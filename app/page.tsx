import Image from "next/image";
export const dynamic = "force-dynamic";
import { readInfo, type ShopInfo, type DayHours } from "@/lib/infoStore";

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

async function getInfo(): Promise<ShopInfo> {
  try {
    return await readInfo();
  } catch {
    return {
      name: "Nöösi",
      address: "Satakunnankatu 7",
      city: "Tampere",
      hours: [
        { day: "Mon", open: "08:00", close: "18:00", closed: false },
        { day: "Tue", open: "08:00", close: "18:00", closed: false },
        { day: "Wed", open: "08:00", close: "18:00", closed: false },
        { day: "Thu", open: "08:00", close: "18:00", closed: false },
        { day: "Fri", open: "08:00", close: "18:00", closed: false },
        { day: "Sat", open: "09:00", close: "17:00", closed: false },
        { day: "Sun", open: "10:00", close: "16:00", closed: false },
      ],
      backgroundUrl: "/bg.jpg",
    };
  }
}

export default async function Home() {
  const info = await getInfo();
  return (
    <div className="relative min-h-dvh w-full">
      <div className="absolute inset-0 -z-10">
        <Image
          src="/cafe-noosi.jpg"
          alt="Warm retro coffee texture"
          fill
          priority
          className="object-cover opacity-70"
        />
        <div className="grainy-overlay absolute inset-0 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/60" />
      </div>

      <main className="flex min-h-dvh items-center justify-center p-6 sm:p-10 enter-fade">
        <div className="retro-panel panel-art sharp-panel px-6 py-7 sm:px-10 sm:py-10 max-w-xl w-full enter-rise">
          <h1 className="retro-title metallic-text text-4xl sm:text-5xl md:text-6xl enter-rise">
            {info.name}
          </h1>
          <p className="mt-2 text-sm tracking-wide text-[var(--foreground)]/85">
            {info.address}, {info.city}
          </p>

          <div className="mt-6 pt-6">
            <div className="hairline" />
            <h2 className="label-bauhaus uppercase tracking-widest text-xs text-[var(--accent-2)]">
              Opening Hours
            </h2>
            <ul className="mt-3 space-y-2 stagger-list thin-list">
              {(() => {
                const order: DayHours["day"][] = [
                  "Mon",
                  "Tue",
                  "Wed",
                  "Thu",
                  "Fri",
                  "Sat",
                  "Sun",
                ];
                const days = order.map((d) => info.hours.find((x) => x.day === d) || { day: d, closed: true });

                type Group = { from: DayHours["day"]; to: DayHours["day"]; key: string; closed: boolean; open?: string; close?: string };
                const groups: Group[] = [];
                const makeKey = (h: Partial<DayHours>) => (h.closed ? "closed" : `open-${h.open}-${h.close}`);

                for (const h of days) {
                  const key = makeKey(h);
                  if (groups.length === 0) {
                    groups.push({ from: h.day as DayHours["day"], to: h.day as DayHours["day"], key, closed: Boolean(h.closed), open: h.open, close: h.close });
                  } else {
                    const last = groups[groups.length - 1];
                    if (last.key === key) {
                      last.to = h.day as DayHours["day"];
                    } else {
                      groups.push({ from: h.day as DayHours["day"], to: h.day as DayHours["day"], key, closed: Boolean(h.closed), open: h.open, close: h.close });
                    }
                  }
                }

                const label = (g: Group) => (g.from === g.to ? g.from : `${g.from}–${g.to}`);

                return groups.map((g) => (
                  <li key={`${g.from}-${g.to}-${g.key}`} className="flex items-center justify-between text-[15px]">
                    <span className="text-[var(--foreground)]/92">{label(g)}</span>
                    {g.closed ? (
                      <span className="uppercase tracking-widest text-[var(--foreground)]/70">Closed</span>
                    ) : (
                      <span className="tabular-nums text-[var(--foreground)]/92">{g.open} – {g.close}</span>
                    )}
                  </li>
                ));
              })()}
            </ul>
          </div>

          {info.weeklyNote ? (
            <div className="mt-6 pt-5 text-sm text-[var(--foreground)]/85">
              <div className="hairline mb-3" />
              <p style={{ whiteSpace: "pre-wrap" }}>{info.weeklyNote}</p>
            </div>
          ) : null}

          <div className="mt-8 flex items-center gap-3 text-xs text-[var(--foreground)]/70 copy-future">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_8px_rgba(226,183,20,0.5)]" />
          </div>
        </div>
      </main>
    </div>
  );
}
