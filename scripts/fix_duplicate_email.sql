-- Розводить два акаунти з однаковою поштою.
--
-- Адресу й id користувача прибрано: репозиторій публічний, а це персональні
-- дані живої людини. Підставити реальні значення перед запуском.
--
-- Обидва порожні: ні навичок, ні угод, ні повідомлень, ні відгуків, в обох
-- баланс 120 і пароль. Людина просто зареєструвалася двічі, причому перший
-- раз (20.07) — у вікно, коли вхід поштою був зламаний: пароль зберігався
-- відкритим текстом і bcrypt-порівняння ніколи не збігалося.
--
-- Лишаємо робочим пізніший акаунт (31.08) — саме його пароль користувач
-- вводив останнім. Старший НЕ видаляємо: рядок лишається на місці, пошту
-- можна повернути одним UPDATE, якщо виявиться, що потрібен був він.
--
-- Поки дублікат живий, GetUserByEmail бере перший-ліпший рядок, тож вхід
-- потрапляє у випадковий із двох, а унікальний індекс не створюється.

UPDATE users SET email = NULL
WHERE id = '<older-duplicate-user-id>' AND email IS NOT NULL
RETURNING id, username, created_at::date AS created, email;

-- Тепер індекс стає без конфліктів. Та сама команда є у стартовому блоці
-- cmd/api/main.go, тож на проді вона в будь-якому разі відпрацює при рестарті.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (email);

-- Перевірки: індекс на місці, дублікатів немає, з поштою лишився один акаунт.
SELECT indexdef FROM pg_indexes WHERE indexname = 'users_email_key';

SELECT lower(email) AS email, count(*) AS accounts
FROM users WHERE email IS NOT NULL
GROUP BY lower(email) HAVING count(*) > 1;

SELECT id, username, created_at::date AS created, balance_minutes,
       password_hash IS NOT NULL AND password_hash <> '' AS has_pwd
FROM users WHERE email = '<duplicate-email>';
