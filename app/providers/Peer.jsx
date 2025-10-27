"use client";

import React, { createContext, useMemo, useContext } from "react";

const PeerContext = createContext(null);

// 2️⃣ Provider component
export const PeerProvider = (props) => {
  const peer = useMemo(() => {
  if (typeof window === "undefined") return null; // prevent SSR crash
  return new RTCPeerConnection({ 
    iceServers: [{ 
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:global.stun.twilio.com:3478"
      ] 
    }] 
  });
}, []);


const createOffer = async ()=> {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    return offer
  };

  return (
    <PeerContext.Provider value={{ peer, createOffer }}>
      {props.children}
    </PeerContext.Provider>
  );
};
 
export const usePeer = () => {
  return useContext(PeerContext);
};