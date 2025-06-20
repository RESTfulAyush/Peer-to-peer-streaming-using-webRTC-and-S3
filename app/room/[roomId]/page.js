"use client";

import { useEffect, useRef, useState } from "react";

export default function RoomPage({ params }) {
  const roomId = params.roomId;
  const localVideoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [chunks, setChunks] = useState([]);

  // 1. Get camera/mic on load
  useEffect(() => {
    async function getMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        mediaStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing media devices:", error);
      }
    }

    getMedia();
  }, []);

  // 2. Start Recording
  const startRecording = () => {
    const stream = mediaStreamRef.current;
    if (!stream) return;

    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;
    setChunks([]);

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        setChunks((prev) => [...prev, event.data]);
        console.log("Chunk captured:", event.data);
        // TODO: Upload this chunk to S3 using fetch to `/api/upload-url`
      }
    };

    recorder.start(5000); // Record in 5-second chunks
    setIsRecording(true);
    console.log("Recording started");
  };

  // 3. Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log("Recording stopped");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Room: {roomId}</h1>
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: "100%",
          maxWidth: 600,
          borderRadius: 8,
          border: "2px solid #ccc",
        }}
      />

      <div style={{ marginTop: 20 }}>
        {!isRecording ? (
          <button onClick={startRecording}>▶️ Start Recording</button>
        ) : (
          <button onClick={stopRecording}>⏹️ Stop Recording</button>
        )}
      </div>
    </div>
  );
}
