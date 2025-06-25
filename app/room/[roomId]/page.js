// /app/room/[roomId]/page.js
"use client";

import { useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";

export default function RoomPage({ params }) {
  const { roomId } = use(params); // Get roomId from the URL
  const router = useRouter();

  // Refs to store various resources
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const webSocketRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunkIndexRef = useRef(0);
  const userIdRef = useRef(null);
  const peerLeftRef = useRef(false);
  const callEndedRef = useRef(false);

  // Runs once on component mount
  useEffect(() => {
    // Connect to signaling server via WebSocket
    const ws = new WebSocket("ws://localhost:3001");
    webSocketRef.current = ws;

    // On WebSocket open, join the room
    ws.onopen = () => {
      console.log("✅ Connected to signaling server");
      ws.send(JSON.stringify({ type: "join", roomId }));
    };

    // Handle incoming signaling messages
    ws.onmessage = async (message) => {
      const { type, payload } = JSON.parse(message.data);
      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        if (type === "offer") {
          // Handle offer from remote
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendMessage("answer", answer);
        }

        if (type === "answer" && pc.signalingState === "have-local-offer") {
          // Set answer from remote
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
        }

        if (type === "ice-candidate" && pc.remoteDescription) {
          // Add ICE candidate from remote
          await pc.addIceCandidate(new RTCIceCandidate(payload));
        }

        if (type === "peer-left") {
          // Mark that the other peer has left
          peerLeftRef.current = true;
          checkIfShouldStop();
        }
      } catch (err) {
        console.error("❌ Signaling error:", err);
      }
    };

    // Initialize media and WebRTC peer connection
    initMediaAndPeer();

    // Cleanup on unmount
    return () => {
      sendMessage("peer-left", null);
      webSocketRef.current?.close();
    };
  }, []);

  // Send a signaling message via WebSocket
  const sendMessage = (type, payload) => {
    const ws = webSocketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("⚠️ WebSocket not ready. Retrying...");
      setTimeout(() => sendMessage(type, payload), 500);
      return;
    }
    ws.send(JSON.stringify({ type, roomId, payload }));
  };

  // Capture local media and initialize WebRTC connection
  const initMediaAndPeer = async () => {
    // Request access to camera and mic
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    mediaStreamRef.current = stream;

    // Show local stream in UI
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    // Assign or generate user ID
    userIdRef.current =
      localStorage.getItem("userId") || Math.random().toString(36).slice(2, 8);
    localStorage.setItem("userId", userIdRef.current);
    chunkIndexRef.current = 0;

    // Create WebRTC peer connection
    const pc = new RTCPeerConnection();
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    // Send ICE candidates to remote peer
    pc.onicecandidate = (event) => {
      if (event.candidate) sendMessage("ice-candidate", event.candidate);
    };

    // When remote track is received, show in UI
    pc.ontrack = (event) => {
      if (remoteVideoRef.current)
        remoteVideoRef.current.srcObject = event.streams[0];
    };

    peerConnectionRef.current = pc;

    // Create and send offer after random delay (to avoid collision)
    setTimeout(async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendMessage("offer", offer);
    }, Math.random() * 1000);

    // Wait until remote video is playing
    await waitForRemoteVideo();

    // Start capturing a mixed stream of local+remote using canvas
    startMixedRecording();
  };

  // Wait until remote video is ready (playing)
  const waitForRemoteVideo = () =>
    new Promise((resolve) => {
      const check = () => {
        if (remoteVideoRef.current?.readyState >= 2) resolve();
        else setTimeout(check, 500);
      };
      check();
    });

  // Capture a combined stream of local + remote using a canvas
  const startMixedRecording = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");

    // Continuously draw local and remote video onto the canvas
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

    const mixedStream = canvas.captureStream(25); // 25 fps

    // Record mixed stream in chunks
    const mediaRecorder = new MediaRecorder(mixedStream, {
      mimeType: "video/webm; codecs=vp8,opus",
      videoBitsPerSecond: 2_500_000,
    });

    // On each chunk, upload it to S3 via pre-signed URL
    mediaRecorder.ondataavailable = async (event) => {
      if (callEndedRef.current || !event.data || event.data.size === 0) return;

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

    // On recording stop, trigger video merge
    mediaRecorder.onstop = async () => {
      console.log("🛑 Mixed recording stopped");
      try {
        const res = await fetch("/api/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId }),
        });
        if (!res.ok) throw new Error("Merge failed");
        const data = await res.json();
        console.log("✅ Merge complete:", data);
      } catch (err) {
        console.error("❌ Merge failed:", err);
      }
    };

    mediaRecorder.start(2000); // Record in 2-second chunks
    mediaRecorderRef.current = mediaRecorder;
  };

  // Stop recording if the other peer has left
  const checkIfShouldStop = () => {
    if (
      peerLeftRef.current &&
      mediaRecorderRef.current?.state === "recording"
    ) {
      console.log("⚠️ Peer left, stopping recording...");
      mediaRecorderRef.current.stop();
    }
  };

  // Handle manual call end by user
  const handleEndCall = async () => {
    callEndedRef.current = true;

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    sendMessage("peer-left", null); // Notify other peer
    router.push("/"); // Navigate back to home

    // Attempt to merge chunks
    try {
      const res = await fetch("/api/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
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

      {/* Video preview section */}
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

      {/* End call button */}
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
