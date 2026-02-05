// scripts/list-models.js
// 利用可能なGeminiモデルをリスト表示
// 実行方法: node scripts/list-models.js

require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ エラー: GOOGLE_GEMINI_API_KEY が設定されていません');
  process.exit(1);
}

async function listModels() {
  try {
    console.log('🔄 利用可能なモデルを取得中...\n');
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    
    if (data.models) {
      console.log('✅ 利用可能なモデル一覧:\n');
      data.models.forEach(m => {
        const modelName = m.name.replace('models/', '');
        console.log(`  📌 ${modelName}`);
        if (m.supportedGenerationMethods) {
          console.log(`     サポート: ${m.supportedGenerationMethods.join(', ')}`);
        }
      });
      
      console.log('\n💡 推奨モデル:');
      console.log('  - gemini-1.5-flash-latest (最新の高速モデル)');
      console.log('  - gemini-1.5-pro-latest (最新の高性能モデル)');
    } else {
      console.error('❌ モデルリストを取得できませんでした');
      console.log('レスポンス:', data);
    }
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    console.log('\nAPIキーが正しいか確認してください');
  }
}

listModels();