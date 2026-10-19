import { NextResponse } from "next/server";

/** Historical weekly/monthly payments keep their entitlements; no new sales. */
export async function POST(_request: Request) {
  return NextResponse.json({ error: "Los planes ilimitados no están disponibles para compras nuevas." },
    { status: 410, headers: { "Cache-Control": "private, no-store" } });
}
