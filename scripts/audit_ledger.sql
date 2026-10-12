-- Ревизия учёта минут. Только чтение, ничего не меняет.
-- Запуск: psql "$DATABASE_URL" -f scripts/audit_ledger.sql
--
-- Инвариант платформы: frozen_minutes пользователя равен сумме цен его
-- незакрытых заявок. Любое расхождение — это минуты, снятые с баланса
-- и ни к чему не привязанные (или наоборот, размороженные дважды).

\echo '== 1. Расхождение заморозки с реальными заявками =='
SELECT u.id,
       u.username,
       u.balance_minutes,
       u.frozen_minutes                        AS frozen_in_profile,
       COALESCE(d.frozen_by_deals, 0)          AS frozen_by_deals,
       u.frozen_minutes - COALESCE(d.frozen_by_deals, 0) AS diff
FROM users u
LEFT JOIN (
    SELECT initiator_id, SUM(price) AS frozen_by_deals
    FROM deals
    WHERE status IN ('pending', 'negotiating', 'accepted', 'cancel_requested', 'disputed')
    GROUP BY initiator_id
) d ON d.initiator_id = u.id
WHERE u.frozen_minutes <> COALESCE(d.frozen_by_deals, 0)
ORDER BY ABS(u.frozen_minutes - COALESCE(d.frozen_by_deals, 0)) DESC;

\echo '== 2. Отрицательные остатки (в схеме нет CHECK, так что они возможны) =='
SELECT id, username, balance_minutes, frozen_minutes
FROM users
WHERE balance_minutes < 0 OR frozen_minutes < 0
ORDER BY LEAST(balance_minutes, frozen_minutes);

\echo '== 3. Сделки по статусам =='
SELECT status, count(*), SUM(price) AS minutes
FROM deals
GROUP BY status
ORDER BY count(*) DESC;

\echo '== 4. Зависшие сделки: запрос отмены и споры =='
-- cancel_requested не возвращал минуты и не показывался мастеру,
-- так что эти строки — заведомо замороженные навсегда минуты.
SELECT id, initiator_id, receiver_id, price, status, created_at, updated_at
FROM deals
WHERE status IN ('cancel_requested', 'disputed')
ORDER BY created_at;

\echo '== 5. Принятые уроки, которые не удалось завершить =='
-- CompleteDeal падал всегда, поэтому всё принятое старше суток
-- почти наверняка пыталось завершиться и не смогло.
SELECT id, initiator_id, receiver_id, price, scheduled_at, created_at
FROM deals
WHERE status = 'accepted' AND created_at < NOW() - INTERVAL '1 day'
ORDER BY created_at;

\echo '== 6. Сходимость системы: сколько минут в обороте =='
SELECT (SELECT count(*) FROM users)                          AS users,
       (SELECT SUM(balance_minutes) FROM users)              AS balance_total,
       (SELECT SUM(frozen_minutes) FROM users)               AS frozen_total,
       (SELECT count(*) * 120 FROM users)                    AS welcome_total,
       (SELECT COALESCE(SUM(price), 0) FROM deals WHERE status = 'completed') AS completed_minutes;

\echo '== 7. Защита от повторного бонуса за достижение =='
-- Если уникального индекса нет, два одновременных запроса начислят бонус дважды.
SELECT indexdef FROM pg_indexes WHERE tablename = 'user_achievements';

SELECT user_id, achievement_id, count(*)
FROM user_achievements
GROUP BY user_id, achievement_id
HAVING count(*) > 1;

\echo '== 9. Дубликаты почты (уникального индекса на users.email немає) =='
-- GetUserByEmail бере перший-ліпший рядок, тож вхід у такі акаунти
-- потрапляє в випадковий із них.
SELECT lower(email) AS email, count(*) AS accounts,
       string_agg(id::text || ' (' || coalesce(username, '?') || ', ' || created_at::date || ')', ' | ' ORDER BY created_at) AS rows
FROM users
WHERE email IS NOT NULL
GROUP BY lower(email)
HAVING count(*) > 1;

\echo '== 8. Объявления, снесённые ИИ-модерацией =='
-- Персональная новость с этим заголовком создаётся только в ветке удаления.
SELECT count(*) AS deleted_by_ai, min(created_at) AS first, max(created_at) AS last
FROM global_news
WHERE user_id IS NOT NULL AND title LIKE '%видалено%';

-- Причина в тексті новини показує, спрацювала модерація по суті
-- чи це була помилка API (стара гілка відповідала "Підозра на заборонений контент").
SELECT created_at, content
FROM global_news
WHERE user_id IS NOT NULL AND title LIKE '%видалено%'
ORDER BY created_at DESC
LIMIT 5;
