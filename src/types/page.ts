export interface PageTreeNode {
  id: string;
  title: string;
  icon: string | null;
  parentId: string | null;
  order: number;
}

export interface EditorPageData {
  id: string;
  title: string;
  icon: string | null;
  cover: string | null;
  content: unknown;
  contentVersion: number;
  isPublic: boolean;
  updatedAt: string;
  deletedAt: string | null;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: "OWNER" | "EDITOR";
}
