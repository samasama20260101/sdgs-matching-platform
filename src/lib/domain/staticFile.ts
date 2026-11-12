// 静的ファイル(public/ の画像・アイコン・マニフェストなど)かどうかを拡張子で決める。
// 「.」を含むかどうかで決めると、指標の番号(4.3.1)が入る画面や API まで静的ファイル扱いになり、
// 言語の振り分け・メンテナンス中の振り分け・Staging の入口のパスワードを通らなくなる(#123)。
// src/proxy.ts の config.matcher も同じ一覧で除外している。拡張子を足すときは両方を直す
// (Next.js は matcher を静的に読むので文字列のまま書く。ずれは scripts/tests/staticFile.test.ts が落とす)。
export const STATIC_FILE_EXTENSIONS = [
  'ico', 'png', 'svg', 'webmanifest',
  'jpg', 'jpeg', 'gif', 'webp', 'avif',
  'txt', 'xml', 'js', 'css', 'map',
  'woff', 'woff2', 'ttf', 'otf',
] as const

const STATIC_FILE_PATTERN = new RegExp(`\\.(?:${STATIC_FILE_EXTENSIONS.join('|')})$`, 'i')

export function isStaticFilePath(pathname: string): boolean {
  return STATIC_FILE_PATTERN.test(pathname)
}
