"use client";

export default function GlobalError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body>
        <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
          <h1>ListoRD no pudo cargar</h1>
          <p>Intenta otra vez en unos segundos.</p>
          <button onClick={reset}>Intentar de nuevo</button>
        </main>
      </body>
    </html>
  );
}
