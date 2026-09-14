import { NextResponse } from "next/server";
import { z } from "zod";
import { executeRun } from "@/lib/executor";

const requestSchema = z.object({ runId: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const execution = executeRun(body.runId);
    return NextResponse.json({ execution });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to execute plan" },
      { status: 400 },
    );
  }
}
