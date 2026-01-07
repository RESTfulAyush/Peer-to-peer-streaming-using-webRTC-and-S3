import { s3Client, BUCKET_NAME } from "@/lib/s3";
import {
  CompleteMultipartUploadCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { triggerMediaConvert } from "@/lib/mediaconvert";

async function getS3Json(key) {
  const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
  const response = await s3Client.send(command);
  const str = await response.Body.transformToString();
  return JSON.parse(str);
}

export async function POST(req) {
  try {
    const { uploadId, key, parts, roomId, userId } = await req.json();

    if (!userId || !roomId) {
      console.error("Missing userId or roomId:", { userId, roomId });
      return NextResponse.json(
        { error: "Missing userId or roomId" },
        { status: 400 }
      );
    }

    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    });
    await s3Client.send(completeCommand);

    // 2. Create a "Status File" in S3 to act as our Database
    // We use the userId to make the filename unique
    const statusKey = `recordings/${roomId}/status_${userId}.json`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: statusKey,
        Body: JSON.stringify({
          completed: true,
          videoKey: key,
          userId: userId,
          timestamp: Date.now(),
        }),
        ContentType: "application/json",
      })
    );

    // 3. Check if the OTHER user is finished
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: `recordings/${roomId}/status_`,
    });
    const folderContents = await s3Client.send(listCommand);

    const statusFiles =
      folderContents.Contents?.filter((file) => file.Key.endsWith(".json")) ||
      [];

    if (statusFiles.length === 2) {
      const user1Data = await getS3Json(statusFiles[0].Key);
      const user2Data = await getS3Json(statusFiles[1].Key);

      await triggerMediaConvert(roomId, user1Data.videoKey, user2Data.videoKey);
      return NextResponse.json({
        success: true,
        message: "Merge triggered successfully",
      });
    }

    // If only 1 user is done
    return NextResponse.json({
      success: true,
      message: `User ${userId} finished. Waiting for peer...`,
      location: `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`,
    });
  } catch (error) {
    console.error("Complete Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
