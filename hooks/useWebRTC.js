"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const useWebRTC = ({ socket, peer, router }) => {
  const myVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteEmailRef = useRef(null);

  const [myStream, setMyStream] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);

  /* ------------------ MEDIA ------------------ */

  const getUserMediaStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      setMyStream(stream);

      if (myVideoRef.current) {
        myVideoRef.current.srcObject = stream;
      }

      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });

      setIsReady(true);
      socket.emit("ready-to-receive");
    } catch (err) {
      console.error("getUserMedia failed:", err);
    }
  }, [peer, socket]);

  /* ------------------ TRACK HANDLERS ------------------ */

  useEffect(() => {
    peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          to: remoteEmailRef.current,
        });
      }
    };
  }, [peer, socket]);

  /* ------------------ TOGGLES ------------------ */

  const toggleMic = useCallback(() => {
    if (!peer) return;

    const nextState = !isMicOn;
    setIsMicOn(nextState);

    peer
      .getSenders()
      .filter((s) => s.track?.kind === "audio")
      .forEach((s) => (s.track.enabled = nextState));

    myStream?.getAudioTracks().forEach((t) => (t.enabled = nextState));
  }, [peer, isMicOn, myStream]);

  const toggleVideo = useCallback(() => {
    if (!peer) return;

    const nextState = !isVideoOn;
    setIsVideoOn(nextState);

    peer
      .getSenders()
      .filter((s) => s.track?.kind === "video")
      .forEach((s) => (s.track.enabled = nextState));

    myStream?.getVideoTracks().forEach((t) => (t.enabled = nextState));
  }, [peer, isVideoOn, myStream]);

  /* ------------------ CLEANUP ------------------ */

  const endCall = useCallback(() => {
    myStream?.getTracks().forEach((t) => t.stop());

    peer.getSenders().forEach((s) => s.track?.stop());
    peer.close();

    if (remoteEmailRef.current) {
      socket.emit("end-call", { to: remoteEmailRef.current });
    }

    router.push("/");
  }, [myStream, peer, socket, router]);

  /* ------------------ INIT ------------------ */

  useEffect(() => {
    getUserMediaStream();

    return () => {
      myStream?.getTracks().forEach((t) => t.stop());
    };
  }, [getUserMediaStream]);

  return {
    myVideoRef,
    remoteVideoRef,
    remoteEmailRef,
    myStream,
    isReady,
    isMicOn,
    isVideoOn,
    toggleMic,
    toggleVideo,
    endCall,
  };
};
