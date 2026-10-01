import { addDays, localDay } from "@/lib/tracker";

export interface DigestTask {
  id: string;
  title: string;
  workspaceId: string;
  dueAt: Date;
}

export interface Digest {
  today: string;
  overdue: DigestTask[];
  dueToday: DigestTask[];
  dueTomorrow: DigestTask[];
}

/** Sorts open deliveries into overdue / today / tomorrow, using the owner's own calendar days. */
export function buildDigest(tasks: DigestTask[], now: Date, timeZone: string): Digest {
  const today = localDay(now, timeZone);
  const tomorrow = addDays(today, 1);
  const digest: Digest = { today, overdue: [], dueToday: [], dueTomorrow: [] };
  for (const task of [...tasks].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())) {
    const day = localDay(task.dueAt, timeZone);
    if (day < today) {
      digest.overdue.push(task);
    } else if (day === today) {
      digest.dueToday.push(task);
    } else if (day === tomorrow) {
      digest.dueTomorrow.push(task);
    }
  }
  return digest;
}

export function isEmptyDigest(d: Digest) {
  return d.overdue.length + d.dueToday.length + d.dueTomorrow.length === 0;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderDigestEmail(d: Digest, name: string, timeZone: string, baseUrl: string) {
  const time = (date: Date) =>
    new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);

  const sections: [string, DigestTask[]][] = [
    ["Overdue", d.overdue],
    ["Due today", d.dueToday],
    ["Due tomorrow", d.dueTomorrow],
  ];

  const html = [
    `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#37352f;max-width:560px">`,
    `<p>Good morning ${escapeHtml(name)}, here are your deliveries.</p>`,
    ...sections
      .filter(([, items]) => items.length > 0)
      .map(
        ([label, items]) =>
          `<h3 style="margin:20px 0 6px;font-size:15px;${label === "Overdue" ? "color:#eb5757" : ""}">${label}</h3><ul style="padding-left:18px;margin:0">` +
          items
            .map(
              (t) =>
                `<li style="margin:4px 0"><a href="${baseUrl}/w/${t.workspaceId}/tracker" style="color:#37352f">${escapeHtml(t.title)}</a> <span style="color:#787774">· ${time(t.dueAt)}</span></li>`,
            )
            .join("") +
          `</ul>`,
      ),
    `<p style="margin-top:24px;font-size:12px;color:#787774">You can turn these emails off in your tracker settings.</p>`,
    `</div>`,
  ].join("");

  const text = [
    `Good morning ${name}, here are your deliveries.`,
    ...sections
      .filter(([, items]) => items.length > 0)
      .map(([label, items]) => `\n${label}\n${items.map((t) => `- ${t.title} (${time(t.dueAt)})`).join("\n")}`),
    `\nOpen your tracker: ${baseUrl}`,
  ].join("\n");

  const count = d.overdue.length + d.dueToday.length + d.dueTomorrow.length;
  const subject =
    d.dueToday.length > 0
      ? `${d.dueToday.length} ${d.dueToday.length === 1 ? "delivery" : "deliveries"} due today`
      : `${count} upcoming ${count === 1 ? "delivery" : "deliveries"}`;

  return { subject, html, text };
}
