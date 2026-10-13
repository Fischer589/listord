import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isAdminSession } from './lib/admin-session'

const COOKIE_NAME = 'admin_session'

function loginRedirect(request: NextRequest) {
  const url = new URL('/admin/login', request.url)
  // Next can use its internal hostname here; the browser's Host keeps the redirect on-site.
  const host = request.headers.get('host')
  if (host) url.host = host
  return NextResponse.redirect(url)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow only the login page and its form submission through.
  if (pathname === '/admin/login' || (pathname === '/admin/session' && request.method === 'POST')) {
    return NextResponse.next()
  }

  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret) {
    console.warn('ADMIN_SESSION_SECRET not set — admin access blocked')
    return loginRedirect(request)
  }

  const sessionCookie = request.cookies.get(COOKIE_NAME)
  if (!await isAdminSession(sessionCookie?.value, secret)) {
    const res = loginRedirect(request)
    res.cookies.delete(COOKIE_NAME)
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*']
}
