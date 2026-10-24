-- Перевірка «дідусювання» email_verified: усі наявні користувачі мають
-- лишитись здатними витрачати хвилини (verified або з Telegram). Тестові
-- @example.com не рахуємо. Очікуємо can_spend = total.
SELECT
  count(*)                                                        AS total,
  count(*) FILTER (WHERE email_verified)                          AS verified,
  count(*) FILTER (WHERE telegram_id IS NOT NULL)                 AS has_telegram,
  count(*) FILTER (WHERE email_verified OR telegram_id IS NOT NULL) AS can_spend
FROM public.users
WHERE email IS NULL OR email NOT LIKE '%@example.com';
