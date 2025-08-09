import OpenAI from "openai";

export type ParsedCommand =
  | { type: "set_hours"; days: string; open?: string; close?: string; closed?: boolean }
  | { type: "set_hours_bulk"; entries: { days: "Mon–Fri" | "Sat" | "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri"; open?: string; close?: string; closed?: boolean }[] }
  | { type: "set_address"; address: string; city: string }
  | { type: "set_name"; name: string }
  | { type: "set_bg"; url: string }
  | { type: "push" }
  | { type: "unknown" };

const system = `You convert short cafe owner messages into a structured command for opening hours, address, name, or background.
Strictly output ONLY JSON for one of these shapes:
{"type":"set_hours","days":"Mon–Fri","open":"09:00","close":"19:00"}
{"type":"set_hours","days":"Mon–Fri","closed":true}
{"type":"set_hours_bulk","entries":[{"days":"Mon–Fri","open":"09:00","close":"19:00"},{"days":"Sat","open":"10:00","close":"17:00"},{"days":"Sun","closed":true}]}
{"type":"set_address","address":"45 Vinyl Ave","city":"Helsinki"}
{"type":"set_name","name":"Nooti Coffee"}
{"type":"set_bg","url":"https://..."}
{"type":"push"}
Rules:
- Allowed days labels ONLY: "Mon–Fri", "Sat", "Sun".
- When the user describes multiple day groups, use set_hours_bulk.
- Accept flexible phrasing like "weekdays", "weekends" → map to Mon–Fri and Sat/Sun respectively.
- If the user says a group is not open / closed, set {"closed": true} and omit open/close.
- Accept 24h time with colon. If user says "an hour later on weekdays", and current hours are provided, adjust accordingly; otherwise infer reasonable times and prefer set_hours over unknown.
- If nothing matches, return {"type":"unknown"}.`;

export async function parseCommandWithAI(
  message: string,
  context?: { hours?: { days: string; open?: string; close?: string; closed?: boolean }[] }
): Promise<ParsedCommand> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Fallback: very light local heuristics when no API key
    const lower = message.toLowerCase();
    if (lower.startsWith("set hours ")) {
      const rest = message.slice("set hours ".length).trim();
      const m = /^(.+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/u.exec(rest);
      if (m) return { type: "set_hours", days: m[1], open: m[2], close: m[3] };
    } else if (lower.startsWith("set address ")) {
      const rest = message.slice("set address ".length).trim();
      const [address, cityRaw] = rest.split(",");
      return { type: "set_address", address: address?.trim() || "", city: (cityRaw || "").trim() };
    } else if (lower.startsWith("set name ")) {
      return { type: "set_name", name: message.slice("set name ".length).trim() };
    } else if (lower.startsWith("set bg ")) {
      return { type: "set_bg", url: message.slice("set bg ".length).trim() };
    } else if (lower === "push") {
      return { type: "push" };
    }
    return { type: "unknown" };
  }

  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: system },
      ...(context?.hours
        ? [{ role: "system", content: `Current hours: ${JSON.stringify(context.hours)}` } as const]
        : []),
      { role: "user", content: message },
    ],
    response_format: { type: "json_object" },
  });
  const content = completion.choices[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(content) as ParsedCommand;
    return parsed;
  } catch {
    return { type: "unknown" };
  }
}

export async function sendTelegramMessage(opts: { botToken?: string; chatId: number; text: string }) {
  if (!opts.botToken) return;
  const url = `https://api.telegram.org/bot${opts.botToken}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: opts.chatId,
      text: opts.text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
}

export async function generateFriendlyReply(message: string, context?: { name?: string; city?: string }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return `I’m here. I couldn’t map that to a command. Try: “set hours Mon–Fri 09:00-19:00”, “set address 45 Vinyl Ave, Helsinki”, “set name Nooti Coffee”, “set bg https://…”, or “push”.`;
  }
  const client = new OpenAI({ apiKey });
  const sys = `You are a concise barista-bot. You respond in one or two short sentences, friendly and clear. If asked to change hours or address, suggest the exact command format, but do not invent facts.`;
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: message },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() || "Got it.";
}

