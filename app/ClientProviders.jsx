// app/ClientProviders.jsx
"use client";

import React from "react";
import { SocketProvider } from "./providers/Socket";
import { PeerProvider } from "./providers/Peer";

export const ClientProviders = ({ children }) => {
  return (
    <SocketProvider>
      <PeerProvider>{children}</PeerProvider>
    </SocketProvider>
  );
};
