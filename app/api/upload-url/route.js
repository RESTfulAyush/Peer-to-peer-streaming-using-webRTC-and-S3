// Import AWS S3 client and signing utilities
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Initialize AWS S3 client with credentials and region
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// GET handler to generate a pre-signed URL for uploading video chunks
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  // Validate that key exists
  if (!key) {
    return new Response(JSON.stringify({ error: "Missing key" }), {
      status: 400,
    });
  }

  // Create a PutObjectCommand for uploading to S3 with the given key
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    ContentType: "video/webm",
  });

  // Generate a signed URL valid for 60 seconds
  const url = await getSignedUrl(s3, command, { expiresIn: 60 });

  // Return the URL in the response
  return new Response(JSON.stringify({ url }), { status: 200 });
}
