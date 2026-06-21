import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export function GET(request: NextRequest) {
  cookies().delete('admin_session')
  return NextResponse.redirect(new URL('/admin/login', request.url))
}
