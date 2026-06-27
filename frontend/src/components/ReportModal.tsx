import { useState } from "react"
import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import toast from 'react-hot-toast'

interface ReportModalProps {
    targetType: 'user' | 'skill' | 'deal'
    targetId: string
    isOpen: boolean
    onClose: () => void
}

export default function ReportModal({ targetType, targetId, isOpen, onClose }: ReportModalProps) {
    const [reason, setReason] = useState("Спам / Шахрайство")
    const [details, setDetails] = useState("")
    const [loading, setLoading] = useState(false)

    if (!isOpen) return null

    const submitReport = async () => {
        if (reason === "Інше" && !details.trim()) {
            toast.error("Будь ласка, опишіть проблему в деталях")
            return
        }

        setLoading(true)
        const token = localStorage.getItem("token")
        try {
            const res = await fetch("https://api.synapse.tel/api/reports", {
                method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ target_type: targetType, target_id: targetId, reason, details })
            })
            if (res.ok) {
                toast.success("Скаргу відправлено адміністрації. Дякуємо!")
                onClose()
            } else {
                toast.error("Помилка відправки")
            }
        } catch (e) {
            toast.error("Помилка мережі")
        } finally {
            setLoading(false)
        }
    }

    const reasons = [
        "Спам / Шахрайство",
        "Неприйнятний контент",
        "Образи / Погрози",
        "Вимагання реальних грошей",
        "Інше"
    ]

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="text-red-500">🚩</span> Поскаржитися
                </h3>

                <div className="space-y-4">
                    <div>
                        <Label className="dark:text-slate-300">Оберіть причину</Label>
                        <select value={reason} onChange={e => setReason(e.target.value)} className="w-full mt-1 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white outline-none">
                            {reasons.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>

                    {(reason === "Інше" || reason !== "") && (
                        <div>
                            <Label className="dark:text-slate-300">Деталі (обов'язково для "Інше")</Label>
                            <textarea
                                value={details} onChange={e => setDetails(e.target.value)}
                                rows={3} placeholder="Опишіть ситуацію детальніше..."
                                className="w-full mt-1 p-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none"
                            />
                        </div>
                    )}

                    <div className="flex gap-2 pt-2">
                        <Button onClick={onClose} variant="outline" className="flex-1 dark:border-slate-700 dark:text-slate-300">Скасувати</Button>
                        <Button onClick={submitReport} disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold">Відправити</Button>
                    </div>
                </div>
            </div>
        </div>
    )
}