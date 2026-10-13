import { timingSafeEqual } from 'node:crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_SECONDS, createAdminSession } from '@/lib/admin-session'
import { readBoundedText } from '@/lib/http-json'

export const runtime = 'nodejs'

const COOKIE_NAME = 'admin_session'

function matches(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
}

function redirectTo(origin: string, path: string) {
  const response = NextResponse.redirect(new URL(path, origin), 303)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export async function POST(request: NextRequest) {
  // Native form POSTs carry Origin. Reject cross-site and non-browser submissions.
  const origin = request.headers.get('origin')
  const host = request.headers.get('host') || new URL(request.url).host
  let submittedOrigin: URL
  try {
    submittedOrigin = new URL(origin || '')
  } catch {
    return new NextResponse(null, { status: 403 })
  }
  if (submittedOrigin.origin !== origin || submittedOrigin.host !== host || !['http:', 'https:'].includes(submittedOrigin.protocol)) {
    return new NextResponse(null, { status: 403 })
  }

  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) {
    return new NextResponse(null, { status: 415 })
  }
  const encoded = await readBoundedText(request, 4096).catch(() => null)
  if (encoded === null) return new NextResponse(null, { status: 413 })
  const form = new URLSearchParams(encoded)
  const username = form.get('username')
  const password = form.get('password')
  const expectedUsername = process.env.ADMIN_USERNAME
  const expectedPassword = process.env.ADMIN_PASSWORD
  const secret = process.env.ADMIN_SESSION_SECRET

  if (!expectedUsername || !expectedPassword || !secret) {
    console.error('Admin login configuration is incomplete')
    return redirectTo(submittedOrigin.origin, '/admin/login?error=unavailable')
  }

  if (username === null || password === null ||
      !matches(username.trim(), expectedUsername) || !matches(password, expectedPassword)) {
    return redirectTo(submittedOrigin.origin, '/admin/login?error=invalid')
  }

  const response = redirectTo(submittedOrigin.origin, '/admin/dashboard')
  response.cookies.set(COOKIE_NAME, await createAdminSession(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: ADMIN_SESSION_SECONDS,
    path: '/'
  })
  return response
}
