"use client";

import React, { useCallback, useEffect } from "react";
import { useSocket } from "@/app/providers/Socket";
import { usePeer } from "@/app/providers/Peer";

const RoomPage = () => {
  const { socket } = useSocket();
  const { peer, createOffer } = usePeer();

  // ✅ Corrected: "useeCallback" → "useCallback"
  const newUserJoined = useCallback(
    async (data) => {
      const { emailId } = data;
      console.log("🟢 New user joined:", emailId);

      try {
        // Create WebRTC offer
        const offer = await createOffer();

        // Emit event via socket
        socket.emit("call-user", { emailId, offer });
        console.log("📤 Sent call offer to:", emailId);
      } catch (err) {
        console.error("❌ Error creating offer:", err);
      }
    },
    [createOffer, socket]
  );

  // Handle incoming call
  const handleIncomingCall = useCallback(
    async (data) => {
      const { from, offer } = data;
      console.log("helooooo");
      console.log("📞 Incoming call from:", from, offer);

      try {
        // You’ll handle the answer creation here soon
        // Example (once implemented):
        // await peer.setRemoteDescription(offer);
        // const answer = await peer.createAnswer();
        // await peer.setLocalDescription(answer);
        // socket.emit("call-accepted", { emailId: from, answer });
      } catch (err) {
        console.error("❌ Error handling incoming call:", err);
      }
    },
    [peer, socket]
  );

  // Setup socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on("user-joined", newUserJoined);
    socket.on("incoming-call", handleIncomingCall);

    // ✅ Cleanup to prevent duplicate event listeners
    return () => {
      socket.off("user-joined", newUserJoined);
      socket.off("incoming-call", handleIncomingCall);
    };
  }, [socket, newUserJoined, handleIncomingCall]);

  return <div>hello this is Room</div>;
};

export default RoomPage;
