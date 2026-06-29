import { useEffect, useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Search, MapPin, Star, Filter, ShieldAlert, Wallet, ChevronDown, Check } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import toast from 'react-hot-toast'
import ReportModal from "@/components/ReportModal"

interface Skill {
    skill_id: string; title: string; description: string; type: string; price: number;
    user_id: string; user_name: string; user_avatar: string; city_name: string;
    user_rating: number; birth_date?: string;
}

interface City { id: number; name: string; }

export default function Feed() {
    const [feed, setFeed] = useState<Skill[]>([])
    const [matches, setMatches] = useState<Skill[]>([])
    const [cities, setCities] = useState<City[]>([])

    const [visibleCount, setVisibleCount] = useState(10)
    const [myBalance, setMyBalance] = useState<number | null>(null)

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

    // Стейт для модального вікна підтвердження відгуку
    const [dealConfirm, setDealConfirm] = useState<{skillId: string, price: number} | null>(null)

    const navigate = useNavigate()
    const token = localStorage.getItem("token")
    const myId = localStorage.getItem("userId")

    useEffect(() => {
        if (!token) { navigate("/login"); return; }
        fetchCities()
        loadFeed()
        if (myId) {
            loadMatches()
            fetchBalance()
        }
    }, [token, navigate, myId])

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (search !== undefined) { loadFeed(); setVisibleCount(10); }
        }, 500)
        return () => clearTimeout(delayDebounceFn)
    }, [search])

    const fetchBalance = async () => {
        try {
            const res = await fetch(`https://synapse.tel/api/users/public/${myId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            })
            const data = await res.json()
            if (data && data.balance_minutes !== undefined) {
                setMyBalance(data.balance_minutes)
            }
        } catch (e) { console.error("Не вдалося завантажити баланс", e) }
    }

    const fetchCities = async () => {
        try {
            const res = await fetch("https://synapse.tel/api/cities")
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

            const res = await fetch(`https://synapse.tel/api/feed/?${query.toString()}`, {
                headers: { "Authorization": `Bearer ${token}` }
            })
            const data = await res.json()
            setFeed(data.feed || [])
        } catch (error) { toast.error("Помилка завантаження стрічки") } finally { setLoading(false) }
    }

    const loadMatches = async () => {
        setLoadingMatches(true)
        try {
            const res = await fetch(`https://synapse.tel/api/feed/matches?user_id=${myId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            })
            const data = await res.json()
            setMatches(data.feed || [])
        } catch (error) { console.error(error) } finally { setLoadingMatches(false) }
    }

    const handleApplyFilters = () => {
        setActiveTab('all')
        setVisibleCount(10)
        loadFeed()
        setShowFilters(false)
    }

    const handleResetFilters = () => {
        setSearch(""); setFilterType("all"); setCityId("0"); setMinPrice(""); setMaxPrice(""); setMinRating("0");
        setActiveTab('all'); setVisibleCount(10);
        setTimeout(() => loadFeed(), 0)
    }

    const calculateAge = (birthDateStr?: string) => {
        if (!birthDateStr || birthDateStr === "" || birthDateStr.startsWith("0001")) return null;
        const birthDate = new Date(birthDateStr);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
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

    // Логіка перевірки балансу та виклику модалки
    const handleCreateDealClick = (skillId: string, price: number) => {
        if (myBalance !== null && myBalance < price) {
            toast.error("Недостатньо хвилин на балансі!");
            return;
        }
        setDealConfirm({ skillId, price });
    }

    // Виконання запиту після підтвердження
    const executeDeal = async () => {
        if (!dealConfirm) return;

        try {
            const res = await fetch(`https://synapse.tel/api/deals/`, {
                method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ skill_id: dealConfirm.skillId, initiator_id: myId })
            })
            if (res.ok) {
                toast.success("Заявку успішно відправлено!");
                fetchBalance();
                setDealConfirm(null);
                navigate("/profile");
            } else {
                const data = await res.json();
                toast.error(data.error || "Помилка");
                setDealConfirm(null);
            }
        } catch (e) {
            toast.error("Помилка сервера");
            setDealConfirm(null);
        }
    }

    const renderSkillCard = (s: Skill) => {
        const age = calculateAge(s.birth_date);
        return (
            <Card key={s.skill_id} className="overflow-hidden border border-slate-200/60 dark:border-slate-800/60 shadow-lg hover:shadow-xl transition-all rounded-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
                <CardContent className="p-5 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <img src={s.user_avatar || "/default-avatar.png"} alt={s.user_name}
                                 className="w-12 h-12 rounded-2xl object-cover shadow-sm"/>
                            <div>
                                <Link to={`/profile/${s.user_id}`}
                                      className="font-black text-slate-800 dark:text-white hover:text-indigo-600 transition-colors">
                                    {s.user_name}
                                </Link>
                                <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                    <MapPin className="w-3 h-3"/> {s.city_name || "Онлайн"}
                                    {age && <span className="ml-1 opacity-70">• {formatAge(age)}</span>}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            {s.user_rating > 0 && (
                                <div
                                    className="flex items-center bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full text-xs font-bold">
                                    <Star className="w-3 h-3 mr-1 fill-amber-500"/> {s.user_rating.toFixed(1)}
                                </div>
                            )}
                            <button onClick={() => setReportData({type: 'skill', id: s.skill_id})}
                                    className="text-slate-300 hover:text-red-500 transition-colors p-1 mt-1">
                                <ShieldAlert className="w-4 h-4"/>
                            </button>
                        </div>
                    </div>

                    <div className="mb-4 flex-grow">
                        <div
                            className="inline-block px-2.5 py-1 rounded-lg text-[10px] font-black mb-2 uppercase tracking-widest bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {s.type === 'teach' ? 'Навчає' : 'Хоче вивчити'}
                        </div>
                        <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 leading-tight mb-2">{s.title}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{s.description}</p>
                    </div>

                    <div
                        className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between mt-auto">
                        <div className="font-black text-indigo-600 dark:text-indigo-400 text-lg">
                            {s.price} <span className="text-xs font-normal text-slate-400">хв / год</span>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => handleCreateDealClick(s.skill_id, s.price)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm px-5 font-bold shadow-md transition-transform active:scale-95 z-10"
                        >
                            Відгукнутись
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )
    }

    const displayedFeed = feed.slice(0, visibleCount);
    const displayedMatches = matches.slice(0, visibleCount);

    return (
        <div className="min-h-screen bg-transparent pb-28">
            {/* ХЕДЕР */}
            <div
                className="bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl border-b border-white/20 dark:border-slate-800/50 sticky top-0 z-30 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
                    <h1 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent tracking-tight">
                        SkillSwap
                    </h1>
                    {myBalance !== null && (
                        <div className="flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 text-indigo-700 dark:text-indigo-300 px-4 py-1.5 rounded-full font-bold text-sm shadow-sm">
                            <Wallet className="w-4 h-4"/>
                            {myBalance} хв
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-6">

                {/* ПОШУК І ФІЛЬТРИ */}
                <div className="mb-6 space-y-3 relative z-20">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-grow group">
                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                <Search className="w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                            </div>
                            <Input
                                placeholder="Що хочете вивчити або викладати?"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-12 h-14 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 w-full focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500 transition-all text-base shadow-sm font-medium"
                            />
                        </div>
                        <Button
                            onClick={() => setShowFilters(!showFilters)}
                            variant="outline"
                            className={`h-14 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 w-full sm:w-auto font-bold transition-all px-8 shadow-sm ${showFilters ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700' : 'bg-white/70 dark:bg-slate-900/70 backdrop-blur-md text-slate-700 dark:text-slate-200'}`}
                        >
                            <Filter className={`w-5 h-5 mr-2 ${showFilters ? 'text-indigo-200' : 'text-slate-400'}`} />
                            {showFilters ? 'Приховати' : 'Фільтри'}
                        </Button>
                    </div>

                    {/* НОВИЙ ПРЕМІАЛЬНИЙ БЛОК ФІЛЬТРІВ */}
                    {showFilters && (
                        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-2xl rounded-3xl p-6 mb-8 mt-2 animate-in slide-in-from-top-4 fade-in duration-300">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                                    <Filter className="w-5 h-5 text-indigo-500" /> Тонке налаштування
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                                {/* Локація */}
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><MapPin className="w-3 h-3"/> Локація</label>
                                    <div className="relative group">
                                        <select className="w-full h-12 appearance-none rounded-2xl bg-slate-100/50 dark:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer" value={cityId} onChange={e => setCityId(e.target.value)}>
                                            <option value="0">🌍 Всі міста (Онлайн)</option>
                                            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-indigo-500 transition-colors" />
                                    </div>
                                </div>

                                {/* Тип */}
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">🎯 Хто потрібен?</label>
                                    <div className="flex bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-2xl">
                                        <button onClick={() => setFilterType('all')} className={`flex-1 text-xs font-bold py-2.5 rounded-xl transition-all ${filterType === 'all' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Всі</button>
                                        <button onClick={() => setFilterType('teach')} className={`flex-1 text-xs font-bold py-2.5 rounded-xl transition-all ${filterType === 'teach' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Вчителі</button>
                                        <button onClick={() => setFilterType('learn')} className={`flex-1 text-xs font-bold py-2.5 rounded-xl transition-all ${filterType === 'learn' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Учні</button>
                                    </div>
                                </div>

                                {/* Рейтинг */}
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">⭐ Рейтинг від</label>
                                    <div className="flex bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-2xl">
                                        {['0', '4', '4.5', '4.8'].map(r => (
                                            <button key={r} onClick={() => setMinRating(r)} className={`flex-1 flex items-center justify-center gap-1 text-xs font-bold py-2.5 rounded-xl transition-all ${minRating === r ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                                {r !== '0' && <Star className={`w-3 h-3 ${minRating === r ? 'fill-amber-500 text-amber-500' : ''}`} />}
                                                {r === '0' ? 'Всі' : r}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Ціна */}
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Wallet className="w-3 h-3"/> Вартість (Хв)</label>
                                    <div className="flex items-center gap-2">
                                        <Input placeholder="Від" value={minPrice} onChange={e => setMinPrice(e.target.value)} type="number" className="h-12 bg-slate-100/50 dark:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-center rounded-2xl font-bold shadow-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 transition-all"/>
                                        <span className="text-slate-300 font-bold">-</span>
                                        <Input placeholder="До" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} type="number" className="h-12 bg-slate-100/50 dark:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-center rounded-2xl font-bold shadow-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 transition-all"/>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                                <Button variant="ghost" onClick={handleResetFilters} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl h-12 px-6 font-bold w-full sm:w-auto transition-all">
                                    Скинути все
                                </Button>
                                <Button onClick={handleApplyFilters} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-12 px-8 shadow-lg shadow-indigo-600/20 font-bold w-full sm:w-auto transition-all active:scale-95 flex items-center gap-2">
                                    <Check className="w-5 h-5" /> Застосувати
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ВКЛАДКИ */}
                <div className="flex bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-2xl p-1.5 w-full sm:w-max mb-8 relative z-10 border border-slate-200/50 dark:border-slate-700/50">
                    <button onClick={() => setActiveTab('all')} className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'all' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                        🌍 Всі оголошення
                    </button>
                    {myId && (
                        <button onClick={() => setActiveTab('matches')} className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'matches' ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/30' : 'text-slate-500 hover:text-amber-600 dark:hover:text-amber-500'}`}>
                            ✨ ШІ Рекомендації
                        </button>
                    )}
                </div>

                {/* СІТКА ОГОЛОШЕНЬ */}
                <div className="relative z-10">
                    {activeTab === 'all' ? (
                        loading ? (
                            <div className="flex justify-center py-20"><div className="w-8 h-8 sm:w-10 sm:h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div></div>
                        ) : feed.length === 0 ? (
                            <div className="text-center py-20 text-slate-500 font-medium">За вашим запитом нічого не знайдено 😔</div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                                    {displayedFeed.map(renderSkillCard)}
                                </div>
                                {feed.length > visibleCount && (
                                    <div className="flex justify-center mt-8 mb-4">
                                        <Button variant="outline" onClick={() => setVisibleCount(v => v + 10)}
                                                className="rounded-2xl font-bold h-12 px-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 ring-1 ring-slate-200 dark:ring-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm">
                                            Показати ще 👇
                                        </Button>
                                    </div>
                                )}
                            </>
                        )
                    ) : (
                        loadingMatches ? (
                            <div className="flex justify-center py-20"><div className="w-8 h-8 sm:w-10 sm:h-10 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin"></div></div>
                        ) : matches.length === 0 ? (
                            <div className="text-center py-20 text-slate-500 font-medium">Поки що немає рекомендацій. Додайте навички у профіль!</div>
                        ) : (
                            <>
                                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 text-indigo-800 dark:text-indigo-300 p-4 rounded-2xl mb-6 font-medium text-sm text-center border border-indigo-100 dark:border-indigo-800/30 shadow-sm animate-in fade-in">
                                    💡 Ці оголошення підібрані спеціально для вас на основі ваших інтересів та біографії.
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                                    {displayedMatches.map(renderSkillCard)}
                                </div>
                                {matches.length > visibleCount && (
                                    <div className="flex justify-center mt-8 mb-4">
                                        <Button variant="outline" onClick={() => setVisibleCount(v => v + 10)}
                                                className="rounded-2xl font-bold h-12 px-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 ring-1 ring-slate-200 dark:ring-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm">
                                            Показати ще 👇
                                        </Button>
                                    </div>
                                )}
                            </>
                        )
                    )}
                </div>

                {/* МОДАЛКА ПІДТВЕРДЖЕННЯ ВІДГУКУ */}
                {dealConfirm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                    <Wallet className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Підтвердження</h3>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 mb-8 text-base leading-relaxed">
                                Бажаєте відгукнутися на це оголошення? З вашого балансу буде списано <span className="font-black text-indigo-600 dark:text-indigo-400">{dealConfirm.price} хв</span>.
                            </p>
                            <div className="flex gap-3">
                                <Button
                                    onClick={executeDeal}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 rounded-xl transition-transform active:scale-95"
                                >
                                    Підтвердити
                                </Button>
                                <Button
                                    onClick={() => setDealConfirm(null)}
                                    variant="outline"
                                    className="flex-1 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 h-12 rounded-xl font-bold transition-transform active:scale-95"
                                >
                                    Скасувати
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                <ReportModal targetType={reportData?.type || 'user'} targetId={reportData?.id || ''}
                             isOpen={!!reportData} onClose={() => setReportData(null)}/>
            </div>
        </div>
    )
}