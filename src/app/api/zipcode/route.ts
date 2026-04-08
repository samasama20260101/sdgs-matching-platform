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
        // API 1: zipcloud（一般的な郵便番号）
        const res = await fetch(
            `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zipcode}`,
            { next: { revalidate: 3600 } }
        )

        if (res.ok) {
            const data = await res.json()
            if (data.status === 200 && data.results?.length) {
                const r = data.results[0]
                return NextResponse.json({
                    prefecture: r.address1,
                    city: r.address2,
                    town: r.address3,
                    fullAddress: `${r.address1}${r.address2}${r.address3}`,
                })
            }
        }

        // API 2: HeartRails Geo API（大口事業所・官公庁等も対応）
        const res2 = await fetch(
            `https://geoapi.heartrails.com/api/json?method=searchByPostal&postal=${zipcode}`,
            { next: { revalidate: 3600 } }
        )

        if (res2.ok) {
            const data2 = await res2.json()
            if (data2.response?.location?.length) {
                const loc = data2.response.location[0]
                return NextResponse.json({
                    prefecture: loc.prefecture,
                    city: loc.city + (loc.town || ''),
                    town: loc.town || '',
                    fullAddress: `${loc.prefecture}${loc.city}${loc.town || ''}`,
                })
            }
        }

        // どちらも見つからない場合
        return NextResponse.json({
            error: 'この郵便番号は自動入力に対応していません。手動で住所を入力してください。'
        }, { status: 404 })

    } catch (err) {
        console.error('zipcode API error:', err)
        return NextResponse.json({ error: '住所検索に失敗しました' }, { status: 500 })
    }
}
