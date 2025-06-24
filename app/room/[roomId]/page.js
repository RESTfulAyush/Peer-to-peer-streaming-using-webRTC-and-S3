// /app/room/[roomId]/page.js
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, use } from "react";

export default function RoomPage({ params }) {
  const { roomId } = use(params);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const webSocketRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunkIndexRef = useRef(0);
  const userIdRef = useRef(null);
  const peerLeftRef = useRef(false);
  const router = useRouter();
  const callEndedRef = useRef(false);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3001");
    webSocketRef.current = ws;

    ws.onopen = () => {
      console.log("Connected to signaling server");
      ws.send(JSON.stringify({ type: "join", roomId }));
    };

    ws.onmessage = async (message) => {
      const { type, payload } = JSON.parse(message.data);

      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        if (type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendMessage("answer", answer);
        }

        if (type === "answer" && pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
        }

        if (type === "ice-candidate" && pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(payload));
        }
      } catch (err) {
        console.error("Signaling error:", err);
      }
    };

    initMediaAndPeer();

    return () => {
      sendMessage("peer-left", null);
      webSocketRef.current?.close();
    };
  }, []);

  const sendMessage = (type, payload) => {
    const ws = webSocketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not ready. Queuing message...");
      setTimeout(() => sendMessage(type, payload), 500);
      return;
    }
    ws.send(JSON.stringify({ type, roomId, payload }));
  };

  const initMediaAndPeer = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    mediaStreamRef.current = stream;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    userIdRef.current =
      localStorage.getItem("userId") || Math.random().toString(36).slice(2, 8);
    localStorage.setItem("userId", userIdRef.current);
    chunkIndexRef.current = 0;

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

    setTimeout(async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendMessage("offer", offer);
    }, Math.floor(Math.random() * 1000));

    const waitForRemote = () =>
      new Promise((resolve) => {
        const check = () => {
          if (remoteVideoRef.current?.readyState >= 2) resolve();
          else setTimeout(check, 500);
        };
        check();
      });

    await waitForRemote();

    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");

    const drawFrame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (localVideoRef.current?.readyState >= 2) {
        ctx.drawImage(
          localVideoRef.current,
          0,
          0,
          canvas.width / 2,
          canvas.height
        );
      }
      if (remoteVideoRef.current?.readyState >= 2) {
        ctx.drawImage(
          remoteVideoRef.current,
          canvas.width / 2,
          0,
          canvas.width / 2,
          canvas.height
        );
      }
      requestAnimationFrame(drawFrame);
    };
    drawFrame();

    const mixedStream = canvas.captureStream(25);

    const mediaRecorder = new MediaRecorder(mixedStream, {
      mimeType: "video/webm; codecs=vp8,opus",
      videoBitsPerSecond: 2_500_000,
    });

    mediaRecorder.ondataavailable = async (event) => {
      if (
        callEndedRef.current || // Prevent chunk uploads after end
        !event.data ||
        event.data.size === 0
      ) {
        return;
      }

      const chunk = event.data;
      const userId = userIdRef.current;
      const chunkIndex = chunkIndexRef.current++;

      const key = `recordings/${roomId}/user-${userId}/chunk-${String(
        chunkIndex
      ).padStart(4, "0")}.webm`;

      try {
        const res = await fetch(`/api/upload-url?key=${key}`);
        const { url } = await res.json();

        await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "video/webm" },
          body: chunk,
        });

        console.log(`✅ Uploaded chunk ${chunkIndex} → ${key}`);
      } catch (error) {
        console.error(`❌ Failed to upload chunk ${chunkIndex}`, error);
      }
    };

    mediaRecorder.onstop = async () => {
      console.log("🛑 Mixed recording stopped");
      try {
        const res = await fetch("/api/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId }),
        });
        if (!res.ok) throw new Error("Merge request failed");
        const data = await res.json();
        console.log("✅ Merge complete");
      } catch (err) {
        console.error("❌ Merge failed:", err);
      }
    };

    mediaRecorder.start(2000);
    mediaRecorderRef.current = mediaRecorder;
  };

  const checkIfShouldStop = () => {
    if (
      peerLeftRef.current &&
      mediaRecorderRef.current?.state === "recording"
    ) {
      console.log("⚠️ Peer left, stopping recording...");
      mediaRecorderRef.current.stop();
    }
  };

  const handleEndCall = async () => {
    callEndedRef.current = true;
    router.push("/");
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    // Send peer-left to notify the other user
    sendMessage("peer-left", null);

    try {
      const res = await fetch("/api/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      });

      console.log("merge res:", res);
      if (!res.ok) throw new Error("Merge failed");
      const data = await res.json();

      alert("✅ Video merged and uploaded!");
    } catch (err) {
      console.error("❌ Merge error:", err);
      alert("❌ Merge failed. Please try again.");
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
        onClick={handleEndCall}
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
        📞 End Call
      </button>
    </div>
  );
}
