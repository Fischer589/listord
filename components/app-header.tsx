import Link from "next/link";
import Image from "next/image";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-black/10 bg-[#fbfaf7]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
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
            sizes="(max-width: 640px) 120px, 164px"
            className="h-[34px] w-auto object-contain sm:h-[48px]"
          />
        </Link>
        <nav className="flex shrink-0 flex-wrap items-center justify-end gap-1 text-xs font-semibold sm:gap-2 sm:text-sm">
          <Link
            href="/trabajadores/editar"
            className="tap-target inline-flex items-center rounded-md px-2 py-2 text-ink sm:px-3"
          >
            Editar mi perfil
          </Link>
          <Link
            href="/trabajadores/registro"
            className="tap-target inline-flex items-center rounded-md px-2 py-2 text-ink sm:px-3"
          >
            Busco trabajo
          </Link>
          <Link
            href="/empleadores"
            className="tap-target inline-flex items-center rounded-md bg-ink px-2 py-2 text-white sm:px-3"
          >
            Necesito gente
          </Link>
        </nav>
      </div>
    </header>
  );
}
