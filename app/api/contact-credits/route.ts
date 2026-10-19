import { NextResponse } from "next/server";
import { verifiedMarketplaceUser } from "@/lib/marketplace-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { workspaceSessionPrefix } from "@/lib/employer-workspace";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  let ownerId: string;
  try { ownerId = await verifiedMarketplaceUser(request); }
  catch { return NextResponse.json({ error: "Verifica tu correo." }, { status: 401, headers }); }
  const db = getSupabaseAdminClient();
  const prefix = workspaceSessionPrefix();
  if (!db || !prefix) return NextResponse.json({ error: "Saldo no disponible." }, { status: 503, headers });
  const { data, error } = await db.rpc("contact_credit_overview", { p_owner: ownerId, p_prefix: prefix })
    .abortSignal(AbortSignal.timeout(8000));
  if (error || !Array.isArray(data) || data.length !== 1 ||
      !Number.isSafeInteger(data[0].remaining) || !Array.isArray(data[0].unlocked)) {
    return NextResponse.json({ error: "Saldo no disponible." }, { status: 503, headers });
  }
  return NextResponse.json({ remaining: data[0].remaining, unlocked: data[0].unlocked,
    legacyActive: data[0].legacy_active === true }, { headers });
}
