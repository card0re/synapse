import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Check, Crown, ArrowLeft, Zap, ShieldCheck, Sparkles, Info } from "lucide-react"
import toast from 'react-hot-toast'

export default function Premium() {
    const navigate = useNavigate()

    const handleSubscribe = () => {
        toast("Інтеграція з MonoPay в процесі розробки 🚀", {
            icon: '💳',
            style: { borderRadius: '10px', background: '#333', color: '#fff' },
        })
    }

    return (
        <div className="min-h-[calc(100vh-64px)] bg-transparent p-4 md:p-8 font-sans transition-colors duration-300 relative flex flex-col items-center z-10">
            {/* bg-transparent дозволяє глобальному фону з App.tsx просвічуватися */}

            <div className="w-full max-w-5xl space-y-8">

                <Button variant="ghost" onClick={() => navigate(-1)} className="self-start text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white mb-2 backdrop-blur-sm bg-white/30 dark:bg-slate-900/30 rounded-xl">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Назад
                </Button>

                <div className="text-center space-y-4 mb-14">
                    <div className="inline-flex items-center justify-center p-3 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border border-amber-200 dark:border-amber-900/50 text-amber-500 rounded-2xl mb-2 shadow-sm transform -rotate-6">
                        <Crown size={32} />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white drop-shadow-sm">
                        Обери свій рівень у <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-blue-500">Synapse</span>
                    </h1>
                    <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-medium">
                        Прокачай свій профіль, отримуй бонуси щомісяця та навчайся ще ефективніше з розумними рекомендаціями.
                    </p>
                </div>

                {/* 👇 СІТКА З ВИРІВНЮВАННЯМ 👇 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch pt-4">

                    {/* БАЗОВИЙ ТАРИФ */}
                    <div className="flex flex-col rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-lg p-8 hover:shadow-xl transition-all h-full">
                        <div className="text-center pb-8">
                            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-200">Стандарт</h2>
                            <p className="text-slate-500 mt-2 font-medium">Твій безкоштовний старт</p>
                            <div className="mt-8 flex justify-center items-baseline gap-1">
                                <span className="text-5xl font-black text-slate-900 dark:text-white">0</span>
                                <span className="text-lg font-bold text-slate-500">грн</span>
                            </div>
                        </div>
                        <div className="flex-1 space-y-4">
                            <ul className="space-y-4 text-sm text-slate-600 dark:text-slate-300 font-medium">
                                <li className="flex items-start gap-3"><Check className="text-indigo-500 shrink-0 mt-0.5" size={18} /> <span className="leading-snug">Створення стандартних оголошень</span></li>
                                <li className="flex items-start gap-3"><Check className="text-indigo-500 shrink-0 mt-0.5" size={18} /> <span className="leading-snug">Безлімітне спілкування в чатах</span></li>
                                <li className="flex items-start gap-3"><Check className="text-indigo-500 shrink-0 mt-0.5" size={18} /> <span className="leading-snug">Заробіток хвилин за уроки</span></li>
                                <li className="flex items-start gap-3 opacity-40"><span className="w-[18px] text-center text-lg shrink-0 mt-[-2px]">✕</span> <span className="leading-snug">Бонусні хвилини на баланс</span></li>
                                <li className="flex items-start gap-3 opacity-40"><span className="w-[18px] text-center text-lg shrink-0 mt-[-2px]">✕</span> <span className="leading-snug">ШІ-рекомендації збігів</span></li>
                                <li className="flex items-start gap-3 opacity-40"><span className="w-[18px] text-center text-lg shrink-0 mt-[-2px]">✕</span> <span className="leading-snug">PRO-бейдж у профілі</span></li>
                            </ul>
                        </div>
                        <div className="pt-8 mt-auto">
                            <Button variant="outline" disabled className="w-full h-14 rounded-xl font-bold border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                                Поточний план
                            </Button>
                        </div>
                    </div>

                    {/* PRO ТАРИФ */}
                    <div className="flex flex-col relative rounded-3xl border-2 border-amber-400 dark:border-amber-500/50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-amber-500/10 p-8 h-full">
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                                <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[11px] font-black uppercase tracking-widest py-2 px-6 rounded-full shadow-lg shadow-amber-500/30 flex items-center gap-1.5 whitespace-nowrap border-2 border-white dark:border-slate-900">
                                    <Zap size={14} className="fill-white" /> Топ вибір
                                </span>
                        </div>
                        <div className="text-center pb-8 pt-2">
                            <h2 className="text-2xl font-black text-amber-600 dark:text-amber-500 flex justify-center items-center gap-2">
                                Synapse PRO
                            </h2>
                            <p className="text-slate-500 mt-2 font-medium">Максимум можливостей платформи</p>
                            <div className="mt-8 flex justify-center items-baseline gap-1">
                                <span className="text-5xl font-black text-slate-900 dark:text-white">150</span>
                                <span className="text-lg font-bold text-slate-500">грн / міс</span>
                            </div>
                        </div>
                        <div className="flex-1 space-y-4">
                            <ul className="space-y-4 text-sm text-slate-800 dark:text-slate-200 font-medium">
                                <li className="flex items-start gap-3"><Check className="text-amber-500 shrink-0 mt-0.5" size={18} /> <span className="leading-snug">Всі функції базового плану</span></li>
                                <li className="flex items-start gap-3 p-2.5 -mx-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl"><Sparkles className="text-amber-500 shrink-0 mt-0.5" size={18} /> <span className="leading-snug"><strong className="text-indigo-600 dark:text-indigo-400">+500 хвилин</strong> на баланс щомісяця</span></li>
                                <li className="flex items-start gap-3"><Check className="text-amber-500 shrink-0 mt-0.5" size={18} /> <span className="leading-snug">Доступ до ШІ-підбору збігів</span></li>
                                <li className="flex items-start gap-3"><Check className="text-amber-500 shrink-0 mt-0.5" size={18} /> <span className="leading-snug">Пріоритет у стрічці оголошень</span></li>
                                <li className="flex items-start gap-3"><Check className="text-amber-500 shrink-0 mt-0.5" size={18} /> <span className="leading-snug">Ексклюзивний PRO-бейдж</span></li>
                                <li className="flex items-start gap-3"><Check className="text-amber-500 shrink-0 mt-0.5" size={18} /> <span className="leading-snug">Преміальна підтримка</span></li>
                            </ul>
                        </div>
                        <div className="pt-8 mt-auto flex flex-col gap-3">
                            <Button onClick={handleSubscribe} className="w-full h-14 rounded-xl font-black text-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/30 transition-all hover:scale-[1.02]">
                                Оформити підписку
                            </Button>
                            <p className="text-[11px] text-center text-slate-400 flex items-center justify-center gap-1.5 uppercase tracking-wide font-bold mt-1">
                                <ShieldCheck size={14} /> Безпечно через MonoPay
                            </p>
                        </div>
                    </div>

                </div>

                {/* ПРИМІТКА ЗНИЗУ */}
                <div className="mt-16 border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                    <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400 max-w-2xl text-center md:text-left">
                        <Info size={32} className="shrink-0 text-indigo-500" />
                        <p className="text-sm font-medium leading-relaxed">
                            Підписка продовжується автоматично щомісяця. Ви можете скасувати її в будь-який момент у налаштуваннях профілю. Бонусні хвилини нараховуються миттєво після успішної оплати.
                        </p>
                    </div>
                    <Button variant="link" className="text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                        Умови підписки
                    </Button>
                </div>

            </div>
        </div>
    )
}