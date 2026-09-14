import { NextResponse } from "next/server";
import { scenarios } from "@/lib/scenarios";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ scenarios });
}
