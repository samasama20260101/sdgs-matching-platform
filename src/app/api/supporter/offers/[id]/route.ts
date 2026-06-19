// src/app/api/supporter/offers/[id]/route.ts
// サポーター用：自分のオファー操作（RLSバイパス）
// [id] = offer id
import { NextResponse } from 'next/server'

// 更新は案件単位APIで状態遷移を検証して行う。
export async function PATCH() {
    return NextResponse.json({ error: 'Use the case offer endpoint' }, { status: 405 })
}
