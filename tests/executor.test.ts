import { beforeEach, describe, expect, it } from "vitest";
import { runAgent } from "@/lib/agent";
import { executeRun } from "@/lib/executor";
import { resetStore } from "@/lib/store";

describe("action and validation loop", () => {
  beforeEach(() => {
    resetStore();
    process.env.AGENT_MODE = "demo";
  });

  it("detects a partial confirmation and recovers through an alternate supplier", async () => {
    const run = await runAgent("recommendation-review");
    const result = executeRun(run.id);

    expect(result.status).toBe("recovered");
    expect(result.purchaseOrders).toHaveLength(2);
    expect(result.purchaseOrders[0].requestedQuantity).toBe(624);
    expect(result.purchaseOrders[0].confirmedQuantity).toBe(250);
    expect(result.purchaseOrders[1].confirmedQuantity).toBe(384);
    expect(result.totalConfirmed).toBe(634);
    expect(result.totalConfirmed).toBeGreaterThanOrEqual(result.targetQuantity);
    const committedCost = result.purchaseOrders.reduce(
      (sum, order) => sum + order.confirmedQuantity * order.unitCost,
      0,
    );
    expect(committedCost).toBeLessThanOrEqual(run.decision.projectedCost * 1.05);
    expect(result.trace.some((event) => event.phase === "validate" && event.status === "warning")).toBe(true);
    expect(result.trace.at(-1)?.title).toBe("Combined outcome validated");
  });

  it("validates a fully confirmed order without unnecessary recovery", async () => {
    const run = await runAgent("clean-accept");
    const result = executeRun(run.id);

    expect(result.status).toBe("validated");
    expect(result.purchaseOrders).toHaveLength(1);
    expect(result.totalConfirmed).toBe(800);
  });
});
