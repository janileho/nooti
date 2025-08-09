import OpenAI from "openai";

export type ParsedCommand =
  | { type: "set_hours"; days: string; open: string; close: string }
  | { type: "set_address"; address: string; city: string }
  | { type: "set_name"; name: string }
  | { type: "set_bg"; url: string }
  | { type: "push" }
  | { type: "unknown" };

const system = `You convert short cafe owner messages into one structured command.
Return ONLY JSON matching one of these shapes:
{"type":"set_hours","days":"Mon–Fri","open":"09:00","close":"19:00"}
{"type":"set_address","address":"45 Vinyl Ave","city":"Helsinki"}
{"type":"set_name","name":"Nooti Coffee"}
{"type":"set_bg","url":"https://..."}
{"type":"push"}
If the user message isn't about these, return {"type":"unknown"}.`;

export async function parseCommandWithAI(message: string): Promise<ParsedCommand> {
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

