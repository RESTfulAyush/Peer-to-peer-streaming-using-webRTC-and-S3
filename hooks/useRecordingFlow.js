"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalRecorder } from "@/hooks/useLocalRecorder";

export const useRecordingFlow = ({ socket, roomId, myStream }) => {
  const [uploadConfig, setUploadConfig] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const partsList = useRef([]);
  const partNumberCounter = useRef(1);

  const { startRecording, stopRecording, isRecording, packageNextPart } =
    useLocalRecorder(myStream, roomId);

  /* ---------------- INITIATE MULTIPART ---------------- */

  const initiateS3Recording = useCallback(
    async (serverStartTime) => {
      const res = await fetch("/api/recording/initiate", {
        method: "POST",
        body: JSON.stringify({
          meetingId: roomId,
          userId: socket.id,
        }),
      });

      const data = await res.json();
      if (!data.uploadId) throw new Error("Upload init failed");

      setUploadConfig({ uploadId: data.uploadId, key: data.key });
      partsList.current = [];
      partNumberCounter.current = 1;

      startRecording(serverStartTime);
    },
    [roomId, socket.id, startRecording],
  );

  /* ---------------- UPLOAD ONE PART ---------------- */

  const uploadPart = useCallback(
    async (blob) => {
      if (!uploadConfig) return;

      const partNumber = partNumberCounter.current++;

      const urlRes = await fetch("/api/recording/get-url", {
        method: "POST",
        body: JSON.stringify({
          uploadId: uploadConfig.uploadId,
          key: uploadConfig.key,
          partNumber,
        }),
      });

      const { url } = await urlRes.json();

      const s3Res = await fetch(url, {
        method: "PUT",
        body: blob,
      });

      const etag = s3Res.headers.get("ETag");
      if (etag) {
        partsList.current.push({
          ETag: etag,
          PartNumber: partNumber,
        });
      }
    },
    [uploadConfig],
  );

  /* ---------------- PERIODIC UPLOAD LOOP ---------------- */

  useEffect(() => {
    if (!isRecording || !uploadConfig) return;

    const interval = setInterval(async () => {
      const partBlob = await packageNextPart();
      if (!partBlob) return;

      try {
        setIsUploading(true);
        await uploadPart(partBlob);
      } catch (err) {
        console.error("Chunk upload failed:", err);
        // retry queue could be added here
      } finally {
        setIsUploading(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isRecording, uploadConfig, packageNextPart, uploadPart]);

  /* ---------------- FINALIZE ---------------- */

  const finalizeUpload = useCallback(async () => {
    if (!uploadConfig) return;

    await stopRecording();
    await new Promise((r) => setTimeout(r, 200));

    const finalBlob = await packageNextPart(true);
    if (finalBlob) {
      await uploadPart(finalBlob);
    }

    if (partsList.current.length === 0) return;

    const sortedParts = [...partsList.current].sort(
      (a, b) => a.PartNumber - b.PartNumber,
    );

    await fetch("/api/recording/complete", {
      method: "POST",
      body: JSON.stringify({
        uploadId: uploadConfig.uploadId,
        key: uploadConfig.key,
        parts: sortedParts,
        roomId,
        userId: socket.id,
      }),
    });

    setUploadConfig(null);
  }, [
    uploadConfig,
    stopRecording,
    packageNextPart,
    uploadPart,
    roomId,
    socket.id,
  ]);

  /* ---------------- SOCKET TRIGGERS ---------------- */

  useEffect(() => {
    socket.on("start-recording-trigger", async ({ startTime }) => {
      await initiateS3Recording(startTime);
    });

    socket.on("stop-recording-trigger", async () => {
      await finalizeUpload();
    });

    return () => {
      socket.off("start-recording-trigger");
      socket.off("stop-recording-trigger");
    };
  }, [socket, initiateS3Recording, finalizeUpload]);

  /* ---------------- PUBLIC CONTROLS ---------------- */

  const start = useCallback(() => {
    socket.emit("start-recording-trigger", {
      roomId,
      startTime: Date.now(),
    });
  }, [socket, roomId]);

  const stop = useCallback(() => {
    socket.emit("stop-recording-trigger", { roomId });
  }, [socket, roomId]);

  return {
    isRecording,
    isUploading,
    startRecording: start,
    stopRecording: stop,
  };
};
