import { AppHeader } from "@/components/app-header";
import { AdminActivationQueue } from "@/components/admin-activation-queue";
import { requireAdmin } from "@/lib/admin-auth";
import "@/app/solicitar/request.css";

export const dynamic = "force-dynamic";
export default async function AdminActivationPage() {
  await requireAdmin();
  return <><AppHeader /><main className="container request-page"><AdminActivationQueue /></main></>;
}
