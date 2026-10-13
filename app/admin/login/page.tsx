import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin — ListoRD',
  robots: { index: false, follow: false }
}

export default async function AdminLoginPage({
  searchParams: searchParamsPromise
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const searchParams = await searchParamsPromise;
  const hasError = searchParams?.error === 'invalid'
  const isUnavailable = searchParams?.error === 'unavailable'

  return (
    <div className="flex min-h-screen items-center justify-center bg-crema p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="inline-block text-sm font-bold text-black/40 hover:text-black/60"
          >
            ← Volver al inicio
          </Link>
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
          {isUnavailable && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              El acceso de administración no está disponible. Intenta más tarde.
            </div>
          )}

          <form action="/admin/session" method="post" className="space-y-5">
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
