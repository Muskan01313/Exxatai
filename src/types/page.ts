export interface PageTreeNode {
  id: string;
  title: string;
  icon: string | null;
  parentId: string | null;
  order: number;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: "OWNER" | "EDITOR";
}

export const PAGES_CHANGED_EVENT = "workspace:pages-changed";
