import { promises as fs } from "fs";
import path from "path";

export type ShopInfo = {
  name: string;
  address: string;
  city: string;
  hours: { days: string; open: string; close: string }[];
  backgroundUrl: string;
};

const DATA_FILE = path.join(process.cwd(), "data", "info.json");

const DEFAULT_INFO: ShopInfo = {
  name: "Nooti Coffee",
  address: "123 Groove St",
  city: "Helsinki",
  hours: [
    { days: "Mon–Fri", open: "08:00", close: "18:00" },
    { days: "Sat", open: "09:00", close: "17:00" },
    { days: "Sun", open: "10:00", close: "16:00" },
  ],
  backgroundUrl: "/retro-fallback",
};

export async function ensureSeed(): Promise<void> {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(DEFAULT_INFO, null, 2), "utf8");
  }
}

export async function readInfo(): Promise<ShopInfo> {
  await ensureSeed();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(raw) as ShopInfo;
}

export async function writeInfo(next: ShopInfo): Promise<void> {
  await ensureSeed();
  await fs.writeFile(DATA_FILE, JSON.stringify(next, null, 2), "utf8");
}

