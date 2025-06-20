import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { pipeline } from "stream";
import { promisify } from "util";
import os from "os";

const pump = promisify(pipeline);

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export async function POST(request) {
  const { roomId } = await request.json();

  if (!roomId) {
    return new Response("Missing roomId", { status: 400 });
  }

  const prefix = `recordings/${roomId}/`;
  const tmpDir = path.join(os.tmpdir(), `merge-${roomId}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  // 1. List chunks
  const { Contents } = await s3.send(
    new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET_NAME,
      Prefix: prefix,
    })
  );

  const chunkKeys = (Contents || [])
    .map((obj) => obj.Key)
    .filter((key) => key.endsWith(".webm"))
    .sort();

  if (!chunkKeys.length) {
    return new Response("No chunks found", { status: 404 });
  }

  // 2. Download chunks locally
  const listPath = path.join(tmpDir, "chunks.txt");
  const writeList = fs.createWriteStream(listPath);

  for (const key of chunkKeys) {
    const fileName = path.basename(key);
    const filePath = path.join(tmpDir, fileName);

    const { Body } = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
      })
    );

    await pump(Body, fs.createWriteStream(filePath));
    writeList.write(`file '${fileName}'\n`);
  }

  writeList.end();

  // 3. Merge chunks using FFmpeg
  const outputPath = path.join(tmpDir, "final.webm");

  await new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      outputPath,
    ]);

    ffmpeg.stderr.on("data", (data) => {
      console.error(data.toString());
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
  });

  // 4. Upload merged file back to S3
  const finalKey = `${prefix}final.webm`;

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: finalKey,
      Body: fs.createReadStream(outputPath),
      ContentType: "video/webm",
    })
  );

  return new Response(
    JSON.stringify({ message: "Merged successfully", key: finalKey }),
    {
      status: 200,
    }
  );
}
