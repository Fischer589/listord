import { AppHeader } from "@/components/app-header";
import { WorkerAvailability } from "@/components/worker-availability";
import "@/app/solicitar/request.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Mi disponibilidad", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default function AvailabilityPage() {
  return <><AppHeader /><main className="container request-page"><WorkerAvailability /></main></>;
}
