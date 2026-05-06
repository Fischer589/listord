import Link from "next/link";
import Image from "next/image";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-hoja/15 bg-crema/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:flex-nowrap sm:px-6 sm:py-4">
        <Link
          href="/"
          className="mr-2 flex shrink-0 items-center sm:mr-3"
          aria-label="ListoRD"
        >
          <Image
            src="/logo-header.png"
            alt="ListoRD"
            width={1337}
            height={412}
            priority
            sizes="(max-width: 640px) 112px, 164px"
            className="h-[32px] w-auto object-contain sm:h-[48px]"
          />
        </Link>
        <nav className="flex w-full items-center justify-between gap-1.5 text-xs font-bold sm:w-auto sm:justify-end sm:gap-2 sm:text-sm">
          <Link
            href="/trabajadores/editar"
            className="tap-target inline-flex flex-1 items-center justify-center rounded-lg px-2 py-2 text-center text-ink/80 transition hover:bg-card hover:text-ink sm:flex-none sm:px-3"
          >
            Editar mi perfil
          </Link>
          <Link
            href="/trabajadores/registro"
            className="tap-target inline-flex flex-1 items-center justify-center rounded-lg px-2 py-2 text-center text-ink/80 transition hover:bg-card hover:text-ink sm:flex-none sm:px-3"
          >
            Busco trabajo
          </Link>
          <Link
            href="/empleadores"
            className="tap-target inline-flex flex-1 items-center justify-center rounded-lg bg-ink px-2 py-2 text-center text-white shadow-soft transition hover:bg-hoja sm:flex-none sm:px-3"
          >
            Necesito gente
          </Link>
        </nav>
      </div>
    </header>
  );
}
