import Link from "next/link";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-black/10 bg-[#fbfaf7]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-black tracking-normal text-ink">
          Listo<span className="text-hoja">RD</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm font-semibold">
          <Link
            href="/trabajadores/registro"
            className="tap-target inline-flex items-center rounded-md px-3 py-2 text-ink"
          >
            Busco trabajo
          </Link>
          <Link
            href="/empleadores"
            className="tap-target inline-flex items-center rounded-md bg-ink px-3 py-2 text-white"
          >
            Necesito gente
          </Link>
        </nav>
      </div>
    </header>
  );
}
