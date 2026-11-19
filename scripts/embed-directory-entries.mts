// 掲載台帳の団体の相談の受け方の要約を埋め込みにして持つ(#148)。取り込み(import-directory-entries.mts)のあとに流す。
//
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... OPENAI_API_KEY=... \
//     npx tsx scripts/embed-directory-entries.mts --env staging [--apply]
//
// - 対象は民間の団体で、公開中・相談を受けている(YES)・要約がある行
// - 元の文(名前と要約)とモデルの指紋(consult_embedding_hash)が変わった行だけ作り直す。モデルを上げたら全件が作り直しになる
// - モデルは wrangler.jsonc の --env の vars の AI_EMBEDDING_MODEL(アプリの検索と同じモデルにそろえるため。環境変数で上書きできる)
// - 既定はドライラン (件数だけ出す)。--apply で書き込む。Staging で確かめてから、本番は明示の OK を得て流す (AGENTS.md)
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const envName = args[args.indexOf('--env') + 1];
if (!args.includes('--env') || !envName) throw new Error('usage: embed-directory-entries.mts --env <staging|production> [--apply]');

// wrangler.jsonc のコメントを外して読む(文字列の中の // は残す)
function readWranglerVars(name: string): Record<string, string> {
    const text = readFileSync('wrangler.jsonc', 'utf8');
    const json = text.replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (_m, str: string | undefined) => str ?? '');
    const config = JSON.parse(json.replace(/,(\s*[}\]])/g, '$1')) as {env?: Record<string, {vars?: Record<string, string>}>};
    return config.env?.[name]?.vars ?? {};
}

const model = process.env.AI_EMBEDDING_MODEL || readWranglerVars(envName).AI_EMBEDDING_MODEL;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
if (!model) throw new Error(`wrangler.jsonc の env.${envName}.vars に AI_EMBEDDING_MODEL がない`);
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要');
if (apply && !openaiKey) throw new Error('OPENAI_API_KEY が必要');

type Row = {id: string; name: string; consult_summary: string; consult_embedding_hash: string | null};
const supabase = createClient(url, key, {auth: {persistSession: false}});

const rows: Row[] = [];
for (let from = 0; ; from += 1000) {
    const {data, error} = await supabase.from('directory_entries')
        .select('id, name, consult_summary, consult_embedding_hash')
        .eq('kind', 'ORGANIZATION').eq('visibility', 'PUBLIC').eq('accepts_consultation', 'YES').not('consult_summary', 'is', null)
        .order('id').range(from, from + 999);
    if (error) throw error;
    rows.push(...(data as Row[]));
    if (data.length < 1000) break;
}

// 埋め込む文: 名前と相談の受け方の要約
const textOf = (r: Row) => `${r.name}\n${r.consult_summary}`;
const hashOf = (r: Row) => createHash('sha256').update(`${model}\n${textOf(r)}`).digest('hex');
const todo = rows.filter((r) => r.consult_embedding_hash !== hashOf(r));
console.log(`モデル ${model} / 対象 ${rows.length} 行 / 作り直す ${todo.length} 行`);
if (!apply) {
    console.log('ドライラン。書き込むには --apply を付ける');
    process.exit(0);
}

const BATCH = 100;
for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {'content-type': 'application/json', authorization: `Bearer ${openaiKey}`},
        body: JSON.stringify({model, input: batch.map(textOf)}),
    });
    if (!response.ok) throw new Error(`embeddings HTTP ${response.status}`);
    const data = (await response.json()) as {data: {index: number; embedding: number[]}[]};
    const vectors = [...data.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
    if (vectors.length !== batch.length) throw new Error('埋め込みの数が合わない');
    for (const [j, r] of batch.entries()) {
        const {error} = await supabase.from('directory_entries')
            .update({consult_embedding: JSON.stringify(vectors[j]), consult_embedding_model: model, consult_embedding_hash: hashOf(r)})
            .eq('id', r.id);
        if (error) throw error;
    }
    console.log(`  ${Math.min(i + BATCH, todo.length)} / ${todo.length}`);
}
console.log('完了');
