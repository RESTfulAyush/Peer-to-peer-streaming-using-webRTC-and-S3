"use client";

import { useEffect, useRef } from "react";

export default function RoomPage({ params }) {
  const roomId = params.roomId;
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const webSocketRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunkIndexRef = useRef(0); // for tracking chunk order
  const userIdRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3001");
    webSocketRef.current = ws;

    ws.onopen = () => {
      console.log("Connected to signaling server");
    };

    ws.onmessage = async (message) => {
      const { type, payload } = JSON.parse(message.data);
      if (!peerConnectionRef.current) return;

      switch (type) {
        case "offer":
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(payload)
          );
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          sendMessage("answer", answer);
          break;

        case "answer":
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(payload)
          );
          break;

        case "ice-candidate":
          try {
            await peerConnectionRef.current.addIceCandidate(payload);
          } catch (e) {
            console.error("Error adding received ice candidate", e);
          }
          break;
      }
    };

    initMediaAndPeer();

    return () => {
      ws.close();
    };
  }, []);

  const sendMessage = (type, payload) => {
    webSocketRef.current?.send(JSON.stringify({ type, roomId, payload }));
  };

  const uploadChunkToS3 = async (blob, index) => {
    const fileName = `chunk_${String(index).padStart(4, "0")}.webm`;
    const key = `recordings/${roomId}/${fileName}`;

    try {
      const res = await fetch(`/api/upload-url?key=${key}`);
      const { url } = await res.json();

      await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "video/webm",
        },
        body: blob,
      });

      console.log(`✅ Uploaded: ${fileName}`);
    } catch (err) {
      console.error("❌ Upload failed:", err);
    }
  };

  const initMediaAndPeer = async () => {
    // 1. Get camera and mic
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    mediaStreamRef.current = stream;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    // 2. Setup userId and chunk index
    userIdRef.current =
      localStorage.getItem("userId") || Math.random().toString(36).slice(2, 8);
    localStorage.setItem("userId", userIdRef.current);

    chunkIndexRef.current = 0;

    // 3. Setup MediaRecorder for chunked recording
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: "video/webm; codecs=vp8,opus",
      videoBitsPerSecond: 2_500_000,
    });

    mediaRecorder.onstart = () => {
      console.log("🎥 Recording started");
    };

    mediaRecorder.ondataavailable = async (event) => {
      if (event.data && event.data.size > 0) {
        const chunk = event.data;
        const userId = userIdRef.current;
        const chunkIndex = chunkIndexRef.current++;

        const key = `recordings/${roomId}/user-${userId}/chunk-${String(
          chunkIndex
        ).padStart(4, "0")}.webm`;

        try {
          // 1. Request presigned URL
          const res = await fetch(`/api/upload-url?key=${key}`);
          const { url } = await res.json();

          // 2. Upload chunk
          await fetch(url, {
            method: "PUT",
            headers: {
              "Content-Type": "video/webm",
            },
            body: chunk,
          });

          console.log(`✅ Uploaded chunk ${chunkIndex} → ${key}`);
        } catch (error) {
          console.error(`❌ Failed to upload chunk ${chunkIndex}`, error);
        }
      }
    };

    mediaRecorder.onstop = () => {
      console.log("🛑 Recording stopped — no more chunks will be sent.");
    };

    mediaRecorder.start(2000); // ⏱️ 2-second chunks
    mediaRecorderRef.current = mediaRecorder;

    // 4. Setup WebRTC peer connection
    const pc = new RTCPeerConnection();

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage("ice-candidate", event.candidate);
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    peerConnectionRef.current = pc;

    // 5. Delay offer creation randomly
    setTimeout(async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendMessage("offer", offer);
    }, Math.floor(Math.random() * 1000));
  };

  const stopRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      console.log("🛑 Stopping MediaRecorder...");
      recorder.stop();

      // ✅ Wait a short time to ensure last chunks upload
      setTimeout(async () => {
        try {
          console.log("📡 Triggering server-side merge...");

          const res = await fetch("/api/merge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId }),
          });

          if (!res.ok) throw new Error("Merge request failed");

          const data = await res.json();
          console.log("✅ Merge complete:", data);

          const finalUrl = `https://${process.env.NEXT_PUBLIC_S3_BUCKET}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${data.key}`;

          alert("🎉 Recording merged successfully!");
          window.open(finalUrl, "_blank"); // Optional: open the final video
        } catch (err) {
          console.error("❌ Merge failed:", err);
          alert("⚠️ Failed to merge the video. Please try again.");
        }
      }, 2000); // wait 2s to ensure final chunk is uploaded
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Room: {roomId}</h1>
      <div style={{ display: "flex", gap: 20 }}>
        <div>
          <h3>🎥 Local</h3>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{ width: 300, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </div>
        <div>
          <h3>👥 Remote</h3>
          <video
            ref={remoteVideoRef}
            autoPlay
            muted
            playsInline
            style={{ width: 300, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </div>
      </div>

      <button
        onClick={stopRecording}
        style={{
          marginTop: 20,
          padding: "10px 20px",
          backgroundColor: "#d33",
          color: "white",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        🔴 Stop Recording
      </button>
    </div>
  );
}
