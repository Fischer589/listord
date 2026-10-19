import { redirect } from "next/navigation";
import { isUuid } from "@/lib/employer-workspace";

export default async function RetiredWorkspacePaymentPage({ searchParams }: { searchParams: Promise<{ worker?: string }> }) {
  const query = await searchParams;
  redirect(isUuid(query.worker) ? `/empleadores/contacto?worker=${encodeURIComponent(query.worker)}` : "/empleadores/contacto");
}
