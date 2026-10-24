// Единая точка правды для адреса бэкенда. Меняется через .env, без хардкода
// по всем файлам (раньше каждый релиз = ручной поиск-замена в 11 файлах).
// Фолбек мусить вказувати на справжній API, а не на власний origin: за
// synapse.tel/api стоїть nginx цього ж фронтенду, який на будь-який шлях
// віддає index.html із кодом 200. Тобто збірка без VITE_API_URL (а .env у
// git не лежить і в образ не потрапляє) мовчки отримувала HTML замість JSON —
// сайт відкривався, але жоден запит не працював, починаючи з логіна.
export const API_URL = import.meta.env.VITE_API_URL || "https://api.synapse.tel/api"
export const WS_URL = import.meta.env.VITE_WS_URL || "wss://api.synapse.tel/api"
