"use client";

import { Mic, Video, PhoneOff, MoreHorizontal, CircleDot } from "lucide-react";

const ControlBar = ({
  onMic,
  onVideo,
  onRecord,
  onEnd,
  onToggleRoomInfo,
  isMicOn,
  isVideoOn,
  isRecording,
}) => {
  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 px-6 py-4 rounded-full flex items-center gap-4">
      {/* Mic */}
      <button
        onClick={onMic}
        className={`w-12 h-12 rounded-full flex items-center justify-center text-white transition ${
          isMicOn ? "bg-red-700" : "bg-gray-700"
        }`}
      >
        <Mic className="w-6 h-6" />
      </button>

      {/* Video */}
      <button
        onClick={onVideo}
        className={`w-12 h-12 rounded-full flex items-center justify-center text-white transition ${
          isVideoOn ? "bg-red-700" : "bg-gray-700"
        }`}
      >
        <Video className="w-6 h-6" />
      </button>

      {/* Record */}
      <button
        onClick={onRecord}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition relative ${
          isRecording ? "bg-red-600 animate-pulse" : "bg-gray-700"
        }`}
      >
        <CircleDot
          className={`w-6 h-6 ${isRecording ? "fill-white" : "text-red-500"}`}
        />
      </button>

      {/* Info */}
      <button
        onClick={onToggleRoomInfo}
        className="w-12 h-12 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center text-white transition"
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>

      {/* End */}
      <button
        onClick={onEnd}
        className="w-12 h-12 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center text-white transition"
      >
        <PhoneOff className="w-6 h-6" />
      </button>
    </div>
  );
};

export default ControlBar;
