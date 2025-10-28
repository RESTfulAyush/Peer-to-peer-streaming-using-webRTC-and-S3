"use client";
import React, { createContext, useMemo, useContext, useEffect } from "react";

const PeerContext = createContext(null);

export const PeerProvider = (props) => {
  const peer = useMemo(() => {
    if (typeof window === "undefined") return null; // prevent SSR crash
    
    const peerConnection = new RTCPeerConnection({ 
      iceServers: [
        { 
          urls: [
            "stun:stun.l.google.com:19302",
            "stun:global.stun.twilio.com:3478"
          ] 
        }
      ] 
    });

    // Add connection state logging
    peerConnection.onconnectionstatechange = () => {
      console.log("Peer connection state:", peerConnection.connectionState);
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", peerConnection.iceConnectionState);
    };

    return peerConnection;
  }, []);

  const createOffer = async () => {
    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      console.log("Offer created:", offer);
      return offer;
    } catch (error) {
      console.error("Error creating offer:", error);
      throw error;
    }
  };

  const createAnswer = async (offer) => {
    try {
      // ✅ Wrap in RTCSessionDescription
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      console.log("Answer created:", answer);
      return answer;
    } catch (error) {
      console.error("Error creating answer:", error);
      throw error;
    }
  };

  const setRemoteAns = async (ans) => {
    try {
      // ✅ Wrap in RTCSessionDescription
      await peer.setRemoteDescription(new RTCSessionDescription(ans));
      console.log("Remote answer set successfully");
    } catch (error) {
      console.error("Error setting remote answer:", error);
      throw error;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (peer) {
        console.log("Closing peer connection");
        peer.close();
      }
    };
  }, [peer]);

  return (
    <PeerContext.Provider value={{ peer, createOffer, createAnswer, setRemoteAns }}>
      {props.children}
    </PeerContext.Provider>
  );
};

export const usePeer = () => {
  const context = useContext(PeerContext);
  if (!context) {
    throw new Error("usePeer must be used within a PeerProvider");
  }
  return context;
};