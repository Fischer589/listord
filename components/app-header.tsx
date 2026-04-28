import Link from "next/link";
import Image from "next/image";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-black/10 bg-[#fbfaf7]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-6 sm:py-5">
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
            className="h-[38px] w-auto object-contain sm:h-[52px]"
          />
        </Link>
        <nav className="flex shrink-0 items-center gap-1 text-sm font-semibold sm:gap-2">
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
