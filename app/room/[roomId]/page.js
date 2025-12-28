"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "@/app/providers/Socket";
import { usePeer } from "@/app/providers/Peer";
import {
  Mic,
  Video,
  PhoneOff,
  MoreHorizontal,
  CircleDot,
  Database,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { useLocalRecorder } from "@/hooks/useLocalRecorder";

import RoomInfoCard from "@/app/components/card/page";

const RoomPage = () => {
  const { socket } = useSocket();
  const { peer, createOffer, createAnswer, setRemoteAns } = usePeer();
  const myVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteEmailRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [myStream, setMyStream] = useState(null);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const router = useRouter();
  const [showRoomCard, setShowRoomCard] = useState(true);
  const params = useParams();
  const roomId = params.roomId;
  const [recording, setRecording] = useState(false);

  const {
    startRecording,
    stopRecording,
    bufferSize,
    isRecording,
    packageNextPart,
  } = useLocalRecorder(myStream, roomId);

  useEffect(() => {
    let interval;
    if (isRecording) {
      interval = setInterval(async () => {
        const part = await packageNextPart();
        if (part) {
          console.log(
            ">>> Phase 2 Trigger: Uploading 6MB chunk to S3...",
            part
          );
          // fetch('/api/upload-url', ...)
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isRecording, packageNextPart]);

  const getUserMediaStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      if (myVideoRef.current) {
        myVideoRef.current.srcObject = stream;
        console.log("my stream:", stream);
      }

      setMyStream(stream);

      // Add local tracks to peer connection
      stream.getTracks().forEach((track) => {
        console.log("Adding track:", track.kind);
        peer.addTrack(track, stream);
      });

      setIsReady(true);
      console.log("mic on:", isMicOn);
      socket.emit("ready-to-receive");
    } catch (error) {
      console.error("Error getting user media:", error);
    }
  }, [peer, socket]);

  const newUserJoined = useCallback(
    async ({ emailId }) => {
      console.log("New user joined:", emailId);
      remoteEmailRef.current = emailId;

      const offer = await createOffer();
      console.log("Sending offer to:", emailId);
      socket.emit("call-user", { emailId, offer });
    },
    [createOffer, socket]
  );

  const handleIncomingCall = useCallback(
    async ({ from, offer }) => {
      console.log("Incoming call from:", from);
      remoteEmailRef.current = from;

      const ans = await createAnswer(offer);
      console.log("Sending answer to:", from);
      socket.emit("call-accepted", { emailId: from, ans });
    },
    [createAnswer, socket]
  );

  const handleCallAccepted = useCallback(
    async ({ ans }) => {
      console.log("Call accepted, setting remote answer");
      await setRemoteAns(ans);
    },
    [setRemoteAns]
  );

  useEffect(() => {
    peer.ontrack = (event) => {
      console.log("Received remote track:", event.track.kind);
      const [stream] = event.streams;
      console.log("Remote stream received:", stream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    };

    peer.onconnectionstatechange = () => {
      console.log("Connection state:", peer.connectionState);
    };

    peer.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", peer.iceConnectionState);
    };
  }, [peer]);

  useEffect(() => {
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("Sending ICE candidate to:", remoteEmailRef.current);
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          to: remoteEmailRef.current,
        });
      }
    };

    socket.on("ice-candidate", async ({ candidate }) => {
      console.log("Received ICE candidate");
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
        console.log("ICE candidate added successfully");
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    });

    return () => {
      socket.off("ice-candidate");
    };
  }, [peer, socket]);

  useEffect(() => {
    getUserMediaStream();
  }, [getUserMediaStream]);

  useEffect(() => {
    socket.on("joined-room", ({ roomId }) => {});

    return () => {
      socket.off("joined-room");
    };
  }, [socket]);

  useEffect(() => {
    socket.on("user-joined", newUserJoined);
    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-accepted", handleCallAccepted);

    return () => {
      socket.off("user-joined", newUserJoined);
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-accepted", handleCallAccepted);
    };
  }, [socket, newUserJoined, handleIncomingCall, handleCallAccepted]);

  useEffect(() => {
    // Listen for the "Start" signal from the other peer
    socket.on("start-recording-trigger", ({ startTime }) => {
      console.log("Received remote start signal. Starting local recording...");
      startRecording(startTime);
    });

    // Listen for the "Stop" signal
    socket.on("stop-recording-trigger", () => {
      console.log("Received remote stop signal.");
      stopRecording();
    });

    return () => {
      socket.off("start-recording-trigger");
      socket.off("stop-recording-trigger");
    };
  }, [socket, startRecording, stopRecording]);

  const handleMic = () => {
    if (!peer) return;

    // Find all audio senders (tracks being sent to remote peer)
    const audioSenders = peer
      .getSenders()
      .filter((sender) => sender.track && sender.track.kind === "audio");

    if (audioSenders.length === 0) {
      console.warn("No audio senders found");
      return;
    }

    const newMicState = !isMicOn;
    setIsMicOn(newMicState);

    // Toggle both sender and local stream track (for UI consistency)
    audioSenders.forEach((sender) => {
      sender.track.enabled = newMicState;
    });

    if (myStream) {
      myStream.getAudioTracks().forEach((track) => {
        track.enabled = newMicState;
      });
    }

    console.log(`Microphone ${newMicState ? "unmuted" : "muted"}`);
  };

  const handleVideo = () => {
    if (!peer) return;

    const videoSenders = peer
      .getSenders()
      .filter((sender) => sender.track && sender.track.kind === "video");

    if (videoSenders.length === 0) {
      console.warn("No video senders found");
      return;
    }

    const newVideoState = !isVideoOn;
    setIsVideoOn(newVideoState);

    // Toggle video tracks being sent
    videoSenders.forEach((sender) => {
      sender.track.enabled = newVideoState;
    });

    // Also toggle local preview video
    if (myStream) {
      myStream.getVideoTracks().forEach((track) => {
        track.enabled = newVideoState;
      });
    }

    console.log(`Camera ${newVideoState ? "turned on" : "turned off"}`);
  };

  // const handleEndCall = () => {
  //   if (myStream) {
  //     myStream.getTracks().forEach((track) => {
  //       track.stop();
  //     });
  //     setMyStream(null);
  //   }

  //   if (peer) {
  //     peer.getSenders().forEach((sender) => {
  //       try {
  //         sender.track?.stop();
  //       } catch (err) {}
  //     });
  //     peer.close();
  //     console.log("Peer connection closed");
  //   }

  //   if (remoteEmailRef.current) {
  //     socket.emit("end-call", { to: remoteEmailRef.current });
  //     console.log("End call signal sent to:", remoteEmailRef.current);
  //   }

  //   if (myVideoRef.current) myVideoRef.current.srcObject = null;
  //   if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  //   remoteEmailRef.current = null;
  //   setIsReady(false);
  //   router.push("/");
  //   console.log("Call ended successfully");
  // };

  const handleEndCall = () => {
    if (isRecording) stopRecording(); // Stop recording if user ends call
    if (myStream) myStream.getTracks().forEach((t) => t.stop());
    if (peer) {
      peer.getSenders().forEach((s) => s.track?.stop());
      peer.close();
    }
    if (remoteEmailRef.current)
      socket.emit("end-call", { to: remoteEmailRef.current });
    router.push("/");
  };

  const handleRecording = () => {
    if (!isRecording) {
      const serverTimestamp = Date.now(); // Ideally, get this from server sync

      // 1. Start my own local recorder
      startRecording(serverTimestamp);

      // 2. Tell the other person to start theirs
      socket.emit("start-recording-trigger", {
        roomId,
        startTime: serverTimestamp,
      });
    } else {
      stopRecording();
      socket.emit("stop-recording-trigger", { roomId });
    }
  };

  return (
    <div className="relative w-full h-screen bg-gray-900">
      {/* Remote Video (Full Screen) */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />

      {/* My Video (Picture-in-Picture) */}
      <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden shadow-2xl border-2 border-gray-700">
        <video
          ref={myVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover transform -scale-x-100"
        />
      </div>

      {showRoomCard && (
        <RoomInfoCard roomId={roomId} onClose={() => setShowRoomCard(false)} />
      )}

      {/* Status Bar (Top) */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-50 px-4 py-2 rounded-lg">
        <div className="flex items-center gap-2 text-white text-sm">
          <div
            className={`w-2 h-2 rounded-full ${
              isReady ? "bg-green-500" : "bg-yellow-500"
            }`}
          />
          <span>{isReady ? "Connected" : "Setting up..."}</span>
        </div>
        {remoteEmailRef.current && (
          <div className="text-white text-xs mt-1">
            {remoteEmailRef.current}
          </div>
        )}
      </div>

      {/* Control Bar (Bottom) */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 px-6 py-4 rounded-full flex items-center gap-4">
        {/* Mic Button */}
        <button
          onClick={handleMic}
          className={`w-12 h-12 ${
            isMicOn
              ? "bg-red-700 hover:bg-red-800"
              : "bg-gray-700 hover:bg-gray-600"
          } rounded-full flex items-center justify-center text-white transition`}
        >
          <Mic className="w-6 h-6" />
        </button>

        {/* Video Button */}
        <button
          onClick={handleVideo}
          className={`w-12 h-12 ${
            isVideoOn
              ? "bg-red-700 hover:bg-red-800"
              : "bg-gray-700 hover:bg-gray-600"
          } rounded-full flex items-center justify-center text-white transition`}
        >
          <Video className="w-6 h-6" />
        </button>

        {/* NEW: Record Button */}
        <button
          onClick={handleRecording}
          className={`w-12 h-12 ${
            recording ? "bg-red-600 animate-pulse" : "bg-gray-700"
          } rounded-full flex items-center justify-center text-white transition relative`}
          title={recording ? "Stop Recording" : "Start Recording"}
        >
          <CircleDot
            className={`w-6 h-6 ${recording ? "fill-white" : "text-red-500"}`}
          />
          {recording && (
            <span className="absolute top-2 right-2 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
          )}
        </button>

        {/* Meeting Details Button */}
        <button
          onClick={() => setShowRoomCard(!showRoomCard)}
          className={`w-12 h-12 rounded-full flex items-center justify-center text-white transition hover:bg-gray-600 ${
            showRoomCard ? "bg-violet-600" : "bg-gray-700"
          }`}
          title="Meeting Details"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>

        {/* End Call Button */}
        <button
          onClick={handleEndCall}
          className="w-12 h-12 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center text-white transition"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default RoomPage;
