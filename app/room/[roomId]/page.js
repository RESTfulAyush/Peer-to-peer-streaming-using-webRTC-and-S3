"use client";

import { useParams, useRouter } from "next/navigation";
import { useSocket } from "@/app/providers/Socket";
import { usePeer } from "@/app/providers/Peer";

import VideoStage from "./components/VideoStage";
import ControlBar from "./components/ControlBar";
import StatusBar from "./components/StatusBar";
import RoomOverlays from "./components/RoomOverlays";

import { useWebRTC } from "@/hooks/useWebRTC";
import { useSignaling } from "@/hooks/useSignaling";
import { useRecordingFlow } from "@/hooks/useRecordingFlow";

const RoomPage = () => {
  const { roomId } = useParams();
  const router = useRouter();
  const { socket } = useSocket();
  const { peer, createOffer, createAnswer, setRemoteAns } = usePeer();

  /* -------- WebRTC -------- */
  const {
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
  } = useWebRTC({ socket, peer, router });

  /* -------- Signaling -------- */
  useSignaling({
    socket,
    peer,
    remoteEmailRef,
    createOffer,
    createAnswer,
    setRemoteAns,
  });

  /* -------- Recording -------- */
  const { isRecording, startRecording, stopRecording } = useRecordingFlow({
    socket,
    roomId,
    myStream,
  });

  return (
    <div className="relative w-full h-screen bg-gray-900">
      <VideoStage myVideoRef={myVideoRef} remoteVideoRef={remoteVideoRef} />

      <StatusBar isReady={isReady} remoteEmail={remoteEmailRef.current} />

      <RoomOverlays roomId={roomId} />

      <ControlBar
        onMic={toggleMic}
        onVideo={toggleVideo}
        onRecord={isRecording ? stopRecording : startRecording}
        onEnd={endCall}
        isMicOn={isMicOn}
        isVideoOn={isVideoOn}
        isRecording={isRecording}
      />
    </div>
  );
};

export default RoomPage;
