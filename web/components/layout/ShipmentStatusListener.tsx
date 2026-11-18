"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useSocket } from "@/context/SocketContext";
import { ShipmentStatusUpdate } from "@/types";

export function ShipmentStatusListener() {
  const { socket, connected } = useSocket();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  useEffect(() => {
    if (!socket || !connected) return;

    const handleShipmentStatusUpdate = (data: ShipmentStatusUpdate) => {
      // Whoever made the change already got their own confirmation.
      if (data.actorUserId !== userId) {
        toast.success(data.message || "Shipment status updated!");
      }
      const id = String(data.shipmentId);
      queryClient.invalidateQueries({ queryKey: ["shipment", id] });
      queryClient.invalidateQueries({ queryKey: ["shipment-events", id] });
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
    };

    socket.on("shipmentStatusUpdate", handleShipmentStatusUpdate);
    return () => {
      socket.off("shipmentStatusUpdate", handleShipmentStatusUpdate);
    };
  }, [socket, connected, userId, queryClient]);

  return null;
}
