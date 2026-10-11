
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:3000";

export default function useSocket() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);

    newSocket.on("connect", () => {
      setConnected(true);
      console.log("Connected to Tambola server!");
    });

    newSocket.on("disconnect", () => {
      setConnected(false);
      console.log("Disconnected from Tambola server.");
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return { socket, connected };
}
