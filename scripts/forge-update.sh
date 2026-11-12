#!/usr/bin/env bash
# تحديث منصة وسطاء ازدان على خادم Forge بعد أي تعديل في الكود. البيانات والوثائق لا تتأثر.
#   ssh -i ~/.ssh/azdan_deploy forge@SERVER 'bash -s' < scripts/forge-update.sh
set -euo pipefail
APP="$HOME/azdan-brokers"
BRANCH="${BRANCH:-mysql-forge}"
cd "$APP"
git fetch --depth 1 origin "$BRANCH"
git reset --hard "origin/$BRANCH"
npm ci --no-audit --no-fund
[ -n "$(ls public/fonts/*.otf 2>/dev/null)" ] || npm run fonts || true
npx prisma generate
npx tsx scripts/db-setup.ts
npx next build
pm2 restart azdan-brokers --update-env
sleep 4
curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:3100/login
