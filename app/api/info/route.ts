import { NextResponse } from "next/server";
import { readInfo, writeInfo } from "@/lib/infoStore";

export async function GET() {
  const data = await readInfo();
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  const next = {
    name: body.name,
    address: body.address,
    city: body.city,
    hours: body.hours,
    backgroundUrl:
      body.backgroundUrl ||
      "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=1600&q=60",
  };
  await writeInfo(next);
  return NextResponse.json({ ok: true });
}

