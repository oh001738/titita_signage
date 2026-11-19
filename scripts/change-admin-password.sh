#!/bin/sh
# Run with: sh scripts/change-admin-password.sh
# Uses local Node.js, or Node.js in the running signage Docker container.
set -eu
umask 077

PROJECT_DIR=$(CDPATH= cd -P "$(dirname "$0")/.." && pwd)
ENV_FILE="$PROJECT_DIR/.env.local"
CONTAINER=${SIGNAGE_CONTAINER:-titita-signage}
TEMP_FILE=
BACKUP_FILE=
TTY_STATE=

cleanup() {
  if [ -n "$TTY_STATE" ]; then
    stty "$TTY_STATE" <&3 || :
  fi
  if [ -n "$TEMP_FILE" ]; then
    rm -f "$TEMP_FILE"
  fi
  unset PASSWORD CONFIRM CREDENTIALS
}
trap cleanup 0
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

if [ ! -f "$ENV_FILE" ] || [ -L "$ENV_FILE" ]; then
  printf '%s\n' '找不到一般檔案 .env.local；請在實際部署的專案執行，或先完成 setup。' >&2
  exit 1
fi

if command -v node >/dev/null 2>&1; then
  RUNTIME=node
elif command -v docker >/dev/null 2>&1 &&
  docker exec "$CONTAINER" node --version >/dev/null 2>&1; then
  RUNTIME=docker
else
  printf '%s\n' "需要本機 Node.js，或可執行 Docker 且容器 $CONTAINER 正在運行。" >&2
  printf '%s\n' '若 Docker 需要管理員權限，請使用 sudo sh scripts/change-admin-password.sh。' >&2
  exit 1
fi

# Read directly from the terminal; passwords never appear in command arguments.
if ! { exec 3<>/dev/tty; }; then
  printf '%s\n' '請從互動式終端機執行此腳本。' >&2
  exit 1
fi
TTY_STATE=$(stty -g <&3)
printf '%s\n' '修改管理員密碼；同時更新 session 金鑰，所有管理員需重新登入。' >&3
stty -echo <&3
printf '%s' '請輸入新密碼（8–256 字元）：' >&3
IFS= read -r PASSWORD <&3
printf '\n%s' '請再輸入一次：' >&3
IFS= read -r CONFIRM <&3
stty "$TTY_STATE" <&3
TTY_STATE=
printf '\n' >&3

if [ "$PASSWORD" != "$CONFIRM" ]; then
  printf '%s\n' '兩次密碼不同，設定未修改。' >&2
  exit 1
fi

HASH_SCRIPT='const fs = require("node:fs");
const crypto = require("node:crypto");
const password = fs.readFileSync(0, "utf8");
if (password.length < 8 || password.length > 256) {
  console.error("密碼長度需為 8–256 字元，設定未修改。");
  process.exit(1);
}
const salt = crypto.randomBytes(16).toString("hex");
console.log(salt + ":" + crypto.scryptSync(password, salt, 64).toString("hex"));
console.log(crypto.randomBytes(48).toString("hex"));'

if [ "$RUNTIME" = node ]; then
  CREDENTIALS=$(printf '%s' "$PASSWORD" | node -e "$HASH_SCRIPT")
else
  CREDENTIALS=$(printf '%s' "$PASSWORD" | docker exec -i "$CONTAINER" node -e "$HASH_SCRIPT")
fi
unset PASSWORD CONFIRM
PASSWORD_HASH=$(printf '%s\n' "$CREDENTIALS" | sed -n '1p')
SESSION_KEY=$(printf '%s\n' "$CREDENTIALS" | sed -n '2p')
unset CREDENTIALS

# Keep a private backup and replace the settings atomically in the same directory.
BACKUP_FILE=$(mktemp "$ENV_FILE.backup.XXXXXX")
cat "$ENV_FILE" > "$BACKUP_FILE"
TEMP_FILE=$(mktemp "$ENV_FILE.tmp.XXXXXX")
awk -v password_hash="$PASSWORD_HASH" -v session_key="$SESSION_KEY" '
  /^[[:space:]]*(export[[:space:]]+)?ADMIN_PASSWORD_HASH[[:space:]]*=/ {
    if (!password_written++) print "ADMIN_PASSWORD_HASH=" password_hash
    next
  }
  /^[[:space:]]*(export[[:space:]]+)?SESSION_SECRET[[:space:]]*=/ {
    if (!session_written++) print "SESSION_SECRET=" session_key
    next
  }
  /^# Initial login password;/ { next }
  { print }
  END {
    if (!password_written) print "ADMIN_PASSWORD_HASH=" password_hash
    if (!session_written) print "SESSION_SECRET=" session_key
  }
' "$ENV_FILE" > "$TEMP_FILE"
mv -f "$TEMP_FILE" "$ENV_FILE"
TEMP_FILE=
unset PASSWORD_HASH SESSION_KEY

printf '%s\n' '管理員密碼設定已更新。'
printf '原設定備份：%s\n' "$BACKUP_FILE"
printf '%s\n' '請在專案目錄重建容器，讓新密碼生效：'
printf '%s\n' '  docker compose up -d --force-recreate signage'
printf '%s\n' '若使用本機 pnpm 啟動，請停止並重新啟動服務。'
