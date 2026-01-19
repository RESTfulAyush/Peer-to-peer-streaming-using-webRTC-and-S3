import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { spawnSync } from "child_process";
import { writeFileSync, readFileSync, unlinkSync } from "fs";
import { Readable } from "stream";

const s3Client = new S3Client({ region: process.env.AWS_REGION });

async function downloadFromS3(bucket, key, localPath) {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3Client.send(command);

  // Convert stream to buffer
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  writeFileSync(localPath, buffer);
  console.log(`Downloaded ${key} to ${localPath}`);
}

async function uploadToS3(bucket, key, localPath) {
  const fileContent = readFileSync(localPath);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fileContent,
    ContentType: "video/mp4",
  });

  await s3Client.send(command);
  console.log(`Uploaded to ${key}`);
}

export async function handler(event) {
  const { roomId, video1Key, video2Key, bucketName } = event;

  console.log("Starting video merge", { roomId, video1Key, video2Key });

  const video1Path = "/tmp/video1.webm";
  const video2Path = "/tmp/video2.webm";
  const outputPath = "/tmp/merged.mp4";

  try {
    // 1. Download both videos
    await downloadFromS3(bucketName, video1Key, video1Path);
    await downloadFromS3(bucketName, video2Key, video2Path);

    // 2. Run FFmpeg to merge side-by-side
    console.log("Running FFmpeg...");
    const ffmpegResult = spawnSync(
      "/opt/bin/ffmpeg",
      [
        "-i",
        video1Path,
        "-i",
        video2Path,
        "-filter_complex",
        "[0:v]scale=960:1080[left]; [1:v]scale=960:1080[right]; [left][right]hstack=inputs=2[v]; [0:a][1:a]amix=inputs=2:duration=longest[a]",
        "-map",
        "[v]",
        "-map",
        "[a]",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-y", // Overwrite output
        outputPath,
      ],
      { encoding: "utf-8" }
    );

    if (ffmpegResult.error) {
      throw new Error(`FFmpeg error: ${ffmpegResult.error}`);
    }

    console.log("FFmpeg stdout:", ffmpegResult.stdout);
    console.log("FFmpeg stderr:", ffmpegResult.stderr);

    if (ffmpegResult.status !== 0) {
      throw new Error(`FFmpeg exited with code ${ffmpegResult.status}`);
    }

    // 3. Upload merged video
    const outputKey = `recordings/${roomId}/merged.mp4`;
    await uploadToS3(bucketName, outputKey, outputPath);

    // 4. Cleanup
    unlinkSync(video1Path);
    unlinkSync(video2Path);
    unlinkSync(outputPath);

    console.log("Merge completed successfully");

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        outputKey: outputKey,
        url: `https://${bucketName}.s3.amazonaws.com/${outputKey}`,
      }),
    };
  } catch (error) {
    console.error("Merge failed:", error);
    throw error;
  }
}
