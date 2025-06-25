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
  try {
    const { roomId } = await request.json();
    if (!roomId) {
      return new Response("Missing roomId", { status: 400 });
    }

    const lockFilePath = path.join(os.tmpdir(), `merge-${roomId}.lock`);
    if (fs.existsSync(lockFilePath)) {
      console.log("⛔ Merge already triggered for", roomId);
      return new Response(JSON.stringify({ message: "Already merged" }), {
        status: 200,
      });
    }
    fs.writeFileSync(lockFilePath, "locked");

    const prefix = `recordings/${roomId}/`;
    const tmpDir = path.join(os.tmpdir(), `merge-${roomId}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const { Contents } = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.S3_BUCKET_NAME,
        Prefix: prefix,
      })
    );

    const chunkKeys = (Contents || [])
      .map((obj) => obj.Key)
      .filter((key) => key.endsWith(".webm") && key.includes("user-"));

    if (!chunkKeys.length) {
      throw new Error("No .webm chunks found for room " + roomId);
    }

    // Group by user
    const userChunks = new Map();
    for (const key of chunkKeys) {
      const parts = key.split("/");
      const userFolder = parts[2];
      if (!userChunks.has(userFolder)) userChunks.set(userFolder, []);
      userChunks.get(userFolder).push(key);
    }

    // Pick user with most chunks
    const [selectedUser, selectedKeys] = [...userChunks.entries()].sort(
      (a, b) => b[1].length - a[1].length
    )[0];

    selectedKeys.sort();
    console.log(
      `🧩 Merging from user: ${selectedUser} (${selectedKeys.length} chunks)`
    );

    // Download
    const listPath = path.join(tmpDir, "chunks.txt");
    const writeList = fs.createWriteStream(listPath);

    for (const key of selectedKeys) {
      const fileName = path.basename(key);
      const filePath = path.join(tmpDir, fileName);

      try {
        const { Body } = await s3.send(
          new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
          })
        );

        await pump(Body, fs.createWriteStream(filePath));
        writeList.write(`file '${fileName}'\n`);
        console.log(`✅ Downloaded ${fileName}`);
      } catch (err) {
        console.error(`❌ Failed to download ${key}`, err);
        throw err;
      }
    }

    writeList.end();

    // Merge
    const outputPath = path.join(tmpDir, "final.webm");

    await new Promise((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listPath,
        "-c:v",
        "libvpx",
        "-c:a",
        "libopus",
        "-b:v",
        "2M",
        outputPath,
      ]);

      ffmpeg.stderr.on("data", (data) => {
        console.error("[ffmpeg]", data.toString());
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          console.log("✅ FFmpeg merge success");
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });
    });

    const finalKey = `${prefix}final.webm`;
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: finalKey,
        Body: fs.createReadStream(outputPath),
        ContentType: "video/webm",
      })
    );

    console.log("✅ Uploaded merged final.webm to S3");

    return new Response(
      JSON.stringify({ message: "Merged successfully", key: finalKey }),
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Merge failed:", error);
    return new Response(
      JSON.stringify({ message: "Merge failed", error: error.message }),
      { status: 500 }
    );
  }
}
