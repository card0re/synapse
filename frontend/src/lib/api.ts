// Единая точка правды для адреса бэкенда. Меняется через .env, без хардкода
// по всем файлам (раньше каждый релиз = ручной поиск-замена в 11 файлах).
export const API_URL = import.meta.env.VITE_API_URL || "https://synapse.tel/api"
export const WS_URL = import.meta.env.VITE_WS_URL || "wss://synapse.tel/api"
