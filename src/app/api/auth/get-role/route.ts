// src/app/api/auth/get-role/route.ts
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { data: userData } = await supabaseAdmin
        .from('users')
        .select('id, role, real_name, display_name, email, phone, organization_name, supporter_type, postal_code, prefecture, city, address_structured, service_area_nationwide, service_areas, must_change_password, bio, social_links')
        .eq('auth_user_id', user.id)
        .single()

    return NextResponse.json({
        role: userData?.role ?? null,
        user: userData ?? null,
    })
}