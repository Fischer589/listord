import { NextResponse } from "next/server";

/** Existing direct contact orders remain honored; new sales use credit packs. */
export async function POST(_request: Request) {
  return NextResponse.json({ error: "El contacto individual ahora se compra con créditos." },
    { status: 410, headers: { "Cache-Control": "private, no-store" } });
}
