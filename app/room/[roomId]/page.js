"use client";

import React, { useCallback, useEffect } from "react";
import { useSocket } from "@/app/providers/Socket";
import { usePeer } from "@/app/providers/Peer";
// import { useParams } from "next/navigation";

const RoomPage = () => {
  const { socket } = useSocket();
  const { peer, createOffer } = usePeer();
  // const params = useParams();
  // const roomId = params.roomId;

  // const newUserJoined = useCallback(
  //   async (data) => {
  //     const { emailId } = data;
  //     try {
  //       const offer = await createOffer();
  //       socket.emit("call-user", { emailId, offer });
  //       console.log("Sent call offer to:", emailId, offer);
  //     } catch (err) {
  //       console.error("Error creating offer:", err);
  //     }
  //   },
  //   [createOffer, socket]
  // );

  const newUserJoined = useCallback(
    async (data) => {
      const { emailId } = data;
      console.log("New user joined:", emailId);
      try {
        // Add a small delay so the new user finishes connecting
        setTimeout(async () => {
          const offer = await createOffer();
          socket.emit("call-user", { emailId, offer });
          console.log("Sent call offer to:", emailId, offer);
        }, 1000); // ⏱ 1-second delay
      } catch (err) {
        console.error("Error creating offer:", err);
      }
    },
    [createOffer, socket]
  );

  // Handle incoming call
  const handleIncomingCall = useCallback(
    async (data) => {
      const { from, offer } = data;
      console.log("Incoming call from:", from, offer);
    },
    [peer, socket]
  );

  useEffect(() => {
    socket.on("user-joined", newUserJoined);
    socket.on("incoming-call", handleIncomingCall);

    // return () => {
    //   socket.off("joined-room");
    //   socket.off("incoming-call", handleIncomingCall);
    //   socket.off("user-joined", newUserJoined);
    // };
  }, [socket, newUserJoined, handleIncomingCall]);

  return <div>hello this is Room</div>;
};

export default RoomPage;
