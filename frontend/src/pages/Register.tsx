import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { GoogleLogin } from '@react-oauth/google'
import { ArrowLeft, Eye, EyeOff } from "lucide-react" // 👈 Додали іконки
import toast from 'react-hot-toast'

export default function Register() {
    const navigate = useNavigate()
    const [loginMode, setLoginMode] = useState<'telegram' | 'email' | 'google'>('google')

    const [code, setCode] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [username, setUsername] = useState("")

    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    const [loading, setLoading] = useState(false)
    const [agreed, setAgreed] = useState(false)

    const BOT_USERNAME = "skillswapirp_bot"

    const handleStandardRegister = async (e: React.FormEvent) => {
        e.preventDefault()

        if (loginMode === 'email') {
            if (password !== confirmPassword) {
                toast.error("Паролі не співпадають!")
                return
            }
            if (password.length < 6) {
                toast.error("Пароль має містити щонайменше 6 символів")
                return
            }
        }

        setLoading(true)

        const endpoint = loginMode === 'email' ? "https://api.synapse.tel/api/users/register/email" : "https://api.synapse.tel/api/users/login"
        const payload = loginMode === 'email' ? { email, password, username } : { code }

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
            const data = await response.json()

            if (response.ok) {
                localStorage.setItem("token", data.token)
                localStorage.setItem("userId", data.user.id)
                localStorage.setItem("tgId", data.user.telegram_id || "")
                localStorage.setItem("role", data.user.role || "user")
                toast.success("Успішна реєстрація!")
                navigate("/feed")
                window.location.reload()
            } else {
                toast.error(data.error || "Помилка реєстрації")
            }
        } catch (error) {
            toast.error("Помилка підключення до сервера")
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleLogin = async (credentialResponse: any) => {
        try {
            const res = await fetch("https://api.synapse.tel/api/users/login/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: credentialResponse.credential })
            })
            const data = await res.json()
            if (res.ok) {
                localStorage.setItem("token", data.token)
                localStorage.setItem("userId", data.user.id)
                localStorage.setItem("tgId", data.user.telegram_id || "")
                localStorage.setItem("role", data.user.role || "user")
                toast.success("Вхід через Google успішний!")
                navigate("/feed")
                window.location.reload()
            } else {
                toast.error(data.error || "Помилка авторизації")
            }
        } catch (error) {
            toast.error("Помилка підключення")
        }
    }

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">

            <Button
                variant="ghost"
                onClick={() => navigate("/")}
                className="absolute top-4 left-4 md:top-8 md:left-8 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
                <ArrowLeft className="mr-2 h-4 w-4" /> На головну
            </Button>

            <Card className="w-full max-w-md shadow-xl border-0 dark:border dark:border-slate-800 bg-white dark:bg-slate-900 mt-12 md:mt-0">
                <CardHeader className="space-y-1 text-center pb-6">
                    <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-indigo-200 dark:shadow-none rotate-3">
                        <span className="text-3xl text-white">🎓</span>
                    </div>
                    <CardTitle className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Створити акаунт</CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400">
                        Оберіть зручний спосіб реєстрації
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl gap-1">
                        <button
                            onClick={() => setLoginMode('google')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${loginMode === 'google' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                            Google
                        </button>
                        <button
                            onClick={() => setLoginMode('telegram')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${loginMode === 'telegram' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                        >
                            <svg className="w-4 h-4 text-[#0088cc]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z" /></svg>
                            Telegram
                        </button>
                        <button
                            onClick={() => setLoginMode('email')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${loginMode === 'email' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                        >
                            ✉️ Email
                        </button>
                    </div>

                    <div className="flex items-start gap-3 mt-6 mb-2 px-1">
                        <input
                            type="checkbox"
                            id="terms"
                            checked={agreed}
                            onChange={(e) => setAgreed(e.target.checked)}
                            className="mt-1 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 cursor-pointer shrink-0"
                        />
                        <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            <Label htmlFor="terms" className="cursor-pointer font-normal text-sm inline">
                                Підтверджую, що мені виповнилося <strong>14 років</strong>, і я приймаю{' '}
                            </Label>
                            <Link to="/terms" className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold inline-block">Умови використання</Link>
                            {' '}та{' '}
                            <Link to="/privacy" className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold inline-block">Політику конфіденційності</Link>.
                        </div>
                    </div>

                    {loginMode === 'google' ? (
                        <div className="flex flex-col items-center mt-4">
                            {!agreed ? (
                                <div className="p-3 text-sm text-center text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-900/20 rounded-lg w-full">
                                    Погодьтеся з умовами вище, щоб увійти через Google
                                </div>
                            ) : (
                                <GoogleLogin
                                    onSuccess={handleGoogleLogin}
                                    onError={() => toast.error('Помилка входу через Google')}
                                    useOneTap
                                />
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleStandardRegister} className="space-y-4 mt-2">
                            {loginMode === 'email' ? (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="username">Ваше ім'я (Нікнейм)</Label>
                                        <Input id="username" type="text" placeholder="Іван Франко" value={username} onChange={(e) => setUsername(e.target.value)} required className="h-12 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Електронна пошта</Label>
                                        <Input id="email" type="email" placeholder="mail@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="password">Пароль</Label>
                                        {/* 👇 Око для першого пароля 👇 */}
                                        <div className="relative">
                                            <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white pr-10" />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPassword">Повторіть пароль</Label>
                                        {/* 👇 Око для підтвердження пароля 👇 */}
                                        <div className="relative">
                                            <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="h-12 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white pr-10" />
                                            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                                                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : loginMode === 'telegram' ? (
                                <div className="space-y-6">
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl text-center border border-indigo-100 dark:border-indigo-800">
                                        <p className="text-sm text-indigo-800 dark:text-indigo-300 font-medium mb-3">
                                            1. Відкрийте нашого бота в Telegram
                                        </p>
                                        <a href={`https://t.me/${BOT_USERNAME}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-[#0088cc] hover:bg-[#0077b5] text-white px-6 py-3 rounded-lg font-bold transition-all shadow-md hover:shadow-lg w-full sm:w-auto">
                                            <span>Відкрити бота</span>
                                        </a>
                                        <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mt-3">
                                            2. Натисніть /start і введіть код нижче
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="code" className="text-center block text-slate-500 dark:text-slate-400">Введіть 6-значний код</Label>
                                        <Input id="code" type="text" placeholder="000000" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required className="tracking-[0.7em] text-center font-bold text-3xl h-16 bg-slate-50 dark:bg-slate-800 border-2 dark:border-slate-700 dark:text-white focus-visible:border-indigo-500 dark:focus-visible:border-indigo-400" />
                                    </div>
                                </div>
                            ) : null}

                            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-md font-bold" disabled={loading || !agreed || (loginMode === 'telegram' && code.length < 6)}>
                                {loading ? "Реєстрація..." : "Зареєструватися"}
                            </Button>
                        </form>
                    )}
                </CardContent>

                <CardFooter className="flex flex-col space-y-4">
                    <div className="text-sm text-center text-slate-500 dark:text-slate-400">Вже маєте акаунт? <Link to="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold">Увійти</Link></div>
                </CardFooter>
            </Card>
        </div>
    )
}