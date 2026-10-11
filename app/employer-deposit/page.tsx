import { notFound } from "next/navigation";
import { employerDepositEnabled } from "@/lib/release-gates";
import EmployerDepositClient from "./employer-deposit-client";

export default function EmployerDepositPage() {
  if (!employerDepositEnabled()) notFound();
  return <EmployerDepositClient />;
}
