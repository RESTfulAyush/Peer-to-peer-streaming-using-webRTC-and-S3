"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "@/app/providers/Socket";
import { usePeer } from "@/app/providers/Peer";
import { Mic, Video, PhoneOff, MoreHorizontal, CircleDot } from "lucide-react";
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
  // const [recording, setRecording] = useState(false);
  const [uploadConfig, setUploadConfig] = useState(null);
  const partsList = useRef([]);
  const partNumberCounter = useRef(1);
  const [isUploading, setIsUploading] = useState(false);

  const {
    startRecording,
    stopRecording,
    bufferSize,
    isRecording,
    packageNextPart,
  } = useLocalRecorder(myStream, roomId);

  const initiateS3Recording = useCallback(
    async (serverStartTime) => {
      try {
        const userId = socket.id;
        const res = await fetch("/api/recording/initiate", {
          method: "POST",
          body: JSON.stringify({ meetingId: roomId, userId: userId }),
        });
        const data = await res.json();

        if (data.uploadId) {
          setUploadConfig({ uploadId: data.uploadId, key: data.key });
          partsList.current = [];
          partNumberCounter.current = 1;
          startRecording(serverStartTime);
          return true;
        }
      } catch (err) {
        console.error("Failed to initiate S3 recording:", err);
        return false;
      }
    },
    [socket.id, roomId, startRecording]
  );

  const handleStopAndFinalize = useCallback(async () => {
    if (!uploadConfig) return;

    try {
      setIsUploading(true);

      // Wait for MediaRecorder to fully stop and flush all data
      await stopRecording();

      // Small additional buffer to ensure IndexedDB writes complete
      // This is much safer than the 800ms guess
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Now package the remaining data from IndexedDB
      const finalBlob = await packageNextPart(true);

      if (finalBlob) {
        const currentPartNumber = partNumberCounter.current;
        partNumberCounter.current += 1;

        // Get Presigned URL for the last part
        const urlRes = await fetch("/api/recording/get-url", {
          method: "POST",
          body: JSON.stringify({
            uploadId: uploadConfig.uploadId,
            key: uploadConfig.key,
            partNumber: currentPartNumber,
          }),
        });

        if (!urlRes.ok) throw new Error("Failed to get final part URL");
        const { url } = await urlRes.json();

        // Upload final Blob to S3
        const s3Res = await fetch(url, { method: "PUT", body: finalBlob });
        const etag = s3Res.headers.get("ETag");

        if (etag) {
          partsList.current.push({
            ETag: etag,
            PartNumber: currentPartNumber,
          });
        }
      }

      // Complete the Multipart Upload
      if (partsList.current.length > 0) {
        const sortedParts = [...partsList.current].sort(
          (a, b) => a.PartNumber - b.PartNumber
        );

        const completeRes = await fetch("/api/recording/complete", {
          method: "POST",
          body: JSON.stringify({
            uploadId: uploadConfig.uploadId,
            key: uploadConfig.key,
            parts: sortedParts,
            roomId: roomId,
            userId: socket.id,
          }),
        });

        if (!completeRes.ok) throw new Error("Failed to complete S3 assembly");
      } else {
        console.warn("No parts were uploaded. Nothing to complete.");
      }
    } catch (err) {
      console.error("Recording finalization failed:", err);
      alert("There was an error saving your recording.");
    } finally {
      // Cleanup state
      setUploadConfig(null);
      setIsUploading(false);
    }
  }, [uploadConfig, roomId, socket.id, packageNextPart, stopRecording]);

  useEffect(() => {
    let interval;
    if (isRecording && uploadConfig) {
      interval = setInterval(async () => {
        // 1. Check if we have a 6MB chunk ready in IndexedDB
        const partBlob = await packageNextPart();

        if (partBlob) {
          try {
            setIsUploading(true);
            const currentPartNumber = partNumberCounter.current;
            partNumberCounter.current += 1;

            // 2. Get Presigned URL from Backend
            const urlRes = await fetch("/api/recording/get-url", {
              method: "POST",
              body: JSON.stringify({
                uploadId: uploadConfig.uploadId,
                key: uploadConfig.key,
                partNumber: currentPartNumber,
              }),
            });
            const { url } = await urlRes.json();

            // 3. Upload Blob directly to S3
            const s3Res = await fetch(url, {
              method: "PUT",
              body: partBlob,
            });

            // 4. Capture ETag from Headers (CRITICAL)
            const etag = s3Res.headers.get("ETag");
            if (etag) {
              partsList.current.push({
                ETag: etag,
                PartNumber: currentPartNumber,
              });
            }
          } catch (err) {
            console.error("Chunk upload failed:", err);
            //put the chunk back in a retry queue here (later)
          } finally {
            setIsUploading(false);
          }
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isRecording, uploadConfig, packageNextPart]);

  const getUserMediaStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      if (myVideoRef.current) {
        myVideoRef.current.srcObject = stream;
      }

      setMyStream(stream);

      // Add local tracks to peer connection
      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });

      setIsReady(true);
      socket.emit("ready-to-receive");
    } catch (error) {
      console.error("Error getting user media:", error);
    }
  }, [peer, socket]);

  const newUserJoined = useCallback(
    async ({ emailId }) => {
      remoteEmailRef.current = emailId;

      const offer = await createOffer();
      socket.emit("call-user", { emailId, offer });
    },
    [createOffer, socket]
  );

  const handleIncomingCall = useCallback(
    async ({ from, offer }) => {
      remoteEmailRef.current = from;

      const ans = await createAnswer(offer);
      socket.emit("call-accepted", { emailId: from, ans });
    },
    [createAnswer, socket]
  );

  const handleCallAccepted = useCallback(
    async ({ ans }) => {
      await setRemoteAns(ans);
    },
    [setRemoteAns]
  );

  useEffect(() => {
    peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    };
  }, [peer]);

  useEffect(() => {
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          to: remoteEmailRef.current,
        });
      }
    };

    socket.on("ice-candidate", async ({ candidate }) => {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
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
    socket.on("start-recording-trigger", async ({ startTime }) => {
      // BOTH users initiate from the socket event
      await initiateS3Recording(startTime);
    });

    socket.on("stop-recording-trigger", async () => {
      await handleStopAndFinalize();
    });

    return () => {
      socket.off("start-recording-trigger");
      socket.off("stop-recording-trigger");
    };
  }, [socket, roomId, initiateS3Recording, handleStopAndFinalize]);

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
  };

  const handleEndCall = async () => {
    if (isRecording) {
      socket.emit("stop-recording-trigger", { roomId });
      await handleStopAndFinalize();
    }

    if (myStream) myStream.getTracks().forEach((t) => t.stop());
    if (peer) {
      peer.getSenders().forEach((s) => s.track?.stop());
      peer.close();
    }
    if (remoteEmailRef.current)
      socket.emit("end-call", { to: remoteEmailRef.current });
    router.push("/");
  };

  const handleRecording = async () => {
    if (!isRecording) {
      const serverTimestamp = Date.now();

      // ONLY emit, don't initiate locally
      socket.emit("start-recording-trigger", {
        roomId,
        startTime: serverTimestamp,
      });
    } else {
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

        {/* Record Button */}
        <button
          onClick={handleRecording}
          className={`w-12 h-12 ${
            isRecording ? "bg-red-600 animate-pulse" : "bg-gray-700"
          } rounded-full flex items-center justify-center text-white transition relative`}
          title={isRecording ? "Stop Recording" : "Start Recording"}
        >
          <CircleDot
            className={`w-6 h-6 ${isRecording ? "fill-white" : "text-red-500"}`}
          />
          {isRecording && (
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
