import Link from "next/link";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--cream)]/92 backdrop-blur-xl">
      <div className="container flex items-center justify-between gap-3 py-3 sm:py-3.5">

        <Link
          href="/"
          className="site-logo-link"
          aria-label="ListoRD — Inicio"
        >
          {/* Logo mark — heart with double checkmark (matches brand logo) */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true" className="shrink-0">
            <defs>
              <linearGradient id="logo-grad" x1="3" y1="4" x2="22" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#45A85A" />
                <stop offset="100%" stopColor="#1A3D2B" />
              </linearGradient>
            </defs>
            {/* Outer heart */}
            <path
              d="M14 23.5C14 23.5 4.5 17.2 4.5 10.8A5.5 5.5 0 0 1 14 7.2a5.5 5.5 0 0 1 9.5 3.6c0 6.4-9.5 12.7-9.5 12.7Z"
              fill="url(#logo-grad)"
            />
            {/* Inner double-V checkmark */}
            <path
              d="M9.5 13l2 2 4-4"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M11 14.5l2 2 4-4"
              stroke="white"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <span className="site-logo-text">ListoRD</span>
        </Link>

        <nav className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/trabajadores/registro"
            className="tap-target btn-ghost text-xs sm:text-sm px-3 py-2 sm:px-4"
          >
            Busco trabajo
          </Link>
          <Link
            href="/empleadores"
            className="tap-target btn-primary text-xs sm:text-sm px-3 py-2 sm:px-4 text-white"
          >
            Necesito gente
          </Link>
        </nav>

      </div>
    </header>
  );
}
