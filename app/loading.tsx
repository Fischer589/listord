import { AppHeader } from "@/components/app-header";

export default function LoadingPage() {
  return (
    <>
      <AppHeader />
      <main className="page-shell">
        <section className="hero-section">
          <div className="container py-12">
            <div className="h-8 w-40 animate-pulse rounded-md bg-white/70" />
            <div className="mt-4 h-16 max-w-2xl animate-pulse rounded-md bg-white/70" />
            <div className="mt-4 h-6 max-w-xl animate-pulse rounded-md bg-white/70" />
          </div>
        </section>
        <section className="container py-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-80 animate-pulse rounded-xl bg-white shadow-soft"
              />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
