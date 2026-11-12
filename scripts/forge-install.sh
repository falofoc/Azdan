#!/usr/bin/env bash
# تثبيت منصة وسطاء ازدان على خادم Forge (مرة واحدة) — يعمل بصلاحيات المستخدم forge بدون sudo.
# الاستخدام من جهازك:
#   ssh -i ~/.ssh/azdan_deploy forge@SERVER 'ADMIN_PHONE=05xxxxxxxx bash -s' < scripts/forge-install.sh
# ما يفعله:
#   1) ينشئ قاعدة MySQL مستقلة (azdan_brokers) ومستخدمًا خاصًا بها — لا يلمس قاعدة الموقع الرئيسي.
#   2) يسحب الكود إلى ~/azdan-brokers، ويكتب ملف .env بأسرار عشوائية.
#   3) يبني المنصة ويشغلها بـ PM2 على 127.0.0.1:3100 (غير مكشوفة للإنترنت حتى يُربط Nginx).
set -euo pipefail

REPO="${REPO:-https://github.com/falofoc/Azdan.git}"
BRANCH="${BRANCH:-mysql-forge}"
APP="$HOME/azdan-brokers"
STORAGE="$HOME/azdan-brokers-storage"
PORT="${PORT:-3100}"
DB_NAME="azdan_brokers"
DB_USER="azdan_brokers"
MAIN_ENV="$HOME/azdan.sa/.env"

say() { printf '\n\033[1;33m▸ %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*"; exit 1; }

[[ "${ADMIN_PHONE:-}" =~ ^05[0-9]{8}$ ]] || die "اكتب جوال المدير بصيغة 05xxxxxxxx: ADMIN_PHONE=05xxxxxxxx"
[ -e "$APP/.env" ] && die "المنصة مثبتة مسبقًا في $APP. للتحديث استخدم scripts/forge-update.sh"
command -v node >/dev/null && command -v pm2 >/dev/null || die "Node.js أو PM2 غير موجود"
ss -ltn | grep -q ":$PORT " && die "المنفذ $PORT مستخدم. شغّل السكربت مع PORT=رقم_آخر"

rnd() { node -e "process.stdout.write(require('crypto').randomBytes($1).toString('base64url'))"; }

say "1/5 قاعدة البيانات"
# صلاحيات forge على MySQL مأخوذة من ملف الموقع الرئيسي دون طباعتها
ROOT_USER=$(grep -E '^DB_USERNAME=' "$MAIN_ENV" | cut -d= -f2- | tr -d '"'"'")
ROOT_PASS=$(grep -E '^DB_PASSWORD=' "$MAIN_ENV" | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
DB_PASS=$(rnd 24)
MYSQL_PWD="$ROOT_PASS" mysql -u "$ROOT_USER" -h 127.0.0.1 <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
ALTER USER '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
echo "✓ قاعدة $DB_NAME جاهزة"

say "2/5 الكود"
git clone --depth 1 -b "$BRANCH" "$REPO" "$APP"
mkdir -p "$STORAGE" && chmod 700 "$STORAGE"

ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(rnd 12)}"
umask 077
cat > "$APP/.env" <<ENV
PORT=$PORT
HOSTNAME=127.0.0.1
DATABASE_URL="mysql://$DB_USER:$DB_PASS@127.0.0.1:3306/$DB_NAME"
UPLOAD_DIR="$STORAGE"
SESSION_SECRET="$(rnd 48)"
ADMIN_PHONE="$ADMIN_PHONE"
ADMIN_PASSWORD="$ADMIN_PASSWORD"
ADMIN_NAME="إدارة ازدان"
SEED_DEMO="${SEED_DEMO:-0}"
NEXT_TELEMETRY_DISABLED=1
ENV
umask 022

say "3/5 المكتبات والبناء (عدة دقائق)"
cd "$APP"
npm ci --no-audit --no-fund
npm run fonts || echo "⚠ تعذر تنزيل خطوط الهوية؛ ستُستخدم خطوط بديلة. يمكن إعادة المحاولة لاحقًا: npm run fonts"
npx prisma generate
npx tsx scripts/db-setup.ts
npx next build

say "4/5 التشغيل"
pm2 start npm --name azdan-brokers --cwd "$APP" -- start -- -p "$PORT" -H 127.0.0.1
pm2 save
# إعادة التشغيل تلقائيًا بعد إقلاع الخادم (بدون sudo)
( crontab -l 2>/dev/null | grep -v 'pm2 resurrect' ; echo "@reboot $(command -v pm2) resurrect >/dev/null 2>&1" ) | crontab -

say "5/5 فحص"
sleep 5
code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/login" || true)
[ "$code" = "200" ] && echo "✓ المنصة تعمل على 127.0.0.1:$PORT" || { pm2 logs azdan-brokers --lines 30 --nostream; die "المنصة لم تستجب (HTTP $code)"; }

cat <<DONE

════════════════════════════════════════
 ✓ تم التثبيت
 دخول المدير:  الجوال  $ADMIN_PHONE
               كلمة المرور  $ADMIN_PASSWORD
 احفظ كلمة المرور الآن؛ لن تظهر مرة أخرى.
════════════════════════════════════════
DONE
