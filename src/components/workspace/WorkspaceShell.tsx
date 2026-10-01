"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronsRight, X } from "lucide-react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { AiChatPanel } from "@/components/ai/AiChatPanel";
import { WorkspaceProvider } from "./WorkspaceContext";
import { SearchModal } from "./SearchModal";
import { SettingsModal } from "./SettingsModal";
import type { WorkspaceSummary } from "@/types/page";
import type { ReminderItem } from "@/types/tracker";
import { formatDue } from "@/components/tracker/dates";
import { reminderHref, reminderIsDue, reminderKey } from "@/components/tracker/reminders";

interface ReminderAlert {
  key: string;
  taskId: string;
  title: string;
  when: string;
  href: string;
}

/** Remembers which reminders already popped up, across tabs and reloads when storage allows. */
function claimReminder(key: string, shown: Set<string>): boolean {
  if (shown.has(key)) {
    return false;
  }
  shown.add(key);
  try {
    if (localStorage.getItem(key)) {
      return false;
    }
    localStorage.setItem(key, String(Date.now()));
  } catch {
    // Storage unavailable: the in-memory set still stops repeats in this tab.
  }
  return true;
}

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
  const router = useRouter();
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [alerts, setAlerts] = useState<ReminderAlert[]>([]);
  const shownReminders = useRef(new Set<string>());

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

  const refreshReminders = useCallback(async () => {
    const res = await fetch("/api/tracker/reminders", { cache: "no-store" });
    if (res.ok) {
      setReminders((await res.json()).reminders);
    }
  }, []);

  // Deliveries come from the tracker; check for new ones every minute.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    void refreshReminders();
    const id = setInterval(() => void refreshReminders(), 60_000);
    return () => clearInterval(id);
  }, [refreshReminders]);

  // Pop up each reminder once when its time comes: a card in the app, plus a desktop notification.
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      for (const r of reminders) {
        if (!reminderIsDue(r, now) || !claimReminder(reminderKey(r), shownReminders.current)) {
          continue;
        }
        const href = reminderHref(r);
        const when = new Date(r.dueAt).getTime() < now ? `Was due ${formatDue(r.dueAt)}` : `Due ${formatDue(r.dueAt)}`;
        // One card per task: a moved delivery replaces the earlier reminder.
        setAlerts((prev) => [...prev.filter((a) => a.taskId !== r.id), { key: reminderKey(r), taskId: r.id, title: r.title, when, href }]);
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          try {
            const notification = new Notification(`Delivery: ${r.title}`, { body: when, tag: r.id });
            notification.onclick = () => {
              window.focus();
              router.push(href);
              notification.close();
            };
          } catch {
            // Some browsers (e.g. Android Chrome) only allow notifications from a service worker.
          }
        }
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [reminders, router]);

  // Times in the morning email follow the zone your browser is in.
  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      if (sessionStorage.getItem("tracker-timezone") === timezone) {
        return;
      }
    } catch {
      // Fall through and sync anyway.
    }
    void fetch("/api/tracker/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone }),
    }).then((res) => {
      if (res.ok) {
        try {
          sessionStorage.setItem("tracker-timezone", timezone);
        } catch {
          // Not critical.
        }
      }
    });
  }, []);

  const ui = useMemo(
    () => ({
      openSearch: () => setSearchOpen(true),
      openSettings: () => setSettingsOpen(true),
      openChat: () => setChatOpen(true),
      toast,
      reminders,
      refreshReminders,
    }),
    [toast, reminders, refreshReminders],
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
      {alerts.length > 0 && (
        <div className="fixed right-4 bottom-4 z-50 flex w-[320px] max-w-[calc(100vw-2rem)] flex-col gap-2">
          {alerts.map((alert) => (
            <div key={alert.key} role="alert" data-testid="reminder-alert" className="flex gap-3 rounded-lg bg-white p-3 text-sm shadow-menu">
              <Bell size={18} className="mt-0.5 shrink-0 text-[#c4651d]" />
              <div className="min-w-0 flex-1">
                <p className="font-medium break-words">{alert.title}</p>
                <p className="text-xs text-ink-2">{alert.when}</p>
                <Link
                  href={alert.href}
                  onClick={() => setAlerts((prev) => prev.filter((a) => a.key !== alert.key))}
                  className="mt-1 inline-block text-xs font-medium text-accent hover:underline"
                >
                  Open in tracker
                </Link>
              </div>
              <button
                type="button"
                title="Dismiss"
                onClick={() => setAlerts((prev) => prev.filter((a) => a.key !== alert.key))}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-3 hover:bg-hover"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      {toastMessage && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-sm text-white shadow-menu">
          {toastMessage}
        </div>
      )}
    </WorkspaceProvider>
  );
}
