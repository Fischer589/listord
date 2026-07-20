export const EMPLOYER_DEPOSIT_AMOUNT_CENTS = 300_000; // RD$3,000.00 in centavos
export const EMPLOYER_DEPOSIT_CURRENCY = "dop";
export const EMPLOYER_DEPOSIT_PRODUCT_NAME =
  "Depósito de búsqueda de personal ListoRD";

export type EmployerPaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type EmployerPayment = {
  id: string;
  created_at: string;
  stripe_payment_id: string | null;
  stripe_session_id: string;
  amount: number;
  currency: string;
  status: EmployerPaymentStatus;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  paid_at: string | null;
};

export const EMPLOYER_PAYMENT_STATUS_LABELS: Record<EmployerPaymentStatus, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  failed: "Fallido",
  refunded: "Reembolsado"
};
