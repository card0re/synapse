import { Navigate, Outlet, Link, useLocation } from "react-router-dom"
import { Home, MessageCircle, Trophy, User } from "lucide-react"
import { useEffect, useState } from "react"
import { useWebSocket } from "../contexts/WebSocketContext"

export default function ProtectedRoute() {
    const token = localStorage.getItem("token")
    const userId = localStorage.getItem("userId")
    const location = useLocation()

    const [unreadChatCount, setUnreadChatCount] = useState(0)
    const { lastMessage } = useWebSocket()

    // Логіка підрахунку непрочитаних повідомлень для глобального навбару
    useEffect(() => {
        if (!token || !userId) return;
        fetch(`https://api.synapse.tel/api/users/${userId}/chats`, { headers: { "Authorization": `Bearer ${token}` } })
            .then(res => res.json())
            .then((data: any[]) => {
                if (Array.isArray(data)) {
                    const totalUnread = data.reduce((sum, chat) => sum + (chat.unread_count || 0), 0)
                    setUnreadChatCount(totalUnread)
                }
            }).catch(e => console.error(e))
    }, [token, userId])

    useEffect(() => {
        if (lastMessage) {
            if (lastMessage.type === "new_message" || (!lastMessage.type && lastMessage.sender_id)) {
                if (!window.location.pathname.includes(`/chat/${lastMessage.sender_id}`)) {
                    setUnreadChatCount(prev => prev + 1)
                }
            }
        }
    }, [lastMessage])

    // Якщо немає токена - викидаємо на логін
    if (!token) {
        return <Navigate to="/login" replace />
    }

    // ВИДАЛЕНО УМОВУ isDeepChat

    return (
        <>
            {/* Основний контент сторінки. Додаємо відступ знизу, щоб навбар не перекривав текст */}
            <div className="pb-24">
                <Outlet />
            </div>

            {/* ГЛОБАЛЬНИЙ НИЖНІЙ НАВБАР (ТЕПЕР ПОКАЗУЄТЬСЯ ЗАВЖДИ) */}
            <div className="fixed bottom-0 left-0 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-800/50 z-[100] transition-all" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))', paddingTop: '0.5rem' }}>
                <div className="max-w-md mx-auto px-4 flex justify-between items-center">
                    <Link to="/feed" className="relative flex flex-col items-center gap-1 w-16 group">
                        <div className={`p-2 rounded-2xl transition-all duration-300 ${location.pathname === '/feed' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 scale-110' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                            <Home className="w-6 h-6" strokeWidth={location.pathname === '/feed' ? 2.5 : 2} />
                        </div>
                        <span className={`text-[10px] font-bold transition-all duration-300 ${location.pathname === '/feed' ? 'text-indigo-600 dark:text-indigo-400 opacity-100' : 'text-slate-400 opacity-80'}`}>Стрічка</span>
                    </Link>

                    <Link to="/chat" className="relative flex flex-col items-center gap-1 w-16 group">
                        <div className={`p-2 rounded-2xl transition-all duration-300 ${location.pathname.startsWith('/chat') ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 scale-110' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                            <MessageCircle className="w-6 h-6" strokeWidth={location.pathname.startsWith('/chat') ? 2.5 : 2} />
                            {/* Червоний кружечок непрочитаних */}
                            {unreadChatCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold h-4 min-w-[16px] flex items-center justify-center rounded-full px-1 border-2 border-white dark:border-slate-900 animate-pulse">
                                    {unreadChatCount > 99 ? '99+' : unreadChatCount}
                                </span>
                            )}
                        </div>
                        <span className={`text-[10px] font-bold transition-all duration-300 ${location.pathname.startsWith('/chat') ? 'text-indigo-600 dark:text-indigo-400 opacity-100' : 'text-slate-400 opacity-80'}`}>Чати</span>
                    </Link>

                    <Link to="/leaderboard" className="relative flex flex-col items-center gap-1 w-16 group">
                        <div className={`p-2 rounded-2xl transition-all duration-300 ${location.pathname === '/leaderboard' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 scale-110' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                            <Trophy className="w-6 h-6" strokeWidth={location.pathname === '/leaderboard' ? 2.5 : 2} />
                        </div>
                        <span className={`text-[10px] font-bold transition-all duration-300 ${location.pathname === '/leaderboard' ? 'text-indigo-600 dark:text-indigo-400 opacity-100' : 'text-slate-400 opacity-80'}`}>Топ</span>
                    </Link>

                    <Link to="/profile" className="relative flex flex-col items-center gap-1 w-16 group">
                        <div className={`p-2 rounded-2xl transition-all duration-300 ${location.pathname === '/profile' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 scale-110' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                            <User className="w-6 h-6" strokeWidth={location.pathname === '/profile' ? 2.5 : 2} />
                        </div>
                        <span className={`text-[10px] font-bold transition-all duration-300 ${location.pathname === '/profile' ? 'text-indigo-600 dark:text-indigo-400 opacity-100' : 'text-slate-400 opacity-80'}`}>Профіль</span>
                    </Link>
                </div>
            </div>
        </>
    )
}