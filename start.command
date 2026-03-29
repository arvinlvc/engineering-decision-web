#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

ENV_FILE="$SCRIPT_DIR/.env.local"
EXAMPLE_ENV_FILE="$SCRIPT_DIR/.env.example"
PORT_VALUE="${PORT:-3000}"
USE_MOCK_FALLBACK="0"

if [ ! -f "$ENV_FILE" ] && [ -f "$EXAMPLE_ENV_FILE" ]; then
  cp "$EXAMPLE_ENV_FILE" "$ENV_FILE"
  echo "已创建 .env.local（来自 .env.example）"
fi

if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<'EOF'
BIGMODEL_API_KEY=
BIGMODEL_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4
BIGMODEL_MODEL=GLM-4.7
PORT=3000
BIGMODEL_USE_MOCK=1
EOF
  echo "已创建默认 .env.local"
fi

API_KEY_VALUE="$(grep '^BIGMODEL_API_KEY=' "$ENV_FILE" 2>/dev/null | head -n 1 | cut -d'=' -f2- | tr -d '[:space:]')"

if [ -z "$API_KEY_VALUE" ] || [ "$API_KEY_VALUE" = "your_api_key_here" ]; then
  USE_MOCK_FALLBACK="1"
fi

if [ "$USE_MOCK_FALLBACK" = "1" ]; then
  echo "未检测到有效 BIGMODEL_API_KEY，当前将使用 mock 模式启动。"
  export BIGMODEL_USE_MOCK=1
else
  echo "检测到模型配置，将连接 Coding Plan 默认模型。"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js，请先安装 Node.js 18+。"
  exit 1
fi

echo "启动 Engineering Decision Web..."
echo "访问地址：http://localhost:${PORT_VALUE}"

( sleep 1; open "http://localhost:${PORT_VALUE}" ) >/dev/null 2>&1 &

exec node server.js
