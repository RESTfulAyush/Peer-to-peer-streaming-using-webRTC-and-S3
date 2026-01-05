import {
  MediaConvertClient,
  CreateJobCommand,
} from "@aws-sdk/client-mediaconvert";

const client = new MediaConvertClient({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_MEDIACONVERT_ENDPOINT,
});

export async function triggerMediaConvert(roomId, keyA, keyB) {
  const jobParams = {
    Role: process.env.AWS_MEDIACONVERT_ROLE,
    Settings: {
      OutputGroups: [
        {
          Name: "File Group",
          OutputGroupSettings: {
            Type: "FILE_GROUP_SETTINGS",
            FileGroupSettings: {
              Destination: `s3://${process.env.AWS_BUCKET_NAME}/recordings/${roomId}/final_call`,
            },
          },
          Outputs: [
            {
              ContainerSettings: { Container: "MP4" },
              VideoDescription: {
                Width: 1920,
                Height: 1080,
                CodecSettings: {
                  Codec: "H_264",
                  H264Settings: { Bitrate: 5000000, RateControlMode: "CBR" },
                },
              },
              AudioDescriptions: [
                {
                  AudioSourceName: "Audio Selector 1",
                  CodecSettings: {
                    Codec: "AAC",
                    AacSettings: { Bitrate: 96000, SampleRate: 48000 },
                  },
                },
              ],
            },
          ],
        },
      ],
      Inputs: [
        {
          FileInput: `s3://${process.env.AWS_BUCKET_NAME}/${keyA}`,
          InputClipping: { StartTimecode: "00:00:00:00" },
          VideoSelector: {
            // Position User A on the Left
            CustomOffsets: { Left: 0, Top: 0, Right: 960, Bottom: 0 },
          },
          AudioSelectors: {
            "Audio Selector 1": { DefaultSelection: "DEFAULT" },
          },
        },
        {
          FileInput: `s3://${process.env.AWS_BUCKET_NAME}/${keyB}`,
          // Position User B on the Right
          VideoSelector: {
            CustomOffsets: { Left: 960, Top: 0, Right: 0, Bottom: 0 },
          },
          AudioSelectors: {
            "Audio Selector 1": { DefaultSelection: "DEFAULT" },
          },
        },
      ],
    },
  };

  return client.send(new CreateJobCommand(jobParams));
}
