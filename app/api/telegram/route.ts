import { NextResponse } from "next/server";
import { readInfo, writeInfo, type ShopInfo } from "@/lib/infoStore";
import { writeRepoFile } from "@/lib/githubContent";
import { revalidatePath } from "next/cache";

// Simple Telegram bot webhook handler
// Expects messages like: "set hours Mon–Fri 09:00-19:00" or "set address 45 Vinyl Ave, Helsinki"

function isAuthorized(req: Request): boolean {
  const token = process.env.TELEGRAM_WEBHOOK_SECRET;
  const provided = new URL(req.url).searchParams.get("secret");
  return Boolean(token && provided && token === provided);
}

type Update = {
  message?: {
    text?: string;
    chat?: { id: number };
  };
};

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const update = (await req.json()) as Update;
  const text = update.message?.text?.trim() || "";

  if (!text) {
    return NextResponse.json({ ok: true });
  }

  // Basic command parsing
  // Supported:
  // - set hours <days> <open>-<close>
  // - set address <address>, <city>
  // - set name <name>
  // - set bg <url>
  // - push (commit current data/info.json to GitHub)
  try {
    const current = (await readInfo()) as ShopInfo;

    const lower = text.toLowerCase();

    if (lower.startsWith("set hours ")) {
      // Example: set hours Mon–Fri 09:00-19:00
      const rest = text.slice("set hours ".length).trim();
      const match = /^(.+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/u.exec(rest);
      if (match) {
        const [, days, open, close] = match;
        const other = current.hours.filter((h) => h.days !== days);
        const next = { ...current, hours: [...other, { days, open, close }] };
        await writeInfo(next);
      }
    } else if (lower.startsWith("set address ")) {
      const rest = text.slice("set address ".length).trim();
      const parts = rest.split(",");
      const address = parts[0]?.trim() || current.address;
      const city = (parts[1] || current.city).trim();
      const next = { ...current, address, city };
      await writeInfo(next);
    } else if (lower.startsWith("set name ")) {
      const name = text.slice("set name ".length).trim();
      const next = { ...current, name };
      await writeInfo(next);
    } else if (lower.startsWith("set bg ")) {
      const backgroundUrl = text.slice("set bg ".length).trim();
      const next = { ...current, backgroundUrl };
      await writeInfo(next);
    } else if (lower === "push") {
      // Commit the current data/info.json to GitHub to record the change
      const owner = process.env.GITHUB_OWNER || "janileho";
      const repo = process.env.GITHUB_REPO || "nooti";
      const branch = process.env.GITHUB_BRANCH || "main";
      const token = process.env.GITHUB_TOKEN || "";

      if (!token) {
        console.warn("Missing GITHUB_TOKEN; cannot push");
      } else {
        const content = JSON.stringify(await readInfo(), null, 2);
        await writeRepoFile({
          owner,
          repo,
          branch,
          token,
          path: "web/data/info.json",
          message: `chore: update hours/location via Telegram ${new Date().toISOString()}`,
          content,
        });
      }
    }
    revalidatePath("/");
  } catch (e) {
    console.error(e);
  }

  return NextResponse.json({ ok: true });
}

