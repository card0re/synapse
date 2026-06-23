import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
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
import { WebSocketProvider } from "./contexts/WebSocketContext"

export default function App() {
    return (
        <WebSocketProvider>
            <Router>
                <div className="min-h-screen text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300 relative overflow-x-hidden">

                    {/* 👇 ГЛОБАЛЬНИЙ ФОН: ДОДАНО ГРАДІЄНТ З ПРОФІЛЮ 👇 */}
                    <div
                        className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900">
                        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-40">
                        </div>
                        <div
                            className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/20 dark:bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"
                            style={{animationDuration: '4s'}}></div>
                        <div
                            className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-amber-500/10 dark:bg-amber-600/10 rounded-full blur-[100px] animate-pulse"
                            style={{animationDuration: '6s', animationDelay: '1s'}}></div>
                        <div
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-400/10 dark:bg-blue-600/10 rounded-full blur-[120px] transform rotate-45"></div>
                    </div>

                    {/* 👇 ОСНОВНИЙ КОНТЕНТ 👇 */}
                    <div className="relative z-10 flex flex-col min-h-screen">

                        <ThemeToggle/>

                        <Toaster
                            position="top-center"
                            reverseOrder={false}
                            toastOptions={{
                                className: 'dark:bg-slate-800 dark:text-white',
                                duration: 4000,
                            }}
                        />

                        <Routes>
                            {/* Публічні сторінки (без навбару) */}
                            <Route element={<PublicRoute />}>
                                <Route path="/" element={<Landing />} />
                                <Route path="/login" element={<Login />} />
                                <Route path="/register" element={<Register />} />
                                <Route path="/terms" element={<Terms />} />
                                <Route path="/privacy" element={<Privacy />} />
                            </Route>

                            {/* Захищені сторінки (з нижнім навбаром) */}
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