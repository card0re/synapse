import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShieldAlert, MessageCircle, Wallet } from "lucide-react"
import toast from 'react-hot-toast'
import ReportModal from "@/components/ReportModal"

interface User { id: string; username: string; bio: string; avatar_url: string; rating: number; }
interface Skill { id: string; type: string; title: string; description: string; price: number; is_active: boolean; }
interface Review { id: string; reviewer_name: string; score: number; comment: string; created_at: string; }
interface Achievement { id: string; name: string; description: string; icon: string; is_unlocked: boolean; }

export default function PublicProfile() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [user, setUser] = useState<User | null>(null)
    const [skills, setSkills] = useState<Skill[]>([])
    const [reviews, setReviews] = useState<Review[]>([])
    const [achievements, setAchievements] = useState<Achievement[]>([])
    const [reviewCount, setReviewCount] = useState(0)
    const [loading, setLoading] = useState(true)

    const [myBalance, setMyBalance] = useState<number | null>(null)
    const [reviewFilter, setReviewFilter] = useState<number | null>(null)
    const [reportData, setReportData] = useState<{type: 'user'|'skill'|'deal', id: string} | null>(null)

    const myId = localStorage.getItem("userId")
    const token = localStorage.getItem("token")

    const confirmAction = (message: string, onConfirm: () => void) => {
        toast((t) => (
            <div className="flex flex-col gap-3 min-w-[260px] p-1">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{message}</p>
                <div className="flex gap-2 justify-end mt-2">
                    <Button size="sm" variant="outline" onClick={() => toast.dismiss(t.id)} className="h-8 text-xs font-bold dark:border-slate-700 dark:text-slate-300">Скасувати</Button>
                    <Button size="sm" className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => { onConfirm(); toast.dismiss(t.id); }}>Підтвердити</Button>
                </div>
            </div>
        ), { duration: 8000, position: 'top-center' })
    }

    useEffect(() => {
        // 👇 ИСПРАВЛЕНИЕ: Добавлен заголовок Authorization ко всем запросам
        const headers = { "Authorization": `Bearer ${token}` };

        Promise.all([
            fetch(`https://synapse.tel/api/users/public/${id}`, { headers }).then(r => r.json()),
            fetch(`https://synapse.tel/api/skills/${id}`, { headers }).then(r => r.json()),
            fetch(`https://synapse.tel/api/users/${id}/reviews`, { headers }).then(r => r.json()),
            fetch(`https://synapse.tel/api/users/${id}/achievements`, { headers }).then(r => r.json())
        ])
            .then(([uData, sData, rData, aData]) => {
                setUser(uData)
                setSkills(sData.skills || [])
                setReviews(rData.reviews || [])
                setReviewCount(rData.count || 0)
                setAchievements(aData.achievements || [])
                setLoading(false)
            })
            .catch(() => {
                toast.error("Помилка завантаження профілю")
                setLoading(false)
            })

        if (myId && token) {
            // 👇 ИСПРАВЛЕНИЕ: Изменили profile на public, чтобы избежать конфликта с telegram_id
            fetch(`https://synapse.tel/api/users/public/${myId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            })
                .then(r => r.json())
                .then(data => {
                    if (data && data.balance_minutes !== undefined) {
                        setMyBalance(data.balance_minutes)
                    }
                }).catch(e => console.error("Помилка завантаження балансу", e))
        }
    }, [id, myId, token])

    const handleCreateDealClick = (skillId: string, price: number) => {
        if (!myId || !token) {
            toast.error("Спочатку увійдіть в акаунт");
            navigate("/login");
            return;
        }

        if (myBalance !== null && myBalance < price) {
            toast.error("Недостатньо хвилин на балансі!");
            return;
        }

        confirmAction(`Ви впевнені, що хочете відгукнутися на це оголошення? З вашого балансу буде списано ${price} хв.`, async () => {
            const res = await fetch(`https://synapse.tel/api/deals`, {
                method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ skill_id: skillId, initiator_id: myId })
            })
            if (res.ok) {
                toast.success("Заявку успішно відправлено!");
                navigate("/profile");
            }
            else {
                const data = await res.json();
                toast.error(data.error || "Помилка створення заявки");
            }
        })
    }

    if (loading) return <div className="p-8 text-center text-slate-500">Завантаження...</div>
    if (!user || user.id === "") return <div className="p-8 text-center text-slate-500">Користувача не знайдено</div>

    const reviewCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    reviews.forEach(r => { if (r.score >= 1 && r.score <= 5) reviewCounts[r.score as keyof typeof reviewCounts]++ })
    const filteredReviews = reviewFilter ? reviews.filter(r => r.score === reviewFilter) : reviews
    const unlockedAchievements = achievements.filter(a => a.is_unlocked);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 transition-colors duration-300">
            <div className="max-w-4xl mx-auto space-y-6">

                <Button variant="outline" onClick={() => navigate(-1)} className="dark:border-slate-700 dark:text-slate-200 mb-2">← Назад</Button>

                {myBalance !== null && user.id !== myId && (
                    <div className="flex justify-between items-center bg-indigo-600 dark:bg-indigo-900 text-white p-6 rounded-3xl shadow-xl mb-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                        <div className="relative z-10">
                            <h4 className="text-indigo-100 text-sm font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
                                <Wallet size={16} /> Ваш баланс
                            </h4>
                            <div className="text-4xl font-black tracking-tight">{myBalance} <span className="text-lg text-indigo-200 font-bold">хвилин</span></div>
                        </div>
                        <div className="relative z-10 w-16 h-16 bg-white/10 border border-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl shadow-inner transform rotate-6">
                            ⏳
                        </div>
                    </div>
                )}

                <Card className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                    <div className="h-24 bg-gradient-to-r from-indigo-600 to-blue-500 opacity-20" />
                    <CardContent className="p-6 -mt-12 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
                        <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}&background=6366f1&color=fff`} className="w-24 h-24 rounded-3xl object-cover border-4 border-white dark:border-slate-800 shadow-xl" alt="avatar" />
                        <div className="flex-1 mt-2">
                            <h1 className="text-3xl font-black dark:text-white flex flex-wrap justify-center sm:justify-start items-center gap-3">
                                {user.username}
                                <span className="text-sm font-bold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-3 py-1 rounded-full border border-yellow-200 dark:border-yellow-800/50 flex items-center gap-1.5 shadow-sm">
                                    ⭐ {user.rating} <span className="text-yellow-400/50">|</span> <span>{reviewCount} відгуків</span>
                                </span>
                            </h1>
                            <p className="text-slate-500 mt-2 italic">{user.bio || "Користувач ще не додав біографію."}</p>

                            {user.id !== myId && (
                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-4">
                                    <Button
                                        onClick={() => navigate(`/chat/${user.id}`)}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all"
                                    >
                                        <MessageCircle size={18} className="mr-2" />
                                        Написати
                                    </Button>

                                    <button
                                        onClick={() => setReportData({type: 'user', id: user.id})}
                                        className="text-slate-400 hover:text-red-500 text-sm flex items-center gap-1.5 font-medium transition-colors"
                                    >
                                        🚩 Поскаржитися
                                    </button>
                                </div>
                            )}

                            {unlockedAchievements.length > 0 && (
                                <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-5">
                                    {unlockedAchievements.map(badge => (
                                        <div key={badge.id} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm" title={badge.description}>
                                            <span className="text-lg">{badge.icon}</span>
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{badge.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <div className="bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/50 p-4 rounded-2xl shadow-sm flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-amber-800 dark:text-amber-400/90 leading-relaxed">
                        <strong>Пам'ятайте про обережність.</strong> Ніколи не переказуйте реальні гроші користувачам платформи і не погоджуйтесь на зустрічі в реальному житті з малознайомими людьми поза межами офіційних заходів SkillSwap. Всі розрахунки відбуваються у хвилинах всередині системи.
                    </p>
                </div>

                <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
                    <CardHeader><CardTitle className="text-xl text-slate-800 dark:text-slate-200">Відкриті пропозиції</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        {skills.filter(s => s.is_active).length === 0 ? (
                            <p className="text-slate-500 text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">Немає активних пропозицій.</p>
                        ) : (
                            skills.filter(s => s.is_active).map(skill => (
                                <div key={skill.id} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors shadow-sm">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${skill.type === 'teach' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400' : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'}`}>
                                                {skill.type === 'teach' ? 'Навчить' : 'Хоче вивчити'}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-lg dark:text-white leading-tight">{skill.title}</h4>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{skill.description}</p>

                                        {user.id !== myId && (
                                            <button
                                                onClick={() => setReportData({type: 'skill', id: skill.id})}
                                                className="text-slate-400 hover:text-red-500 text-xs mt-2 flex items-center gap-1 font-medium transition-colors"
                                            >
                                                🚩 Поскаржитися
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                                        <span className="font-black text-indigo-600 dark:text-indigo-400 text-xl">{skill.price} <small className="text-xs text-slate-400 font-bold">хв</small></span>
                                        {user.id !== myId ? (
                                            <Button onClick={() => handleCreateDealClick(skill.id, skill.price)} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md hover:shadow-lg transition-all rounded-xl">
                                                Відгукнутися
                                            </Button>
                                        ) : (
                                            <Button variant="outline" disabled className="w-full md:w-auto font-bold border-slate-200 dark:border-slate-700 rounded-xl">
                                                Ваше оголошення
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-none shadow-sm bg-white dark:bg-slate-900 h-fit md:col-span-1">
                        <CardHeader><CardTitle className="text-slate-800 dark:text-slate-200 text-lg">Рейтинг</CardTitle></CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {[5, 4, 3, 2, 1].map(star => {
                                    const count = reviewCounts[star as keyof typeof reviewCounts];
                                    const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                                    const isSelected = reviewFilter === star;
                                    return (
                                        <div
                                            key={star}
                                            className={`flex items-center gap-2 cursor-pointer p-1.5 rounded-lg transition-all ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-200 dark:ring-indigo-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                            onClick={() => setReviewFilter(isSelected ? null : star)}
                                        >
                                            <span className="w-8 text-xs font-bold text-slate-700 dark:text-slate-300">{star} ⭐</span>
                                            <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-yellow-400" style={{ width: `${percentage}%` }}></div>
                                            </div>
                                            <span className="w-6 text-right text-xs font-medium text-slate-500 dark:text-slate-400">{count}</span>
                                        </div>
                                    )
                                })}
                            </div>
                            {reviewFilter && <Button variant="outline" size="sm" onClick={() => setReviewFilter(null)} className="w-full mt-4 text-slate-600 dark:text-slate-300 dark:border-slate-700 text-xs h-8">❌ Скинути фільтр</Button>}
                        </CardContent>
                    </Card>

                    <div className="md:col-span-2 space-y-4">
                        <h3 className="font-black text-xl text-slate-800 dark:text-slate-200 px-1">Всі відгуки</h3>
                        {reviews.length === 0 ? (
                            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm text-slate-500">Ще немає відгуків.</div>
                        ) : filteredReviews.length === 0 ? (
                            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm text-slate-500">Немає відгуків з оцінкою {reviewFilter} ⭐</div>
                        ) : (
                            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                {filteredReviews.map(review => (
                                    <Card key={review.id} className="bg-white dark:bg-slate-900 shadow-sm border-slate-100 dark:border-slate-800 transition-colors">
                                        <CardContent className="p-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="font-bold text-slate-800 dark:text-slate-200">{review.reviewer_name}</span>
                                                <span className="text-yellow-500 font-bold tracking-widest text-xs">{"⭐".repeat(review.score)}</span>
                                            </div>
                                            {review.comment && <p className="text-slate-600 dark:text-slate-300 text-sm bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50 transition-colors mt-2 break-words whitespace-pre-wrap">"{review.comment}"</p>}
                                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">{new Date(review.created_at).toLocaleDateString('uk-UA')}</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <ReportModal
                    targetType={reportData?.type || 'user'}
                    targetId={reportData?.id || ''}
                    isOpen={!!reportData}
                    onClose={() => setReportData(null)}
                />

            </div>
        </div>
    )
}