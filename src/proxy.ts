// src/proxy.ts (Next.js 16: middleware.ts -> proxy.ts)
import createIntlMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { routing, stripLocalePrefix } from './i18n/routing'

const PUBLIC_FILE_PATTERN = /\.(.*)$/
const handleI18nRouting = createIntlMiddleware(routing)

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
    const logicalPathname = stripLocalePrefix(pathname)

    if (isMaintenanceEnabled() && !hasMaintenanceBypass(request) && !isMaintenanceAllowedPath(logicalPathname)) {
        if (logicalPathname.startsWith('/api/')) {
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
                logicalPathname !== '/dev-login'
                && !logicalPathname.startsWith('/api/dev-auth')
                && !logicalPathname.startsWith('/api/cron/')
                && !isMaintenanceAllowedPath(logicalPathname)
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

    if (logicalPathname.startsWith('/api/')) {
        return NextResponse.next()
    }

    return handleI18nRouting(request)
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
    ],
}
