import Link from "next/link";
import Image from "next/image";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[rgba(31,31,28,0.06)] bg-crema/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-3 px-4 py-3 sm:flex-nowrap sm:justify-between sm:px-6 sm:py-3.5">
        <Link
          href="/"
          className="inline-flex shrink-0 items-center rounded-2xl border border-hoja/15 bg-card/90 px-3 py-2 shadow-[0_12px_30px_rgba(29,29,27,0.055),inset_0_1px_0_rgba(255,255,255,0.72)] hover:border-hoja/25 hover:bg-[#fffdf8]"
          aria-label="ListoRD"
        >
          <span className="block h-[34px] w-[132px] overflow-hidden sm:h-[40px] sm:w-[164px]">
            <Image
              src="/branding/listord-premium-logo-cropped.png"
              alt="ListoRD"
              width={840}
              height={262}
              priority
              sizes="(max-width: 640px) 132px, 164px"
              className="h-full w-full object-contain"
            />
          </span>
        </Link>
        <nav className="flex w-full items-center justify-between gap-1.5 text-xs font-black sm:w-auto sm:justify-end sm:gap-2 sm:text-sm">
          <Link
            href="/trabajadores/editar"
            className="tap-target inline-flex flex-1 items-center justify-center rounded-xl px-2 py-2 text-center text-ink/70 hover:bg-card hover:text-ink sm:flex-none sm:px-3"
          >
            Editar mi perfil
          </Link>
          <Link
            href="/trabajadores/registro"
            className="tap-target inline-flex flex-1 items-center justify-center rounded-xl px-2 py-2 text-center text-ink/70 hover:bg-card hover:text-ink sm:flex-none sm:px-3"
          >
            Busco trabajo
          </Link>
          <Link
            href="/empleadores"
            className="btn-primary tap-target inline-flex flex-1 items-center justify-center px-2 py-2 text-center text-white sm:flex-none sm:px-3"
          >
            Necesito gente
          </Link>
        </nav>
      </div>
    </header>
  );
}
