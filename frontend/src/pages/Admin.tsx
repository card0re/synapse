import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import toast from 'react-hot-toast'
import { Users, Activity, Briefcase, BookOpen, Lock, Wallet, TrendingUp, Newspaper, LayoutDashboard, ShieldAlert, Scale } from "lucide-react"

interface SystemStats { total_users: number; total_skills: number; total_deals: number; completed_deals: number; total_circulating: number; total_frozen: number }
interface User { id: string; username: string; email: string; phone_number: string; balance_minutes: number; frozen_minutes: number; role: string; rating: number; is_banned: boolean }
interface Deal { id: string; skill_title: string; initiator_name: string; master_name: string; status: string; created_at: string }
interface Skill { id: string; title: string; user_name: string; price: number; is_active: boolean }
interface NewsItem { id: number; title: string; content: string; created_at: string }
interface Report { id: string; reporter_name: string; target_type: string; target_info: string; reason: string; details: string; created_at: string; status: string }

export default function Admin() {
    const navigate = useNavigate()
    const token = localStorage.getItem("token")
    const role = localStorage.getItem("role")

    const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'deals' | 'skills' | 'news' | 'reports' | 'arbitration'>('dashboard')

    const [stats, setStats] = useState<SystemStats | null>(null)
    const [users, setUsers] = useState<User[]>([])
    const [deals, setDeals] = useState<Deal[]>([])
    const [skills, setSkills] = useState<Skill[]>([])
    const [news, setNews] = useState<NewsItem[]>([])
    const [reports, setReports] = useState<Report[]>([])
    const [loading, setLoading] = useState(true)

    const [newsTitle, setNewsTitle] = useState("")
    const [newsContent, setNewsContent] = useState("")

    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [editingDeal, setEditingDeal] = useState<Deal | null>(null)
    const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
    const [editingNews, setEditingNews] = useState<NewsItem | null>(null)

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
        if (!token || role !== "admin") { navigate("/feed"); return }
        loadData()
    }, [token, role, navigate])

    const loadData = async () => {
        setLoading(true)
        try {
            const [statsRes, dealsRes, skillsRes, newsRes, reportsRes] = await Promise.all([
                fetch("https://api.synapse.tel/api/admin/stats", { headers: { "Authorization": `Bearer ${token}` } }),
                fetch("https://api.synapse.tel/api/admin/deals", { headers: { "Authorization": `Bearer ${token}` } }),
                fetch("https://api.synapse.tel/api/admin/skills", { headers: { "Authorization": `Bearer ${token}` } }),
                fetch("https://api.synapse.tel/api/news", { headers: { "Authorization": `Bearer ${token}` } }),
                fetch("https://api.synapse.tel/api/admin/reports", { headers: { "Authorization": `Bearer ${token}` } })
            ])
            if (statsRes.ok) { const data = await statsRes.json(); setStats(data.stats); setUsers(data.users || []) }
            if (dealsRes.ok) { const data = await dealsRes.json(); setDeals(data.deals || []) }
            if (skillsRes.ok) { const data = await skillsRes.json(); setSkills(data.skills || []) }
            if (newsRes.ok) { const data = await newsRes.json(); setNews(data.news || []) }
            if (reportsRes.ok) { const data = await reportsRes.json(); setReports(data.reports || []) }
        } catch (error) { toast.error("Помилка завантаження даних") } finally { setLoading(false) }
    }

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault(); if (!editingUser) return;
        const res = await fetch(`https://api.synapse.tel/api/admin/users/${editingUser.id}`, {
            method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                username: editingUser.username, email: editingUser.email, phone_number: editingUser.phone_number,
                balance_minutes: Number(editingUser.balance_minutes), role: editingUser.role, rating: Number(editingUser.rating || 5)
            })
        })
        if (res.ok) { toast.success("Юзера оновлено"); setEditingUser(null); loadData(); } else { toast.error("Помилка") }
    }

    const handleSaveDeal = async (e: React.FormEvent) => {
        e.preventDefault(); if (!editingDeal) return;
        const res = await fetch(`https://api.synapse.tel/api/deals/${editingDeal.id}/status`, {
            method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ status: editingDeal.status })
        })
        if (res.ok) { toast.success("Статус угоди змінено"); setEditingDeal(null); loadData(); } else { toast.error("Помилка") }
    }

    const handleSaveSkill = async (e: React.FormEvent) => {
        e.preventDefault(); if (!editingSkill) return;
        const res = await fetch(`https://api.synapse.tel/api/admin/skills/${editingSkill.id}`, {
            method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ title: editingSkill.title, price: Number(editingSkill.price), is_active: editingSkill.is_active })
        })
        if (res.ok) { toast.success("Навичку оновлено"); setEditingSkill(null); loadData(); } else { toast.error("Помилка (Можливо бекенд ще не підтримує всі поля)") }
    }

    const handleSaveNews = async (e: React.FormEvent) => {
        e.preventDefault(); if (!editingNews) return;
        const res = await fetch(`https://api.synapse.tel/api/admin/news/${editingNews.id}`, {
            method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ title: editingNews.title, content: editingNews.content })
        })
        if (res.ok) { toast.success("Новину оновлено"); setEditingNews(null); loadData(); } else { toast.error("Помилка") }
    }

    const resolveReport = async (id: string, status: 'resolved' | 'dismissed') => {
        const res = await fetch(`https://api.synapse.tel/api/admin/reports/${id}/resolve`, {
            method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ status })
        })
        if (res.ok) { toast.success("Скаргу оброблено"); loadData() } else { toast.error("Помилка") }
    }

    const resolveDispute = async (dealId: string, resolution: 'completed' | 'cancelled') => {
        confirmAction(resolution === 'completed' ? "Завершити і зарахувати хвилини майстру?" : "Скасувати і повернути хвилини учню?", async () => {
            const res = await fetch(`https://api.synapse.tel/api/deals/${dealId}/status`, {
                method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ status: resolution })
            });
            if (res.ok) { toast.success("Спір вирішено!"); loadData(); }
            else { toast.error("Помилка сервера"); }
        });
    }

    const toggleBan = (id: string) => { confirmAction("Змінити статус блокування?", async () => { await fetch(`https://api.synapse.tel/api/admin/users/${id}/ban`, { method: "PUT", headers: { "Authorization": `Bearer ${token}` } }); loadData() }) }
    const cancelDeal = (id: string) => { confirmAction("Примусово скасувати угоду?", async () => { await fetch(`https://api.synapse.tel/api/admin/deals/${id}/cancel`, { method: "PUT", headers: { "Authorization": `Bearer ${token}` } }); toast.success("Угоду скасовано"); loadData() }) }
    const deleteSkill = (id: string) => { confirmAction("Видалити це оголошення назавжди?", async () => { await fetch(`https://api.synapse.tel/api/admin/skills/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } }); toast.success("Оголошення видалено"); loadData() }) }
    const deleteNews = (id: number) => { confirmAction("Видалити новину?", async () => { await fetch(`https://api.synapse.tel/api/admin/news/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } }); toast.success("Новину видалено"); loadData() }) }

    const handleCreateNews = async (e: React.FormEvent) => {
        e.preventDefault()
        const res = await fetch("https://api.synapse.tel/api/admin/news", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ title: newsTitle, content: newsContent }) })
        if (res.ok) { toast.success("Новину опубліковано!"); setNewsTitle(""); setNewsContent(""); loadData() }
    }

    if (loading) return <div className="p-10 text-center font-bold text-slate-500">Завантаження системних даних...</div>

    const successRate = stats?.total_deals ? Math.round((stats.completed_deals / stats.total_deals) * 100) : 0
    const frozenRatio = stats?.total_circulating && stats.total_circulating > 0 ? Math.round((stats.total_frozen / stats.total_circulating) * 100) : 0

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 p-4 md:p-8 font-sans transition-colors duration-300 relative">

            {editingUser && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in">
                    <Card className="w-full max-w-md shadow-2xl border-none bg-white dark:bg-slate-900">
                        <CardHeader><CardTitle className="dark:text-white">Редагування Користувача</CardTitle></CardHeader>
                        <CardContent>
                            <form onSubmit={handleSaveUser} className="space-y-4">
                                <div><Label>Нікнейм</Label><Input value={editingUser.username} onChange={e => setEditingUser({...editingUser, username: e.target.value})} className="dark:bg-slate-800 dark:text-white dark:border-slate-700"/></div>
                                <div><Label>Email</Label><Input value={editingUser.email || ""} onChange={e => setEditingUser({...editingUser, email: e.target.value})} className="dark:bg-slate-800 dark:text-white dark:border-slate-700"/></div>
                                <div><Label>Телефон</Label><Input value={editingUser.phone_number || ""} onChange={e => setEditingUser({...editingUser, phone_number: e.target.value})} className="dark:bg-slate-800 dark:text-white dark:border-slate-700"/></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><Label>Баланс (хв)</Label><Input type="number" value={editingUser.balance_minutes} onChange={e => setEditingUser({...editingUser, balance_minutes: Number(e.target.value)})} className="dark:bg-slate-800 dark:text-white dark:border-slate-700"/></div>
                                    <div><Label>Рейтинг</Label><Input type="number" step="0.1" value={editingUser.rating || 5} onChange={e => setEditingUser({...editingUser, rating: Number(e.target.value)})} className="dark:bg-slate-800 dark:text-white dark:border-slate-700"/></div>
                                </div>
                                <div>
                                    <Label>Роль</Label>
                                    <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})} className="w-full p-2 rounded-md border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                                        <option value="user">User</option><option value="admin">Admin</option>
                                    </select>
                                </div>
                                <div className="flex gap-2 pt-4">
                                    <Button type="button" variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setEditingUser(null)}>Скасувати</Button>
                                    <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700">Зберегти</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}

            {editingDeal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in">
                    <Card className="w-full max-w-sm shadow-2xl border-none bg-white dark:bg-slate-900">
                        <CardHeader><CardTitle className="dark:text-white">Статус угоди: {editingDeal.skill_title}</CardTitle></CardHeader>
                        <CardContent>
                            <form onSubmit={handleSaveDeal} className="space-y-4">
                                <div>
                                    <Label>Новий статус</Label>
                                    <select value={editingDeal.status} onChange={e => setEditingDeal({...editingDeal, status: e.target.value})} className="w-full p-2 mt-1 rounded-md border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                                        <option value="pending">Pending (Очікує)</option>
                                        <option value="accepted">Accepted (Схвалено)</option>
                                        <option value="completed">Completed (Завершено)</option>
                                        <option value="cancelled">Cancelled (Скасовано)</option>
                                        <option value="rejected">Rejected (Відхилено)</option>
                                    </select>
                                </div>
                                <div className="flex gap-2 pt-4">
                                    <Button type="button" variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setEditingDeal(null)}>Скасувати</Button>
                                    <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700">Зберегти</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}

            {editingSkill && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in">
                    <Card className="w-full max-w-md shadow-2xl border-none bg-white dark:bg-slate-900">
                        <CardHeader><CardTitle className="dark:text-white">Редагувати оголошення</CardTitle></CardHeader>
                        <CardContent>
                            <form onSubmit={handleSaveSkill} className="space-y-4">
                                <div><Label>Назва</Label><Input value={editingSkill.title} onChange={e => setEditingSkill({...editingSkill, title: e.target.value})} className="dark:bg-slate-800 dark:text-white dark:border-slate-700"/></div>
                                <div><Label>Ціна (хв)</Label><Input type="number" value={editingSkill.price} onChange={e => setEditingSkill({...editingSkill, price: Number(e.target.value)})} className="dark:bg-slate-800 dark:text-white dark:border-slate-700"/></div>
                                <div>
                                    <Label>Статус</Label>
                                    <select value={editingSkill.is_active ? "true" : "false"} onChange={e => setEditingSkill({...editingSkill, is_active: e.target.value === "true"})} className="w-full p-2 mt-1 rounded-md border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                                        <option value="true">Активно</option><option value="false">Вимкнено</option>
                                    </select>
                                </div>
                                <div className="flex gap-2 pt-4">
                                    <Button type="button" variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setEditingSkill(null)}>Скасувати</Button>
                                    <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700">Зберегти</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}

            {editingNews && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in">
                    <Card className="w-full max-w-lg shadow-2xl border-none bg-white dark:bg-slate-900">
                        <CardHeader><CardTitle className="dark:text-white">Редагувати новину</CardTitle></CardHeader>
                        <CardContent>
                            <form onSubmit={handleSaveNews} className="space-y-4">
                                <div><Label>Заголовок</Label><Input value={editingNews.title} onChange={e => setEditingNews({...editingNews, title: e.target.value})} className="dark:bg-slate-800 dark:text-white dark:border-slate-700"/></div>
                                <div>
                                    <Label>Текст</Label>
                                    <textarea value={editingNews.content} onChange={e => setEditingNews({...editingNews, content: e.target.value})} rows={5} className="w-full p-3 mt-1 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none" />
                                </div>
                                <div className="flex gap-2 pt-4">
                                    <Button type="button" variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setEditingNews(null)}>Скасувати</Button>
                                    <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700">Зберегти</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="max-w-7xl mx-auto space-y-6 relative z-10">

                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
                            <Activity size={28} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 dark:text-white">System Cell Amar</h1>
                            <p className="text-sm text-slate-500 font-medium tracking-wide uppercase">Глобальний менеджер платформи</p>
                        </div>
                    </div>
                </div>

                <div className="flex overflow-x-auto bg-white dark:bg-slate-900 p-1.5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 custom-scrollbar">
                    {[
                        { id: 'dashboard', icon: LayoutDashboard, label: 'Дашборд' },
                        { id: 'users', icon: Users, label: 'Користувачі' },
                        { id: 'skills', icon: BookOpen, label: 'Оголошення' },
                        { id: 'deals', icon: Briefcase, label: 'Угоди' },
                        { id: 'reports', icon: ShieldAlert, label: `Скарги (${reports.length})` },
                        { id: 'arbitration', icon: Scale, label: `Арбітраж (${deals.filter(d => d.status === 'disputed').length})` },
                        { id: 'news', icon: Newspaper, label: 'Новини' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold transition-all flex-1 justify-center whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                        >
                            <tab.icon size={18} /> {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'dashboard' && stats && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <Card className="border-none shadow-sm bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/50 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10"><Users size={80} /></div>
                                <CardContent className="p-6">
                                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Користувачі</p>
                                    <h3 className="text-4xl font-black text-slate-800 dark:text-white">{stats.total_users}</h3>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-sm bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/50 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10 text-indigo-500"><BookOpen size={80} /></div>
                                <CardContent className="p-6">
                                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Активні навички</p>
                                    <h3 className="text-4xl font-black text-indigo-600 dark:text-indigo-400">{stats.total_skills}</h3>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-sm bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/50 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10 text-green-500"><TrendingUp size={80} /></div>
                                <CardContent className="p-6">
                                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Всього угод</p>
                                    <h3 className="text-4xl font-black text-green-600 dark:text-green-400">{stats.total_deals}</h3>
                                    <p className="text-xs font-bold text-slate-400 mt-2">Успішних: {stats.completed_deals}</p>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-sm bg-gradient-to-br from-indigo-500 to-blue-600 text-white relative overflow-hidden lg:col-span-2">
                                <div className="absolute top-0 right-0 p-4 opacity-20"><Wallet size={120} /></div>
                                <CardContent className="p-6 relative z-10 flex flex-col justify-center h-full">
                                    <p className="text-sm font-bold text-indigo-100 uppercase tracking-wider mb-2">Економіка: Хвилин в обігу</p>
                                    <h3 className="text-5xl font-black">{stats.total_circulating} <span className="text-2xl font-medium text-indigo-200">хв</span></h3>
                                    <div className="mt-4">
                                        <div className="flex justify-between text-xs font-bold text-indigo-100 mb-1">
                                            <span>Вільні на балансах</span>
                                            <span>Заморожені ({frozenRatio}%)</span>
                                        </div>
                                        <div className="w-full h-3 bg-indigo-900/50 rounded-full overflow-hidden">
                                            <div className="h-full bg-yellow-400" style={{ width: `${frozenRatio}%` }}></div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-sm bg-gradient-to-br from-amber-500 to-orange-500 text-white relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-20"><Lock size={80} /></div>
                                <CardContent className="p-6 relative z-10">
                                    <p className="text-sm font-bold text-amber-100 uppercase tracking-wider mb-2">В Сейфах (Холдінг)</p>
                                    <h3 className="text-4xl font-black">{stats.total_frozen}</h3>
                                    <p className="text-xs font-medium text-amber-100 mt-2">Очікують підтвердження угод</p>
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
                            <CardHeader><CardTitle className="text-slate-800 dark:text-slate-200 flex items-center gap-2"><Activity size={20} className="text-blue-500"/> Здоров'я платформи</CardTitle></CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-sm mb-1 font-bold dark:text-slate-300">
                                            <span>Конверсія угод (Успішні / Всього)</span>
                                            <span className={successRate > 50 ? "text-green-500" : "text-amber-500"}>{successRate}%</span>
                                        </div>
                                        <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className={`h-full ${successRate > 50 ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${successRate}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === 'users' && (
                    <Card className="border-none shadow-sm bg-white dark:bg-slate-900 animate-in fade-in">
                        <CardHeader><CardTitle className="text-slate-800 dark:text-slate-200">Управління користувачами</CardTitle></CardHeader>
                        <CardContent className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50 dark:text-slate-400">
                                <tr>
                                    <th className="px-4 py-3 rounded-tl-lg">ID / Ім'я</th>
                                    <th className="px-4 py-3">Контакти</th>
                                    <th className="px-4 py-3 text-right">Баланс / Сейф</th>
                                    <th className="px-4 py-3 text-center">Роль</th>
                                    <th className="px-4 py-3 rounded-tr-lg text-center">Дії</th>
                                </tr>
                                </thead>
                                <tbody>
                                {users.map(user => (
                                    <tr key={user.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-slate-900 dark:text-white">{user.username}</div>
                                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{user.id.substring(0, 8)}...</div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                            <div>{user.email || '—'}</div>
                                            <div className="text-xs text-slate-400">{user.phone_number || '—'}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="font-black text-indigo-600 dark:text-indigo-400">{user.balance_minutes}</div>
                                            <div className="text-xs font-bold text-amber-500">{user.frozen_minutes}</div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${user.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                                                    {user.role}
                                                </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex gap-2 justify-center">
                                                <Button size="sm" variant="outline" onClick={() => setEditingUser(user)} className="h-8 font-bold dark:border-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-600">✏️ Редагувати</Button>
                                                <Button size="sm" onClick={() => toggleBan(user.id)} className={`h-8 font-bold ${user.is_banned ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'}`}>
                                                    {user.is_banned ? 'Розблокувати' : 'Забанити'}
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                )}

                {activeTab === 'skills' && (
                    <Card className="border-none shadow-sm bg-white dark:bg-slate-900 animate-in fade-in">
                        <CardHeader><CardTitle className="text-slate-800 dark:text-slate-200">Оголошення (Навички)</CardTitle></CardHeader>
                        <CardContent className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50 dark:text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">Назва</th>
                                    <th className="px-4 py-3">Автор</th>
                                    <th className="px-4 py-3 text-center">Ціна</th>
                                    <th className="px-4 py-3 text-center">Статус</th>
                                    <th className="px-4 py-3 text-center">Дії</th>
                                </tr>
                                </thead>
                                <tbody>
                                {skills.map(skill => (
                                    <tr key={skill.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/20">
                                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{skill.title}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{skill.user_name}</td>
                                        <td className="px-4 py-3 text-center font-black text-indigo-600 dark:text-indigo-400">{skill.price}</td>
                                        <td className="px-4 py-3 text-center">
                                            {skill.is_active ? <span className="text-green-500 font-bold text-xs">Активно</span> : <span className="text-slate-400 font-bold text-xs">Вимкнено</span>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex gap-2 justify-center">
                                                <Button size="sm" variant="outline" onClick={() => setEditingSkill(skill)} className="h-8 font-bold dark:border-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-600">✏️ Редагувати</Button>
                                                <Button size="sm" variant="destructive" onClick={() => deleteSkill(skill.id)} className="h-8 font-bold">Видалити</Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                )}

                {activeTab === 'deals' && (
                    <Card className="border-none shadow-sm bg-white dark:bg-slate-900 animate-in fade-in">
                        <CardHeader><CardTitle className="text-slate-800 dark:text-slate-200">Всі угоди</CardTitle></CardHeader>
                        <CardContent className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50 dark:text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">Оголошення</th>
                                    <th className="px-4 py-3">Учень → Майстер</th>
                                    <th className="px-4 py-3 text-center">Статус</th>
                                    <th className="px-4 py-3 text-center">Дії</th>
                                </tr>
                                </thead>
                                <tbody>
                                {deals.map(deal => (
                                    <tr key={deal.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/20">
                                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{deal.skill_title}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                            {deal.initiator_name} <span className="text-slate-400 px-1">→</span> {deal.master_name}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider
                                                    ${deal.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                    deal.status === 'pending' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                        deal.status === 'accepted' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                                                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                    {deal.status}
                                                </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex gap-2 justify-center">
                                                <Button size="sm" variant="outline" onClick={() => setEditingDeal(deal)} className="h-8 font-bold dark:border-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-600">✏️ Редагувати</Button>
                                                {deal.status !== 'completed' && deal.status !== 'cancelled' && deal.status !== 'rejected' && (
                                                    <Button size="sm" variant="outline" onClick={() => cancelDeal(deal.id)} className="border-red-200 text-red-500 hover:bg-red-50 h-8 text-xs font-bold">Скасувати примусово</Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                )}

                {/* 5. СКАРГИ */}
                {activeTab === 'reports' && (
                    <Card className="border-none shadow-sm bg-white dark:bg-slate-900 animate-in fade-in">
                        <CardHeader><CardTitle className="text-slate-800 dark:text-slate-200">Скарги на розгляд</CardTitle></CardHeader>
                        <CardContent className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50 dark:text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">Від кого</th>
                                    <th className="px-4 py-3">На що скарга</th>
                                    <th className="px-4 py-3">Причина</th>
                                    <th className="px-4 py-3">Деталі</th>
                                    <th className="px-4 py-3 text-center">Дії</th>
                                </tr>
                                </thead>
                                <tbody>
                                {reports.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center p-8 text-slate-500">Немає нових скарг 🎉</td></tr>
                                ) : (
                                    reports.map(rep => (
                                        <tr key={rep.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/20">
                                            <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{rep.reporter_name}</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                <span className="text-xs font-bold uppercase bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md mr-2">{rep.target_type}</span>
                                                {rep.target_info}
                                            </td>
                                            <td className="px-4 py-3 font-bold text-red-500">{rep.reason}</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-xs truncate" title={rep.details}>{rep.details || '—'}</td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex gap-2 justify-center">
                                                    <Button size="sm" onClick={() => resolveReport(rep.id, 'resolved')} className="h-8 font-bold bg-green-600 hover:bg-green-700">Вирішено</Button>
                                                    <Button size="sm" variant="outline" onClick={() => resolveReport(rep.id, 'dismissed')} className="h-8 font-bold border-red-200 text-red-500 hover:bg-red-50">Відхилити</Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                )}

                {/* 5.5 АРБІТРАЖ */}
                {activeTab === 'arbitration' && (
                    <Card className="border-none shadow-sm bg-white dark:bg-slate-900 animate-in fade-in">
                        <CardHeader><CardTitle className="text-slate-800 dark:text-slate-200">Арбітраж (Спірні угоди)</CardTitle></CardHeader>
                        <CardContent className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50 dark:text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">Оголошення</th>
                                    <th className="px-4 py-3">Учень → Майстер</th>
                                    <th className="px-4 py-3 text-center">Рішення</th>
                                </tr>
                                </thead>
                                <tbody>
                                {deals.filter(d => d.status === 'disputed').length === 0 ? (
                                    <tr><td colSpan={3} className="text-center p-8 text-slate-500">Немає відкритих спорів 🎉</td></tr>
                                ) : (
                                    deals.filter(d => d.status === 'disputed').map(deal => (
                                        <tr key={deal.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/20">
                                            <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{deal.skill_title}</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{deal.initiator_name} <span className="text-slate-400 px-1">→</span> {deal.master_name}</td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex gap-2 justify-center">
                                                    <Button size="sm" onClick={() => resolveDispute(deal.id, 'cancelled')} className="h-8 font-bold border-amber-200 text-amber-600 hover:bg-amber-50">Учню</Button>
                                                    <Button size="sm" onClick={() => resolveDispute(deal.id, 'completed')} className="h-8 font-bold bg-indigo-600 hover:bg-indigo-700 text-white">Майстру</Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                )}

                {/* 6. НОВИНИ */}
                {activeTab === 'news' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
                        <Card className="lg:col-span-1 border-none shadow-sm bg-white dark:bg-slate-900 h-fit">
                            <CardHeader><CardTitle className="text-slate-800 dark:text-slate-200">Опублікувати новину</CardTitle></CardHeader>
                            <CardContent>
                                <form onSubmit={handleCreateNews} className="space-y-4">
                                    <div>
                                        <Label className="dark:text-slate-300 mb-1 block">Заголовок</Label>
                                        <Input value={newsTitle} onChange={e => setNewsTitle(e.target.value)} required className="dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                                    </div>
                                    <div>
                                        <Label className="dark:text-slate-300 mb-1 block">Текст новини</Label>
                                        <textarea
                                            value={newsContent}
                                            onChange={e => setNewsContent(e.target.value)}
                                            required
                                            rows={5}
                                            className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold h-12">Відправити всім</Button>
                                </form>
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-2 border-none shadow-sm bg-white dark:bg-slate-900">
                            <CardHeader><CardTitle className="text-slate-800 dark:text-slate-200">Опубліковані новини</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                {news.map(item => (
                                    <div key={item.id} className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex flex-col md:flex-row justify-between items-start gap-4">
                                        <div className="w-full">
                                            <h4 className="font-bold text-lg text-slate-900 dark:text-white">{item.title}</h4>
                                            <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">{item.content}</p>
                                            <p className="text-xs text-slate-400 font-medium mt-3">{new Date(item.created_at).toLocaleString('uk-UA')}</p>
                                        </div>
                                        <div className="flex gap-2 w-full md:w-auto shrink-0">
                                            <Button size="sm" variant="outline" onClick={() => setEditingNews(item)} className="h-8 font-bold dark:border-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-600">✏️ Ред</Button>
                                            <Button size="sm" variant="outline" onClick={() => deleteNews(item.id)} className="text-red-500 border-red-200 hover:bg-red-50 h-8 font-bold">Видалити</Button>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                )}

            </div>
        </div>
    )
}