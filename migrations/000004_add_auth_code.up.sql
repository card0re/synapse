-- Колонка была на старом DO-сервере добавлена вручную (ALTER TABLE), но не попала в дамп при переезде на Cloud SQL.
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_code VARCHAR(6);
