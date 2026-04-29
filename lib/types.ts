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
  user_id?: string | null;
  edit_token?: string;
  full_name: string;
  photo_url?: string | null;
  country: string;
  region: string;
  city: string;
  whatsapp_number?: string | null;
  skills: string[];
  desired_income: number;
  income_type: IncomeType;
  availability: string[];
  available_now: boolean;
  work_style?: WorkStyle | null;
  work_style_note?: string | null;
  job_duration_preference: string;
  duration_note?: string | null;
  short_intro: string;
  experience?: string | null;
  show_up_count: number;
  completed_jobs_count: number;
  hired_count: number;
  hire_rate: number;
  rating_average: number;
  rating_count: number;
  is_verified: boolean;
  created_at?: string;
  updated_at?: string;
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
