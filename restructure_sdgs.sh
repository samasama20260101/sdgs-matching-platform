#!/bin/bash

# SDGsマッチングプラットフォーム ディレクトリ構造リファクタリング
# 目的: メンテナンス性・拡張性・認識性の向上

set -e

APP_DIR="$HOME/sdgs_projects/sdgs-matching-platform/src/app"
cd "$APP_DIR"

echo "=== ディレクトリ構造リファクタリング開始 ==="
echo ""
echo "現在のディレクトリ: $(pwd)"
echo ""

# バックアップ作成
BACKUP_DIR="$HOME/sdgs_projects/backup_$(date +%Y%m%d_%H%M%S)"
echo "0. バックアップを作成中: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
cp -r "$APP_DIR" "$BACKUP_DIR/"
echo "   ✅ バックアップ完了: $BACKUP_DIR/app"
echo ""

# 1. (auth) グループの作成と移動
echo "1. 認証系ファイルを (auth)/ グループに移動..."
mkdir -p "(auth)/login" "(auth)/signup" "(auth)/dev-login"

if [ -f "login/page.tsx" ]; then
  mv login/page.tsx "(auth)/login/"
  rmdir login 2>/dev/null || true
  echo "   ✅ login/page.tsx → (auth)/login/page.tsx"
fi

if [ -f "signup/page.tsx" ]; then
  mv signup/page.tsx "(auth)/signup/"
  rmdir signup 2>/dev/null || true
  echo "   ✅ signup/page.tsx → (auth)/signup/page.tsx"
fi

if [ -f "dev-login/page.tsx" ]; then
  mv dev-login/page.tsx "(auth)/dev-login/"
  rmdir dev-login 2>/dev/null || true
  echo "   ✅ dev-login/page.tsx → (auth)/dev-login/page.tsx"
fi

# 2. (dev) グループの作成と移動
echo ""
echo "2. 開発・テスト用ファイルを (dev)/ グループに移動..."
mkdir -p "(dev)"

if [ -d "test-ai" ]; then
  mv test-ai "(dev)/"
  echo "   ✅ test-ai/ → (dev)/test-ai/"
fi

# 3. SOS ダッシュボードの移動
echo ""
echo "3. SOS ダッシュボードを sos/dashboard/ に移動..."
mkdir -p "sos/dashboard"

if [ -f "dashboard/sos/page.tsx" ]; then
  mv dashboard/sos/page.tsx sos/dashboard/
  rmdir dashboard/sos 2>/dev/null || true
  echo "   ✅ dashboard/sos/page.tsx → sos/dashboard/page.tsx"
fi

# 4. Supporter ダッシュボードの移動
echo ""
echo "4. Supporter ダッシュボードを supporter/dashboard/ に移動..."
mkdir -p "supporter/dashboard"

if [ -f "dashboard/supporter/page.tsx" ]; then
  mv dashboard/supporter/page.tsx supporter/dashboard/
  rmdir dashboard/supporter 2>/dev/null || true
  echo "   ✅ dashboard/supporter/page.tsx → supporter/dashboard/page.tsx"
fi

# 5. 空の dashboard ディレクトリを削除
echo ""
if [ -d "dashboard" ]; then
  if rmdir dashboard 2>/dev/null; then
    echo "5. 空の dashboard/ ディレクトリを削除"
    echo "   ✅ dashboard/ 削除完了"
  else
    echo "5. dashboard/ に他のファイルが残っています（削除スキップ）"
  fi
fi

echo ""
echo "=== ファイル移動完了 ==="
echo ""
echo "新しいディレクトリ構造:"
echo ""
tree -L 2 -I 'node_modules' "$APP_DIR" || ls -la "$APP_DIR"

echo ""
echo "=========================================="
echo "次のステップ:"
echo "1. ルーティングパスの修正が必要です"
echo "2. 以下のコマンドで修正スクリプトを実行してください:"
echo ""
echo "   bash ~/sdgs_projects/sdgs-matching-platform/fix_routing.sh"
echo "=========================================="