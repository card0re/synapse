import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import PublicShell from "@/components/PublicShell"
import { API_URL } from "@/lib/api"
import { SKILLS, adsPlural } from "@/lib/skills"

export default function SkillsIndex() {
    const [counts, setCounts] = useState<Record<string, number> | null>(null)

    useEffect(() => {
        let alive = true
        fetch(`${API_URL}/feed/`)
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((data) => {
                if (!alive) return
                const list: any[] = Array.isArray(data) ? data : data?.feed || data?.skills || []
                const next: Record<string, number> = {}
                for (const s of SKILLS) {
                    next[s.slug] = list.filter((it) =>
                        s.match.test(`${it?.title ?? ""} ${it?.description ?? ""}`)
                    ).length
                }
                setCounts(next)
            })
            .catch(() => alive && setCounts({}))
        return () => {
            alive = false
        }
    }, [])

    const itemList = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Напрямки обміну навичками на Synapse",
        itemListElement: SKILLS.map((s, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: s.name,
            url: `https://synapse.tel/skills/${s.slug}`,
        })),
    }

    return (
        <PublicShell>
            <title>Напрямки навчання — що можна вивчати й викладати на Synapse</title>
            <meta name="description" content="Усі напрямки обміну навичками на Synapse: англійська, математика, програмування, гітара, малювання та інші. Навчай тому, що знаєш, і навчайся безкоштовно в обмін на свій час." />
            <link rel="canonical" href="https://synapse.tel/skills" />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />

            <div className="max-w-5xl mx-auto px-5 py-12">
                <nav aria-label="Навігація" className="text-sm text-slate-500 dark:text-slate-400 mb-8 flex items-center gap-1.5">
                    <Link to="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Головна</Link>
                    <span aria-hidden="true">/</span>
                    <span className="text-slate-700 dark:text-slate-200 font-semibold">Напрямки</span>
                </nav>

                <header className="max-w-2xl space-y-5">
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">
                        Що можна вивчати й викладати на Synapse
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                        Обмін працює в обидві сторони: ти навчаєш тому, що знаєш краще за інших, і за
                        зароблені хвилини навчаєшся сам. Нижче — напрямки, які обмінюють найчастіше.
                        Якщо твоєї навички тут немає, її можна просто додати після реєстрації.
                    </p>
                    <div className="pt-1">
                        <Link to="/register">
                            <Button size="lg" className="h-14 px-7 text-base bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-600/20">
                                Почати безкоштовно — 120 хвилин на старт
                            </Button>
                        </Link>
                    </div>
                </header>

                <ul className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {SKILLS.map((s) => {
                        const n = counts?.[s.slug]
                        return (
                            <li key={s.slug}>
                                <Link
                                    to={`/skills/${s.slug}`}
                                    className="group h-full flex flex-col gap-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 transition-colors"
                                >
                                    <span className="text-3xl" aria-hidden="true">{s.emoji}</span>
                                    <span className="font-bold text-lg group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                        {s.name}
                                    </span>
                                    <span className="text-sm text-slate-500 dark:text-slate-400 mt-auto pt-1 tabular-nums">
                                        {n === undefined
                                            ? " "
                                            : n > 0
                                                ? `${n} ${adsPlural(n)}`
                                                : "Вільно — стань першим"}
                                    </span>
                                </Link>
                            </li>
                        )
                    })}
                </ul>

                <p className="mt-10 text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                    Платформа молода, тому більшість напрямків поки вільні. Це означає, що ментор,
                    який зареєструється зараз, не має конкуренції — перші учні звернуться саме до нього.
                </p>
            </div>
        </PublicShell>
    )
}
