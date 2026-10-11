
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = "https://tambola1-8u4s.onrender.com";

export default function useSocket() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    newSocket.on("connect", () => {
      setConnected(true);
      console.log("Connected to Tambola server!");
    });

    newSocket.on("disconnect", () => {
      setConnected(false);
      console.log("Disconnected from Tambola server.");
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return { socket, connected };
}
