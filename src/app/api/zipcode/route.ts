// src/app/api/zipcode/route.ts
// 郵便番号検索APIプロキシ（CORSバイパス用）
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const zipcode = searchParams.get('zipcode')?.replace(/[^0-9]/g, '')

    if (!zipcode || zipcode.length !== 7) {
        return NextResponse.json({ error: '郵便番号は7桁で入力してください' }, { status: 400 })
    }

    try {
        const res = await fetch(
            `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zipcode}`,
            { next: { revalidate: 3600 } } // 1時間キャッシュ
        )
        if (!res.ok) throw new Error(`zipcloud API error: ${res.status}`)
        const data = await res.json()

        if (data.status !== 200 || !data.results?.length) {
            return NextResponse.json({ error: '住所が見つかりませんでした' }, { status: 404 })
        }

        const r = data.results[0]
        return NextResponse.json({
            prefecture: r.address1,
            city: r.address2,
            town: r.address3,
            fullAddress: `${r.address1}${r.address2}${r.address3}`,
        })
    } catch (err) {
        console.error('zipcode API error:', err)
        return NextResponse.json({ error: '住所検索に失敗しました' }, { status: 500 })
    }
}
