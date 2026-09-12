import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

// Шапка й підвал для публічних сторінок напрямків. Ці сторінки живуть поза
// PublicRoute/ProtectedRoute, тому мають власний каркас: PublicRoute відкидає
// авторизованих на /feed, а тут сторінка має відкриватися будь-кому.
export default function PublicShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-display transition-colors duration-300">
            <nav className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center transform rotate-12 shadow-md shadow-indigo-500/30">
                            <span className="text-white font-extrabold -rotate-12">S</span>
                        </div>
                        <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white uppercase">Synapse</span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <Link to="/skills" className="hidden sm:inline-block text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mr-2">
                            Усі напрямки
                        </Link>
                        <Link to="/register">
                            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md">
                                Приєднатися
                            </Button>
                        </Link>
                    </div>
                </div>
            </nav>

            <main>{children}</main>

            <footer className="bg-slate-900 text-slate-400 py-10 mt-4">
                <div className="max-w-5xl mx-auto px-5 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-indigo-500 rounded flex items-center justify-center transform rotate-12">
                            <span className="text-white font-extrabold text-xs -rotate-12">S</span>
                        </div>
                        <span className="text-lg font-extrabold tracking-tight text-white uppercase">Synapse</span>
                    </Link>
                    <p className="text-sm">© {new Date().getFullYear()} Освітня ініціатива Synapse · Ірпінь, Україна</p>
                    <div className="flex gap-4 text-sm">
                        <Link to="/terms" className="hover:text-white transition-colors">Правила</Link>
                        <Link to="/privacy" className="hover:text-white transition-colors">Конфіденційність</Link>
                    </div>
                </div>
            </footer>
        </div>
    )
}
