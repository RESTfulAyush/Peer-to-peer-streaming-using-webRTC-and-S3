import { NextResponse } from "next/server";
import { s3Client, BUCKET_NAME } from "@/lib/s3";
import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";

export async function POST(req) {
  try {
    const { meetingId, userId } = await req.json();

    // Create a unique key: recordings/meeting-123/user-456-timestamp.webm
    const key = `recordings/${meetingId}/${userId}-${Date.now()}.webm`;

    const command = new CreateMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: "video/webm",
    });

    const response = await s3Client.send(command);

    return NextResponse.json({
      uploadId: response.UploadId,
      key: key,
    });
  } catch (error) {
    console.error("S3 Initiate Error:", error);
    return NextResponse.json(
      { error: "Failed to initiate upload" },
      { status: 500 }
    );
  }
}
