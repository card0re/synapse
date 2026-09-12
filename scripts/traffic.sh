#!/usr/bin/env bash
# Відвідуваність synapse.tel з логів Cloud Run. Без GA, без реєстрацій, безкоштовно.
# Використання:  bash scripts/traffic.sh [днів]   (за замовчуванням 7)
set -euo pipefail

DAYS="${1:-7}"
PROJECT="project-8aff5131-25d9-4667-85c"

# Сканери шлють звичайний user-agent, тому фільтруємо за шляхом: лишаємо
# тільки реальні маршрути застосунку. Все інше (/.env, /wp-admin, ...) — шум.
REAL='^/(login|register|terms|privacy|feed|profile|chat|admin|leaderboard|premium|logo[.]png|robots[.]txt|sitemap[.]xml)?$|^/(chat|user|assets)/'
BOTS='bot|crawler|spider|curl|HeadlessChrome|python-requests|Go-http-client|masscan|zgrab'

TMP="$(mktemp)"; LIVE="$(mktemp)"
trap 'rm -f "$TMP" "$LIVE"' EXIT

gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=skillswap-frontend AND httpRequest.requestMethod!=\"\"" \
  --project="$PROJECT" --limit=5000 --freshness="${DAYS}d" \
  --format="value(httpRequest.remoteIp,httpRequest.requestUrl,httpRequest.referer,httpRequest.userAgent)" > "$TMP"

# нормалізуємо шлях у 5-ту колонку, далі лишаємо справжні сторінки без ботів
awk -F'\t' '{p=$2; sub(/^https?:\/\/[^\/]*/,"",p); sub(/\?.*$/,"",p); print $0 "\t" p}' "$TMP" \
  | grep -viE "$BOTS" | awk -F'\t' -v re="$REAL" '$5 ~ re' > "$LIVE"

TOTAL=$(wc -l < "$TMP" | tr -d ' ')
HUMAN=$(wc -l < "$LIVE" | tr -d ' ')

echo "== Трафік synapse.tel за останні ${DAYS} днів =="
printf '\nЗапитів від людей:        %s\n' "$HUMAN"
printf 'Унікальних відвідувачів:  %s\n' "$(cut -f1 "$LIVE" | sort -u | wc -l | tr -d ' ')"
printf 'Відсіяно ботів/сканерів:  %s з %s усіх запитів\n' "$((TOTAL - HUMAN))" "$TOTAL"

printf '\n-- Найпопулярніші сторінки --\n'
cut -f5 "$LIVE" | grep -vE '^/(assets/|logo[.]png|robots[.]txt|sitemap[.]xml)' \
  | sort | uniq -c | sort -rn | head -10

printf '\n-- Звідки приходять (зовнішні реферери) --\n'
REFS="$(cut -f3 "$LIVE" | grep -v '^$' | grep -viE 'synapse[.]tel|run[.]app' \
  | sort | uniq -c | sort -rn | head -10 || true)"
if [ -n "$REFS" ]; then
  printf '%s\n' "$REFS"
else
  echo "(зовнішніх переходів немає — пошук і соцмережі трафіку не дають)"
fi
