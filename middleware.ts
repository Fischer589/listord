import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const COOKIE_NAME = 'admin_session'

async function verifySessionToken(token: string, secret: string): Promise<boolean> {
  try {
    const dotIndex = token.lastIndexOf('.')
    if (dotIndex < 1) return false

    const payloadB64 = token.slice(0, dotIndex)
    const sigHex = token.slice(dotIndex + 1)

    if (!payloadB64 || sigHex.length < 64) return false

    const encoder = new TextEncoder()

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const sigBytes = new Uint8Array(
      (sigHex.match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16))
    )

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      encoder.encode(payloadB64)
    )

    if (!isValid) return false

    const payload = JSON.parse(atob(payloadB64)) as { expires?: unknown }
    return typeof payload.expires === 'number' && payload.expires > Date.now()
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === '/admin/login') {
    return NextResponse.next()
  }

  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret) {
    console.warn('ADMIN_SESSION_SECRET not set — admin access blocked')
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  const sessionCookie = request.cookies.get(COOKIE_NAME)
  if (!sessionCookie?.value) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  const valid = await verifySessionToken(sessionCookie.value, secret)
  if (!valid) {
    const res = NextResponse.redirect(new URL('/admin/login', request.url))
    res.cookies.delete(COOKIE_NAME)
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*']
}
