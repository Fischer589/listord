import Link from "next/link";
import Image from "next/image";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[rgba(31,31,28,0.06)] bg-crema/90 backdrop-blur-xl">
      <div className="app-header-inner mx-auto flex w-full min-w-0 max-w-6xl flex-wrap items-center justify-center gap-3 px-3 py-3 sm:flex-nowrap sm:justify-between sm:px-6 sm:py-3.5">
        <Link
          href="/"
          className="inline-flex shrink-0 items-center rounded-2xl border border-[rgba(74,72,60,0.11)] bg-[#fffdf7] px-2.5 py-1.5 shadow-[0_10px_24px_rgba(29,29,27,0.045),inset_0_1px_0_rgba(255,255,255,0.82)] hover:border-[rgba(74,72,60,0.16)] hover:bg-[#fffefb] sm:px-3 sm:py-2"
          aria-label="ListoRD"
        >
          <span className="app-header-logo block h-[34px] w-[132px] overflow-hidden sm:h-[40px] sm:w-[164px]">
            <Image
              src="/branding/listord-premium-logo-cropped.png"
              alt="ListoRD"
              width={840}
              height={262}
              priority
              sizes="(max-width: 640px) 132px, 164px"
              className="h-full w-full object-contain brightness-90 contrast-125 saturate-[0.92]"
            />
          </span>
        </Link>
        <nav className="app-header-nav flex w-full min-w-0 items-center justify-between gap-1.5 text-xs font-black sm:w-auto sm:justify-end sm:gap-2 sm:text-sm">
          <Link
            href="/trabajadores/editar"
            className="tap-target inline-flex min-w-0 flex-1 items-center justify-center rounded-xl px-2 py-2 text-center leading-tight text-ink/70 hover:bg-card hover:text-ink sm:flex-none sm:px-3"
          >
            Editar mi perfil
          </Link>
          <Link
            href="/trabajadores/registro"
            className="tap-target inline-flex min-w-0 flex-1 items-center justify-center rounded-xl px-2 py-2 text-center leading-tight text-ink/70 hover:bg-card hover:text-ink sm:flex-none sm:px-3"
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
