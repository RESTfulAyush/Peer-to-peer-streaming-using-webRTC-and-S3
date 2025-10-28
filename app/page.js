"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSocket } from "./providers/Socket";
import { motion } from "framer-motion";

export default function HomePage() {
  const router = useRouter();
  const { socket } = useSocket();
  const [email, setEmail] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const handleRoomJoined = useCallback(
    ({ roomId }) => {
      router.push(`/room/${roomId}`);
    },
    [router]
  );

  useEffect(() => {
    socket.on("joined-room", handleRoomJoined);
    return () => {
      socket.off("joined-room", handleRoomJoined);
    };
  }, [socket, handleRoomJoined]);

  const handleCreateRoom = () => {
    if (!email) return alert("Please enter your email first.");
    const newRoomId = Math.random().toString(36).substring(2, 8);
    socket.emit("join-room", { emailId: email, roomId: newRoomId });
  };

  const handleJoinRoom = () => {
    if (!email) return alert("Please enter your email first.");
    if (!roomCode) return alert("Please enter a room code.");
    socket.emit("join-room", { emailId: email, roomId: roomCode });
  };

  return (
    <div className="flex flex-col md:flex-row h-screen">
      {/* LEFT FORM SECTION */}
      <div className="w-full md:w-1/2 flex items-center justify-center bg-white px-8 md:px-16">
        <div className="w-full max-w-md">
          {/* Brand */}
          <div className="flex items-center mb-8">
            <div className="w-8 h-8 bg-[#8b5cf6] rounded-md mr-3"></div>
            <h1 className="text-2xl font-bold text-gray-800">MeetLite</h1>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2">
            Welcome back
          </h2>
          <p className="text-gray-500 mb-8">
            Create or join meetings instantly — simple, secure, and fast.
          </p>

          {/* Email input */}
          <div className="mb-5">
            <label className="block mb-2 text-sm text-gray-700 font-medium">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a78bfa] text-black"
            />
          </div>

          {/* Create Room */}
          <button
            onClick={handleCreateRoom}
            className="w-full bg-[#8b5cf6] hover:bg-[#7c3aed] text-white py-3 rounded-lg font-semibold transition mb-4"
          >
            Create New Room
          </button>

          {/* Divider */}
          <div className="flex items-center justify-center space-x-2 text-gray-400 text-sm my-4">
            <div className="w-16 h-[1px] bg-gray-300"></div>
            <span>or</span>
            <div className="w-16 h-[1px] bg-gray-300"></div>
          </div>

          {/* Join Room */}
          <div className="mb-4">
            <label className="block mb-2 text-sm text-gray-700 font-medium">
              Enter Code to Join
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="Enter room code"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a78bfa] text-black"
              />
              <button
                onClick={handleJoinRoom}
                className="bg-[#a78bfa] hover:bg-[#8b5cf6] text-white px-6 rounded-lg font-semibold transition"
              >
                Join
              </button>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            Powered by WebRTC • Made with 💜 by Ayush
          </p>
        </div>
      </div>

      {/* RIGHT ILLUSTRATION SECTION */}
      <div className="hidden md:flex w-1/2 bg-[#ede9fe] relative overflow-hidden">
        <motion.img
          src="/home.png"
          alt="illustration"
          className="absolute inset-0 w-full h-full object-cover opacity-70"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        <div className="absolute inset-0 bg-[#ede9fe]/25"></div>
      </div>
    </div>
  );
}
