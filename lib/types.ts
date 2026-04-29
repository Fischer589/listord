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
  full_name: string;
  photo_url?: string | null;
  city: string;
  whatsapp_number?: string | null;
  skills: string[];
  desired_income: number;
  availability: string[];
  work_style?: WorkStyle | null;
  short_intro: string;
  is_verified: boolean;
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
