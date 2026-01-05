import { useRef, useState, useEffect, useCallback } from "react";
import { recordingDb } from "../lib/db";

export const useLocalRecorder = (stream, meetingId) => {
  const mediaRecorderRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [bufferSize, setBufferSize] = useState(0);
  const [startTime, setStartTime] = useState(null);

  // Calculate total bytes in IndexedDB
  const updateBufferSize = useCallback(async () => {
    const allChunks = await recordingDb.getAll();
    const total = allChunks.reduce((acc, curr) => acc + curr.blob.size, 0);
    setBufferSize(total);
    return total;
  }, []);

  // Package blobs into a "Chapter" (Min 6MB for S3)
  const packageNextPart = useCallback(
    async (isFinal = false) => {
      const minSize = 6 * 1024 * 1024; // 6MB
      const allChunks = await recordingDb.getAll();

      if (allChunks.length === 0) return null;

      let currentSize = 0;
      const chunksToProcess = [];

      for (const chunk of allChunks) {
        chunksToProcess.push(chunk);
        currentSize += chunk.blob.size;
        // If we hit 6MB, or if it's the final part, we stop gathering
        if (!isFinal && currentSize >= minSize) break;
      }

      // Only package if we hit the limit or it's the final stop
      if (isFinal || currentSize >= minSize) {
        const blobPart = new Blob(
          chunksToProcess.map((c) => c.blob),
          { type: "video/webm" }
        );
        const idsToDelete = chunksToProcess.map((c) => c.id);

        await recordingDb.deleteChunk(idsToDelete);
        await updateBufferSize();

        console.log(
          `Packaged ${isFinal ? "Final" : "Part"}: ${(
            currentSize /
            1024 /
            1024
          ).toFixed(2)} MB`
        );
        return blobPart;
      }

      return null;
    },
    [updateBufferSize]
  );

  const startRecording = async (serverStartTime) => {
    if (!stream) return;

    await recordingDb.clearAll();
    setStartTime(serverStartTime);

    const options = { mimeType: "video/webm;codecs=vp8,opus" };
    const recorder = new MediaRecorder(stream, options);

    recorder.ondataavailable = async (event) => {
      if (event.data && event.data.size > 0) {
        await recordingDb.addChunk(event.data);
        await updateBufferSize();
      }
    };

    // Request data every 1 second (1000ms)
    recorder.start(1000);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return {
    startRecording,
    stopRecording,
    packageNextPart,
    isRecording,
    bufferSize,
    startTime,
  };
};
