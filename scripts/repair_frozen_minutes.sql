-- Повертає власникам хвилини, які зависли в заморозці без жодної відкритої заявки.
--
-- Звідки вони взялися: створення угоди списувало ціну двічі (юзкейс + транзакція
-- репозиторію), а повернення при скасуванні — лише один раз, якщо його робив
-- фоновий прибиральник CleanStaleDeals, який ходить повз юзкейс. Різниця
-- залишалась у frozen_minutes назавжди.
--
-- Ідемпотентно: після першого запуску вибірка порожня.
-- Від'ємну заморозку свідомо не чіпаємо — забирати хвилини в людей без
-- доказів не можна, такі випадки треба розбирати руками (запит 2 в audit_ledger.sql).

UPDATE users u
SET balance_minutes = u.balance_minutes + u.frozen_minutes,
    frozen_minutes  = 0
WHERE u.frozen_minutes > 0
  AND NOT EXISTS (
      SELECT 1 FROM deals d
      WHERE d.initiator_id = u.id
        AND d.status IN ('pending', 'negotiating', 'accepted', 'cancel_requested', 'disputed')
  )
RETURNING id, username, balance_minutes AS new_balance, frozen_minutes AS new_frozen;
