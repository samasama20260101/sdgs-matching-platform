// src/proxy.ts (Next.js 16: middleware.ts → proxy.ts)
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_FILE_PATTERN = /\.(.*)$/

function isMaintenanceEnabled() {
    return process.env.MAINTENANCE_MODE === 'true'
}

function hasMaintenanceBypass(request: NextRequest) {
    const bypassToken = process.env.MAINTENANCE_BYPASS_TOKEN
    if (!bypassToken) return false
    return request.cookies.get('maintenance-bypass')?.value === bypassToken
        || request.headers.get('x-maintenance-bypass') === bypassToken
}

function isMaintenanceAllowedPath(pathname: string) {
    return pathname === '/maintenance'
        || pathname.startsWith('/api/maintenance-bypass')
        || pathname.startsWith('/api/health')
        || pathname.startsWith('/_next/')
        || pathname === '/favicon.ico'
        || PUBLIC_FILE_PATTERN.test(pathname)
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl

    if (isMaintenanceEnabled() && !hasMaintenanceBypass(request) && !isMaintenanceAllowedPath(pathname)) {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json(
                { error: 'Service is under maintenance', code: 'MAINTENANCE_MODE' },
                { status: 503, headers: { 'Retry-After': '600' } }
            )
        }

        const url = request.nextUrl.clone()
        url.pathname = '/maintenance'
        url.searchParams.delete('maintenance_bypass')
        return NextResponse.redirect(url)
    }

    // 本番パスワード保護
    if (process.env.NODE_ENV === 'production') {
        const devPassword = process.env.DEV_PASSWORD
        if (devPassword) {
            if (
                pathname !== '/dev-login'
                && !pathname.startsWith('/api/dev-auth')
                && !pathname.startsWith('/api/cron/')
                && !isMaintenanceAllowedPath(pathname)
            ) {
                const authCookie = request.cookies.get('dev-auth')
                if (authCookie?.value !== devPassword) {
                    const url = request.nextUrl.clone()
                    url.pathname = '/dev-login'
                    return NextResponse.redirect(url)
                }
            }
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
}
