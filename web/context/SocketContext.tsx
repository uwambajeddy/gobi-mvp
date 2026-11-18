"use client";

import { useSession } from "next-auth/react";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  error: string | null;
  updateShipmentLocation: (shipmentId: string, coordinates: [number, number], timestamp: string) => boolean;
}

interface SocketProviderProps {
  children: React.ReactNode;
  socketUrl: string;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

/**
 * One authenticated Socket.IO connection per signed-in browser tab.
 * The API checks the access token on connect (protectSocket), so the socket
 * is re-created whenever NextAuth hands out a fresh access token.
 */
export const SocketProvider: React.FC<SocketProviderProps> = ({ children, socketUrl }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: session } = useSession();
  const accessToken = session?.tokens?.accessToken;

  const connectSocket = (token: string) => {
    try {
      const newSocket = io(socketUrl, {
        auth: {
          token, // Match `handshake.auth.token`
        },
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      newSocket.on("connect", () => {
        console.log("Socket connected");
        setSocket(newSocket);
        setConnected(true);
        setError(null);
      });

      newSocket.on("connect_error", (err) => {
        console.error("Socket connection error:", err);
        setError(`Connection error: ${err.message}`);
        setConnected(false);
      });

      newSocket.on("disconnect", () => {
        console.log("Socket disconnected");
        setConnected(false);
      });

      // Reconnection events live on the manager (`socket.io`) in socket.io-client v4.
      newSocket.io.on("reconnect_attempt", () => {
        console.log("Attempting to reconnect");
      });

      return newSocket;
    } catch (err) {
      console.log(`Socket initialization error: ${err instanceof Error ? err.message : String(err)}`);
      setError(`Socket initialization error: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  };

  useEffect(() => {
    if (!accessToken) return;
    const newSocket = connectSocket(accessToken);

    return () => {
      // Disconnect the socket this effect created (not the one in state,
      // which may still be null if it never connected).
      newSocket?.disconnect();
      setSocket(null);
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketUrl, accessToken]);

  const updateShipmentLocation = useCallback(
    (shipmentId: string, coordinates: [number, number], timestamp: string) => {
      if (!socket?.connected) {
        return false;
      }

      try {
        socket.emit("newCoordinates", shipmentId, coordinates, timestamp);
        return true;
      } catch (err) {
        console.error("Error emitting location update:", err);
        setError(`Location update failed: ${err instanceof Error ? err.message : String(err)}`);
        return false;
      }
    },
    [socket],
  );

  const value = {
    socket,
    connected,
    error,
    updateShipmentLocation,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};
