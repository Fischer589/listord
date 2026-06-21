import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const COOKIE_NAME = 'admin_session'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow the login page through
  if (pathname === '/admin/login') {
    return NextResponse.next()
  }

  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret) {
    console.warn('ADMIN_SESSION_SECRET not set — admin access blocked')
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  const sessionCookie = request.cookies.get(COOKIE_NAME)
  if (sessionCookie?.value !== secret) {
    const res = NextResponse.redirect(new URL('/admin/login', request.url))
    res.cookies.delete(COOKIE_NAME)
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*']
}
