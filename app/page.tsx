import Image from "next/image";
export const dynamic = "force-dynamic";
import { readInfo, type ShopInfo } from "@/lib/infoStore";

async function getInfo(): Promise<ShopInfo> {
  try {
    return await readInfo();
  } catch {
    return {
      name: "Nooti Coffee",
      address: "123 Groove St",
      city: "Helsinki",
      hours: [
        { days: "Mon–Fri", open: "08:00", close: "18:00" },
        { days: "Sat", open: "09:00", close: "17:00" },
        { days: "Sun", open: "10:00", close: "16:00" },
      ],
      backgroundUrl:
        "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=1600&q=60",
    };
  }
}

export default async function Home() {
  const info = await getInfo();
  return (
    <div className="relative min-h-dvh w-full">
      <div className="absolute inset-0 -z-10">
        <Image
          src={
            info.backgroundUrl ||
            "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=1600&q=60"
          }
          alt="Warm retro coffee texture"
          fill
          priority
          className="object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/60" />
      </div>

      <main className="flex min-h-dvh items-center justify-center p-6 sm:p-10">
        <div className="retro-panel rounded-xl px-6 py-7 sm:px-10 sm:py-10 max-w-xl w-full shadow-2xl/40 shadow-black/50">
          <h1 className="retro-title text-4xl sm:text-5xl md:text-6xl text-[var(--accent)] drop-shadow-[0_2px_0_rgba(0,0,0,0.35)]">
            {info.name}
          </h1>
          <p className="mt-2 text-sm tracking-wide text-[var(--foreground)]/85">
            {info.address}, {info.city}
          </p>

          <div className="mt-6 border-t border-[var(--foreground)]/20 pt-6">
            <h2 className="font-semibold uppercase tracking-widest text-xs text-[var(--accent-2)]">
              Opening Hours
            </h2>
            <ul className="mt-3 space-y-2">
              {info.hours.map((h) => (
                <li key={h.days} className="flex items-center justify-between text-[15px]">
                  <span className="text-[var(--foreground)]/92">{h.days}</span>
                  {h.closed ? (
                    <span className="uppercase tracking-widest text-[var(--foreground)]/70">Closed</span>
                  ) : (
                    <span className="tabular-nums text-[var(--foreground)]/92">
                      {h.open} – {h.close}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 flex items-center gap-3 text-xs text-[var(--foreground)]/70">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
            <span>Est. 1969 • Vinyl, crema, conversation</span>
          </div>
        </div>
      </main>
    </div>
  );
}
