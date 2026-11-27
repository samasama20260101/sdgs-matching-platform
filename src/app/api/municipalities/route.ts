// 都道府県の市区町村の一覧(認証不要・公開。#173)。わたしとはじめの質問で、市区町村を選ぶのに使う。
// 政令市は市と区の両方を並べる(区が分からない人は市を選べる)。団体コードの順 = 市のすぐ後ろにその区
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const prefecture = new URL(request.url).searchParams.get('prefecture') ?? ''
  if (!/^JP-\d{2}$/.test(prefecture)) return NextResponse.json({ municipalities: [] })
  const { data, error } = await supabaseAdmin
    .from('municipalities')
    .select('code, name, kind')
    .eq('prefecture_code', prefecture)
    .order('code', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ municipalities: data ?? [] }, { headers: { 'Cache-Control': 'public, max-age=86400' } })
}
