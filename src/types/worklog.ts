export interface WorkLogRow {
  id: string;
  userId: string;
  userName: string;
  ticketNumber: string;
  stubName: string;
  domain: string;
  analyst: string;
  workType: string;
  mainCategory: string;
  subCategory: string;
  formComplexity: string;
  completedCount: number | null;
  usedByDate: string | null;
  workDate: string;
  comments: string;
  vstsNumber: string;
  status: string;
  timerSeconds: number;
  timerStartedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
}

/** The fields you type into; everything else is managed by the server. */
export type WorkLogFields = Pick<
  WorkLogRow,
  | "ticketNumber"
  | "stubName"
  | "domain"
  | "analyst"
  | "workType"
  | "mainCategory"
  | "subCategory"
  | "formComplexity"
  | "completedCount"
  | "usedByDate"
  | "workDate"
  | "comments"
  | "vstsNumber"
  | "status"
>;

export interface WorkLogLists {
  stubNames: string[];
  domains: string[];
  analysts: string[];
  workTypes: string[];
  /** Each main category with the sub categories that belong to it. */
  categories: { name: string; subs: string[] }[];
  complexities: string[];
  statuses: string[];
}

export const DEFAULT_WORKLOG_LISTS: WorkLogLists = {
  stubNames: [],
  domains: [],
  analysts: [],
  workTypes: ["New", "BAU"],
  categories: [],
  complexities: ["Simple", "Medium", "Complex"],
  statuses: ["In progress", "Completed", "On hold", "Blocked"],
};
