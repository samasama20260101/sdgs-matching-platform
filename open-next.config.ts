// OpenNext(Cloudflare Workers)の設定。
// このアプリは ISR やデータのキャッシュを使わないので、増分キャッシュ(R2)は置かない。
// fetch の `next.revalidate`(郵便番号・リンクの下見)はキャッシュされず、毎回取りに行く。
import { defineCloudflareConfig } from '@opennextjs/cloudflare'

export default defineCloudflareConfig({})
