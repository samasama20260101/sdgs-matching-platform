import { NextResponse } from 'next/server'

export async function GET() {
    return NextResponse.json({
        ok: true,
        maintenance: process.env.MAINTENANCE_MODE === 'true',
        timestamp: new Date().toISOString(),
    })
}
