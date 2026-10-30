-- Підправити вік сид-акаунтів у діапазон 15–19 (дати підібрані так, щоб день
-- народження вже минув цього року, тож вік точний станом на 2026-10-24).
BEGIN;
UPDATE public.users SET birth_date = DATE '2009-03-14' WHERE email = 'andrii.kovalenko@demo.synapse.tel';     -- 17
UPDATE public.users SET birth_date = DATE '2007-07-22' WHERE email = 'oleksandr.bondarenko@demo.synapse.tel'; -- 19
UPDATE public.users SET birth_date = DATE '2010-02-02' WHERE email = 'dmytro.tkachenko@demo.synapse.tel';     -- 16
UPDATE public.users SET birth_date = DATE '2008-01-30' WHERE email = 'maksym.melnyk@demo.synapse.tel';        -- 18
UPDATE public.users SET birth_date = DATE '2011-05-18' WHERE email = 'oksana.shevchenko@demo.synapse.tel';    -- 15
UPDATE public.users SET birth_date = DATE '2008-09-09' WHERE email = 'nataliia.boiko@demo.synapse.tel';       -- 18
UPDATE public.users SET birth_date = DATE '2010-04-25' WHERE email = 'iryna.kravchenko@demo.synapse.tel';     -- 16
UPDATE public.users SET birth_date = DATE '2009-04-07' WHERE email = 'kateryna.polishchuk@demo.synapse.tel';  -- 17
UPDATE public.users SET birth_date = DATE '2011-08-16' WHERE email = 'yuliia.savchenko@demo.synapse.tel';     -- 15
UPDATE public.users SET birth_date = DATE '2007-02-11' WHERE email = 'mariia.lysenko@demo.synapse.tel';       -- 19

SELECT username,
       birth_date,
       date_part('year', age(birth_date))::int AS age
FROM public.users
WHERE email LIKE '%@demo.synapse.tel'
ORDER BY birth_date;
COMMIT;
