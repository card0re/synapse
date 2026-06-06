-- Таблица пользователей
CREATE TABLE users (
                       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                       telegram_id BIGINT UNIQUE NOT NULL,
                       username VARCHAR(255),
                       phone_number VARCHAR(20) UNIQUE, -- Для верификации и защиты от ботов
                       balance_minutes INT DEFAULT 120, -- Приветственные 2 часа (120 минут)
                       rating DECIMAL(3, 2) DEFAULT 5.00,
                       created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Справочник навыков (категории того, чем обмениваемся)
CREATE TABLE skills (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(100) UNIQUE NOT NULL, -- "Математика", "Go", "Копирайтинг"
                        category VARCHAR(100) -- "Точные науки", "IT", "Гуманитарные"
);

-- Таблица заявок (Order Book - "Биржевой стакан")
CREATE TABLE orders (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                        skill_id INT REFERENCES skills(id),
                        order_type VARCHAR(10) NOT NULL, -- 'OFFER' (я учу) или 'REQUEST' (меня учат)
                        description TEXT,
                        status VARCHAR(20) DEFAULT 'ACTIVE', -- 'ACTIVE', 'PAUSED', 'CLOSED'
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица сделок (Договоренность двух юзеров)
-- Когда кто-то откликается на заявку, создается эта запись.
CREATE TABLE deals (
                       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                       order_id UUID REFERENCES orders(id), -- К какой заявке привязана сделка
                       provider_id UUID REFERENCES users(id), -- Тот, кто предоставляет услугу (получает время)
                       client_id UUID REFERENCES users(id),   -- Тот, кто получает услугу (платит время)
                       duration_minutes INT NOT NULL CHECK (duration_minutes > 0), -- Объем сделки в минутах
                       status VARCHAR(20) DEFAULT 'CREATED', -- 'CREATED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED', 'CANCELED'
                       created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                       updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица транзакций (Финансовый лог)
-- Создается только после того, как сделка (deal) перешла в статус 'COMPLETED'
CREATE TABLE transactions (
                              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                              deal_id UUID REFERENCES deals(id),
                              sender_id UUID REFERENCES users(id),
                              receiver_id UUID REFERENCES users(id),
                              amount_minutes INT NOT NULL CHECK (amount_minutes > 0),
                              created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);