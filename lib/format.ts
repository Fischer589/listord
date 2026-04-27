import type { IncomeType, WorkStyle } from "./types";

const incomeLabels: Record<IncomeType, string> = {
  hourly: "por hora",
  daily: "por día",
  weekly: "por semana",
  monthly: "al mes"
};

const shortIncomeLabels: Record<IncomeType, string> = {
  hourly: "hora",
  daily: "día",
  weekly: "semana",
  monthly: "mes"
};

export function formatIncome(amount: number | string | null | undefined, type?: IncomeType | null) {
  const incomeType = getIncomeType(type);
  return `RD$${formatMoneyAmount(amount)} ${incomeLabels[incomeType]}`;
}

export function formatIncomeShort(
  amount: number | string | null | undefined,
  type?: IncomeType | null
) {
  const incomeType = getIncomeType(type);
  return `RD$${formatMoneyAmount(amount)} / ${shortIncomeLabels[incomeType]}`;
}

export const workStyleLabels: Record<WorkStyle, string> = {
  structured: "organizado",
  creative: "creativo",
  hands_on: "práctico",
  people_oriented: "con personas",
  systems_oriented: "de sistemas",
  fast_paced: "rápido",
  detail_oriented: "detallado",
  flexible: "flexible"
};

function formatMoneyAmount(amount: number | string | null | undefined) {
  const value = Number(amount ?? 0);

  if (Number.isNaN(value)) {
    return "0";
  }

  return value.toLocaleString("es-DO");
}

function getIncomeType(type?: IncomeType | null): IncomeType {
  return type && type in incomeLabels ? type : "daily";
}
