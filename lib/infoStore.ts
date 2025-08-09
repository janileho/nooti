import { promises as fs } from "fs";
import path from "path";
import { writeRepoFile } from "@/lib/githubContent";

export type ShopInfo = {
  name: string;
  address: string;
  city: string;
  hours: { days: string; open?: string; close?: string; closed?: boolean }[];
  backgroundUrl: string;
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
    { days: "Mon–Fri", open: "08:00", close: "18:00", closed: false },
    { days: "Sat", open: "09:00", close: "17:00", closed: false },
    { days: "Sun", open: "10:00", close: "16:00", closed: false },
  ],
  backgroundUrl: "/retro-fallback",
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
  if (isServerless) {
    try {
      const url = getRemoteInfoUrl();
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        return (await res.json()) as ShopInfo;
      }
    } catch {
      // ignore and fall back to local tmp file
    }
  }
  await ensureSeed();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(raw) as ShopInfo;
}

export async function writeInfo(next: ShopInfo): Promise<void> {
  await ensureSeed();
  await fs.writeFile(DATA_FILE, JSON.stringify(next, null, 2), "utf8");
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
      content: JSON.stringify(next, null, 2),
    });
  }
}

