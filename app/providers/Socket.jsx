"use client";

import React, { createContext, useMemo, useContext } from "react";
import { io } from "socket.io-client";

// 1️⃣ Create context
const SocketContext = createContext({ socket: null });

// 2️⃣ Provider component
export const SocketProvider = ({ children }) => {
  const socket = useMemo(() => {
    return io("http://localhost:8001", {
      transports: ["websocket"],
    });
  }, []);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};
 
export const useSocket = () => {
    return useContext(SocketContext)
};
