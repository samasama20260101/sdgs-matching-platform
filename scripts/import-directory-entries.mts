// つなぎ先の取り込み(v2.0 #72。元は directory-data の app-integration、2026-10-15 の案)。
// directory-data の out/export/directory_entries.jsonl を directory_entries に冪等に取り込む。
//
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     npx tsx scripts/import-directory-entries.mts <path/to/directory_entries.jsonl> [--apply]
//
// - 既定はドライラン (件数と差分を出すだけ)。--apply で書き込む
// - entry_key で upsert する。掲載停止 (visibility = HIDDEN) や claim の状態は取り込みで上書きしない
// - 支援団体と結んだ行 (claim_status = CLAIMED、#140) は、承認のときに登録の内容に合わせた列
//   (名前・法人番号・活動地域。src/lib/domain/directoryClaim.ts の CLAIM_PRESERVED_COLUMNS) を出典の値で戻さない
// - 公開できない行 (publishable = false: 出典で確認できなかった行) は取り込まない
// - 今回の取り込みに無い既存行は消さずに件数だけ報告する (削除は人が判断する)
// - Staging で確認してから、本番は明示の OK を得て実行する (AGENTS.md の DB 変更ルール)
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
// src の .ts は .mts から静的に名前で import できない (tsx が CommonJS として読むため) ので、動的に読む
const {CLAIM_PRESERVED_COLUMNS} = await import('../src/lib/domain/directoryClaim');

type ImportRow = Record<string, unknown> & {entry_key: string; publishable: boolean};

const [path, ...flags] = process.argv.slice(2);
if (!path) throw new Error('usage: import-directory-entries.ts <directory_entries.jsonl> [--apply]');
const apply = flags.includes('--apply');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要');

const rows = readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as ImportRow);
const publishable = rows.filter((r) => r.publishable);
const supabase = createClient(url, key, {auth: {persistSession: false}});

type ExistingRow = {entry_key: string; visibility: string; claim_status: string} & Record<(typeof CLAIM_PRESERVED_COLUMNS)[number], unknown>;
const existing = new Map<string, ExistingRow>();
for (let from = 0; ; from += 1000) {
    const {data, error} = await supabase.from('directory_entries').select(['entry_key', 'visibility', 'claim_status', ...CLAIM_PRESERVED_COLUMNS].join(', ')).order('entry_key').range(from, from + 999);
    if (error) throw error;
    const page = data as unknown as ExistingRow[];
    for (const r of page) existing.set(r.entry_key, r);
    if (page.length < 1000) break;
}

// 人が決めた状態 (掲載停止・claim) と、支援団体と結んだ行の登録の内容は、取り込みで戻さない
let keptClaimed = 0;
const payload = publishable.map(({publishable: _p, ...r}) => {
    const current = existing.get(r.entry_key);
    if (!current) return {...r, imported_at: new Date().toISOString()};
    const claimed = current.claim_status === 'CLAIMED' ? Object.fromEntries(CLAIM_PRESERVED_COLUMNS.map((c) => [c, current[c]])) : {};
    if (current.claim_status === 'CLAIMED') keptClaimed += 1;
    return {...r, ...claimed, claim_status: current.claim_status, imported_at: new Date().toISOString()};
});
const incoming = new Set(payload.map((r) => r.entry_key));
const added = payload.filter((r) => !existing.has(r.entry_key)).length;
const missing = [...existing.keys()].filter((k) => !incoming.has(k)).length;
console.log(`入力 ${rows.length} 行 / 公開可 ${publishable.length} / 新規 ${added} / 更新 ${publishable.length - added} (うち支援団体と結んだ行 ${keptClaimed} は名前・活動地域を残す) / 今回に無い既存行 ${missing} (削除しない)`);

if (!apply) {
    console.log('ドライラン。書き込むには --apply を付ける');
    process.exit(0);
}
for (let i = 0; i < payload.length; i += 500) {
    const {error} = await supabase.from('directory_entries').upsert(payload.slice(i, i + 500), {onConflict: 'entry_key'});
    if (error) throw error;
    console.log(`  ${Math.min(i + 500, payload.length)} / ${payload.length}`);
}
console.log('完了');
