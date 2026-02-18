"use client";

import { useState } from "react";
import RoomInfoCard from "@/app/components/card/page";

const RoomOverlays = ({ roomId }) => {
  const [showRoomCard, setShowRoomCard] = useState(true);

  if (!showRoomCard) return null;

  return (
    <RoomInfoCard roomId={roomId} onClose={() => setShowRoomCard(false)} />
  );
};

export default RoomOverlays;
