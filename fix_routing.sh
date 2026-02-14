#!/bin/bash

# SDGsマッチングプラットフォーム ルーティングパス修正
# /dashboard/sos → /sos/dashboard
# /dashboard/supporter → /supporter/dashboard

set -e

APP_DIR="$HOME/sdgs_projects/sdgs-matching-platform/src/app"
cd "$APP_DIR"

echo "=== ルーティングパス修正開始 ==="
echo ""

# 修正対象ファイルのリスト
FILES=(
  "sos/dashboard/page.tsx"
  "sos/cases/page.tsx"
  "sos/hearing/page.tsx"
  "sos/result/[id]/page.tsx"
  "supporter/dashboard/page.tsx"
  "supporter/case/[id]/page.tsx"
  "page.tsx"
)

# Headerコンポーネントも修正対象に追加（存在する場合）
if [ -f "../components/layout/Header.tsx" ]; then
  FILES+=("../components/layout/Header.tsx")
fi

echo "修正対象ファイル:"
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  - $file"
  fi
done
echo ""

# 各ファイルを修正
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "修正中: $file"
    
    # /dashboard/sos → /sos/dashboard
    sed -i.bak "s|'/dashboard/sos'|'/sos/dashboard'|g" "$file"
    sed -i.bak "s|\"/dashboard/sos\"|\"/sos/dashboard\"|g" "$file"
    sed -i.bak 's|`/dashboard/sos`|`/sos/dashboard`|g' "$file"
    
    # /dashboard/supporter → /supporter/dashboard
    sed -i.bak "s|'/dashboard/supporter'|'/supporter/dashboard'|g" "$file"
    sed -i.bak "s|\"/dashboard/supporter\"|\"/supporter/dashboard\"|g" "$file"
    sed -i.bak 's|`/dashboard/supporter`|`/supporter/dashboard`|g' "$file"
    
    # バックアップファイル削除
    rm -f "${file}.bak"
    
    echo "  ✅ 完了"
  else
    echo "  ⚠️  ファイルが見つかりません: $file"
  fi
done

echo ""
echo "=== ルーティングパス修正完了 ==="
echo ""
echo "修正内容の確認:"
echo "----------------"

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo ""
    echo "📄 $file:"
    grep -n "sos/dashboard\|supporter/dashboard" "$file" | head -5 || echo "  (該当なし)"
  fi
done

echo ""
echo "=========================================="
echo "✅ リファクタリング完了！"
echo ""
echo "確認事項:"
echo "1. 開発サーバーを再起動してください:"
echo "   cd ~/sdgs_projects/sdgs-matching-platform"
echo "   npm run dev"
echo ""
echo "2. 以下のURLで動作確認:"
echo "   - /sos/dashboard (SOSユーザー)"
echo "   - /supporter/dashboard (サポーター)"
echo "   - /login (ログイン)"
echo "=========================================="