import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || "us-east-1",
});

export async function triggerMediaConvert(roomId, video1Key, video2Key) {
  console.log("Triggering Lambda merge", { roomId, video1Key, video2Key });

  const payload = {
    roomId,
    video1Key,
    video2Key,
    bucketName: process.env.AWS_BUCKET_NAME,
  };

  console.log("triggerMediaConvert, payload:", payload);

  try {
    const command = new InvokeCommand({
      FunctionName: "duocast-video-merger",
      InvocationType: "Event",
      Payload: JSON.stringify(payload),
    });

    const response = await lambdaClient.send(command);

    console.log("Lambda invoked successfully", response);
    return { success: true, lambdaInvoked: true };
  } catch (error) {
    console.error("Lambda invocation failed:", error);
    throw error;
  }
}
