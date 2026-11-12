// src/proxy.ts (Next.js 16: middleware.ts -> proxy.ts)
import createIntlMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { routing, stripLocalePrefix } from './i18n/routing'
import { isStaticFilePath } from './lib/domain/staticFile'

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
        || isStaticFilePath(pathname)
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

// 静的ファイルは拡張子で除外する(一覧は src/lib/domain/staticFile.ts と同じ)。
// 「.」を含むパスをまとめて除外すると、指標の番号が入る /support/contributions/4.3.1 が 404 になる(#123)。
export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|svg|webmanifest|jpg|jpeg|gif|webp|avif|txt|xml|js|css|map|woff|woff2|ttf|otf)$).*)',
    ],
}
