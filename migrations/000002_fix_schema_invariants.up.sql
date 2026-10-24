-- Три розбіжності між схемою в проді й тим, що припускає код.
-- Знайдені 12.10.2026 при звірці дампа схеми з запитами репозиторію.

-- 1. CreateReview робить INSERT ... ON CONFLICT (deal_id) DO UPDATE, але
--    унікального індексу на deal_id у базі немає. Postgres на таке відповідає
--    42P10 ("no unique or exclusion constraint matching the ON CONFLICT
--    specification") — тобто жоден відгук ніколи не зберігався. Таблиця reviews
--    порожня, тож індекс стає без конфліктів.
--    Унікальність тут по парі (угода, автор), а не по угоді: сторін в угоді
--    дві, і кожна лишає свій відгук. З індексом лише на deal_id другий відгук
--    затирав перший, при цьому reviewer_id і target_id у рядку лишались від
--    першого — і перерахунок рейтингу ставив новому адресату 0.00.
DROP INDEX IF EXISTS reviews_deal_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS reviews_deal_reviewer_key ON public.reviews (deal_id, reviewer_id);

-- 2. users.email без унікальності. Реєстрація через пошту розраховує саме на
--    помилку бази ("Можливо, такий email вже існує"), а GetUserByEmail бере
--    перший-ліпший рядок — два акаунти з однаковою поштою означають вхід
--    у випадковий із них. NULL у Postgres унікальності не заважають, тож
--    акаунтам з Telegram без пошти індекс нічого не ламає.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON public.users (email);

-- 3. Дефолт балансу в базі — 240 хвилин, хоча і код, і лендинг, і README
--    говорять про 120. Обидва шляхи реєстрації задають значення явно, тому
--    дефолт спрацьовує лише там, де колонку забули — і тоді мовчки видає вдвічі
--    більше. Зрівнюємо з обіцянкою.
ALTER TABLE public.users ALTER COLUMN balance_minutes SET DEFAULT 120;

-- 4. Колонки users.is_banned у базі немає зовсім, хоча адмінка має кнопку бана,
--    а модель її читає. ToggleBan робить UPDATE users SET is_banned = NOT is_banned
--    і завжди падає з 42703 ("column does not exist") — бан не те що не
--    перевірявся, він навіть не зберігався.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;

-- 5. Відповіді в чаті фронт шле й показує, але зберігати їх нікуди: у messages
--    немає ні reply_to_id, ні reply_to_text, тож після перезавантаження цитата
--    зникала. Текст цитати тримаємо копією — так вона переживає видалення
--    вихідного повідомлення.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_id integer;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_text text;
