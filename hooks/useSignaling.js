"use client";

import { useCallback, useEffect } from "react";

export const useSignaling = ({
  socket,
  peer,
  remoteEmailRef,
  createOffer,
  createAnswer,
  setRemoteAns,
}) => {
  /* -------- user joined -------- */

  const handleUserJoined = useCallback(
    async ({ emailId }) => {
      remoteEmailRef.current = emailId;

      const offer = await createOffer();
      socket.emit("call-user", { emailId, offer });
    },
    [createOffer, socket, remoteEmailRef],
  );

  /* -------- incoming call -------- */

  const handleIncomingCall = useCallback(
    async ({ from, offer }) => {
      remoteEmailRef.current = from;

      const ans = await createAnswer(offer);
      socket.emit("call-accepted", { emailId: from, ans });
    },
    [createAnswer, socket, remoteEmailRef],
  );

  /* -------- call accepted -------- */

  const handleCallAccepted = useCallback(
    async ({ ans }) => {
      await setRemoteAns(ans);
    },
    [setRemoteAns],
  );

  /* -------- ICE candidates -------- */

  useEffect(() => {
    socket.on("ice-candidate", async ({ candidate }) => {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("ICE candidate error:", err);
      }
    });

    return () => socket.off("ice-candidate");
  }, [socket, peer]);

  /* -------- socket bindings -------- */

  useEffect(() => {
    socket.on("user-joined", handleUserJoined);
    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-accepted", handleCallAccepted);

    return () => {
      socket.off("user-joined", handleUserJoined);
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-accepted", handleCallAccepted);
    };
  }, [socket, handleUserJoined, handleIncomingCall, handleCallAccepted]);
};
