import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { SKILLS } from "@/lib/skills"

const FAQ = [
    {
        q: "Це справді безкоштовно?",
        a: "Навчання й обмін хвилинами — безкоштовні, і гроші між користувачами не ходять узагалі. Одразу після реєстрації на баланс надходить 120 хвилин, тому почати вчитися можна ще до свого першого заняття. Окремо є необовʼязкова підписка Synapse PRO з бонусними хвилинами — вона ще в розробці, і без неї платформа працює повністю.",
    },
    {
        q: "Я нічого не вмію на рівні викладача. Мені тут місце?",
        a: "Так. Достатньо знати щось краще за того, хто хоче цьому навчитися. Восьмикласник може підтягнути п'ятикласника з математики, а той, хто рік грає на гітарі, — показати новачку перші акорди. Це вже повноцінний обмін.",
    },
    {
        q: "Що таке волонтерські години і де вони потрібні?",
        a: "Це підтверджений час, який ти витратив, навчаючи інших. Він зараховується у сертифікат, який додають до мотиваційного листа при вступі або до портфоліо — як підтвердження соціальної активності.",
    },
    {
        q: "Чи безпечно це для дитини?",
        a: "Заняття проходять онлайн у Google Meet, тому зустрічатися особисто з незнайомими людьми не потрібно. Оголошення та повідомлення перевіряє ШІ-модерація, а будь-якого користувача можна заблокувати або поскаржитися на нього. Переказувати реальні гроші на платформі заборонено правилами.",
    },
    {
        q: "Скільки коштує одне заняття?",
        a: "Ціну у хвилинах встановлює сам ментор. Типове заняття — 60 хвилин: година твого часу за годину його часу.",
    },
    {
        q: "Як перевірити сертифікат?",
        a: "Кожен сертифікат має унікальний номер і QR-код. Навчальний заклад чи роботодавець сканує код і бачить, кому саме видано сертифікат і за скільки підтверджених годин.",
    },
    {
        q: "Як зареєструватися?",
        a: "Через Google, електронну пошту або Telegram — обирай, що зручніше. Реєстрація займає менше хвилини й не потребує жодних платіжних даних.",
    },
]

const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
}

const STEPS = [
    {
        icon: "🧠",
        title: "Поділися навичкою",
        text: "Створи оголошення про те, чому можеш навчити — від розв'язування задач з математики до кулінарії. Сам вкажи, скільки хвилин коштує одне заняття.",
        ring: "hover:border-indigo-500",
    },
    {
        icon: "⏳",
        title: "Проведи заняття",
        text: "Учень відгукується, ви домовляєтесь про час. Зустріч проходить у Google Meet — виходити з дому не потрібно. Хвилини заморожуються, поки обидві сторони не підтвердять заняття.",
        ring: "hover:border-emerald-500",
    },
    {
        icon: "🎓",
        title: "Витрать або збережи",
        text: "Заробленими хвилинами платиш за власне навчання в інших менторів. А проведені години зараховуються як волонтерські й перетворюються на сертифікат.",
        ring: "hover:border-amber-500",
    },
]

const TRUST = [
    {
        tone: "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400",
        title: "Сертифікат, який не підробити",
        text: "Кожен сертифікат має унікальний номер і QR-код. Навчальний заклад перевіряє його за секунду — достатньо відсканувати.",
    },
    {
        tone: "bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400",
        title: "ШІ-модерація та зустрічі онлайн",
        text: "Оголошення й чати перевіряє нейромережа. Заняття проходять у Google Meet, тому зустрічатися особисто з незнайомими людьми не потрібно.",
    },
    {
        tone: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400",
        title: "Хвилини під захистом ескроу",
        text: "Поки заняття не підтверджене обома сторонами, хвилини заморожені. Ніхто не зникне з чужим балансом.",
    },
    {
        tone: "bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400",
        title: "Гроші між користувачами не ходять",
        text: "Розрахунки всередині платформи — лише у хвилинах. Прохання переказати реальні гроші — пряме порушення правил, на яке можна поскаржитися.",
    },
]

const NODES: [number, number][] = [
    [90, 140], [300, 90], [520, 170], [760, 110], [980, 190], [1130, 130],
    [120, 430], [340, 480], [560, 400], [800, 470], [1020, 390], [1160, 450],
]

export default function Landing() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-display transition-colors duration-300">
            <title>Безкоштовне навчання в обмін на знання — Synapse</title>
            <meta name="description" content="Synapse — українська платформа неформальної освіти з Ірпеня. Навчай інших тому, що знаєш: математиці, англійській, програмуванню — і витрачай зароблені хвилини на власне навчання. Без грошей, з волонтерськими годинами та сертифікатом." />
            <link rel="canonical" href="https://synapse.tel/" />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

            {/* НАВІГАЦІЯ */}
            <nav className="fixed w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center transform rotate-12 shadow-lg shadow-indigo-500/30">
                            <span className="text-white font-extrabold text-xl -rotate-12">S</span>
                        </div>
                        <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white uppercase">Synapse</span>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">
                        <a href="#faq" className="hidden md:inline-block text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                            Питання
                        </a>
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

            {/* ГОЛОВНИЙ ЕКРАН */}
            <section className="relative pt-36 pb-20 px-6 overflow-hidden">
                {/* Мотив синапсу: вузли та зв'язки між ними. Декоративний. */}
                <svg
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 w-full h-full text-indigo-600 dark:text-indigo-400 opacity-[0.12] dark:opacity-[0.18]"
                    viewBox="0 0 1200 600"
                    preserveAspectRatio="xMidYMid slice"
                >
                    <g stroke="currentColor" strokeWidth="1.5" fill="none">
                        <path d="M90 140 L300 90 L520 170 L760 110 L980 190 L1130 130" />
                        <path d="M120 430 L340 480 L560 400 L800 470 L1020 390 L1160 450" />
                        <path d="M300 90 L340 480" />
                        <path d="M520 170 L560 400" />
                        <path d="M760 110 L800 470" />
                        <path d="M980 190 L1020 390" />
                    </g>
                    <g fill="currentColor">
                        {NODES.map(([x, y]) => (
                            <circle key={`${x}-${y}`} cx={x} cy={y} r="6" />
                        ))}
                    </g>
                </svg>

                <div className="relative max-w-4xl mx-auto text-center space-y-7">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold text-sm border border-indigo-200 dark:border-indigo-800/50">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                        </span>
                        Перша P2P освітня платформа в Україні
                    </div>

                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.08]">
                        Безкоштовне навчання в обмін на{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">твої знання</span>
                    </h1>

                    <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
                        Synapse — платформа неформальної освіти з Ірпеня. Навчай інших тому, що знаєш добре:
                        математиці, англійській, програмуванню чи грі на гітарі. За кожне проведене заняття
                        отримуєш хвилини — і витрачаєш їх на власне навчання в інших. Між користувачами
                        гроші не ходять узагалі: валюта тут — час.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                        <Link to="/register">
                            <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xl shadow-indigo-600/20">
                                Почати безкоштовно
                            </Button>
                        </Link>
                        <a href="#yak-pracuye">
                            <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-lg font-bold border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
                                Як це працює
                            </Button>
                        </a>
                    </div>

                    {/* Тільки перевірені факти — жодної вигаданої статистики */}
                    <dl className="flex flex-wrap justify-center gap-x-8 gap-y-3 pt-6 text-sm">
                        {[
                            ["120 хвилин", "на старт, одразу"],
                            ["0 ₴", "за навчання й обмін"],
                            ["QR-сертифікат", "за волонтерські години"],
                        ].map(([big, small]) => (
                            <div key={big} className="flex items-baseline gap-2">
                                <dt className="font-extrabold text-slate-900 dark:text-white">{big}</dt>
                                <dd className="text-slate-500 dark:text-slate-400">{small}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </section>

            {/* НАПРЯМКИ */}
            <section className="py-20 px-6 bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800">
                <div className="max-w-5xl mx-auto">
                    <div className="max-w-2xl mb-10">
                        <h2 className="text-3xl md:text-4xl font-extrabold mb-4">Чому можна навчати і що вивчати</h2>
                        <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                            Будь-якій навичці, яку ти знаєш краще за інших. Ось напрямки, які учні обмінюють
                            найчастіше — але список не закритий: якщо вмієш щось своє, просто додай його.
                        </p>
                    </div>

                    <ul className="flex flex-wrap gap-2.5">
                        {SKILLS.map((s) => (
                            <li key={s.slug}>
                                <Link
                                    to={`/skills/${s.slug}`}
                                    className="inline-block px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                >
                                    {s.name}
                                </Link>
                            </li>
                        ))}
                        <li>
                            <Link
                                to="/skills"
                                className="inline-block px-4 py-2 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold text-sm border border-dashed border-indigo-300 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                            >
                                усі напрямки →
                            </Link>
                        </li>
                    </ul>

                    <p className="mt-8 text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                        <strong className="text-slate-900 dark:text-white">Платформа молода</strong> — більшість
                        напрямків досі чекають на свого першого ментора. Якщо ти заповниш вільну нішу, перші
                        учні знайдуть саме тебе.
                    </p>
                </div>
            </section>

            {/* ЯК ЦЕ ПРАЦЮЄ */}
            <section id="yak-pracuye" className="py-24 px-6 scroll-mt-20">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-14 max-w-2xl mx-auto">
                        <h2 className="text-3xl md:text-4xl font-extrabold mb-4">Як працює економіка часу</h2>
                        <p className="text-lg text-slate-500 dark:text-slate-400">
                            Без оплат між користувачами. Тільки твої знання і час, захищені системою ескроу.
                        </p>
                    </div>

                    <ol className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {STEPS.map((step, i) => (
                            <li
                                key={step.title}
                                className={`bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 transition-colors ${step.ring}`}
                            >
                                <div className="w-14 h-14 mb-6 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-3xl">
                                    {step.icon}
                                </div>
                                <h3 className="text-xl font-bold mb-3">
                                    <span className="text-indigo-600 dark:text-indigo-400 tabular-nums">{i + 1}.</span> {step.title}
                                </h3>
                                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{step.text}</p>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* ДОВІРА */}
            <section className="py-24 px-6 bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800">
                <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-start gap-16">
                    <div className="w-full lg:w-1/2 space-y-8">
                        <h2 className="text-3xl md:text-4xl font-extrabold">Чому цьому можна довіряти</h2>
                        <ul className="space-y-6">
                            {TRUST.map((f) => (
                                <li key={f.title} className="flex gap-4">
                                    <div className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center text-lg font-bold ${f.tone}`}>
                                        ✓
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold mb-1">{f.title}</h3>
                                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{f.text}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="w-full lg:w-1/2 relative">
                        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-blue-500 blur-[100px] opacity-20 dark:opacity-30 rounded-full"></div>
                        <figure className="relative bg-white dark:bg-slate-950 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl">
                            <div className="border-b border-slate-100 dark:border-slate-800 pb-6 mb-6 text-center">
                                <h3 className="font-extrabold text-2xl uppercase tracking-widest text-indigo-900 dark:text-indigo-400">Сертифікат</h3>
                                <p className="text-sm text-slate-500 uppercase">Про здобуття неформальної освіти</p>
                            </div>
                            <div className="space-y-4">
                                <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded w-3/4 mx-auto"></div>
                                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-full mx-auto"></div>
                                <div className="flex justify-center pt-4">
                                    <div className="text-center">
                                        <span className="block text-4xl font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums">30</span>
                                        <span className="text-xs font-bold text-slate-400 tracking-widest">ГОДИН</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-end pt-6">
                                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-xs text-slate-400">QR</div>
                                    <div className="w-24 h-1 border-b-2 border-slate-800 dark:border-slate-500"></div>
                                </div>
                            </div>
                            <figcaption className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
                                Зразок. Реальний сертифікат формується з підтверджених годин.
                            </figcaption>
                        </figure>
                    </div>
                </div>
            </section>

            {/* ПИТАННЯ ТА ВІДПОВІДІ */}
            <section id="faq" className="py-24 px-6 scroll-mt-20">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-extrabold mb-10">Питання та відповіді</h2>
                    <div className="space-y-3">
                        {FAQ.map((f, i) => (
                            <details
                                key={f.q}
                                open={i === 0}
                                className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                            >
                                <summary className="cursor-pointer list-none px-6 py-5 flex items-center justify-between gap-4 font-bold text-lg hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                    {f.q}
                                    <span className="shrink-0 text-indigo-600 dark:text-indigo-400 text-2xl leading-none transition-transform group-open:rotate-45">
                                        +
                                    </span>
                                </summary>
                                <p className="px-6 pb-6 -mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">{f.a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* ЗАКЛИК */}
            <section className="py-24 bg-indigo-600 dark:bg-indigo-900 text-white text-center px-6 relative overflow-hidden">
                <div
                    aria-hidden="true"
                    className="absolute inset-0 opacity-[0.15]"
                    style={{
                        backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1.5px, transparent 0)",
                        backgroundSize: "28px 28px",
                    }}
                ></div>
                <div className="max-w-3xl mx-auto relative z-10 space-y-7">
                    <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
                        Стань першим ментором у своєму напрямку
                    </h2>
                    <p className="text-lg md:text-xl text-indigo-100 leading-relaxed">
                        Зараз на Synapse майже вільно: більшість предметів ще не мають жодного ментора.
                        Хто прийде першим — отримає перших учнів і перші волонтерські години.
                    </p>
                    <Link to="/register" className="inline-block pt-2">
                        <Button size="lg" className="h-16 px-8 text-lg md:text-xl font-bold bg-white text-indigo-600 hover:bg-slate-100 shadow-2xl">
                            Створити акаунт — 120 хвилин у подарунок
                        </Button>
                    </Link>
                </div>
            </section>

            {/* ПІДВАЛ */}
            <footer className="bg-slate-900 text-slate-400 py-12">
                <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-5 text-center md:text-left">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-indigo-500 rounded flex items-center justify-center transform rotate-12">
                            <span className="text-white font-extrabold text-xs -rotate-12">S</span>
                        </div>
                        <span className="text-xl font-extrabold tracking-tight text-white uppercase">Synapse</span>
                    </div>
                    <p className="text-sm">
                        © {new Date().getFullYear()} Освітня ініціатива Synapse · Ірпінь, Україна
                    </p>
                    <div className="flex gap-4">
                        <Link to="/terms" className="hover:text-white transition-colors">Правила</Link>
                        <Link to="/privacy" className="hover:text-white transition-colors">Конфіденційність</Link>
                    </div>
                </div>
            </footer>
        </div>
    )
}
