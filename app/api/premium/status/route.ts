import { NextResponse } from "next/server";

/** Public analytics/browser IDs and phone numbers do not establish ownership.
 * Historical entitlements stay intact for verified support reconciliation. */
export async function GET() {
  return NextResponse.json({ error: "El acceso histórico requiere verificar al titular. El contacto con trabajadores es gratis.", premium: false }, {
    status: 403, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" }
  });
}
