"use client";

import { useEffect } from "react";

import React, { createContext, useMemo, useContext } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext({ socket: null });

export const SocketProvider = ({ children }) => {
  const socket = useMemo(() => {
    return io("http://localhost:8000", {
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
  return useContext(SocketContext);
};
