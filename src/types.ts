export type StatusCode = 1 | 2 | 3 | 4 | 5 | 6;

export type StatusType = "open" | "restricted" | "closed";

export type WarningSeverity = "minor" | "moderate" | "severe" | "extreme" | null;

export interface RetiroStatus {
  status: StatusType;
  code: StatusCode;
  message: string;
  incidents: string | null;
  observations: string | null;
  updated_at: string;
  /** Date when Madrid last updated the alert (format: "DD/MM/YYYY" from FECHA_INCIDENCIA) */
  source_updated_at: string | null;
}

export interface WeatherWarningSignal {
  hasActiveWarning: boolean;
  hasWarningWithin2Hours: boolean;
  hasWarningLaterToday: boolean;
  activeWarningSeverity: WarningSeverity;
  nextWarningOnset: string | null;
  nextWarningSeverity: WarningSeverity;
  fetchedAt: string | null;
}

export interface StatusTheme {
  bgColor: string;
  textColor: string;
}

export const STATUS_THEMES: Record<StatusCode, StatusTheme> = {
  1: { bgColor: "#2ECC71", textColor: "#FFFFFF" },
  2: { bgColor: "#3498DB", textColor: "#FFFFFF" },
  3: { bgColor: "#F1C40F", textColor: "#000000" },
  4: { bgColor: "#E67E22", textColor: "#FFFFFF" },
  5: { bgColor: "#C0392B", textColor: "#FFFFFF" },
  6: { bgColor: "#C0392B", textColor: "#FFFFFF" },
};

// Distinct from CLOSED red, used for predictive near-term closing state.
export const CLOSING_THEME: StatusTheme = {
  bgColor: "#E74C3C",
  textColor: "#FFFFFF",
};

export const ERROR_THEME: StatusTheme = {
  bgColor: "#7F8C8D",
  textColor: "#FFFFFF",
};
