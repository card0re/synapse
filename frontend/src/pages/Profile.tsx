import React, { useEffect, useState, useRef } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Lock } from "lucide-react"
import toast from 'react-hot-toast'

interface City { id: number; name: string; }
interface Skill { id: string; type: string; title: string; description: string; price: number; is_active?: boolean; }
interface User { id: string; telegram_id?: number; username: string; phone_number: string; email?: string; balance_minutes: number; frozen_minutes: number; rating: number; bio: string; avatar_url: string; city_id?: number; birth_date?: string; bonus_claimed?: boolean;}
interface Deal { deal_id: string; skill_title: string; initiator_name?: string; initiator_phone?: string; master_name?: string; master_phone?: string; master_id: string; status: string; meeting_url?: string; scheduled_at?: string; }
interface Review { id: string; reviewer_name: string; score: number; comment: string; created_at: string; }
interface Achievement { id: string; name: string; description: string; icon: string; is_unlocked: boolean; current_progress: number; target_progress: number; is_claimed: boolean; bonus_minutes: number; }

export default function Profile() {
    const [user, setUser] = useState<User | null>(null)
    const [skills, setSkills] = useState<Skill[]>([])
    const [incomingDeals, setIncomingDeals] = useState<Deal[]>([])
    const [outgoingDeals, setOutgoingDeals] = useState<Deal[]>([])
    const [reviews, setReviews] = useState<Review[]>([])
    const [cities, setCities] = useState<City[]>([])
    const [achievements, setAchievements] = useState<Achievement[]>([])
    const [reviewCount, setReviewCount] = useState(0)
    const [reviewFilter, setReviewFilter] = useState<number | null>(null)
    const [, setLoading] = useState(true)

    const [activeTab, setActiveTab] = useState<'learning' | 'mentoring' | 'skills' | 'settings'>('learning')

    const [isEditingProfile, setIsEditingProfile] = useState(false)
    const [editForm, setEditForm] = useState({ username: "", phone: "", bio: "", avatar_url: "", city_id: 0 })

    const [kycEmail, setKycEmail] = useState("")
    const [kycCode, setKycCode] = useState("")
    const [isCodeSent, setIsCodeSent] = useState(false)

    const [isAchievementInfoModalOpen, setIsAchievementInfoModalOpen] = useState(false)

    const [isLinkingTg, setIsLinkingTg] = useState(false)

    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const [reviewDealId, setReviewDealId] = useState<string | null>(null)
    const [reviewTargetId, setReviewTargetId] = useState<string | null>(null)
    const [reviewScore, setReviewScore] = useState(5)
    const [reviewComment, setReviewComment] = useState("")

    const [skillType, setSkillType] = useState("teach")
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [price, setPrice] = useState<number | "">(60)

    const [acceptingDealId, setAcceptingDealId] = useState<string | null>(null)
    const [scheduledTime, setScheduledTime] = useState<string>("")

    const navigate = useNavigate()
    const myId = localStorage.getItem("userId")
    const tgId = localStorage.getItem("tgId")
    const token = localStorage.getItem("token")

    const [isAgeModalOpen, setIsAgeModalOpen] = useState(false)
    const [birthDate, setBirthDate] = useState("")

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

    const loadData = async () => {
        if (!myId || !token) { navigate("/login"); return; }

        // Створюємо змінну з заголовком, щоб не дублювати код
        const authHeaders = { "Authorization": `Bearer ${token}` };

        try {
            const [uRes, sRes, iRes, oRes, cRes, rRes, aRes] = await Promise.all([
                // 👇 ТУТ ЗМІНИВ tgId на myId
                fetch(`http://localhost:3000/api/users/profile/${myId}`, { headers: authHeaders }),
                fetch(`http://localhost:3000/api/skills/${myId}`, { headers: authHeaders }),
                fetch(`http://localhost:3000/api/deals/incoming/${myId}`, { headers: authHeaders }),
                fetch(`http://localhost:3000/api/deals/outgoing/${myId}`, { headers: authHeaders }),
                fetch(`http://localhost:3000/api/cities`), // Міста залишаються без токена (вони публічні)
                // 👇 ТУТ ДОДАВ authHeaders
                fetch(`http://localhost:3000/api/users/${myId}/reviews`, { headers: authHeaders }),
                // 👇 ТУТ ДОДАВ authHeaders
                fetch(`http://localhost:3000/api/users/${myId}/achievements`, { headers: authHeaders })
            ]);

            const userData = await uRes.json();
            if (!userData.error) {
                setUser(userData);
                setEditForm({
                    username: userData.username || "", phone: userData.phone_number || "",
                    bio: userData.bio || "", avatar_url: userData.avatar_url || "", city_id: userData.city_id || 0
                });
            }

            const sData = await sRes.json(); setSkills(sData.skills || []);
            const iData = await iRes.json(); setIncomingDeals(iData.deals || []);
            const oData = await oRes.json(); setOutgoingDeals(oData.deals || []);
            const cData = await cRes.json(); setCities(cData.cities || []);
            const rData = await rRes.json(); setReviews(rData.reviews || []);
            setReviewCount(rData.count || 0);

            const aData = await aRes.json(); setAchievements(aData.achievements || []);

        } catch (e) {
            toast.error("Помилка завантаження профілю");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { loadData() }, [myId, tgId, token, navigate])

    const handleClaimBonus = async (achievementId: string, bonusMinutes: number) => {
        const res = await fetch(`http://localhost:3000/api/users/${myId}/claim-bonus`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ achievement_id: achievementId })
        })
        if (res.ok) {
            toast.success(`🎉 Бонус ${bonusMinutes} хв успішно нараховано!`);
            loadData();
        } else {
            const data = await res.json()
            toast.error(data.error || "Помилка")
        }
    }

    const handleDealAction = async (dealId: string, status: string, time?: string) => {
        const payload: any = { status };
        if (time) payload.scheduled_at = new Date(time).toISOString();

        const res = await fetch(`http://localhost:3000/api/deals/${dealId}/status`, {
            method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        if (res.ok) { toast.success("Статус оновлено!"); loadData(); setAcceptingDealId(null); }
        else { toast.error("Помилка сервера"); }
    };

    const handleCompleteDeal = async (dealId: string, targetId: string) => {
        const res = await fetch(`http://localhost:3000/api/deals/${dealId}/status`, {
            method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ status: 'completed' })
        });
        if (res.ok) {
            toast.success("Урок успішно завершено!");
            loadData();
            setReviewDealId(dealId);
            setReviewTargetId(targetId);
        } else { toast.error("Помилка сервера"); }
    };

    const handleCreateSkill = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user?.birth_date) { setIsAgeModalOpen(true); return; }
        const res = await fetch("http://localhost:3000/api/skills/", {
            method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ user_id: myId, type: skillType, title, description, price: Number(price) })
        })
        if (res.ok) { toast.success("ШІ перевіряє оголошення..."); setTitle(""); setDescription(""); setPrice(60); loadData(); }
        else { toast.error("Помилка створення оголошення"); }
    }

    const handleSaveBirthDate = async () => {
        if (!birthDate) return toast.error("Будь ласка, вкажіть дату народження");
        const birthYear = new Date(birthDate).getFullYear();
        if (new Date().getFullYear() - birthYear < 14) return toast.error("Вам має бути більше 14 років для створення оголошень");

        const payload = { ...editForm, city_id: Number(editForm.city_id), birth_date: birthDate }
        const res = await fetch(`http://localhost:3000/api/users/profile/${myId}`, {
            method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        if (res.ok) { toast.success("Дату народження збережено!"); setIsAgeModalOpen(false); loadData(); }
        else { toast.error("Не вдалося зберегти дату"); }
    }

    const handleToggleSkill = async (id: string) => {
        await fetch(`http://localhost:3000/api/skills/${id}/toggle`, { method: "PUT", headers: { "Authorization": `Bearer ${token}` } });
        loadData();
    }

    const handleDeleteSkill = (id: string) => {
        confirmAction("Точно видалити назавжди?", async () => {
            await fetch(`http://localhost:3000/api/skills/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
            loadData();
        });
    }

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = { ...editForm, city_id: Number(editForm.city_id) }
        const res = await fetch(`http://localhost:3000/api/users/profile/${myId}`, {
            method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        if (res.ok) { toast.success("Профіль оновлено!"); loadData(); setIsEditingProfile(false); }
    }

    const sendEmailVerification = async () => {
        const res = await fetch("http://localhost:3000/api/users/verify-email/send", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: kycEmail })
        });
        if (res.ok) { toast.success("Код відправлено!"); setIsCodeSent(true); }
    }

    const confirmEmailVerification = async () => {
        const res = await fetch("http://localhost:3000/api/users/verify-email/confirm", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: myId, email: kycEmail, code: kycCode })
        });
        if (res.ok) { toast.success("Пошту підтверджено!"); loadData(); }
        else { toast.error("Невірний код"); }
    }

    const generateTelegramLink = async () => {
        setIsLinkingTg(true);
        try {
            const res = await fetch(`http://localhost:3000/api/users/${myId}/telegram-link`, { method: "POST" })
            if (res.ok) {
                const data = await res.json()
                window.open(data.url, "_blank")
            }
        } catch(e) { toast.error("Помилка"); } finally { setIsLinkingTg(false); }
    }

    const handleSubmitReview = async (dealId: string, targetId: string) => {
        const res = await fetch(`http://localhost:3000/api/deals/${dealId}/review`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviewer_id: myId, target_id: targetId, score: reviewScore, comment: reviewComment })
        })
        if (res.ok) { toast.success("Дякуємо за ваш відгук!"); loadData(); setReviewDealId(null); }
        else { toast.error("Помилка відправки відгуку") }
    }

    const handleImageUpload = (file: File) => {
        if (!file.type.startsWith("image/")) return toast.error("Будь ласка, завантажте лише зображення!")
        const reader = new FileReader();
        reader.onloadend = () => setEditForm(prev => ({ ...prev, avatar_url: reader.result as string }));
        reader.readAsDataURL(file)
    }

    const handleDrop = (e: React.DragEvent) => { e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (file) handleImageUpload(file) }
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault() }

    const formatDate = (dateString?: string) => {
        if (!dateString) return "Не вказано";
        return new Date(dateString).toLocaleString("uk-UA", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    }

    const isVerified = Boolean(user?.phone_number && user?.email)

    const reviewCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    reviews.forEach(r => { if (r.score >= 1 && r.score <= 5) reviewCounts[r.score as keyof typeof reviewCounts]++ })
    const filteredReviews = reviewFilter ? reviews.filter(r => r.score === reviewFilter) : reviews

    if (!user) return <div className="p-8 text-center">Завантаження...</div>

    const unlockedAchievements = achievements.filter(a => a.is_unlocked);
    const progressPercent = achievements.length > 0 ? Math.round((unlockedAchievements.length / achievements.length) * 100) : 0;

    return (
        <div className="min-h-[calc(100vh-64px)] bg-transparent p-4 md:p-8 relative z-10">

            {/* МОДАЛКИ */}
            {isAchievementInfoModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div
                        className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
                        <div className="flex items-center gap-3 mb-6">
                            <div
                                className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400 text-2xl">🏆
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white">Що таке досягнення?</h3>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                            Гейміфікація робить навчання цікавішим! Виконуючи завдання на платформі, ви розблоковуєте
                            унікальні бейджі.
                        </p>
                        <ul className="space-y-4 text-sm text-slate-700 dark:text-slate-300 mb-8">
                            <li className="flex items-start gap-3"><span className="text-xl">🎁</span>
                                <div><strong className="text-slate-900 dark:text-white">Індивідуальні
                                    бонуси:</strong> Кожне відкрите досягнення дає вам додаткові безкоштовні хвилини на
                                    баланс.
                                </div>
                            </li>
                            <li className="flex items-start gap-3"><span className="text-xl">🌟</span>
                                <div><strong className="text-slate-900 dark:text-white">Супер-приз:</strong> Зберіть усі
                                    бейджі, щоб розблокувати головну винагороду (500 хв)!
                                </div>
                            </li>
                            <li className="flex items-start gap-3"><span className="text-xl">👀</span>
                                <div><strong className="text-slate-900 dark:text-white">Публічний статус:</strong> Ваші
                                    відкриті досягнення відображаються у вашому публічному профілі для всіх.
                                </div>
                            </li>
                        </ul>
                        <Button onClick={() => setIsAchievementInfoModalOpen(false)}
                                className="w-full bg-amber-500 hover:bg-amber-600 text-white h-12 text-lg font-bold">Зрозуміло</Button>
                    </div>
                </div>
            )}

            {isAgeModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div
                        className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Підтвердження віку</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                            Для створення оголошень ви маєте бути старше 14 років.
                        </p>
                        <div className="space-y-2 mb-6">
                            <Label className="text-slate-700 dark:text-slate-300">Дата народження</Label>
                            <Input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)}
                                   className="h-12 text-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                   max={new Date().toISOString().split("T")[0]}/>
                        </div>
                        <div className="flex gap-3">
                            <Button onClick={handleSaveBirthDate}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 font-bold">Зберегти</Button>
                            <Button onClick={() => setIsAgeModalOpen(false)} variant="outline"
                                    className="flex-1">Скасувати</Button>
                        </div>
                    </div>
                </div>
            )}

            {reviewDealId && reviewTargetId && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div
                        className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Оцініть урок</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">Ваш відгук допоможе іншим обрати
                            найкращого майстра!</p>
                        <div className="flex gap-2 justify-center mb-6">
                            {[1, 2, 3, 4, 5].map(star => (
                                <button key={star} onClick={() => setReviewScore(star)}
                                        className={`text-4xl transition-transform ${reviewScore >= star ? 'text-yellow-400 scale-110 drop-shadow-md' : 'text-slate-200 dark:text-slate-700 hover:scale-110'}`}>⭐</button>
                            ))}
                        </div>
                        <textarea
                            className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white mb-6 outline-none focus:ring-2 focus:ring-indigo-500"
                            rows={3} placeholder="Напишіть ваші враження (необов'язково)..." value={reviewComment}
                            onChange={e => setReviewComment(e.target.value)}/>
                        <div className="flex gap-3">
                            <Button onClick={() => {
                                handleSubmitReview(reviewDealId, reviewTargetId);
                                setReviewTargetId(null);
                            }}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 font-bold text-white shadow-md">Відправити</Button>
                            <Button onClick={() => {
                                setReviewDealId(null);
                                setReviewTargetId(null);
                            }} variant="outline"
                                    className="flex-1 dark:border-slate-700 dark:text-slate-300">Скасувати</Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto space-y-6">

                <Card className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                    <div className="h-32 bg-gradient-to-r from-indigo-600 to-blue-500 opacity-20"/>
                    <CardContent
                        className="p-6 pt-0 flex flex-col lg:flex-row items-center lg:items-start justify-between gap-6">
                        <div
                            className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-5 w-full lg:w-auto">
                            <img
                                src={user?.avatar_url || `https://ui-avatars.com/api/?name=${user?.username}&background=6366f1&color=fff`}
                                className="w-28 h-28 rounded-3xl object-cover border-4 border-white dark:border-slate-800 shadow-xl -mt-16 bg-white dark:bg-slate-900 z-10 shrink-0"/>

                            <div className="mt-2 sm:mt-3">
                                <h1 className="text-3xl font-black dark:text-white flex flex-wrap justify-center sm:justify-start items-center gap-3">
                                    {user?.username}
                                    <span
                                        className="text-sm font-bold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-3 py-1 rounded-full border border-yellow-200 dark:border-yellow-800/50 flex items-center gap-1.5 shadow-sm mt-1 sm:mt-0">
                                        ⭐ {user?.rating} <span
                                        className="text-yellow-400/50">|</span> <span>{reviewCount} відгуків</span>
                                    </span>
                                </h1>
                                <p className="text-slate-500 font-medium mt-1 mb-2">{user?.email || "Email не підтверджено"}</p>

                                {unlockedAchievements.length > 0 && (
                                    <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
                                        {unlockedAchievements.map(badge => (
                                            <div key={`header-${badge.id}`}
                                                 className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm"
                                                 title={badge.description}>
                                                <span className="text-lg">{badge.icon}</span>
                                                <span
                                                    className="text-xs font-bold text-slate-700 dark:text-slate-300">{badge.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3 w-full lg:w-auto justify-center lg:mt-3">
                            <div
                                className="flex flex-col items-center justify-center min-w-[120px] px-6 py-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
                                <span
                                    className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Мій Баланс</span>
                                <span
                                    className="text-2xl font-black text-indigo-600 dark:text-indigo-400 leading-none">{user?.balance_minutes}
                                    <small className="text-sm">хв</small></span>
                            </div>
                            <div
                                className="flex flex-col items-center justify-center min-w-[120px] px-6 py-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800/50">
                                <span
                                    className="block text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">В Сейфі</span>
                                <span
                                    className="text-2xl font-black text-amber-600 leading-none">{user?.frozen_minutes || 0}
                                    <small className="text-sm">хв</small></span>
                            </div>
                        </div>
                    </CardContent>

                    <div className="px-6 pb-6 mt-[-10px]">
                        <div
                            className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 w-full shadow-inner">
                            <div className="flex justify-between items-end mb-4">
                                <div>
                                    <span
                                        className="font-black text-slate-800 dark:text-slate-200 text-xl flex items-center gap-2">
                                        🏆 Ваші досягнення
                                        <button
                                            onClick={() => setIsAchievementInfoModalOpen(true)}
                                            className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold flex items-center justify-center hover:bg-amber-200 hover:text-amber-700 dark:hover:bg-amber-900/60 dark:hover:text-amber-300 transition-colors"
                                            title="Дізнатися більше про досягнення"
                                        >
                                            !
                                        </button>
                                    </span>
                                    <span
                                        className="text-sm text-slate-500 font-medium mt-1 block">Відкрито {unlockedAchievements.length} з {achievements.length}.</span>
                                </div>
                                <span
                                    className="font-black text-3xl text-indigo-600 dark:text-indigo-400">{progressPercent}%</span>
                            </div>
                            <div
                                className="w-full h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-6 shadow-inner">
                                <div
                                    className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-1000"
                                    style={{width: `${progressPercent}%`}}></div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                {achievements.map((badge, index) => {
                                    const isAvailable = index === 0 || achievements[index - 1].is_unlocked;
                                    const isUnlocked = badge.is_unlocked;
                                    const isClaimed = badge.is_claimed;

                                    let cardStyle = "";
                                    let badgeStyle = "";

                                    if (isUnlocked && !isClaimed) {
                                        cardStyle = "bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700 hover:scale-105 shadow-md ring-2 ring-green-500/30";
                                        badgeStyle = "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-400";
                                    } else if (isUnlocked && isClaimed) {
                                        cardStyle = "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 shadow-sm";
                                        badgeStyle = "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400";
                                    } else if (isAvailable) {
                                        cardStyle = "bg-white border-indigo-200 dark:bg-slate-800 dark:border-indigo-700/50 shadow-md ring-1 ring-indigo-500/20";
                                        badgeStyle = "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-400";
                                    } else {
                                        cardStyle = "bg-slate-50 border-slate-200 opacity-60 grayscale dark:bg-slate-900/50 dark:border-slate-800";
                                        badgeStyle = "bg-white text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700";
                                    }

                                    return (
                                        <div key={badge.id}
                                             className={`relative flex flex-col items-center p-4 rounded-2xl border text-center transition-all duration-300 ${cardStyle}`}>
                                            {!isAvailable && (
                                                <div
                                                    className="absolute top-3 right-3 text-slate-400 dark:text-slate-500">
                                                    <Lock size={16}/>
                                                </div>
                                            )}
                                            <span className="text-4xl mb-3">{badge.icon}</span>
                                            <span
                                                className="text-sm font-black text-slate-800 dark:text-slate-200 leading-tight mb-1">{badge.name}</span>
                                            <span
                                                className="text-xs font-medium text-slate-500 mb-4 leading-snug flex-1">{badge.description}</span>

                                            {isAvailable && !isUnlocked && (
                                                <div
                                                    className="w-full h-1.5 bg-slate-100 dark:bg-slate-900 rounded-full mb-3 overflow-hidden shadow-inner">
                                                    <div className="h-full bg-indigo-500 transition-all duration-1000"
                                                         style={{width: `${Math.min(100, (badge.current_progress / badge.target_progress) * 100)}%`}}></div>
                                                </div>
                                            )}

                                            {isUnlocked && !isClaimed ? (
                                                <Button
                                                    onClick={() => handleClaimBonus(badge.id, badge.bonus_minutes)}
                                                    size="sm"
                                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-xs h-8 animate-pulse shadow-md"
                                                >
                                                    🎁 Забрати {badge.bonus_minutes} хв
                                                </Button>
                                            ) : (
                                                <span
                                                    className={`text-[11px] uppercase tracking-wider font-black px-3 py-1.5 rounded-full w-full border ${badgeStyle}`}>
                                                    {isAvailable && !isUnlocked ? `${badge.current_progress} / ${badge.target_progress}` : isClaimed ? '✅ Отримано' : '🔒 Заблоковано'}
                                                </span>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </Card>

                <div
                    className="flex p-1.5 bg-slate-200/50 dark:bg-slate-900 rounded-2xl w-full border border-slate-200 dark:border-slate-800 overflow-x-auto custom-scrollbar">
                    {[
                        {
                            id: 'learning',
                            label: '📖 Моє навчання',
                            count: outgoingDeals.filter(d => d.status !== 'completed' && d.status !== 'cancelled' && d.status !== 'rejected').length
                        },
                        {
                            id: 'mentoring',
                            label: '🎓 Менторство',
                            count: incomingDeals.filter(d => d.status === 'pending' || d.status === 'cancel_requested').length
                        },
                        {id: 'skills', label: '⚡ Навички', count: 0},
                        {id: 'settings', label: '⚙️ Налаштування', count: 0}
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                                className={`flex whitespace-nowrap items-center gap-2 px-6 py-3 rounded-xl text-sm font-black transition-all flex-1 justify-center ${activeTab === tab.id ? 'bg-white dark:bg-slate-800 shadow-md text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                            {tab.label} {tab.count > 0 && <span
                            className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">{tab.count}</span>}
                        </button>
                    ))}
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">

                    {activeTab === 'learning' && (
                        <div className="grid grid-cols-1 gap-4">
                            <div className="flex justify-between items-center mb-2 px-1">
                                <h3 className="text-xl font-black text-slate-800 dark:text-slate-200">Я учень (Уроки,
                                    які я замовив)</h3>
                            </div>
                            {outgoingDeals.filter(d => d.status !== 'completed' && d.status !== 'cancelled' && d.status !== 'rejected').length === 0 ? (
                                <p className="text-slate-400 italic p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">Ви
                                    ще не записані на уроки.</p>
                            ) : (
                                outgoingDeals.filter(d => d.status !== 'completed' && d.status !== 'cancelled' && d.status !== 'rejected').map(deal => (
                                    <Card key={deal.deal_id}
                                          className="border-none shadow-sm bg-white dark:bg-slate-900 group">
                                        <CardContent
                                            className="p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                                            <div className="flex gap-4 items-center w-full md:w-auto">
                                                <div
                                                    className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl flex items-center justify-center text-2xl shrink-0">📖
                                                </div>
                                                <div className="w-full">
                                                    <div className="flex justify-between items-start">
                                                        <span
                                                            className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">{deal.status === 'pending' ? 'Очікує' : deal.status === 'accepted' ? 'Схвалено' : deal.status === 'disputed' ? 'Спір (Арбітраж)' : deal.status}</span>
                                                    </div>
                                                    <h4 className="text-xl font-bold dark:text-white leading-tight mt-1">{deal.skill_title}</h4>
                                                    <p className="text-slate-500 text-sm mt-1">Викладач: <span
                                                        className="font-bold text-slate-700 dark:text-slate-300">{deal.master_name}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-3 w-full md:w-auto justify-end">
                                                {deal.meeting_url && deal.status === 'accepted' &&
                                                    <a href={deal.meeting_url} target="_blank" rel="noreferrer"
                                                       className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold">📹
                                                        Google Meet</a>}
                                                {deal.status === 'pending' && <Button variant="outline"
                                                                                      className="border-red-200 dark:border-red-900/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-bold"
                                                                                      onClick={() => confirmAction("Скасувати? Хвилини повернуться.", () => handleDealAction(deal.deal_id, 'cancelled'))}>Скасувати</Button>}
                                                {deal.status === 'accepted' && <Button variant="outline"
                                                                                       className="border-red-200 dark:border-red-900/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-bold"
                                                                                       onClick={() => confirmAction("Виникли проблеми? Хвилини залишаться замороженими до рішення адміна.", () => handleDealAction(deal.deal_id, 'disputed'))}>🚨
                                                    Спір</Button>}
                                                {deal.status === 'accepted' && <Button variant="outline"
                                                                                       className="text-amber-600 border-amber-200 dark:border-amber-900/30 rounded-xl font-bold"
                                                                                       onClick={() => confirmAction("Запросити скасування у майстра?", () => handleDealAction(deal.deal_id, 'cancelled'))}>Запросити
                                                    скасування</Button>}
                                                {deal.status === 'accepted' && <Button
                                                    className="bg-green-600 hover:bg-green-700 rounded-xl font-bold"
                                                    onClick={() => confirmAction("Завершити урок?", () => handleCompleteDeal(deal.deal_id, deal.master_id))}>🏁
                                                    Завершити</Button>}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'mentoring' && (
                        <div className="grid grid-cols-1 gap-4">
                            <h3 className="text-xl font-black px-1 mb-2 text-slate-800 dark:text-slate-200">Я вчитель
                                (Запити до мене)</h3>
                            {incomingDeals.filter(d => d.status !== 'completed' && d.status !== 'cancelled' && d.status !== 'rejected').length === 0 ? (
                                <p className="text-slate-400 italic p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">Немає
                                    активних запитів до вас.</p>
                            ) : (
                                incomingDeals.filter(d => d.status !== 'completed' && d.status !== 'cancelled' && d.status !== 'rejected').map(deal => (
                                    <Card key={deal.deal_id}
                                          className="border-none shadow-sm bg-white dark:bg-slate-900">
                                        <CardContent
                                            className="p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                                            <div className="flex gap-4 items-center">
                                                <div
                                                    className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-2xl flex items-center justify-center text-2xl shrink-0">🎓
                                                </div>
                                                <div>
                                                    <span
                                                        className="text-[10px] font-black uppercase text-green-600 tracking-widest">{deal.status === 'cancel_requested' ? 'Запит скасування' : deal.status === 'disputed' ? 'Спір (Арбітраж)' : deal.status}</span>
                                                    <h4 className="text-xl font-bold dark:text-white leading-tight mt-1">{deal.skill_title}</h4>
                                                    <p className="text-slate-500 text-sm mt-1">Учень: <span
                                                        className="font-bold text-slate-700 dark:text-slate-300">{deal.initiator_name}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-3">
                                                {deal.status === 'cancel_requested' && (
                                                    <div
                                                        className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 p-2 pr-3 rounded-2xl border border-red-100 dark:border-red-900/50">
                                                        <span className="text-xs font-bold text-red-600 px-2">Учень скасовує:</span>
                                                        <Button size="sm"
                                                                className="bg-red-600 hover:bg-red-700 rounded-xl"
                                                                onClick={() => handleDealAction(deal.deal_id, 'cancelled')}>Підтвердити</Button>
                                                    </div>
                                                )}
                                                {deal.status === 'pending' && (
                                                    <div className="flex flex-col gap-2 w-full md:w-[280px]">
                                                        {acceptingDealId === deal.deal_id ? (
                                                            <div
                                                                className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm animate-in fade-in zoom-in w-full">
                                                                <Label
                                                                    className="text-indigo-800 dark:text-indigo-300 font-bold mb-2 block">Запропонуйте
                                                                    дату і час:</Label>
                                                                <Input type="datetime-local"
                                                                       className="mb-4 bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-white w-full shadow-sm"
                                                                       value={scheduledTime}
                                                                       onChange={e => setScheduledTime(e.target.value)}/>
                                                                <div className="flex flex-col gap-2 w-full">
                                                                    <Button
                                                                        onClick={() => handleDealAction(deal.deal_id, 'accepted', scheduledTime)}
                                                                        className="bg-blue-600 hover:bg-blue-700 w-full text-white font-bold"
                                                                        disabled={!scheduledTime}>Схвалити та створити
                                                                        Meet</Button>
                                                                    <Button variant="outline"
                                                                            onClick={() => setAcceptingDealId(null)}
                                                                            className="w-full dark:border-slate-700 dark:text-slate-300">Скасувати</Button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex gap-2 w-full">
                                                                <Button onClick={() => setAcceptingDealId(deal.deal_id)}
                                                                        className="bg-green-600 hover:bg-green-700 flex-1 font-bold">Прийняти</Button>
                                                                <Button
                                                                    onClick={() => handleDealAction(deal.deal_id, 'rejected')}
                                                                    className="bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40 flex-1 font-bold">Відхилити</Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {deal.meeting_url && deal.status === 'accepted' &&
                                                    <a href={deal.meeting_url} target="_blank" rel="noreferrer"
                                                       className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center h-full">📹
                                                        Ввійти у Google Meet</a>}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'skills' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-8">
                                <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
                                    <CardHeader><CardTitle className="text-slate-800 dark:text-slate-200">Мої
                                        оголошення</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        {skills.length === 0 &&
                                            <p className="text-slate-500">У вас ще немає створених навичок.</p>}
                                        {skills.map(skill => (
                                            <div key={skill.id}
                                                 className={`p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center transition-all ${!skill.is_active ? 'opacity-50' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                                                <div>
                                                    <h4 className="font-bold text-lg dark:text-white">{skill.title}</h4>
                                                    <span
                                                        className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">{skill.price} хв</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button variant="outline" size="sm"
                                                            onClick={() => handleToggleSkill(skill.id)}
                                                            className="dark:border-slate-700 dark:text-slate-300">{skill.is_active ? "Вимкнути" : "Увімкнути"}</Button>
                                                    <Button variant="outline" size="sm"
                                                            className="text-red-500 border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                            onClick={() => handleDeleteSkill(skill.id)}>🗑️</Button>
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>

                                <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
                                    <CardHeader><CardTitle className="text-slate-800 dark:text-slate-200">Відгуки про
                                        мене</CardTitle></CardHeader>
                                    <CardContent>
                                        {reviews.length > 0 && (
                                            <div
                                                className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-200 dark:border-slate-800 mb-4">
                                                <div className="space-y-2">
                                                    {[5, 4, 3, 2, 1].map(star => {
                                                        const count = reviewCounts[star as keyof typeof reviewCounts];
                                                        const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                                                        const isSelected = reviewFilter === star;
                                                        return (
                                                            <div
                                                                key={star}
                                                                className={`flex items-center gap-2 cursor-pointer p-1.5 rounded-lg transition-all ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-200 dark:ring-indigo-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
                                                                onClick={() => setReviewFilter(isSelected ? null : star)}
                                                            >
                                                                <span
                                                                    className="w-8 text-sm font-bold text-slate-700 dark:text-slate-300">{star} ⭐</span>
                                                                <div
                                                                    className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-yellow-400"
                                                                         style={{width: `${percentage}%`}}></div>
                                                                </div>
                                                                <span
                                                                    className="w-6 text-right text-sm font-medium text-slate-500 dark:text-slate-400">{count}</span>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                                {reviewFilter && (
                                                    <Button variant="outline" size="sm"
                                                            onClick={() => setReviewFilter(null)}
                                                            className="w-full mt-3 text-slate-600 dark:text-slate-300 dark:border-slate-700 h-8">
                                                        ❌ Скинути фільтр
                                                    </Button>
                                                )}
                                            </div>
                                        )}

                                        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                            {reviews.length === 0 ? (
                                                <p className="text-slate-500 text-center">Ще немає відгуків.</p>
                                            ) : filteredReviews.length === 0 ? (
                                                <p className="text-slate-500 text-center bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl">Немає
                                                    відгуків з оцінкою {reviewFilter} ⭐</p>
                                            ) : (
                                                filteredReviews.map(review => (
                                                    <div key={review.id}
                                                         className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span
                                                                className="font-bold text-slate-800 dark:text-slate-200">{review.reviewer_name}</span>
                                                            <span
                                                                className="text-yellow-500 text-sm">{"⭐".repeat(review.score)}</span>
                                                        </div>
                                                        {review.comment &&
                                                            <p className="text-slate-600 dark:text-slate-300 text-sm bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50 transition-colors mt-2 break-words whitespace-pre-wrap">"{review.comment}"</p>}
                                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">{formatDate(review.created_at)}</p>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className="border-none shadow-sm bg-white dark:bg-slate-900 h-fit">
                                <CardHeader><CardTitle className="text-slate-800 dark:text-slate-200">Створити нове
                                    оголошення</CardTitle></CardHeader>
                                <CardContent>
                                    <form onSubmit={handleCreateSkill} className="space-y-4">
                                        <div
                                            className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                            <button type="button" onClick={() => setSkillType("teach")}
                                                    className={`py-2 rounded-md text-sm font-bold transition-all ${skillType === 'teach' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-300' : 'text-slate-500'}`}>Я
                                                можу навчити
                                            </button>
                                            <button type="button" onClick={() => setSkillType("learn")}
                                                    className={`py-2 rounded-md text-sm font-bold transition-all ${skillType === 'learn' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-300' : 'text-slate-500'}`}>Я
                                                хочу навчитися
                                            </button>
                                        </div>
                                        <Input placeholder="Назва (напр: Уроки англійської)" value={title}
                                               onChange={e => setTitle(e.target.value)} required
                                               className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"/>
                                        <textarea
                                            className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                            rows={3} placeholder="Опис навички..." value={description}
                                            onChange={e => setDescription(e.target.value)} required/>
                                        <div>
                                            <Label className="dark:text-slate-300 mb-1 block">Ціна (у хвилинах за
                                                сеанс)</Label>
                                            <Input type="number" min="10" value={price}
                                                   onChange={e => setPrice(Number(e.target.value))} required
                                                   className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"/>
                                        </div>
                                        <Button type="submit"
                                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12">Опублікувати</Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* НАЛАШТУВАННЯ */}
                    {activeTab === 'settings' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle className="text-slate-800 dark:text-slate-200">Особисті дані</CardTitle>
                                    <Button variant="outline" size="sm"
                                            onClick={() => setIsEditingProfile(!isEditingProfile)}
                                            className="dark:border-slate-700 dark:text-slate-300">
                                        {isEditingProfile ? "Скасувати" : "✏️ Редагувати"}
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    {isEditingProfile ? (
                                        <form onSubmit={handleUpdateProfile} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label className="dark:text-slate-300">Фото профілю</Label>
                                                <div
                                                    className="border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 rounded-xl p-6 text-center cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 flex flex-col items-center gap-3"
                                                    onDragOver={handleDragOver} onDrop={handleDrop}
                                                    onClick={() => fileInputRef.current?.click()}>
                                                    <input type="file" ref={fileInputRef} className="hidden"
                                                           accept="image/*" onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleImageUpload(file)
                                                    }}/>
                                                    {editForm.avatar_url ? <img src={editForm.avatar_url} alt="Preview"
                                                                                className="w-20 h-20 rounded-full object-cover border-4 border-white dark:border-slate-700 shadow-sm"/> :
                                                        <div
                                                            className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl border-4 border-white dark:border-slate-700">📷</div>}
                                                </div>
                                            </div>
                                            <div className="space-y-2"><Label
                                                className="dark:text-slate-300">Нікнейм</Label><Input
                                                value={editForm.username}
                                                onChange={e => setEditForm({...editForm, username: e.target.value})}
                                                className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"/>
                                            </div>
                                            <div className="space-y-2"><Label
                                                className="dark:text-slate-300">Телефон</Label><Input
                                                value={editForm.phone}
                                                onChange={e => setEditForm({...editForm, phone: e.target.value})}
                                                className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"/>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="dark:text-slate-300">Місто</Label>
                                                <select value={editForm.city_id} onChange={(e) => setEditForm({
                                                    ...editForm,
                                                    city_id: Number(e.target.value)
                                                })}
                                                        className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white outline-none">
                                                    <option value="0">Оберіть місто...</option>
                                                    {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-2"><Label
                                                className="dark:text-slate-300">Біографія</Label><Input
                                                value={editForm.bio}
                                                onChange={e => setEditForm({...editForm, bio: e.target.value})}
                                                className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"/>
                                            </div>
                                            <Button type="submit"
                                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 mt-4">Зберегти
                                                зміни</Button>
                                        </form>
                                    ) : (
                                        <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
                                            <p className="italic text-slate-500">{user?.bio || "Біографія не вказана."}</p>
                                            <div
                                                className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                                <p>📱 <span
                                                    className="font-bold">Телефон:</span> {user?.phone_number || "Не вказано"}
                                                </p>
                                                <p>📍 <span
                                                    className="font-bold">Місто:</span> {cities.find(c => c.id === user?.city_id)?.name || "Не вказано"}
                                                </p>
                                                <p>📧 <span
                                                    className="font-bold">Email:</span> {user?.email || "Не підтверджено"}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <div className="space-y-6">

                                {!isVerified && (
                                    <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
                                        <CardHeader><CardTitle className="text-slate-800 dark:text-slate-200">Верифікація
                                            акаунту</CardTitle></CardHeader>
                                        <CardContent className="space-y-4">
                                            {!user?.email && (
                                                <div
                                                    className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                                    <h4 className="font-bold text-slate-900 dark:text-white mb-2">Підтвердити
                                                        Email</h4>
                                                    {!isCodeSent ? (
                                                        <div className="flex gap-2"><Input type="email"
                                                                                           placeholder="mail@example.com"
                                                                                           value={kycEmail}
                                                                                           onChange={e => setKycEmail(e.target.value)}
                                                                                           className="dark:bg-slate-900 dark:border-slate-600 dark:text-white"/><Button
                                                            onClick={sendEmailVerification}
                                                            className="bg-indigo-600 text-white">Відправити</Button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-2"><Input type="text"
                                                                                           placeholder="Код з пошти"
                                                                                           value={kycCode}
                                                                                           onChange={e => setKycCode(e.target.value)}
                                                                                           className="dark:bg-slate-900 dark:border-slate-600 dark:text-white"/><Button
                                                            onClick={confirmEmailVerification}
                                                            className="bg-green-600 text-white">Перевірити</Button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}

                                {/* ІНТЕГРАЦІЇ */}
                                <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
                                    <CardHeader><CardTitle className="text-slate-800 dark:text-slate-200">Інтеграції та
                                        Безпека</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        {/* TELEGRAM */}
                                        {!user?.telegram_id ? (
                                            <div
                                                className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                                                <h4 className="font-bold text-blue-900 dark:text-blue-400 mb-2">Прив'язати
                                                    Telegram</h4>
                                                <p className="text-sm text-slate-500 mb-4">Отримуйте миттєві сповіщення
                                                    про нові повідомлення та уроки.</p>
                                                <Button onClick={generateTelegramLink} disabled={isLinkingTg}
                                                        className="w-full bg-[#0088cc] hover:bg-[#0077b3] text-white font-bold">✈️
                                                    Підключити Telegram</Button>
                                            </div>
                                        ) : (
                                            <div
                                                className="p-4 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-200 dark:border-green-900/30 flex items-center justify-between">
                                                <span className="font-bold text-green-700 dark:text-green-400">Telegram підключено</span>
                                                <span>✅</span>
                                            </div>
                                        )}

                                        {/* ПІДТВЕРДЖЕННЯ ВІКУ */}
                                        {!user?.birth_date ? (
                                            <div
                                                className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-900/30">
                                                <h4 className="font-bold text-amber-900 dark:text-amber-400 mb-2">Підтвердження
                                                    віку</h4>
                                                <p className="text-sm text-amber-700/80 dark:text-amber-400/80 mb-4">Вкажіть
                                                    дату народження для отримання повного доступу до платформи (від 14
                                                    років).</p>
                                                <div className="flex gap-2">
                                                    <Input
                                                        type="date"
                                                        value={birthDate}
                                                        onChange={e => setBirthDate(e.target.value)}
                                                        className="dark:bg-slate-900 dark:border-slate-700 dark:text-white flex-1"
                                                        max={new Date().toISOString().split("T")[0]}
                                                    />
                                                    <Button onClick={handleSaveBirthDate}
                                                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-6">Зберегти</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div
                                                className="p-4 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-200 dark:border-green-900/30 flex items-center justify-between">
                                                <div>
                                                    <span
                                                        className="font-bold text-green-700 dark:text-green-400 block">Вік підтверджено</span>
                                                    <span className="text-xs text-green-600/70 dark:text-green-400/70">
                                                        {new Date(user.birth_date).toLocaleDateString('uk-UA')}
                                                    </span>
                                                </div>
                                                <span>✅</span>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}