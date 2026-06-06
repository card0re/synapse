import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"

export default function Privacy() {
    const navigate = useNavigate()
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans">
            <div className="max-w-4xl mx-auto space-y-6">
                <Button variant="outline" onClick={() => navigate(-1)} className="dark:border-slate-700 dark:text-slate-200">← Назад</Button>
                <Card className="dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl">
                    <CardContent className="p-6 md:p-10 prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200">
                        <h1 className="text-3xl md:text-4xl font-black mb-2 text-slate-900 dark:text-white">Політика конфіденційності (Privacy Policy)</h1>
                        <p className="text-sm text-slate-500 font-medium mb-8 pb-6 border-b border-slate-200 dark:border-slate-800">
                            Остання редакція: {new Date().toLocaleDateString('uk-UA')}
                        </p>

                        <div className="space-y-8 text-sm md:text-base leading-relaxed">
                            <section>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">1. Загальні положення</h3>
                                <p>
                                    1.1. Ця Політика конфіденційності пояснює, як платформа Synapse (далі — «Платформа») збирає, використовує, зберігає та захищає персональні дані Користувачів.
                                </p>
                                <p className="mt-2">
                                    1.2. Використовуючи Платформу, ви надаєте явну згоду на обробку ваших персональних даних відповідно до умов цієї Політики та чинного законодавства України (Закон України «Про захист персональних даних»).
                                </p>
                            </section>

                            <section>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">2. Які дані ми збираємо</h3>
                                <p>2.1. Ми збираємо лише мінімально необхідний обсяг даних для забезпечення функціонування сервісу:</p>
                                <ul className="list-disc pl-5 mt-2 space-y-1">
                                    <li><strong>Облікові дані:</strong> ім'я (або нікнейм), адреса електронної пошти, зашифрований пароль.</li>
                                    <li><strong>Дані профілю:</strong> біографія, аватар, місто, дата народження (за бажанням).</li>
                                    <li><strong>Технічні дані:</strong> Telegram ID (у разі прив'язки бота для сповіщень), IP-адреса, файли cookies та дані локального сховища (Local Storage) для авторизації (JWT-токени).</li>
                                    <li><strong>Історія активності:</strong> ваші оголошення, відгуки, повідомлення в чатах та історія угод (передачі «Хвилин»).</li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">3. Мета обробки даних</h3>
                                <p>3.1. Ваші дані використовуються виключно для:</p>
                                <ul className="list-disc pl-5 mt-2 space-y-1">
                                    <li>Створення та адміністрування вашого облікового запису.</li>
                                    <li>Генерації офіційних сертифікатів неформальної освіти (якщо ви добровільно вказали свої повні дані).</li>
                                    <li>Забезпечення комунікації між Користувачами (P2P чати).</li>
                                    <li>Надсилання сервісних та системних сповіщень.</li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">4. Передача даних третім особам та ШІ-модерація</h3>
                                <p className="font-bold text-indigo-700 dark:text-indigo-400">
                                    4.1. Ми ніколи не продаємо, не здаємо в оренду і не передаємо ваші персональні дані третім особам у маркетингових або рекламних цілях.
                                </p>
                                <p className="mt-2">
                                    4.2. <strong>Використання Штучного Інтелекту:</strong> З метою забезпечення безпеки спільноти та надання персоналізованих рекомендацій (метчинг у стрічці), ваші публічні оголошення, біографія та повідомлення в чатах можуть оброблятися автоматизованими алгоритмами штучного інтелекту (через API-сервіси сторонніх провайдерів) виключно для виявлення порушень правил Платформи та покращення користувацького досвіду. Ці дані не використовуються провайдерами ШІ для тренування їхніх публічних моделей.
                                </p>
                                <p className="mt-2">
                                    4.3. Дані можуть бути розкриті правоохоронним органам виключно у випадках, прямо передбачених чинним законодавством України (за наявності відповідного рішення суду).
                                </p>
                            </section>

                            <section>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">5. Захист та зберігання даних</h3>
                                <p>
                                    5.1. Ми вживаємо розумних технічних та організаційних заходів для захисту ваших даних (шифрування паролів, захищені з'єднання). Однак жоден метод передачі даних через Інтернет не є абсолютно безпечним, тому Платформа не може гарантувати їхню 100% невразливість.
                                </p>
                            </section>

                            <section>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">6. Ваші права як суб'єкта даних</h3>
                                <p>6.1. Відповідно до чинного законодавства, ви маєте право:</p>
                                <ul className="list-disc pl-5 mt-2 space-y-1">
                                    <li>Знати про місцезнаходження та цілі обробки своїх персональних даних.</li>
                                    <li>Отримувати доступ до своїх даних та самостійно змінювати їх у налаштуваннях профілю.</li>
                                    <li><strong>Право на забуття:</strong> Ви маєте право вимагати повного видалення вашого акаунту, включно з усією історією чатів, угод та оголошень.</li>
                                </ul>
                            </section>
                        </div>

                    </CardContent>
                </Card>
            </div>
        </div>
    )
}