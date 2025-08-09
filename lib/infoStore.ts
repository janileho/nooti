import { promises as fs } from "fs";
import path from "path";
import { writeRepoFile } from "@/lib/githubContent";

export type DayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
export type DayHours = { day: DayKey; open?: string; close?: string; closed?: boolean };

export type ShopInfo = {
  name: string;
  address: string;
  city: string;
  hours: DayHours[];
  backgroundUrl: string;
  weeklyNote?: string;
  updatedAt?: string;
};

// Choose a writable base directory depending on the runtime.
// - In serverless (e.g., Vercel), /var/task is read-only. Use TMPDIR (/tmp) or DATA_DIR if provided.
// - Locally, use a "data" folder in the project root.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION);
const baseDirectory = isServerless
  ? (process.env.DATA_DIR || process.env.TMPDIR || "/tmp")
  : path.join(process.cwd(), "data");

const DATA_FILE = path.join(baseDirectory, "info.json");

const DEFAULT_INFO: ShopInfo = {
  name: "Nooti Coffee",
  address: "123 Groove St",
  city: "Helsinki",
  hours: [
    { day: "Mon", open: "08:00", close: "18:00", closed: false },
    { day: "Tue", open: "08:00", close: "18:00", closed: false },
    { day: "Wed", open: "08:00", close: "18:00", closed: false },
    { day: "Thu", open: "08:00", close: "18:00", closed: false },
    { day: "Fri", open: "08:00", close: "18:00", closed: false },
    { day: "Sat", open: "09:00", close: "17:00", closed: false },
    { day: "Sun", open: "10:00", close: "16:00", closed: false },
  ],
  backgroundUrl: "/retro-fallback",
  weeklyNote: "",
};

function getRemoteInfoUrl() {
  const owner = process.env.GITHUB_OWNER || "janileho";
  const repo = process.env.GITHUB_REPO || "nooti";
  const branch = process.env.GITHUB_BRANCH || "main";
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/web/data/info.json`;
}

export async function ensureSeed(): Promise<void> {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(DEFAULT_INFO, null, 2), "utf8");
  }
}

export async function readInfo(): Promise<ShopInfo> {
  type LegacyHour = { days: string; open?: string; close?: string; closed?: boolean };
  const normalize = (data: unknown): ShopInfo => {
    const obj = data as { name?: string; address?: string; city?: string; backgroundUrl?: string; hours?: LegacyHour[] } | undefined;
    // If already per-day structure
    if (
      Array.isArray(obj?.hours) &&
      (obj.hours as Array<{ day?: unknown }>).length > 0 &&
      Boolean((obj.hours as Array<{ day?: unknown }>)[0]?.day)
    ) {
      return obj as unknown as ShopInfo;
    }
    // Legacy grouped structure → expand to per-day
    const perDay: DayHours[] = [];
    const pushRange = (days: DayKey[], open?: string, close?: string, closed?: boolean) => {
      for (const d of days) perDay.push({ day: d, open, close, closed });
    };
    const weekdays: DayKey[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const sat: DayKey[] = ["Sat"];
    const sun: DayKey[] = ["Sun"];
    for (const h of (obj?.hours as LegacyHour[] | undefined) || []) {
      if (h.days === "Mon–Fri") pushRange(weekdays, h.open, h.close, h.closed ?? false);
      else if (h.days === "Sat") pushRange(sat, h.open, h.close, h.closed ?? false);
      else if (h.days === "Sun") pushRange(sun, h.open, h.close, h.closed ?? false);
    }
    return {
      name: obj?.name ?? DEFAULT_INFO.name,
      address: obj?.address ?? DEFAULT_INFO.address,
      city: obj?.city ?? DEFAULT_INFO.city,
      hours: perDay.length ? perDay : DEFAULT_INFO.hours,
      backgroundUrl: obj?.backgroundUrl ?? DEFAULT_INFO.backgroundUrl,
    };
  };

  if (isServerless) {
    try {
      const url = getRemoteInfoUrl();
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        return normalize(data);
      }
    } catch {
      // ignore and fall back to local tmp file
    }
  }
  await ensureSeed();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return normalize(JSON.parse(raw));
}

export async function writeInfo(next: ShopInfo): Promise<void> {
  await ensureSeed();
  const nextWithMeta: ShopInfo = { ...next, updatedAt: new Date().toISOString() };
  await fs.writeFile(DATA_FILE, JSON.stringify(nextWithMeta, null, 2), "utf8");
  // Persist to GitHub as the source of truth for serverless environments
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    const owner = process.env.GITHUB_OWNER || "janileho";
    const repo = process.env.GITHUB_REPO || "nooti";
    const branch = process.env.GITHUB_BRANCH || "main";
    await writeRepoFile({
      owner,
      repo,
      branch,
      token,
      path: "web/data/info.json",
      message: `chore: update site info ${new Date().toISOString()}`,
      content: JSON.stringify(nextWithMeta, null, 2),
    });
  }
}

