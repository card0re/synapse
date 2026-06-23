import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { GoogleLogin } from '@react-oauth/google'
import { ArrowLeft, Eye, EyeOff } from "lucide-react"
import toast from 'react-hot-toast'

export default function Login() {
    const navigate = useNavigate()
    const [loginMode, setLoginMode] = useState<'telegram' | 'email' | 'google'>('google')

    const [code, setCode] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    const [showPassword, setShowPassword] = useState(false)

    const [loading, setLoading] = useState(false)

    const BOT_USERNAME = "skillswapirp_bot"

    const handleStandardLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const endpoint = loginMode === 'email' ? "https://api.synapse.tel/api/users/login/email" : "https://api.synapse.tel/api/users/login"
        const payload = loginMode === 'email' ? { email, password } : { code }

        try {
            const response = await fetch(endpoint, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
            })
            const data = await response.json()
            handleLoginSuccess(response.ok, data)
        } catch (err: any) {
            toast.error("Немає зв'язку з сервером.")
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleSuccess = async (credentialResponse: any) => {
        setLoading(true)
        try {
            const response = await fetch("https://api.synapse.tel/api/users/login/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: credentialResponse.credential }),
            })
            const data = await response.json()
            handleLoginSuccess(response.ok, data)
        } catch (err: any) {
            toast.error("Помилка з'єднання з сервером.")
        } finally {
            setLoading(false)
        }
    }

    const handleLoginSuccess = (isOk: boolean, data: any) => {
        if (isOk && data.user) {
            localStorage.setItem("token", data.token)
            localStorage.setItem("userId", data.user.id)
            localStorage.setItem("role", data.user.role)
            if (data.user.telegram_id) localStorage.setItem("tgId", data.user.telegram_id.toString())

            toast.success("Успішний вхід!");

            if (data.user.role === "admin") navigate("/admin")
            else navigate("/feed")
        } else {
            toast.error(data.error || "Помилка авторизації")
        }
    }

    return (
        <div className="min-h-[calc(100vh-64px)] relative bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 font-sans transition-colors duration-300">

            <Button
                variant="ghost"
                onClick={() => navigate("/")}
                className="absolute top-4 left-4 md:top-8 md:left-8 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
                <ArrowLeft className="mr-2 h-4 w-4" /> На головну
            </Button>

            <Card className="w-full max-w-sm shadow-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
                <CardHeader className="space-y-4">
                    <div>
                        <CardTitle className="text-2xl font-bold text-center text-slate-900 dark:text-white">Вхід у SkillSwap</CardTitle>
                        <CardDescription className="text-center mt-1 text-slate-500 dark:text-slate-400">Оберіть зручний спосіб авторизації</CardDescription>
                    </div>

                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg transition-colors">
                        <button type="button" onClick={() => setLoginMode('google')}
                                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-1 ${loginMode === 'google' ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                            🌐 Google
                        </button>
                        <button type="button" onClick={() => setLoginMode('telegram')}
                                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-1 ${loginMode === 'telegram' ? 'bg-white dark:bg-slate-700 shadow text-[#0088cc] dark:text-[#33aadd]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                            ✈️ Telegram
                        </button>
                        <button type="button" onClick={() => setLoginMode('email')}
                                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${loginMode === 'email' ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                            📧 Пошта
                        </button>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {loginMode === 'google' ? (
                        <div className="flex flex-col items-center justify-center py-6 space-y-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl transition-colors">
                            <p className="text-sm text-slate-500 dark:text-slate-400 text-center px-4">Швидкий вхід без паролів. Ми автоматично створимо вам акаунт.</p>
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={() => toast.error("Помилка авторизації через Google")}
                                useOneTap
                            />
                        </div>
                    ) : null}

                    {loginMode === 'email' || loginMode === 'telegram' ? (
                        <form onSubmit={handleStandardLogin} className="space-y-4">
                            {loginMode === 'email' ? (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="dark:text-slate-300">Email</Label>
                                        <Input id="email" type="email" placeholder="mail@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="password" className="dark:text-slate-300">Пароль</Label>
                                        <div className="relative">
                                            <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="dark:bg-slate-800 dark:border-slate-700 dark:text-white pr-10" />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : null}

                            {loginMode === 'telegram' ? (
                                <div className="space-y-6">
                                    <div className="bg-blue-50 dark:bg-[#0088cc]/10 p-5 rounded-xl border border-blue-100 dark:border-[#0088cc]/20 flex flex-col items-center justify-center gap-3 text-center transition-colors">
                                        <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">Отримайте одноразовий код у нашому боті</p>
                                        <a href={`https://t.me/${BOT_USERNAME}?start=login`} target="_blank" rel="noopener noreferrer" className="bg-[#0088cc] hover:bg-[#0077b3] text-white px-6 py-2.5 rounded-full font-bold shadow-sm transition-all w-full">Відкрити Telegram</a>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="code" className="text-center block text-slate-500 dark:text-slate-400">Введіть 6-значний код</Label>
                                        <Input id="code" type="text" placeholder="000000" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required className="tracking-[0.7em] text-center font-bold text-3xl h-16 bg-slate-50 dark:bg-slate-800 border-2 dark:border-slate-700 dark:text-white focus-visible:border-indigo-500 dark:focus-visible:border-indigo-400" />
                                    </div>
                                </div>
                            ) : null}

                            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-md font-bold" disabled={loading || (loginMode === 'telegram' && code.length < 6)}>
                                {loading ? "Перевірка..." : "Увійти"}
                            </Button>
                        </form>
                    ) : null}
                </CardContent>

                <CardFooter className="flex flex-col space-y-4">
                    <div className="text-sm text-center text-slate-500 dark:text-slate-400">Немає акаунту? <Link to="/register" className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold">Зареєструватися</Link></div>
                </CardFooter>
            </Card>
        </div>
    )
}