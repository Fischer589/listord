import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { MarketplaceAuthCallback } from "@/components/marketplace-auth-callback";
import { marketplaceAuthDestination } from "@/lib/marketplace-auth-redirect";

export default async function AuthCallbackPage({ params }: { params: Promise<{ intent: string }> }) {
  const { intent } = await params;
  const destination = marketplaceAuthDestination(intent);
  if (!destination) notFound();
  return <><AppHeader /><main className="container" style={{ maxWidth: 640, paddingBlock: "3rem" }}>
    <MarketplaceAuthCallback destination={destination} />
  </main></>;
}
