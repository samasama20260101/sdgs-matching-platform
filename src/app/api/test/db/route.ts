import { supabase } from '@/lib/supabase/client'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // テーブルの存在確認
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1)

    if (error) {
      return NextResponse.json({
        success: false,
        message: 'Database connection failed',
        error: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Database connected successfully!',
      tables: ['users', 'cases', 'offers', 'contact_disclosures', 'ratings'],
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 })
  }
}