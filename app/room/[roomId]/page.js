"use client";

import React, { useCallback, useEffect } from "react";
import { useSocket } from "@/app/providers/Socket";
import { usePeer } from "@/app/providers/Peer";

const RoomPage = () => {
  const { socket } = useSocket();
  const { peer, createOffer, createAnswer, setRemoteAns } = usePeer();

  const newUserJoined = useCallback(
    async (data) => {
      const { emailId } = data;
      console.log("New user joined:", emailId);
      try {
        const offer = await createOffer();
        socket.emit("call-user", { emailId, offer });
        console.log("Sent call offer to:", emailId, offer);
      } catch (err) {
        console.error("Error creating offer:", err);
      }
    },
    [createOffer, socket]
  );

  const handleIncomingCall = useCallback(
    async (data) => {
      const { from, offer } = data;
      console.log("Incoming call from:", from, offer);
      const ans = await createAnswer(offer);
      socket.emit("call-accepted", { emailId: from, ans });
    },
    [peer, socket, createAnswer]
  );

  const handleCallAccepted = useCallback(
    async (data) => {
      const { ans } = data;
      console.log("call accpeted", ans);
      await setRemoteAns(ans);
    },
    [setRemoteAns]
  );

  useEffect(() => {
    socket.on("user-joined", newUserJoined);
    socket.on("incoming-call", handleIncomingCall);
    socket.emit("ready-to-receive");
    socket.on("call-accepted", handleCallAccepted);

    return () => {
      socket.off("user-joined", newUserJoined);
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-accepted", handleCallAccepted);
    };
  }, [socket, newUserJoined, handleIncomingCall]);

  return <div>hello this is Room</div>;
};

export default RoomPage;
