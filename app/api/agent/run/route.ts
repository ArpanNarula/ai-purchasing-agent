import { NextResponse } from "next/server";
import { z } from "zod";
import { runAgent } from "@/lib/agent";

const requestSchema = z.object({ scenarioId: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const run = await runAgent(body.scenarioId);
    return NextResponse.json({ run });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to run agent" },
      { status: 400 },
    );
  }
}
