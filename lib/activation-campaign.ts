import { isFreshAvailability } from "./availability";
import { normalizeWhatsAppNumber } from "./whatsapp";

export type CampaignWorker = {
  id: string; is_verified: boolean | null; owner_user_id: string | null;
  whatsapp_number: string | null; available_now: boolean | null;
};
export type CampaignQueueRecord = {
  worker_id: string; invitation_permission_at: string | null;
  invitation_channel: "whatsapp" | null; suppressed_at: string | null;
  opted_out_at: string | null; unreachable_at: string | null;
};
export type CampaignAvailability = {
  worker_id: string; available: boolean; confirmed_at: string | null; access_expires_at: string;
};
export type CampaignNotificationConsent = { worker_id: string; channel: "whatsapp"; revoked_at: string | null };
export type CampaignDelivery = { worker_id: string; status: string };
export type QueueReason = "eligible" | "pending_approval" | "no_contact" | "shared_contact" |
  "no_permission" | "suppressed" | "opted_out" | "unreachable" | "already_batched";

export const ACTIVATION_INVITATION = `🇩🇴 ¡Hola! Somos ListoRD.

Estamos actualizando nuestra comunidad de trabajadores para conectarte con nuevas oportunidades de trabajo.

¿Estás disponible para trabajar actualmente?

Confirma tu perfil y actualiza tu disponibilidad aquí:
[ENLACE PERSONAL]

También podrás elegir si deseas recibir avisos de oportunidades por mensaje.

Tú decides. Puedes cambiar tus preferencias cuando quieras.`;

/** The profile ID selects a page only; verified Auth and linked ownership authorize every action. */
export function workerActivationPath(workerId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workerId))
    throw new Error("invalid worker id");
  return `/trabajadores/activar?perfil=${encodeURIComponent(workerId)}`;
}

export function workerActivationInvitation(origin: string, workerId: string) {
  const base = new URL(origin);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash)
    throw new Error("invalid activation origin");
  return ACTIVATION_INVITATION.replace("[ENLACE PERSONAL]", new URL(workerActivationPath(workerId), base).toString());
}

/** Classify every profile privately. Contact numbers never leave this function. */
export function buildActivationQueue(
  workers: CampaignWorker[], queue: CampaignQueueRecord[], availability: CampaignAvailability[],
  notificationConsent: CampaignNotificationConsent[], deliveries: CampaignDelivery[], now = new Date()
) {
  const byQueue = new Map(queue.map(row => [row.worker_id, row]));
  const byAvailability = new Map(availability.map(row => [row.worker_id, row]));
  const byDelivery = new Map(deliveries.map(row => [row.worker_id, row]));
  const phoneCounts = new Map<string, number>();
  for (const worker of workers) {
    const phone = normalizeWhatsAppNumber(worker.whatsapp_number);
    if (phone) phoneCounts.set(phone, (phoneCounts.get(phone) ?? 0) + 1);
  }
  const rows = workers.map(worker => {
    const record = byQueue.get(worker.id);
    const state = byAvailability.get(worker.id);
    const delivery = byDelivery.get(worker.id);
    const phone = normalizeWhatsAppNumber(worker.whatsapp_number);
    const ownerVerified = Boolean(worker.owner_user_id);
    const available = Boolean(ownerVerified && worker.is_verified && worker.available_now &&
      state?.access_expires_at && Date.parse(state.access_expires_at) > now.getTime() &&
      isFreshAvailability(state.available, state.confirmed_at, now));
    let reason: QueueReason = "eligible";
    if (record?.opted_out_at) reason = "opted_out";
    else if (record?.suppressed_at) reason = "suppressed";
    else if (record?.unreachable_at) reason = "unreachable";
    else if (delivery) reason = "already_batched";
    else if (!worker.is_verified) reason = "pending_approval";
    else if (!phone) reason = "no_contact";
    else if ((phoneCounts.get(phone) ?? 0) > 1) reason = "shared_contact";
    else if (!record?.invitation_permission_at || record.invitation_channel !== "whatsapp") reason = "no_permission";
    return {
      id: worker.id, approved: worker.is_verified === true, ownerVerified, available,
      availabilityConfirmedAt: state?.confirmed_at ?? null,
      contactChannels: { whatsappCandidate: Boolean(phone) },
      sharedContact: Boolean(phone && (phoneCounts.get(phone) ?? 0) > 1),
      invitationPermission: Boolean(record?.invitation_permission_at),
      invitationChannel: record?.invitation_channel ?? null,
      futureJobNotifications: {
        whatsapp: notificationConsent.some(consent => consent.worker_id === worker.id && consent.channel === "whatsapp" && !consent.revoked_at)
      },
      deliveryStatus: delivery?.status ?? null, reason
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
  const totals = {
    totalProfiles: rows.length,
    eligibleRecipients: rows.filter(row => row.reason === "eligible").length,
    messagesSent: deliveries.filter(row => ["sent", "delivered", "responded"].includes(row.status)).length,
    delivered: deliveries.filter(row => ["delivered", "responded"].includes(row.status)).length,
    responses: deliveries.filter(row => row.status === "responded").length,
    verifiedOwners: rows.filter(row => row.ownerVerified).length,
    availableWorkers: rows.filter(row => row.available).length,
    unavailableWorkers: rows.filter(row => row.availabilityConfirmedAt && !row.available).length,
    unreachableWorkers: rows.filter(row => ["no_contact", "shared_contact", "unreachable"].includes(row.reason)).length,
    suppressed: rows.filter(row => row.reason === "suppressed" || row.reason === "opted_out").length,
    needsOwnershipReview: rows.filter(row => !row.ownerVerified).length
  };
  return { asOf: now.toISOString(), totals, rows };
}
