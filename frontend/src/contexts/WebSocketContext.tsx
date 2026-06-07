import { createContext, useContext, useEffect, useState } from "react";

interface WSContextType {
    ws: WebSocket | null;
    lastMessage: any | null;
}

const WebSocketContext = createContext<WSContextType>({ ws: null, lastMessage: null });

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [lastMessage, setLastMessage] = useState<any | null>(null);

    useEffect(() => {
        const userId = localStorage.getItem("userId");
        const token = localStorage.getItem("token");

        if (!userId || !token) return;

        // 👇 ИСПРАВЛЕНИЕ: Теперь передаем token вместо user_id
        const socket = new WebSocket(`ws://localhost:3000/api/ws?token=${token}`);

        socket.onopen = () => console.log("🟢 WS підключено (Global Context)");

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setLastMessage(data);
        };

        setWs(socket);

        return () => {
            socket.close();
        };
    }, []);

    return (
        <WebSocketContext.Provider value={{ ws, lastMessage }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => useContext(WebSocketContext);