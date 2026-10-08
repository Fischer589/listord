import { NextResponse } from "next/server";
import { parseMatchRequest } from "@/lib/request-matching";
import { getRequestMatches, MATCH_HEADERS, readMatchBody } from "@/lib/request-match-server";

export async function POST(request: Request) {
  const draft = parseMatchRequest(await readMatchBody(request).catch(() => null));
  if (!draft) return NextResponse.json({ error: "Revisa los detalles de tu solicitud." }, { status: 400, headers: MATCH_HEADERS });
  try {
    return NextResponse.json(await getRequestMatches(draft), { headers: MATCH_HEADERS });
  } catch {
    return NextResponse.json({ error: "No pudimos verificar los perfiles. Intenta de nuevo; no significa que no haya trabajadores." }, { status: 503, headers: MATCH_HEADERS });
  }
}
