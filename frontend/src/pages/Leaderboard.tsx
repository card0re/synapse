import { useEffect, useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Trophy, Star } from "lucide-react"
import toast from 'react-hot-toast'

interface Leader {
    id: string
    username: string
    avatar_url: string
    rating: number
    reviews_count: number
    completed_deals: number
}

export default function Leaderboard() {
    const [leaders, setLeaders] = useState<Leader[]>([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        fetch("http://localhost:3000/api/leaderboard")
            .then(res => res.json())
            .then(data => {
                setLeaders(data.leaderboard || [])
                setLoading(false)
            })
            .catch(() => {
                toast.error("Помилка завантаження лідерів")
                setLoading(false)
            })
    }, [])

    if (loading) return <div className="p-10 text-center font-bold text-slate-500">Завантаження топу...</div>

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans transition-colors duration-300">
            <div className="max-w-3xl mx-auto space-y-6">

                <div className="flex items-center gap-4 bg-gradient-to-r from-amber-500 to-orange-500 p-6 rounded-3xl shadow-lg text-white">
                    <Trophy size={48} className="drop-shadow-md" />
                    <div>
                        <h1 className="text-3xl font-black tracking-tight">Топ-10 Ірпеня</h1>
                        <p className="text-amber-100 font-medium">Найактивніші та найповажніші майстри платформи</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {leaders.map((user, index) => {
                        const isFirst = index === 0
                        const isSecond = index === 1
                        const isThird = index === 2

                        return (
                            <Card key={user.id} className={`border-none shadow-sm transition-all duration-300 hover:shadow-md ${isFirst ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/10 ring-2 ring-yellow-400' : isSecond ? 'bg-slate-100 dark:bg-slate-800/50' : isThird ? 'bg-orange-50 dark:bg-orange-900/10' : 'bg-white dark:bg-slate-900'}`}>
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="w-10 text-center font-black text-2xl">
                                        {isFirst ? '🥇' : isSecond ? '🥈' : isThird ? '🥉' : <span className="text-slate-400">{index + 1}</span>}
                                    </div>

                                    <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}&background=6366f1&color=fff`} className="w-14 h-14 rounded-2xl object-cover shadow-sm" alt="avatar" />

                                    <div className="flex-1">
                                        <Link to={`/user/${user.id}`} className="text-lg font-bold text-slate-900 dark:text-white hover:text-indigo-600 transition-colors">
                                            {user.username}
                                        </Link>
                                        <div className="flex items-center gap-3 text-xs font-bold text-slate-500 mt-1">
                                            <span className="flex items-center gap-1 text-yellow-500"><Star size={14} fill="currentColor" /> {user.rating}</span>
                                            <span className="text-indigo-500">{user.completed_deals} уроків</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                    {leaders.length === 0 && <div className="text-center p-10 text-slate-500">Поки що немає лідерів</div>}
                </div>
            </div>
        </div>
    )
}