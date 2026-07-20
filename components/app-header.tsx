"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click / Escape / route change (link click)
  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--cream)]/92 backdrop-blur-xl relative">
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

        {/* ── Desktop nav (640px+) — unchanged ── */}
        <nav className="hidden items-center gap-1.5 sm:flex sm:gap-2">
          <Link
            href="/trabajadores/registro"
            className="tap-target btn-ghost text-xs sm:text-sm px-3 py-2 sm:px-4"
          >
            Busco trabajo
          </Link>
          <Link
            href="/soluciones-empresariales"
            className="tap-target btn-ghost text-xs sm:text-sm px-3 py-2 sm:px-4"
          >
            <span className="md:hidden">Empresas</span>
            <span className="hidden md:inline">Soluciones Empresariales</span>
          </Link>
          <Link
            href="/empleadores"
            className="tap-target btn-primary text-xs sm:text-sm px-3 py-2 sm:px-4 text-white"
          >
            Necesito gente
          </Link>
        </nav>

        {/* ── Mobile nav (< 640px) — primary CTA + hamburger ── */}
        <div className="flex items-center gap-2 sm:hidden" ref={menuRef}>
          <Link
            href="/empleadores"
            className="tap-target btn-primary text-xs px-3 py-2 text-white"
          >
            Necesito gente
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="tap-target flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-mid)] bg-[var(--surface-pure)] text-[var(--ink)]"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-menu"
          >
            {menuOpen ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M2 2l14 14M16 2 2 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
                <path d="M0 1h18M0 7h18M0 13h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
          </button>

          {menuOpen && (
            <div
              id="mobile-nav-menu"
              role="menu"
              className="absolute left-0 right-0 top-full border-b border-[var(--border)] bg-[var(--surface-pure)] px-4 py-3 shadow-[var(--shadow-md)]"
            >
              <nav className="flex flex-col gap-1.5">
                <Link
                  href="/trabajadores/registro"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="tap-target rounded-xl px-3 py-3 text-sm font-bold text-[var(--ink)] hover:bg-[var(--surface)]"
                >
                  Busco trabajo
                </Link>
                <Link
                  href="/soluciones-empresariales"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="tap-target rounded-xl px-3 py-3 text-sm font-bold text-[var(--ink)] hover:bg-[var(--surface)]"
                >
                  Soluciones Empresariales
                </Link>
                <Link
                  href="/employee-request-form"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="tap-target rounded-xl px-3 py-3 text-sm font-bold text-[var(--ink)] hover:bg-[var(--surface)]"
                >
                  Formulario de solicitud de personal
                </Link>
                <Link
                  href="/employer-deposit"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="tap-target rounded-xl px-3 py-3 text-sm font-bold text-[var(--ink)] hover:bg-[var(--surface)]"
                >
                  Depósito de empleador
                </Link>
              </nav>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
