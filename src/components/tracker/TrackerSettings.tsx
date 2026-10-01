"use client";

import { useEffect, useState } from "react";
import { Bell, CalendarPlus, RefreshCw, X } from "lucide-react";
import { Modal } from "@/components/ui/Dropdown";

interface Settings {
  calendarPath: string | null;
}

function notificationState(): NotificationPermission | "unsupported" {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        readOnly
        aria-label={label}
        value={value}
        onFocus={(e) => e.target.select()}
        className="min-w-0 flex-1 rounded-md border border-line bg-[#f7f7f5] px-2 py-1.5 text-xs text-ink-2 outline-none"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            window.prompt("Copy this link", value);
          }
        }}
        className="shrink-0 rounded-md bg-accent px-3 text-xs font-medium text-white hover:bg-[#0077d4]"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function TrackerSettings({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [permission, setPermission] = useState(notificationState);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/tracker/settings", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) {
          setSettings(data);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function createLink() {
    if (settings?.calendarPath && !window.confirm("Make a new link? The old one stops working, so you'd re-add it in your calendar.")) {
      return;
    }
    setBusy(true);
    const res = await fetch("/api/tracker/settings/calendar", { method: "POST" });
    if (res.ok) {
      const { calendarPath } = await res.json();
      setSettings((s) => (s ? { ...s, calendarPath } : s));
    }
    setBusy(false);
  }

  const feedUrl = settings?.calendarPath ? `${window.location.origin}${settings.calendarPath}` : null;

  return (
    <Modal onClose={onClose} className="max-w-[560px]">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="font-semibold">Reminders &amp; calendar</h2>
        <button type="button" onClick={onClose} title="Close" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-2 hover:bg-hover">
          <X size={16} />
        </button>
      </div>
      {!settings ? (
        <p className="px-5 py-8 text-center text-sm text-ink-3">Loading…</p>
      ) : (
        <div className="max-h-[70vh] space-y-6 overflow-y-auto px-5 py-4 text-sm">
          <section>
            <h3 className="flex items-center gap-2 font-medium">
              <Bell size={16} /> Pop-up reminders
            </h3>
            <p className="mt-1 text-ink-2">
              While this app is open in a browser tab, you get a pop-up when a delivery&apos;s reminder time arrives. The bell
              in the sidebar always lists what&apos;s due. For reminders when it&apos;s closed, add the calendar link below.
            </p>
            {permission === "granted" ? (
              <p className="mt-2 text-[#448361]">Desktop pop-ups are on.</p>
            ) : permission === "denied" ? (
              <p className="mt-2 text-ink-2">
                Your browser is blocking pop-ups for this site. Allow notifications in the browser&apos;s site settings (the
                icon left of the address bar), then reload.
              </p>
            ) : permission === "unsupported" ? (
              <p className="mt-2 text-ink-2">This browser can&apos;t show desktop pop-ups; reminders appear inside the app.</p>
            ) : (
              <button
                type="button"
                onClick={async () => setPermission(await Notification.requestPermission())}
                className="mt-2 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0077d4]"
              >
                Turn on desktop pop-ups
              </button>
            )}
          </section>

          <section>
            <h3 className="flex items-center gap-2 font-medium">
              <CalendarPlus size={16} /> Add to your work calendar
            </h3>
            <p className="mt-1 text-ink-2">
              Your deliveries show up in Google Calendar or Outlook, with reminders, and stay in sync. This link is private:
              anyone who has it can see your delivery titles and dates.
            </p>
            {feedUrl ? (
              <div className="mt-3 space-y-3">
                <CopyField label="Calendar link" value={feedUrl} />
                <div className="rounded-lg bg-[#f7f7f5] p-3 text-ink-2">
                  <p className="font-medium text-ink">Outlook</p>
                  <p>
                    Calendar → <b>Add calendar</b> → <b>Subscribe from web</b> → paste the link → <b>Import</b>.
                  </p>
                  <p className="mt-2 font-medium text-ink">Google Calendar</p>
                  <p>
                    On a computer: next to <b>Other calendars</b>, click <b>+</b> → <b>From URL</b> → paste the link →{" "}
                    <b>Add calendar</b>.
                  </p>
                  <p className="mt-2 text-xs text-ink-3">
                    Calendars check for changes every few hours (Google can take up to a day), so a brand-new delivery
                    may show up later there. Google may also use your own default reminders instead of the ones set here.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void createLink()}
                  disabled={busy}
                  className="flex items-center gap-1.5 text-xs text-ink-2 hover:text-ink"
                >
                  <RefreshCw size={12} /> Make a new link (stops the old one)
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void createLink()}
                disabled={busy}
                className="mt-2 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0077d4]"
              >
                Create my calendar link
              </button>
            )}
          </section>

        </div>
      )}
    </Modal>
  );
}
