import { useEffect, useState } from "react"
import { Link, useParams, Navigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import PublicShell from "@/components/PublicShell"
import { API_URL } from "@/lib/api"
import { SKILLS, bySlug, adsPlural } from "@/lib/skills"

export default function SkillCategory() {
    const { slug } = useParams()
    const skill = bySlug(slug)

    // null = ще вантажиться; failed = запит не вдався (тоді число не вигадуємо)
    const [count, setCount] = useState<number | null>(null)
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        if (!skill) return
        let alive = true
        fetch(`${API_URL}/feed/`)
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((data) => {
                if (!alive) return
                const list: any[] = Array.isArray(data) ? data : data?.feed || data?.skills || []
                setCount(list.filter((s) => skill.match.test(`${s?.title ?? ""} ${s?.description ?? ""}`)).length)
            })
            .catch(() => alive && setFailed(true))
        return () => {
            alive = false
        }
    }, [skill])

    if (!skill) return <Navigate to="/skills" replace />

    const others = SKILLS.filter((s) => s.slug !== skill.slug)
    const url = `https://synapse.tel/skills/${skill.slug}`

    const breadcrumbs = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Головна", item: "https://synapse.tel/" },
            { "@type": "ListItem", position: 2, name: "Напрямки", item: "https://synapse.tel/skills" },
            { "@type": "ListItem", position: 3, name: skill.name, item: url },
        ],
    }

    return (
        <PublicShell>
            <title>{`${skill.name} — безкоштовні заняття на Synapse`}</title>
            <meta name="description" content={skill.meta} />
            <link rel="canonical" href={url} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />

            <article className="max-w-3xl mx-auto px-5 py-12">
                <nav aria-label="Навігація" className="text-sm text-slate-500 dark:text-slate-400 mb-8 flex flex-wrap items-center gap-1.5">
                    <Link to="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Головна</Link>
                    <span aria-hidden="true">/</span>
                    <Link to="/skills" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Напрямки</Link>
                    <span aria-hidden="true">/</span>
                    <span className="text-slate-700 dark:text-slate-200 font-semibold">{skill.name}</span>
                </nav>

                <header className="space-y-5">
                    <div className="text-5xl" aria-hidden="true">{skill.emoji}</div>
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">{skill.h1}</h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">{skill.intro}</p>

                    {/* Честное состояние: якщо менторів немає — так і написано */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                        {failed ? (
                            <p className="text-slate-700 dark:text-slate-200">
                                Щоб побачити актуальні оголошення цього напрямку, увійди або зареєструйся —
                                це безкоштовно.
                            </p>
                        ) : count === null ? (
                            <p className="text-slate-500 dark:text-slate-400">Перевіряємо, скільки зараз оголошень у цьому напрямку…</p>
                        ) : count > 0 ? (
                            <p className="text-slate-700 dark:text-slate-200">
                                Зараз у цьому напрямку{" "}
                                <strong className="text-indigo-600 dark:text-indigo-400 tabular-nums">{count}</strong>{" "}
                                {adsPlural(count)}. Щоб відгукнутися, потрібен акаунт — реєстрація безкоштовна.
                            </p>
                        ) : (
                            <p className="text-slate-700 dark:text-slate-200">
                                <strong className="text-slate-900 dark:text-white">Тут ще немає жодного ментора.</strong>{" "}
                                Якщо ти знаєш цей напрямок — станеш першим, і перші учні звернуться саме до тебе.
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-1">
                        <Link to="/register">
                            <Button size="lg" className="w-full sm:w-auto h-14 px-7 text-base bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-600/20">
                                Почати безкоштовно
                            </Button>
                        </Link>
                        <Link to="/login">
                            <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-7 text-base font-bold border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
                                Уже маю акаунт
                            </Button>
                        </Link>
                    </div>
                </header>

                <section className="mt-14">
                    <h2 className="text-2xl font-extrabold mb-5">Що можна вивчати</h2>
                    <ul className="space-y-3">
                        {skill.learn.map((item) => (
                            <li key={item} className="flex gap-3 text-slate-700 dark:text-slate-300 leading-relaxed">
                                <span className="mt-2 w-1.5 h-1.5 shrink-0 rounded-full bg-indigo-500" aria-hidden="true" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </section>

                <section className="mt-12">
                    <h2 className="text-2xl font-extrabold mb-3">Чому можна навчати — навіть без диплома</h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
                        Достатньо знати це краще за того, хто хоче навчитися. Ось з чого реально почати:
                    </p>
                    <ul className="space-y-3">
                        {skill.teach.map((item) => (
                            <li key={item} className="flex gap-3 text-slate-700 dark:text-slate-300 leading-relaxed">
                                <span className="mt-1.5 shrink-0 text-emerald-600 dark:text-emerald-400 font-bold" aria-hidden="true">✓</span>
                                {item}
                            </li>
                        ))}
                    </ul>
                </section>

                <section className="mt-12 rounded-3xl bg-indigo-600 dark:bg-indigo-900 text-white p-8 text-center space-y-4">
                    <h2 className="text-2xl md:text-3xl font-extrabold">Як тут платять за заняття</h2>
                    <p className="text-indigo-100 leading-relaxed">
                        Не грошима, а хвилинами. Ти проводиш заняття — отримуєш хвилини на баланс; витрачаєш їх,
                        щоб навчатися самому. На старті одразу 120 хвилин, а проведені години зараховуються
                        як волонтерські й перетворюються на сертифікат із QR-перевіркою.
                    </p>
                    <Link to="/register" className="inline-block pt-1">
                        <Button size="lg" className="h-14 px-8 text-base md:text-lg font-bold bg-white text-indigo-600 hover:bg-slate-100 shadow-xl">
                            Створити акаунт — 120 хвилин у подарунок
                        </Button>
                    </Link>
                </section>

                <section className="mt-14">
                    <h2 className="text-2xl font-extrabold mb-5">Інші напрямки</h2>
                    <ul className="flex flex-wrap gap-2.5">
                        {others.map((s) => (
                            <li key={s.slug}>
                                <Link
                                    to={`/skills/${s.slug}`}
                                    className="inline-block px-4 py-2 rounded-full bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold text-sm border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                >
                                    {s.emoji} {s.name}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            </article>
        </PublicShell>
    )
}
