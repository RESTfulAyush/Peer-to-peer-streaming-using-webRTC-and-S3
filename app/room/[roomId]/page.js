"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "@/app/providers/Socket";
import { usePeer } from "@/app/providers/Peer";

const RoomPage = () => {
  const { socket } = useSocket();
  const { peer, createOffer, createAnswer, setRemoteAns } = usePeer();
  const [myStream, setMyStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const myVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteEmailRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  const getUserMediaStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setMyStream(stream);
      if (myVideoRef.current) {
        myVideoRef.current.srcObject = stream;
        console.log("my stream:", stream);
      }
      // Add local tracks to peer connection
      stream.getTracks().forEach((track) => {
        console.log("Adding track:", track.kind);
        peer.addTrack(track, stream);
      });

      // Signal that we're ready to receive messages
      setIsReady(true);
      socket.emit("ready-to-receive");
    } catch (error) {
      console.error("Error getting user media:", error);
    }
  }, [peer, socket]);

  const newUserJoined = useCallback(
    async ({ emailId }) => {
      console.log("New user joined:", emailId);
      remoteEmailRef.current = emailId; // ✅ Store remote user's email

      const offer = await createOffer();
      console.log("Sending offer to:", emailId);
      socket.emit("call-user", { emailId, offer });
    },
    [createOffer, socket]
  );

  const handleIncomingCall = useCallback(
    async ({ from, offer }) => {
      console.log("Incoming call from:", from);
      remoteEmailRef.current = from; // ✅ Store remote user's email

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

  // ✅ Handle remote stream
  useEffect(() => {
    peer.ontrack = (event) => {
      console.log("Received remote track:", event.track.kind);
      const [stream] = event.streams;
      console.log("Remote stream received:", stream);
      setRemoteStream(stream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    };

    // Monitor connection state
    peer.onconnectionstatechange = () => {
      console.log("Connection state:", peer.connectionState);
    };

    peer.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", peer.iceConnectionState);
    };
  }, [peer]);

  // ✅ ICE candidate exchange
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
    socket.on("joined-room", ({ roomId }) => {
      console.log("✅ Successfully joined room:", roomId);
    });

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

  return (
    <div>
      <h1>This is a Room</h1>
      <div>Status: {isReady ? "Ready" : "Setting up..."}</div>
      <div>Remote Email: {remoteEmailRef.current || "Waiting for peer..."}</div>
      <div style={{ display: "flex", gap: "10px" }}>
        <div>
          <h3>My Video</h3>
          <video ref={myVideoRef} autoPlay playsInline muted width={300} />
        </div>
        <div>
          <h3>Remote Video</h3>
          <video ref={remoteVideoRef} autoPlay playsInline width={300} />
        </div>
      </div>
    </div>
  );
};

export default RoomPage;
