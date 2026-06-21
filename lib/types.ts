export type IncomeType = "hourly" | "daily" | "weekly" | "monthly";
export type HiringOutcome = "pending" | "hired" | "not_hired";

export type WorkStyle =
  | "structured"
  | "creative"
  | "hands_on"
  | "people_oriented"
  | "systems_oriented"
  | "fast_paced"
  | "detail_oriented"
  | "flexible";

export type Worker = {
  id: string;
  edit_token?: string;
  full_name?: string | null;
  photo_url?: string | null;
  city?: string | null;
  whatsapp_number?: string | null;
  skills?: string[] | null;
  desired_income?: number | string | null;
  availability?: string[] | null;
  work_style?: WorkStyle | null;
  short_intro?: string | null;
  is_verified: boolean;
  created_at?: string;
  // Phase 5 — surfaced from DB
  available_now?: boolean | null;
  rating_average?: number | null;
  rating_count?: number | null;
  hired_count?: number | null;
  experience?: string | null;
  income_type?: IncomeType | null;
  // Phase 6 — worker monetization tiers
  is_featured?: boolean | null;
  is_pro?: boolean | null;
};

export type Employer = {
  id: string;
  user_id?: string | null;
  company_name?: string | null;
  contact_name: string;
  country: string;
  region: string;
  city: string;
  whatsapp_number: string;
  is_paid_employer: boolean;
  paid_access_until?: string | null;
  free_contacts_remaining: number;
  successful_hires_count: number;
};

export type ContactRequest = {
  id: string;
  employer_id: string;
  worker_id: string;
  status: "pending" | "accepted" | "rejected";
  outcome: HiringOutcome;
  outcome_confirmed_by_employer?: boolean | null;
  outcome_confirmed_by_worker?: boolean | null;
  outcome_note?: string | null;
  created_at?: string;
};
