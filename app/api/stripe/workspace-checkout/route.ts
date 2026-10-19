import { NextResponse } from "next/server";

/** Existing paid workspace orders remain honored; new unlimited passes are retired. */
export async function POST(_request: Request) {
  return NextResponse.json({ error: "Los pases nuevos se sustituyeron por créditos de contacto." },
    { status: 410, headers: { "Cache-Control": "private, no-store" } });
}
