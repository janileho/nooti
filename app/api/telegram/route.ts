import { NextResponse } from "next/server";
import { readInfo, writeInfo, type ShopInfo, type DayKey, type DayHours } from "@/lib/infoStore";
import { writeRepoFile } from "@/lib/githubContent";
import { revalidatePath } from "next/cache";
import { parseCommandWithAI, sendTelegramMessage, generateFriendlyReply, formatWeeklyNote } from "@/lib/ai";

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
  const isOkPrefixed = text.toLowerCase().startsWith("ok:");
  const effectiveText = isOkPrefixed ? text.slice(3).trim() : text;

  if (!text) {
    return NextResponse.json({ ok: true });
  }

  // Optional admin allowlist
  const adminIds = (process.env.TELEGRAM_ADMIN_IDS || "").trim();
  if (adminIds) {
    const ids = adminIds.split(/[,\s]+/).filter(Boolean).map((s) => Number(s));
    if (!ids.includes(Number(chatId))) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  try {
    const current = (await readInfo()) as ShopInfo;
    const cmd = await parseCommandWithAI(effectiveText, { hours: current.hours });
    let confirmation = "";
    let ack: string | null = null;

    const htmlEscape = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    const echoHtml = htmlEscape(text).slice(0, 400);
    const echoLine = `As you said: <i>“${echoHtml}”</i>`;

    switch (cmd.type) {
      case "set_hours": {
        ack = cmd.closed
          ? `Sending changes: <b>${cmd.days}</b> → closed`
          : `Sending changes: <b>${cmd.days}</b> → ${cmd.open}–${cmd.close}`;
        const other = current.hours.filter((h) => h.day !== (cmd.days as DayKey));
        const entry = cmd.closed
          ? { day: cmd.days as DayKey, closed: true as const }
          : { day: cmd.days as DayKey, open: cmd.open!, close: cmd.close!, closed: false };
        const next = { ...current, hours: [...other, entry] };
        if (isOkPrefixed || (process.env.TELEGRAM_AUTO_APPLY || "").toLowerCase() === "true") {
          await writeInfo(next);
          confirmation = cmd.closed
            ? `Hours updated: <b>${cmd.days}</b> closed`
            : `Hours updated: <b>${cmd.days}</b> ${cmd.open}–${cmd.close}`;
        } else {
          // preview only
          const summary = ((): string => {
            const order: DayHours["day"][] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
            const days = order.map((d) => next.hours.find((x) => x.day === d) || { day: d, closed: true });
            type Group = { from: DayHours["day"]; to: DayHours["day"]; closed: boolean; open?: string; close?: string };
            const groups: Group[] = [];
            const keyOf = (h: Partial<DayHours>) => (h.closed ? "closed" : `open-${h.open}-${h.close}`);
            for (const h of days) {
              const key = keyOf(h);
              const last = groups[groups.length - 1];
              if (last && keyOf(last) === key) last.to = h.day as DayHours["day"]; else groups.push({ from: h.day as DayHours["day"], to: h.day as DayHours["day"], closed: Boolean(h.closed), open: h.open, close: h.close });
            }
            const label = (g: Group) => (g.from === g.to ? g.from : `${g.from}–${g.to}`);
            return groups.map((g) => (g.closed ? `${label(g)}: Closed` : `${label(g)}: ${g.open}–${g.close}`)).join("\n");
          })();
          confirmation = `Preview:\n${summary}`;
        }
        break;
      }
      case "set_hours_bulk": {
        const expandDays = (label: string): DayKey[] => {
          if (label === "Mon–Fri") return ["Mon", "Tue", "Wed", "Thu", "Fri"];
          if (label === "Sat") return ["Sat"];
          if (label === "Sun") return ["Sun"];
          return [label as DayKey];
        };

        const merged = [...current.hours];
        ack =
          "Sending changes:" +
          cmd.entries
            .map((e) =>
              e.closed
                ? `\n• <b>${e.days}</b> → closed`
                : `\n• <b>${e.days}</b> → ${e.open}–${e.close}`
            )
            .join("");
        for (const e of cmd.entries) {
          const targets = expandDays(e.days);
          for (const day of targets) {
            const rest = merged.filter((h: DayHours) => h.day !== day);
            const item = e.closed
              ? { day, closed: true as const }
              : { day, open: e.open!, close: e.close!, closed: false };
            merged.splice(0, merged.length, ...rest, item);
          }
        }
        const next = { ...current, hours: merged };
        await writeInfo(next);
        confirmation = `Hours updated.`;
        break;
      }
      case "set_address": {
        ack = `Sending changes: address → <b>${cmd.address}, ${cmd.city}</b>`;
        const next = { ...current, address: cmd.address, city: cmd.city };
        await writeInfo(next);
        confirmation = `Address updated: <b>${cmd.address}, ${cmd.city}</b>`;
        break;
      }
      case "set_name": {
        ack = `Sending changes: name → <b>${cmd.name}</b>`;
        const next = { ...current, name: cmd.name };
        await writeInfo(next);
        confirmation = `Name updated: <b>${cmd.name}</b>`;
        break;
      }
      case "set_bg": {
        ack = `Sending changes: background → updated`;
        const next = { ...current, backgroundUrl: cmd.url };
        await writeInfo(next);
        confirmation = `Background updated.`;
        break;
      }
      case "set_note": {
        const pretty = await formatWeeklyNote(cmd.note);
        ack = `Sending changes: weekly note → ${pretty}`;
        const next = { ...current, weeklyNote: pretty };
        await writeInfo(next);
        confirmation = pretty;
        break;
      }
      case "push": {
        ack = `Sending changes: pushing current info to GitHub…`;
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

    // Send early acknowledgement (with echo)
    if (chatId && ack) {
      const ackWithEcho = `${ack}\n${echoLine}`;
      await sendTelegramMessage({
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        chatId,
        text: ackWithEcho,
      });
    }

    // Optional: trigger deploy hook if configured
    const deployHook = process.env.VERCEL_DEPLOY_HOOK_URL;
    if (deployHook) {
      try {
        await fetch(deployHook, { method: "POST" });
      } catch {
        // ignore deploy errors for chat UX
      }
    }

    // Final confirmation (with echo)
    if (chatId) {
      const tail = deployHook ? "\nThe updates should be deployed now." : "";
      const finalWithEcho = `${confirmation}\n${echoLine}${tail}`;
      await sendTelegramMessage({
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        chatId,
        text: finalWithEcho,
      });
    }
  } catch (e) {
    console.error(e);
  }

  return NextResponse.json({ ok: true });
}

