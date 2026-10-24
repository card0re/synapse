-- Прибирає тестові акаунти пентест-симуляції 2026-10-24.
-- Усі вони на зарезервованому домені @example.com (жоден реальний користувач
-- такого не має), тож вибірка по ньому безпечна й ідемпотентна — повторний
-- запуск просто нічого не знайде. Залежні рядки видаляються перед users,
-- бо на deals/orders/transactions є зовнішні ключі на users.
BEGIN;

-- id тестових користувачів
CREATE TEMP TABLE _victims ON COMMIT DROP AS
SELECT id FROM public.users WHERE email LIKE '%@example.com';

-- messages: sender_id/receiver_id — varchar(36), тому зводимо id до тексту
DELETE FROM public.messages
 WHERE sender_id   IN (SELECT id::text FROM _victims)
    OR receiver_id IN (SELECT id::text FROM _victims);

-- reviews: автор або адресат — тест
DELETE FROM public.reviews
 WHERE reviewer_id IN (SELECT id FROM _victims)
    OR target_id   IN (SELECT id FROM _victims);

-- reports: target_id — varchar, зводимо до тексту
DELETE FROM public.reports
 WHERE reporter_id IN (SELECT id FROM _victims)
    OR target_id   IN (SELECT id::text FROM _victims);

-- угоди в усіх чотирьох ролях (нові initiator/receiver і спадкові provider/client)
DELETE FROM public.deals
 WHERE initiator_id IN (SELECT id FROM _victims)
    OR receiver_id  IN (SELECT id FROM _victims)
    OR provider_id  IN (SELECT id FROM _victims)
    OR client_id    IN (SELECT id FROM _victims);

DELETE FROM public.transactions
 WHERE sender_id   IN (SELECT id FROM _victims)
    OR receiver_id IN (SELECT id FROM _victims);

DELETE FROM public.orders             WHERE user_id IN (SELECT id FROM _victims);
DELETE FROM public.skills             WHERE user_id IN (SELECT id FROM _victims);
DELETE FROM public.certificates       WHERE user_id IN (SELECT id FROM _victims);
DELETE FROM public.chat_preferences   WHERE user_id IN (SELECT id FROM _victims);
DELETE FROM public.user_achievements  WHERE user_id IN (SELECT id FROM _victims);
DELETE FROM public.global_news        WHERE user_id IN (SELECT id FROM _victims);

-- коди підтвердження пошти прив'язані до адреси, а не до id
DELETE FROM public.email_codes WHERE email LIKE '%@example.com';

-- і самі акаунти
DELETE FROM public.users WHERE id IN (SELECT id FROM _victims);

-- Перевірка: має бути 0
SELECT count(*) AS remaining_test_users FROM public.users WHERE email LIKE '%@example.com';

COMMIT;
