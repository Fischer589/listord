import { notFound } from "next/navigation";
import { legacyCheckoutEnabled } from "@/lib/release-gates";
import EmployerDepositClient from "./employer-deposit-client";

export default function EmployerDepositPage() {
  if (!legacyCheckoutEnabled()) notFound();
  return <EmployerDepositClient />;
}
