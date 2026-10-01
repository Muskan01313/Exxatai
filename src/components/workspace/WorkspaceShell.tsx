"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ChevronsRight } from "lucide-react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { AiChatPanel } from "@/components/ai/AiChatPanel";
import { WorkspaceProvider } from "./WorkspaceContext";
import { SearchModal } from "./SearchModal";
import { SettingsModal } from "./SettingsModal";
import type { WorkspaceSummary } from "@/types/page";

export function WorkspaceShell({
  workspaceId,
  workspaceName,
  workspaces,
  userName,
  children,
}: {
  workspaceId: string;
  workspaceName: string;
  workspaces: WorkspaceSummary[];
  userName: string;
  children: ReactNode;
}) {
  // Desktop and phone keep separate open states so phones start with the sidebar closed.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(() => setToastMessage(null), 2200);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        setSidebarOpen((v) => !v);
        setMobileOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ui = useMemo(
    () => ({
      openSearch: () => setSearchOpen(true),
      openSettings: () => setSettingsOpen(true),
      openChat: () => setChatOpen(true),
      toast,
    }),
    [toast],
  );

  return (
    <WorkspaceProvider
      workspaceId={workspaceId}
      workspaceName={workspaceName}
      workspaces={workspaces}
      userName={userName}
      ui={ui}
    >
      <div
        className={`h-full ${sidebarOpen ? "md:flex" : "md:hidden"} ${
          mobileOpen ? "max-md:flex" : "max-md:hidden"
        } max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:shadow-menu`}
        onClickCapture={(e) => {
          if ((e.target as HTMLElement).closest("a")) {
            setMobileOpen(false);
          }
        }}
      >
        <Sidebar
          onCollapse={() => {
            setSidebarOpen(false);
            setMobileOpen(false);
          }}
        />
      </div>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/20 md:hidden" onClick={() => setMobileOpen(false)} />}
      <button
        type="button"
        onClick={() => {
          setSidebarOpen(true);
          setMobileOpen(true);
        }}
        title="Open sidebar (Ctrl+\)"
        className={`fixed top-2 left-2 z-40 h-7 w-7 items-center justify-center rounded-md bg-white text-ink-2 hover:bg-hover ${
          sidebarOpen ? "md:hidden" : "md:flex"
        } ${mobileOpen ? "max-md:hidden" : "max-md:flex"}`}
      >
        <ChevronsRight size={18} />
      </button>
      <main className={`relative min-w-0 flex-1 overflow-y-auto bg-white ${sidebarOpen ? "" : "md:pl-9"}`}>
        {children}
      </main>
      {chatOpen && <AiChatPanel workspaceId={workspaceId} onClose={() => setChatOpen(false)} />}

      {searchOpen && <SearchModal workspaceId={workspaceId} onClose={() => setSearchOpen(false)} />}
      {settingsOpen && (
        <SettingsModal workspaceId={workspaceId} workspaceName={workspaceName} onClose={() => setSettingsOpen(false)} />
      )}
      {toastMessage && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-sm text-white shadow-menu">
          {toastMessage}
        </div>
      )}
    </WorkspaceProvider>
  );
}
