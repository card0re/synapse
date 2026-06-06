import { useEffect, useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Search, MapPin, Star, Filter, ShieldAlert, MessageCircle } from "lucide-react" // 👈 Добавлена иконка MessageCircle
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import toast from 'react-hot-toast'
import ReportModal from "@/components/ReportModal"

interface Skill {
    skill_id: string
    title: string
    description: string
    type: string
    price: number
    user_id: string
    user_name: string
    user_avatar: string
    city_name: string
    user_rating: number
    birth_date?: string
}

interface City {
    id: number
    name: string
}

export default function Feed() {
    const [feed, setFeed] = useState<Skill[]>([])
    const [matches, setMatches] = useState<Skill[]>([])
    const [cities, setCities] = useState<City[]>([])

    const [activeTab, setActiveTab] = useState<'all' | 'matches'>('all')
    const [search, setSearch] = useState("")
    const [filterType, setFilterType] = useState("all")
    const [cityId, setCityId] = useState("0")
    const [minPrice, setMinPrice] = useState("")
    const [maxPrice, setMaxPrice] = useState("")
    const [minRating, setMinRating] = useState("0")
    const [showFilters, setShowFilters] = useState(false)

    const [loading, setLoading] = useState(true)
    const [loadingMatches, setLoadingMatches] = useState(false)

    const [reportData, setReportData] = useState<{type: 'user'|'skill'|'deal', id: string} | null>(null)

    const navigate = useNavigate()
    const token = localStorage.getItem("token")
    const myId = localStorage.getItem("userId")

    useEffect(() => {
        if (!token) { navigate("/login"); return; }
        fetchCities()
        loadFeed()
        if (myId) {
            loadMatches()
        }
    }, [token, navigate, myId])

    const fetchCities = async () => {
        try {
            const res = await fetch("http://localhost:3000/api/cities")
            const data = await res.json()
            if (data.cities) setCities(data.cities)
        } catch (e) { console.error(e) }
    }

    const loadFeed = async () => {
        setLoading(true)
        try {
            const query = new URLSearchParams()
            if (search) query.append("search", search)
            if (filterType !== "all") query.append("type", filterType)
            if (cityId !== "0") query.append("city_id", cityId)
            if (minPrice) query.append("min_price", minPrice)
            if (maxPrice) query.append("max_price", maxPrice)
            if (minRating && minRating !== "0") query.append("min_rating", minRating)

            const res = await fetch(`http://localhost:3000/api/feed/?${query.toString()}`, {
                headers: { "Authorization": `Bearer ${token}` }
            })
            const data = await res.json()
            setFeed(data.feed || [])
        } catch (error) { toast.error("Помилка завантаження стрічки") } finally { setLoading(false) }
    }

    const loadMatches = async () => {
        setLoadingMatches(true)
        try {
            const res = await fetch(`http://localhost:3000/api/feed/matches?user_id=${myId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            })
            const data = await res.json()
            setMatches(data.feed || [])
        } catch (error) { console.error(error) } finally { setLoadingMatches(false) }
    }

    const handleApplyFilters = () => {
        setActiveTab('all')
        loadFeed()
        setShowFilters(false)
    }

    const handleResetFilters = () => {
        setSearch("")
        setFilterType("all")
        setCityId("0")
        setMinPrice("")
        setMaxPrice("")
        setMinRating("0")
        setActiveTab('all')
        setTimeout(() => loadFeed(), 0)
    }

    const calculateAge = (birthDateStr?: string) => {
        if (!birthDateStr) return null;
        if (birthDateStr === "" || birthDateStr.startsWith("0001")) return null;

        const birthDate = new Date(birthDateStr);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age > 0 && age < 120 ? age : null;
    }

    const formatAge = (age: number) => {
        const lastDigit = age % 10;
        const lastTwoDigits = age % 100;
        if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${age} років`;
        if (lastDigit === 1) return `${age} рік`;
        if (lastDigit >= 2 && lastDigit <= 4) return `${age} роки`;
        return `${age} років`;
    }

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

    const handleCreateDeal = async (skillId: string, price: number) => {
        confirmAction(`Бажаєте відгукнутися на це оголошення? З балансу буде списано ${price} хв.`, async () => {
            const res = await fetch(`http://localhost:3000/api/deals/`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ skill_id: skillId, initiator_id: myId })
            })
            if (res.ok) {
                toast.success("Заявку успішно відправлено!")
                navigate("/profile")
            } else {
                const data = await res.json()
                toast.error(data.error || "Помилка")
            }
        })
    }

    const renderSkillCard = (skill: Skill) => {
        const age = calculateAge(skill.birth_date);

        return (
            <Card key={skill.skill_id} className="mb-6 overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-300 bg-white dark:bg-slate-900 group">
                <CardContent className="p-0">
                    <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <img src={skill.user_avatar || `https://ui-avatars.com/api/?name=${skill.user_name}&background=6366f1&color=fff`} className="w-12 h-12 rounded-2xl object-cover shadow-sm group-hover:scale-105 transition-transform" alt="avatar" />
                                <div>
                                    <Link to={`/user/${skill.user_id}`} className="font-black text-slate-800 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex flex-wrap items-center gap-2">
                                        {skill.user_name}
                                        {age !== null && (
                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                                                {formatAge(age)}
                                            </span>
                                        )}
                                    </Link>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-1">
                                        <span className="flex items-center gap-1"><MapPin size={12} className="text-indigo-500" /> {skill.city_name}</span>
                                        <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-500"><Star size={12} fill="currentColor" /> {skill.user_rating}</span>
                                    </div>
                                </div>
                            </div>
                            <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${skill.type === 'teach' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'}`}>
                                {skill.type === 'teach' ? 'Навчить' : 'Хоче вивчити'}
                            </span>
                        </div>

                        <div className="mb-4">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 leading-tight">{skill.title}</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">{skill.description}</p>

                            {skill.user_id !== myId && (
                                <button
                                    onClick={() => setReportData({type: 'skill', id: skill.skill_id})}
                                    className="text-slate-400 hover:text-red-500 text-xs mt-3 flex items-center gap-1 font-medium transition-colors"
                                >
                                    🚩 Поскаржитися
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 leading-none">{skill.price}</span>
                            <span className="text-xs font-bold text-slate-500">хв</span>
                        </div>
                        {skill.user_id !== myId ? (
                            <div className="flex items-center gap-2">
                                {/* 👇 ДОБАВЛЕНА КНОПКА ЧАТА 👇 */}
                                <Button
                                    variant="outline"
                                    onClick={() => navigate(`/chat/${skill.user_id}`)}
                                    className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-900/50 dark:text-indigo-400 dark:hover:bg-indigo-900/30 font-bold rounded-xl px-4 shadow-sm"
                                >
                                    <MessageCircle size={18} className="md:mr-2" />
                                    <span className="hidden md:inline">Написати</span>
                                </Button>

                                <Button onClick={() => handleCreateDeal(skill.skill_id, skill.price)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 shadow-md shadow-indigo-200 dark:shadow-none rounded-xl">
                                    Відгукнутися
                                </Button>
                            </div>
                        ) : (
                            <Button variant="outline" disabled className="font-bold border-slate-200 dark:border-slate-700 rounded-xl">
                                Ваше оголошення
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans transition-colors duration-300">
            <div className="max-w-3xl mx-auto">

                <div className="bg-amber-50 border-l-4 border-amber-500 dark:bg-amber-900/20 dark:border-amber-500 p-4 rounded-r-xl shadow-sm mb-8">
                    <div className="flex items-start gap-3">
                        <ShieldAlert className="w-6 h-6 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <div>
                            <h4 className="font-bold text-amber-800 dark:text-amber-300 mb-1">Правила безпечної спільноти</h4>
                            <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
                                Задля вашої безпеки <strong>просимо проводити уроки виключно онлайн</strong> через платформу (Google Meet). Не погоджуйтеся на зустрічі наодинці, не переходьте за невідомими посиланнями в чаті та не діліться точною адресою проживання чи фінансовими даними. Якщо ви помітили підозрілу поведінку, негайно повідомте підтримку.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="sticky top-20 z-30 mb-8 space-y-4">
                    <div className="flex gap-2">
                        <div className="relative flex-1 shadow-sm">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <Input
                                placeholder="Знайти навичку, технологію, мову..."
                                className="w-full pl-12 h-14 bg-white dark:bg-slate-900 border-none rounded-2xl text-base dark:text-white shadow-lg focus-visible:ring-indigo-500"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                            />
                        </div>
                        <Button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`h-14 w-14 rounded-2xl shadow-lg transition-colors shrink-0 ${showFilters ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            <Filter size={20} />
                        </Button>
                    </div>

                    {showFilters && (
                        <Card className="border-none shadow-xl bg-white dark:bg-slate-900 rounded-2xl animate-in fade-in slide-in-from-top-4">
                            <CardContent className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                                    <div className="space-y-2 lg:col-span-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Тип</label>
                                        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow cursor-pointer">
                                            <option value="all">Всі оголошення</option>
                                            <option value="teach">Навчають (Майстри)</option>
                                            <option value="learn">Шукають (Учні)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2 lg:col-span-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Місто</label>
                                        <select value={cityId} onChange={e => setCityId(e.target.value)} className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow cursor-pointer">
                                            <option value="0">Всі міста</option>
                                            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2 lg:col-span-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Мін. рейтинг</label>
                                        <select value={minRating} onChange={e => setMinRating(e.target.value)} className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow cursor-pointer">
                                            <option value="0">Будь-який</option>
                                            <option value="3">Від 3 ⭐</option>
                                            <option value="4">Від 4 ⭐</option>
                                            <option value="4.5">Від 4.5 ⭐</option>
                                            <option value="5">Тільки 5 ⭐</option>
                                        </select>
                                    </div>

                                    <div className="lg:col-span-1 flex gap-2">
                                        <div className="flex-1 space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Мін 💰</label>
                                            <Input type="number" placeholder="0" value={minPrice} onChange={e => setMinPrice(e.target.value)} className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-medium focus-visible:ring-indigo-500" />
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Макс 💰</label>
                                            <Input type="number" placeholder="999" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-medium focus-visible:ring-indigo-500" />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3 justify-end border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                                    <Button variant="outline" onClick={handleResetFilters} className="rounded-xl font-bold dark:border-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Скинути</Button>
                                    <Button onClick={handleApplyFilters} className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-8 shadow-md transition-all">Застосувати</Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="flex p-1.5 bg-slate-200/50 dark:bg-slate-900 rounded-2xl w-full border border-slate-200 dark:border-slate-800 mb-6">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all flex-1 justify-center ${activeTab === 'all' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        🌎 Всі оголошення
                    </button>
                    <button
                        onClick={() => setActiveTab('matches')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all flex-1 justify-center ${activeTab === 'matches' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        ✨ Рекомендації (ШІ)
                    </button>
                </div>

                <div className="animate-in fade-in duration-500">
                    {activeTab === 'all' && (
                        loading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                                <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                <p className="font-bold">Шукаємо навички...</p>
                            </div>
                        ) : feed.length === 0 ? (
                            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 shadow-sm">
                                <div className="text-5xl mb-4">🔍</div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Нічого не знайдено</h3>
                                <p className="text-slate-500 max-w-md mx-auto">Спробуйте змінити критерії пошуку або скинути фільтри.</p>
                                <Button variant="outline" onClick={handleResetFilters} className="mt-6 font-bold rounded-xl dark:border-slate-700 dark:text-slate-300">Скинути всі фільтри</Button>
                            </div>
                        ) : (
                            <div>{feed.map(renderSkillCard)}</div>
                        )
                    )}

                    {activeTab === 'matches' && (
                        loadingMatches ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                                <div className="text-4xl animate-bounce">🤖</div>
                                <p className="font-bold text-indigo-600 dark:text-indigo-400 text-center px-4 leading-relaxed">Штучний інтелект аналізує ваш профіль <br/> та підбирає ідеальні збіги...</p>
                            </div>
                        ) : matches.length === 0 ? (
                            <div className="text-center py-20 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 rounded-3xl border border-indigo-100 dark:border-slate-700 shadow-sm">
                                <div className="text-5xl mb-4">✍️</div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Заповніть своє "Біо"</h3>
                                <p className="text-slate-500 max-w-md mx-auto">Штучному інтелекту не вистачає даних про ваші інтереси. Розкажіть про себе в налаштуваннях профілю, і ми знайдемо найкращих майстрів!</p>
                                <Button onClick={() => navigate('/profile')} className="mt-6 font-bold bg-indigo-600 hover:bg-indigo-700 rounded-xl text-white shadow-md hover:shadow-lg transition-all">Перейти в Профіль</Button>
                            </div>
                        ) : (
                            <div>
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300 p-4 rounded-2xl mb-6 font-medium text-sm text-center border border-indigo-100 dark:border-indigo-800/50 shadow-sm animate-in fade-in">
                                    💡 Ці оголошення підібрані спеціально для вас на основі ваших інтересів та біографії.
                                </div>
                                {matches.map(renderSkillCard)}
                            </div>
                        )
                    )}
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