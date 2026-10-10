import { redirect } from "next/navigation";

export default async function ContactRequestPage({
  params,
}: {
  params: Promise<{ workerId: string }>;
}) {
  const { workerId } = await params;
  redirect(`/trabajador/${encodeURIComponent(workerId)}`);
}
