import Link from "next/link";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--cream)]/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-wrap items-center justify-center gap-3 px-3 py-3 sm:flex-nowrap sm:justify-between sm:px-6 sm:py-3.5">
        <Link
          href="/"
          className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-pure)] px-3 py-2 shadow-[var(--shadow-xs)] hover:border-[rgba(26,61,43,0.15)] hover:shadow-[var(--shadow-sm)] transition-shadow"
          aria-label="ListoRD — Inicio"
        >
          {/* ListoRD logo — heart+checkmark gradient + wordmark */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true" className="shrink-0">
            <defs>
              <linearGradient id="hdr-g" x1="4" y1="4" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#45A85A" />
                <stop offset="100%" stopColor="#1A3D2B" />
              </linearGradient>
            </defs>
            {/* Heart shape */}
            <path
              d="M14 24s-9-5.5-9-12A5 5 0 0 1 14 7.6 5 5 0 0 1 23 12c0 6.5-9 12-9 12Z"
              fill="url(#hdr-g)"
            />
            {/* Checkmark */}
            <path
              d="M10 13.5l2.5 2.5 5-5"
              stroke="white"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <span
            className="text-[1.05rem] font-black tracking-[-0.03em] text-[#1A3D2B] leading-none"
            style={{ fontFamily: "var(--font-display, Georgia), serif" }}
          >
            ListoRD
          </span>
        </Link>

        <nav className="flex w-full min-w-0 items-center justify-between gap-1.5 text-xs font-black sm:w-auto sm:justify-end sm:gap-2 sm:text-sm">
          <Link
            href="/trabajadores/registro"
            className="tap-target inline-flex min-w-0 flex-1 items-center justify-center rounded-xl px-2 py-2 text-center leading-tight text-[var(--ink)]/70 hover:bg-[var(--surface)] hover:text-[var(--ink)] transition-colors sm:flex-none sm:px-3"
          >
            Busco trabajo
          </Link>
          <Link
            href="/empleadores"
            className="btn-primary tap-target inline-flex min-w-0 flex-1 items-center justify-center px-2 py-2 text-center leading-tight text-white sm:flex-none sm:px-3"
          >
            Necesito gente
          </Link>
        </nav>
      </div>
    </header>
  );
}
