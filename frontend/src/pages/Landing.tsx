import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

export default function Landing() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans transition-colors duration-300">

            <nav className="fixed w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center transform rotate-12 shadow-lg shadow-indigo-500/30">
                            <span className="text-white font-black text-xl -rotate-12">S</span>
                        </div>
                        <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Synapse</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link to="/login">
                            <Button variant="ghost" className="font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hidden sm:inline-flex">
                                Увійти
                            </Button>
                        </Link>
                        <Link to="/register">
                            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md">
                                Приєднатися
                            </Button>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ГОЛОВНИЙ ЕКРАН (HERO) */}
            <section className="pt-40 pb-20 px-6">
                <div className="max-w-4xl mx-auto text-center space-y-8 animate-in slide-in-from-bottom-8 duration-700">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold text-sm border border-indigo-200 dark:border-indigo-800/50 mb-4">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                        </span>
                        Перша P2P освітня платформа в Україні
                    </div>

                    <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-tight">
                        Обмінюй знання на <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">Можливості</span>
                    </h1>

                    <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed font-medium">
                        Synapse - це платформа для неформальної освіти, де твій час стає валютою. Навчай інших та навчайся сам. Обмінюйся знаннями, отримуй волонтерські години та конвертуй їх у верифіковані сертифікати
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                        <Link to="/register">
                            <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xl shadow-indigo-600/20">
                                Почати безкоштовно
                            </Button>
                        </Link>
                        <Link to="/feed">
                            <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-lg font-bold border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
                                Переглянути навички 🌍
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            <section className="py-24 bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-black mb-4">Як працює економіка часу?</h2>
                        <p className="text-lg text-slate-500 dark:text-slate-400">Без грошей. Тільки ваші знання та час, захищені смарт-системою ескроу.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

                        <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 relative overflow-hidden group hover:border-indigo-500 transition-colors">
                            <div className="text-6xl mb-6">🧠</div>
                            <h3 className="text-xl font-bold mb-3">1. Поділися знаннями</h3>
                            <p className="text-slate-600 dark:text-slate-400">Поділись навчикою, якою володієш найкраще (від математики, до кулінарії). Зароби хвилини на свій баланс.</p>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 relative overflow-hidden group hover:border-green-500 transition-colors">
                            <div className="text-6xl mb-6">⏳</div>
                            <h3 className="text-xl font-bold mb-3">2. Навчайся безкоштовно</h3>
                            <p className="text-slate-600 dark:text-slate-400">Витрачай зароблені хвилини на навчання у інших користувачів платформи.</p>
                        </div>

                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-8 rounded-3xl border border-indigo-100 dark:border-indigo-900/50 relative overflow-hidden group hover:border-indigo-500 transition-colors">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl"></div>
                            <div className="text-6xl mb-6">🎓</div>
                            <h3 className="text-xl font-bold mb-3 text-indigo-900 dark:text-indigo-400">3. Отримуй бонуси</h3>
                            <p className="text-indigo-700 dark:text-indigo-300">Кожне виконане завдання підвищує ваш рейтинг та дає бонусну валюту, яку можна використати в межах платформи.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-24 px-6">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-16">
                    <div className="w-full md:w-1/2 space-y-8">
                        <h2 className="text-4xl font-black">Створено для розвитку. </h2>
                        <ul className="space-y-6">
                            <li className="flex gap-4">
                                <div className="w-12 h-12 shrink-0 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center text-xl font-bold">✓</div>
                                <div>
                                    <h4 className="text-xl font-bold mb-1">Офіційна верифікація QR-кодом</h4>
                                    <p className="text-slate-600 dark:text-slate-400">Кожен сертифікат має унікальний номер і захищений від підробки. Можна перевірити в мить відсканувавши QR.</p>
                                </div>
                            </li>
                            <li className="flex gap-4">
                                <div className="w-12 h-12 shrink-0 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center text-xl font-bold">✓</div>
                                <div>
                                    <h4 className="text-xl font-bold mb-1">Безпека та ШІ-модерація</h4>
                                    <p className="text-slate-600 dark:text-slate-400">Всі чати та навички перевіряються нейромережею. Платформа інтегрована з безпечними зустрічами Google Meet.</p>
                                </div>
                            </li>
                            <li className="flex gap-4">
                                <div className="w-12 h-12 shrink-0 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center text-xl font-bold">✓</div>
                                <div>
                                    <h4 className="text-xl font-bold mb-1">Буст мотиваційного листа</h4>
                                    <p className="text-slate-600 dark:text-slate-400">Сертифікат ментора, який підтверджує вашу соціальну активність.</p>
                                </div>
                            </li>
                        </ul>
                    </div>
                    <div className="w-full md:w-1/2 relative">
                        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-blue-500 blur-[100px] opacity-20 dark:opacity-40 rounded-full"></div>
                        <div className="relative bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl transform rotate-2 hover:rotate-0 transition-transform duration-500">
                            <div className="border-b border-slate-100 dark:border-slate-800 pb-6 mb-6 text-center">
                                <h4 className="font-black text-2xl uppercase tracking-widest text-indigo-900 dark:text-indigo-400">Сертифікат</h4>
                                <p className="text-sm text-slate-500 uppercase">Про здобуття неформальної освіти</p>
                            </div>
                            <div className="space-y-4">
                                <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-3/4 mx-auto"></div>
                                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-full mx-auto mt-4"></div>
                                <div className="flex justify-center gap-8 mt-8">
                                    <div className="text-center"><span className="block text-3xl font-black text-indigo-600">30</span><span className="text-xs font-bold text-slate-400">ГОДИН</span></div>
                                </div>
                                <div className="flex justify-between items-end mt-8">
                                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-xs text-slate-400">QR</div>
                                    <div className="w-24 h-1 border-b-2 border-slate-800 dark:border-slate-400"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA (Call to Action) */}
            <section className="py-24 bg-indigo-600 dark:bg-indigo-900 text-white text-center px-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="max-w-3xl mx-auto relative z-10 space-y-8">
                    <h2 className="text-4xl md:text-6xl font-black tracking-tight">Готові стати частиною освітньої революції?</h2>
                    <p className="text-xl text-indigo-100">Приєднуйся до "Synapse", отримуй стартові хвилини та почни свій шлях волонтера вже сьогодні.</p>
                    <Link to="/register" className="inline-block mt-4">
                        <Button size="lg" className="h-16 px-10 text-xl font-bold bg-white text-indigo-600 hover:bg-slate-100 shadow-2xl">
                            Створити акаунт
                        </Button>
                    </Link>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="bg-slate-900 text-slate-400 py-12 text-center">
                <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-indigo-500 rounded flex items-center justify-center transform rotate-12">
                            <span className="text-white font-black text-xs -rotate-12">S</span>
                        </div>
                        <span className="text-xl font-black tracking-tight text-white uppercase">Synapse</span>
                    </div>
                    <p className="text-sm">© {new Date().getFullYear()} Освітня ініціатива Synapse. Всі права захищено.</p>
                    <div className="flex gap-4">
                        {/* 👇 ТУТ ТЕПЕР РОБОЧІ ПОСИЛАННЯ 👇 */}
                        <Link to="/terms" className="hover:text-white transition-colors">Правила</Link>
                        <Link to="/privacy" className="hover:text-white transition-colors">Конфіденційність</Link>
                    </div>
                </div>
            </footer>
        </div>
    )
}