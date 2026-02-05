// scripts/test-gemini-connection.js
// Gemini API接続テストスクリプト
// 実行方法: node scripts/test-gemini-connection.js

const { GoogleGenerativeAI } = require('@google/generative-ai');

// 環境変数から読み込み
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ エラー: GOOGLE_GEMINI_API_KEY が設定されていません');
  console.log('📝 .env.local ファイルにAPIキーを設定してください');
  process.exit(1);
}

async function testGeminiConnection() {
  try {
    console.log('🔄 Gemini API接続テスト開始...\n');

    // GoogleGenerativeAI の初期化
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // モデルの取得（latest指定で最新版を使用）
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const testPrompt = 'こんにちは。簡単な自己紹介をしてください。';
    
    console.log('📤 送信プロンプト:', testPrompt);
    console.log('📝 使用モデル: gemini-2.5-flash');
    console.log('⏳ 応答待機中...\n');

    const result = await model.generateContent(testPrompt);
    const response = await result.response;
    const text = response.text();

    console.log('✅ 接続成功！');
    console.log('📥 応答内容:');
    console.log('─'.repeat(50));
    console.log(text);
    console.log('─'.repeat(50));
    console.log('\n✨ Gemini API統合が正常に動作しています！');
    
  } catch (error) {
    console.error('❌ 接続エラー:', error.message);
    console.log('\n🔍 トラブルシューティング:');
    console.log('1. APIキーが正しいか確認してください');
    console.log('2. Google AI Studioでクォータを確認してください');
    console.log('3. ネットワーク接続を確認してください');
    console.log('4. ライブラリを最新版に更新: npm install @google/generative-ai@latest');
    process.exit(1);
  }
}

// メイン実行
testGeminiConnection();