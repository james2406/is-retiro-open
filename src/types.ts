export type StatusCode = 1 | 2 | 3 | 4 | 5 | 6;

export type StatusType = "open" | "restricted" | "closing" | "closed";

export interface RetiroStatus {
  status: StatusType;
  code: StatusCode;
  message: string;
  incidents: string | null;
  observations: string | null;
  updated_at: string;
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
  5: { bgColor: "#E74C3C", textColor: "#FFFFFF" },
  6: { bgColor: "#C0392B", textColor: "#FFFFFF" },
};

export const ERROR_THEME: StatusTheme = {
  bgColor: "#7F8C8D",
  textColor: "#FFFFFF",
};
