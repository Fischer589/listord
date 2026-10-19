"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MarketplaceSession } from "@/components/marketplace-session";

type Profile = { id: string; approved: boolean; available: boolean; confirmedAt: string | null;
  notifications: { whatsapp: boolean; sms: boolean }; activationOptedOut: boolean };

function ActivationProfiles({ token }: { token: string }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/workers/activation", { cache: "no-store",
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setProfiles(body.profiles);
  }, [token]);
  useEffect(() => {
    let active = true;
    void load().catch(() => { if (active) setNotice("No pudimos cargar tus perfiles. Intenta de nuevo."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);
  async function save(workerId: string, action: "availability" | "notification_consent" | "invitation_opt_out",
    values: Record<string, unknown>) {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/workers/activation", { method: "POST", cache: "no-store",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ workerId, action, ...values }), signal: AbortSignal.timeout(12000) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      await load();
      setNotice("Tu decisión quedó guardada.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo guardar tu decisión."); }
    finally { setBusy(false); }
  }
  if (loading) return <p role="status">Cargando tus perfiles…</p>;
  if (!profiles.length) return <section className="request-builder"><h2>Verifica la titularidad de tu perfil</h2>
    <p>Tu cuenta está verificada, pero todavía no está vinculada a un perfil. Por seguridad, un número compartido o un enlace antiguo no basta para vincularlo.</p>
    <Link className="btn-primary" href="/trabajadores/recuperar">Solicitar revisión de titularidad</Link>
    {notice && <p role="alert">{notice}</p>}</section>;
  return <section className="request-builder"><h2>Tus perfiles verificados</h2>
    <p>La disponibilidad dura 7 días desde tu confirmación. Elegir avisos por WhatsApp o SMS es una decisión separada.</p>
    {profiles.map(profile => <article key={profile.id} className="rounded-xl border border-black/10 bg-white p-4">
      <h3 className="font-black">Perfil {profile.id.slice(0, 8)}</h3>
      <p>{profile.approved ? profile.available ? "Disponible ahora" : "Disponibilidad sin confirmar o vencida" : "Pendiente de aprobación"}</p>
      {profile.approved && <>
        <div className="request-actions">
          <button className="btn-primary" disabled={busy} onClick={() => void save(profile.id, "availability", { available: true })}>Sí, estoy disponible</button>
          <button className="btn-secondary" disabled={busy} onClick={() => void save(profile.id, "availability", { available: false })}>Ahora no estoy disponible</button>
        </div>
        <fieldset className="mt-4"><legend className="font-bold">Avisos futuros de oportunidades</legend>
          {(["whatsapp", "sms"] as const).map(channel => <label key={channel} className="mt-2 flex items-center gap-2">
            <input type="checkbox" checked={profile.notifications[channel]} disabled={busy}
              onChange={event => void save(profile.id, "notification_consent", { channel, agree: event.target.checked })} />
            Recibir avisos por {channel === "whatsapp" ? "WhatsApp" : "SMS"}
          </label>)}
          <p className="text-sm">Puedes retirar cada permiso cuando quieras. Confirmar disponibilidad no activa estos avisos.</p>
        </fieldset>
        {!profile.activationOptedOut && <button className="btn-secondary" disabled={busy}
          onClick={() => void save(profile.id, "invitation_opt_out", { optOut: true })}>No recibir invitaciones de activación</button>}
      </>}
    </article>)}
    {notice && <p role="status">{notice}</p>}
  </section>;
}

export function WorkerActivation() {
  return <section className="request-builder"><h1>Confirma tu perfil y disponibilidad</h1>
    <p>Solo tú decides si estás disponible. También puedes elegir por separado si deseas avisos de trabajo por mensaje.</p>
    <MarketplaceSession emailRedirectPath="/trabajadores/activar"
      description="Verifica tu correo para administrar los perfiles que ya están vinculados a tu cuenta. Si tu perfil aún no está vinculado, solicita una revisión de titularidad.">
      {token => <ActivationProfiles token={token} />}
    </MarketplaceSession>
  </section>;
}
