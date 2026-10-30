import { createContext, useContext, useEffect, useState } from "react";
import { WS_URL } from "@/lib/api"

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

        // Токен їде списком підпротоколів, а не в адресі: Cloud Run пише
        // повний адрес запиту в логи, тож ?token=... складав туди діючі
        // ключі від акаунтів. Заголовки на WebSocket браузер ставити не дає,
        // і це єдиний спосіб передати токен поза адресою.
        const socket = new WebSocket(`${WS_URL}/ws`, ["bearer", token]);

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