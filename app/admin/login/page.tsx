import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin — ListoRD',
  robots: { index: false, follow: false }
}

const COOKIE_NAME = 'admin_session'
const SESSION_DAYS = 7

async function handleLogin(formData: FormData) {
  'use server'

  const username = ((formData.get('username') as string | null) ?? '').trim()
  const password = (formData.get('password') as string | null) ?? ''

  const expectedUsername = process.env.ADMIN_USERNAME ?? ''
  const expectedPassword = process.env.ADMIN_PASSWORD ?? ''
  const secret = process.env.ADMIN_SESSION_SECRET ?? ''

  const isValid =
    Boolean(expectedUsername) &&
    Boolean(expectedPassword) &&
    Boolean(secret) &&
    username === expectedUsername &&
    password === expectedPassword

  if (!isValid) {
    redirect('/admin/login?error=1')
  }

  const cookieStore = cookies()
  cookieStore.set(COOKIE_NAME, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: '/'
  })

  redirect('/admin/workers')
}

export default function AdminLoginPage({
  searchParams
}: {
  searchParams: { error?: string }
}) {
  const hasError = Boolean(searchParams?.error)

  return (
    <div className="flex min-h-screen items-center justify-center bg-crema p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <a
            href="/"
            className="inline-block text-sm font-bold text-black/40 hover:text-black/60"
          >
            ← Volver al inicio
          </a>
          <div className="mt-4">
            <p className="font-display text-2xl tracking-tight text-ink">ListoRD</p>
            <p className="mt-1 text-sm font-bold text-black/45">Panel de administración</p>
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white p-8 shadow-lift">
          {hasError && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              Credenciales incorrectas. Intenta de nuevo.
            </div>
          )}

          <form action={handleLogin} className="space-y-5">
            <div>
              <label
                htmlFor="username"
                className="mb-1.5 block text-xs font-black uppercase tracking-widest text-ink"
              >
                Usuario
              </label>
              <input
                id="username"
                type="text"
                name="username"
                autoComplete="username"
                required
                className="w-full rounded-lg border border-black/15 bg-card px-4 py-3 text-base text-ink outline-none focus:border-hoja focus:ring-2 focus:ring-hoja/20"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-black uppercase tracking-widest text-ink"
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                name="password"
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-black/15 bg-card px-4 py-3 text-base text-ink outline-none focus:border-hoja focus:ring-2 focus:ring-hoja/20"
              />
            </div>

            <button
              type="submit"
              className="tap-target w-full rounded-lg bg-hoja py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-green-dark"
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
