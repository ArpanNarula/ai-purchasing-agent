import { describe, expect, it } from "vitest";
import { evaluatePurchase } from "@/lib/policy";
import { getScenario } from "@/lib/scenarios";

function scenario(id: string) {
  const value = getScenario(id);
  if (!value) throw new Error(`Missing fixture: ${id}`);
  return value;
}

describe("purchasing policy", () => {
  it("modifies an over-sized recommendation after deducting inventory and incoming POs", () => {
    const result = evaluatePurchase(scenario("recommendation-review"));

    expect(result.decision).toBe("MODIFY");
    expect(result.targetStock).toBe(1_104);
    expect(result.incomingBeforeHorizon).toBe(300);
    expect(result.calculatedNeed).toBe(624);
    expect(result.recommendedQuantity).toBe(624);
    expect(result.approvalRequired).toBe(true);
    expect(result.checks.every((check) => check.status === "pass")).toBe(true);
  });

  it("accepts a recommendation that exactly matches net demand", () => {
    const result = evaluatePurchase(scenario("clean-accept"));

    expect(result.decision).toBe("ACCEPT");
    expect(result.calculatedNeed).toBe(800);
    expect(result.recommendedQuantity).toBe(800);
  });

  it("caps a needed purchase at the executable budget and storage capacity", () => {
    const result = evaluatePurchase(scenario("hard-constraint"));

    expect(result.decision).toBe("MODIFY");
    expect(result.calculatedNeed).toBe(1_080);
    expect(result.recommendedQuantity).toBe(528);
    expect(result.projectedCost).toBe(4_224);
    expect(result.risk).toBe("high");
  });

  it("investigates rather than buying from low-confidence stale evidence", () => {
    const result = evaluatePurchase(scenario("missing-evidence"));

    expect(result.decision).toBe("INVESTIGATE");
    expect(result.recommendedQuantity).toBe(0);
    expect(result.approvalRequired).toBe(false);
    expect(result.checks[0].status).toBe("warning");
  });
});
