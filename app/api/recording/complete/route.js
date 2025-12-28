import { NextResponse } from "next/server";
import { s3Client, BUCKET_NAME } from "@/lib/s3";
import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";

export async function POST(req) {
  try {
    const { uploadId, key, parts } = await req.json();

    // 'parts' must be: [{ ETag: "...", PartNumber: 1 }, ...]
    const command = new CompleteMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
      },
    });

    await s3Client.send(command);

    return NextResponse.json({
      success: true,
      location: `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`,
    });
  } catch (error) {
    console.error("S3 Completion Error:", error);
    return NextResponse.json(
      { error: "Failed to complete upload" },
      { status: 500 }
    );
  }
}
