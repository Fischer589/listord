import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

const WORKER_CONTACT_MESSAGE =
  "Hola, vi tu perfil en ListoRD. ¿Estás disponible hoy para trabajar?";

export async function POST(request: Request) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase no está configurado." },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    workerId?: string;
  } | null;
  const workerId = body?.workerId?.trim();

  if (!workerId) {
    return NextResponse.json(
      { error: "Falta workerId." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("workers")
    .select("whatsapp_number")
    .eq("id", workerId)
    .single();

  if (error) {
    return NextResponse.json(
      { error: "No pudimos preparar el contacto." },
      { status: 404 }
    );
  }

  const phone = data.whatsapp_number?.replace(/\D/g, "");

  if (!phone) {
    return NextResponse.json(
      { error: "Este trabajador no tiene WhatsApp disponible." },
      { status: 404 }
    );
  }

  const message = encodeURIComponent(WORKER_CONTACT_MESSAGE);

  return NextResponse.json({
    url: `https://api.whatsapp.com/send?phone=${phone}&text=${message}`
  });
}
