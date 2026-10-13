import { type NextRequest, NextResponse } from 'next/server'

export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}

export function POST(request: NextRequest) {
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
  const response = NextResponse.redirect(new URL('/admin/login', submittedOrigin.origin), 303)
  response.cookies.delete('admin_session')
  response.headers.set('Cache-Control', 'no-store')
  return response
}
