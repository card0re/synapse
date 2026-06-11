import { useState, useEffect } from "react"
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from "react-router-dom"
import { Bell, MessageCircle, Trophy } from "lucide-react"

import { Toaster } from "react-hot-toast"

import ProtectedRoute from "./components/ProtectedRoute"
import PublicRoute from "./components/PublicRoute"

import Login from "./pages/Login"
import Profile from "./pages/Profile"
import Admin from "./pages/Admin"
import Feed from "./pages/Feed"
import Register from "./pages/Register"
import PublicProfile from "./pages/PublicProfile"
import Landing from "./pages/Landing"
import ThemeToggle from "./components/ThemeToggle"
import Chat from './pages/Chat'
import Terms from "./pages/Terms"
import Privacy from "./pages/Privacy"
import Leaderboard from "./pages/Leaderboard"
import Premium from "./pages/Premium";
import { WebSocketProvider, useWebSocket } from "./contexts/WebSocketContext"

function Navbar() {
    const location = useLocation()
    const token = localStorage.getItem("token")
    const userId = localStorage.getItem("userId")
    const role = localStorage.getItem("role") || "user"

    const [news, setNews] = useState<any[]>([])
    const [showNews, setShowNews] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)

    const [unreadChatCount, setUnreadChatCount] = useState(0)

    const { lastMessage } = useWebSocket()

    useEffect(() => {
        if (!token) return;

        const currentUserId = localStorage.getItem("userId") || "";

        fetch(`http://localhost:3000/api/news?user_id=${currentUserId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                const fetchedNews = data.news || []
                setNews(fetchedNews)
                const lastReadId = parseInt(localStorage.getItem("lastReadNewsId") || "0")
                const unread = fetchedNews.filter((n: any) => n.id > lastReadId).length
                setUnreadCount(unread)
            })
            .catch(err => console.error("Помилка завантаження новин", err))
    }, [token])

    useEffect(() => {
        if (!token || !userId) return;

        fetch(`http://localhost:3000/api/users/${userId}/chats`, { headers: { "Authorization": `Bearer ${token}` } })
            .then(res => res.json())
            .then((data: any[]) => {
                if (Array.isArray(data)) {
                    const totalUnread = data.reduce((sum, chat) => sum + (chat.unread_count || 0), 0)
                    setUnreadChatCount(totalUnread)
                }
            })
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

    const isPublicPage = ["/", "/login", "/register"].includes(location.pathname)
    if (isPublicPage || !token) {
        return null
    }

    const handleLogout = () => {
        localStorage.clear()
        window.location.href = "/"
    }

    const toggleNews = () => {
        setShowNews(!showNews)
        if (!showNews && news.length > 0) {
            localStorage.setItem("lastReadNewsId", news[0].id.toString())
            setUnreadCount(0)
        }
    }

    return (
        <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shadow-sm transition-colors duration-300">
            <div className="w-full px-6 md:px-10">
                <div className="flex justify-between h-16 items-center">

                    <div className="flex items-center space-x-2 relative">
                        <Link to="/feed" className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mr-4">Synapse</Link>

                        <Link to="/leaderboard" className="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200" title="Топ Майстрів">
                            <Trophy size={22} className="text-amber-500" />
                        </Link>

                        <Link to="/chat" className="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200">
                            <MessageCircle size={22} />
                            {unreadChatCount > 0 && (
                                <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white dark:border-slate-900 animate-pulse">
                                    {unreadChatCount}
                                </span>
                            )}
                        </Link>

                        <button onClick={toggleNews} className="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200">
                            <Bell size={22} />
                            {unreadCount > 0 && (
                                <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white dark:border-slate-900">
                                    {unreadCount}
                                </span>
                            )}
                        </button>

                        {showNews && (
                            <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden z-50">
                                <div className="p-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                                    Останні новини
                                </div>
                                <div className="max-h-96 overflow-y-auto">
                                    {news.length === 0 ? (
                                        <div className="p-4 text-center text-slate-500 text-sm">Новин поки немає</div>
                                    ) : (
                                        news.map((item) => (
                                            <div key={item.id} className="p-4 border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{item.title}</h4>
                                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{item.content}</p>
                                                <span className="text-[10px] text-slate-400 mt-2 block">
                                                    {new Date(item.created_at).toLocaleDateString('uk-UA')}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center space-x-6">
                        <Link to="/feed" className="font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400">Стрічка</Link>
                        <Link to="/profile" className="font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400">Мій кабінет</Link>
                        {role === "admin" && (
                            <Link to="/admin" className="font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400">Адмінка</Link>
                        )}
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 text-sm font-bold text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-md transition-colors"
                        >
                            Вийти
                        </button>
                    </div>

                </div>
            </div>
        </nav>
    )
}

export default function App() {
    return (
        <WebSocketProvider>
            <Router>
                <div className="min-h-screen text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300 relative overflow-x-hidden">

                    {/* 👇 ГЛОБАЛЬНИЙ АНІМОВАНИЙ ФОН 👇 */}
                    <div className="fixed inset-0 pointer-events-none z-0 bg-slate-50 dark:bg-slate-950">
                        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-40"></div>
                        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/20 dark:bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '4s' }}></div>
                        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-amber-500/10 dark:bg-amber-600/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }}></div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-400/10 dark:bg-blue-600/10 rounded-full blur-[120px] transform rotate-45"></div>
                    </div>

                    {/* 👇 ОСНОВНИЙ КОНТЕНТ (Поверх фону) 👇 */}
                    <div className="relative z-10 flex flex-col min-h-screen">
                        <Navbar />

                        <ThemeToggle />

                        <Toaster
                            position="bottom-right"
                            reverseOrder={false}
                            toastOptions={{
                                className: 'dark:bg-slate-800 dark:text-white',
                                duration: 4000,
                            }}
                        />

                        <Routes>
                            <Route element={<PublicRoute />}>
                                <Route path="/" element={<Landing />} />
                                <Route path="/login" element={<Login />} />
                                <Route path="/register" element={<Register />} />
                                <Route path="/terms" element={<Terms />} />
                                <Route path="/privacy" element={<Privacy />} />
                            </Route>

                            <Route element={<ProtectedRoute />}>
                                <Route path="/feed" element={<Feed />} />
                                <Route path="/profile" element={<Profile />} />

                                <Route path="/chat" element={<Chat />} />
                                <Route path="/chat/:partnerId" element={<Chat />} />

                                <Route path="/user/:id" element={<PublicProfile />} />
                                <Route path="/admin" element={<Admin />} />
                                <Route path="/leaderboard" element={<Leaderboard />} />
                                <Route path="/premium" element={<Premium />} />
                            </Route>

                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </div>
                </div>
            </Router>
        </WebSocketProvider>
    )
}