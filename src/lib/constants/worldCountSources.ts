// 世界の数(n)に使う国連 SDG データベースの系列の対応表(手で確かめて決めたもの。11/12)。
// 値は scripts/fetch-world-counts.ts が国連 SDG API と世界銀行の API から取り、worldCounts.generated.ts に書き出す。
//
// 載せる決まり: 相談の文言(src/lib/constants/intakeIndicators.ts)と同じ困りごとを、世界全体(地域コード 1)で数えた系列だけ。
// 意味がずれる系列は載せない。2026-11-12 に候補から外したもの:
//   3.8.2 SH_OOP_XPD_EARNNET40  医療費の重い負担の割合(相談は「お金がなくて病院に行けない」で、受診をあきらめた人ではない)
//   10.7.3 SM_DTH_MIGR          移住の途中の死者・行方不明者(相談は監禁や脅迫で、死者の数ではない)
//   16.1.2 VC_DTH_TOTN          紛争による死者(相談は危険にさらされて避難できない人で、死者の数ではない)
// 載せていない指標の n は「まだ数えられていない」と画面に出す。足すときは、相談の文言と系列の説明を並べて確かめる。

import type { CountMethod } from '@/lib/domain/worldCount'

export type WorldCountSource = { series: string; method: CountMethod; note: string }

export const WORLD_COUNT_SOURCES: Record<string, WorldCountSource> = {
  '1.1.1': { series: 'SI_POV_DAY1', method: 'share', note: '国際貧困ラインを下回る暮らしの人の割合' },
  '2.1.1': { series: 'SN_ITK_DEFCN', method: 'count', note: '栄養不足の人の数' },
  '2.1.2': { series: 'AG_PRD_FIESMS', method: 'share', note: '中程度以上の食料不安にある人の割合' },
  '3.3.5': { series: 'SH_TRP_INTVN', method: 'count', note: '顧みられない熱帯病の治療などが必要な人の数' },
  '6.1.1': { series: 'SH_H2O_SAFE', method: 'lacking', note: '安全に管理された飲み水を使える人の割合(使えない人に読み替え)' },
  '6.2.1': { series: 'SH_SAN_SAFE', method: 'lacking', note: '安全に管理されたトイレを使える人の割合(使えない人に読み替え)' },
  '7.1.1': { series: 'EG_ACS_ELEC', method: 'lacking', note: '電気を使える人の割合(使えない人に読み替え)' },
  '7.1.2': { series: 'EG_EGY_CLEAN', method: 'lacking', note: 'きれいな燃料と調理の道具を主に使える人の割合(使えない人に読み替え)' },
  '9.c.1': { series: 'IT_MOB_2GNTWK', method: 'lacking', note: '少なくとも 2G の携帯の電波が届く人の割合(届かない人に読み替え)' },
}
