import { NextResponse } from "next/server";
import { readInfo, writeInfo, type ShopInfo } from "@/lib/infoStore";
import { writeRepoFile } from "@/lib/githubContent";
import { revalidatePath } from "next/cache";
import { parseCommandWithAI, sendTelegramMessage, generateFriendlyReply } from "@/lib/ai";

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
  const chatId = update.message?.chat?.id;
  const text = update.message?.text?.trim() || "";

  if (!text) {
    return NextResponse.json({ ok: true });
  }

  try {
    const current = (await readInfo()) as ShopInfo;
    const cmd = await parseCommandWithAI(text, { hours: current.hours });
    let confirmation = "";

    switch (cmd.type) {
      case "set_hours": {
        const other = current.hours.filter((h) => h.days !== cmd.days);
        const next = { ...current, hours: [...other, { days: cmd.days, open: cmd.open, close: cmd.close }] };
        await writeInfo(next);
        confirmation = `Hours updated: <b>${cmd.days}</b> ${cmd.open}–${cmd.close}`;
        break;
      }
      case "set_hours_bulk": {
        const labels = new Set(["Mon–Fri", "Sat", "Sun"]);
        const filtered = current.hours.filter((h) => !labels.has(h.days));
        const merged = [...filtered];
        for (const e of cmd.entries) {
          const rest = merged.filter((h) => h.days !== e.days);
          merged.splice(0, merged.length, ...rest, { days: e.days, open: e.open, close: e.close });
        }
        const next = { ...current, hours: merged };
        await writeInfo(next);
        confirmation = `Hours updated.`;
        break;
      }
      case "set_address": {
        const next = { ...current, address: cmd.address, city: cmd.city };
        await writeInfo(next);
        confirmation = `Address updated: <b>${cmd.address}, ${cmd.city}</b>`;
        break;
      }
      case "set_name": {
        const next = { ...current, name: cmd.name };
        await writeInfo(next);
        confirmation = `Name updated: <b>${cmd.name}</b>`;
        break;
      }
      case "set_bg": {
        const next = { ...current, backgroundUrl: cmd.url };
        await writeInfo(next);
        confirmation = `Background updated.`;
        break;
      }
      case "push": {
        const owner = process.env.GITHUB_OWNER || "janileho";
        const repo = process.env.GITHUB_REPO || "nooti";
        const branch = process.env.GITHUB_BRANCH || "main";
        const token = process.env.GITHUB_TOKEN || "";
        if (!token) {
          confirmation = `Cannot push: missing GITHUB_TOKEN.`;
        } else {
          const content = JSON.stringify(await readInfo(), null, 2);
          await writeRepoFile({
            owner,
            repo,
            branch,
            token,
            path: "web/data/info.json",
            message: `chore: update via Telegram ${new Date().toISOString()}`,
            content,
          });
          confirmation = `Changes pushed to <b>${owner}/${repo}</b> on <b>${branch}</b>.`;
        }
        break;
      }
      default: {
        confirmation = await generateFriendlyReply(text);
      }
    }

    revalidatePath("/");

    if (chatId) {
      await sendTelegramMessage({
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        chatId,
        text: confirmation,
      });
    }
  } catch (e) {
    console.error(e);
  }

  return NextResponse.json({ ok: true });
}

