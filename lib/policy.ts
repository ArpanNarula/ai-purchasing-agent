import {
  ConstraintCheck,
  PolicyDecision,
  PurchasingScenario,
} from "./types";

export function roundUpToPack(quantity: number, pack: number) {
  if (quantity <= 0) return 0;
  return Math.ceil(quantity / pack) * pack;
}

function roundDownToPack(quantity: number, pack: number) {
  if (quantity <= 0) return 0;
  return Math.floor(quantity / pack) * pack;
}

export function evaluatePurchase(scenario: PurchasingScenario): PolicyDecision {
  const { forecast, constraints, primarySupplier, recommendation } = scenario;
  const incomingBeforeHorizon = scenario.openPurchaseOrders
    .filter((po) => po.status === "confirmed")
    .reduce((sum, po) => sum + po.quantity, 0);

  const targetStock = forecast.dailyUnits * forecast.horizonDays + forecast.safetyStock;
  const rawNeed = Math.max(
    0,
    targetStock - scenario.inventory.usable - incomingBeforeHorizon,
  );
  const calculatedNeed = roundUpToPack(rawNeed, primarySupplier.casePack);
  const budgetCapacity = roundDownToPack(
    constraints.availableBudget / primarySupplier.unitCost,
    primarySupplier.casePack,
  );
  const storageCapacity = roundDownToPack(
    constraints.availableStorageUnits,
    primarySupplier.casePack,
  );
  const supplierCapacity = roundDownToPack(
    primarySupplier.availableCapacity,
    primarySupplier.casePack,
  );
  const executableCapacity = Math.min(
    budgetCapacity,
    storageCapacity,
    supplierCapacity,
  );

  const evidenceIsUnsafe =
    forecast.confidence < 0.7 || Boolean(scenario.dataWarnings?.length);
  let recommendedQuantity = Math.min(calculatedNeed, executableCapacity);
  if (
    recommendedQuantity > 0 &&
    recommendedQuantity < primarySupplier.minimumOrder
  ) {
    recommendedQuantity =
      primarySupplier.minimumOrder <= executableCapacity
        ? roundUpToPack(primarySupplier.minimumOrder, primarySupplier.casePack)
        : 0;
  }

  const checks: ConstraintCheck[] = [
    {
      name: "Demand evidence",
      status: evidenceIsUnsafe ? "warning" : "pass",
      detail: evidenceIsUnsafe
        ? `${Math.round(forecast.confidence * 100)}% confidence · refresh required`
        : `${Math.round(forecast.confidence * 100)}% confidence · ${forecast.horizonDays}-day horizon`,
    },
    {
      name: "Available budget",
      status: recommendedQuantity * primarySupplier.unitCost <= constraints.availableBudget
        ? "pass"
        : "fail",
      detail: `$${Math.round(recommendedQuantity * primarySupplier.unitCost).toLocaleString()} of $${constraints.availableBudget.toLocaleString()}`,
    },
    {
      name: "Storage capacity",
      status: recommendedQuantity <= constraints.availableStorageUnits ? "pass" : "fail",
      detail: `${recommendedQuantity.toLocaleString()} of ${constraints.availableStorageUnits.toLocaleString()} units`,
    },
    {
      name: "Supplier terms",
      status:
        recommendedQuantity === 0 ||
        (recommendedQuantity >= primarySupplier.minimumOrder &&
          recommendedQuantity % primarySupplier.casePack === 0)
          ? "pass"
          : "fail",
      detail: `MOQ ${primarySupplier.minimumOrder} · case pack ${primarySupplier.casePack}`,
    },
    {
      name: "Open PO overlap",
      status: "pass",
      detail: `${incomingBeforeHorizon.toLocaleString()} incoming units deducted from need`,
    },
  ];

  let decision: PolicyDecision["decision"];
  if (evidenceIsUnsafe) {
    decision = "INVESTIGATE";
    recommendedQuantity = 0;
  } else if (calculatedNeed === 0) {
    decision = "REJECT";
  } else if (recommendedQuantity === 0) {
    decision = "REJECT";
  } else if (recommendedQuantity === recommendation.quantity) {
    decision = "ACCEPT";
  } else {
    decision = "MODIFY";
  }

  const projectedCost = recommendedQuantity * primarySupplier.unitCost;
  const projectedInventory =
    scenario.inventory.usable + incomingBeforeHorizon + recommendedQuantity;
  const projectedCoverageDays =
    forecast.dailyUnits > 0 ? projectedInventory / forecast.dailyUnits : 0;
  const constrained = executableCapacity < calculatedNeed;
  const confidence = evidenceIsUnsafe
    ? forecast.confidence
    : constrained
      ? Math.min(forecast.confidence, 0.84)
      : Math.min(0.98, forecast.confidence + 0.03);

  const reasons = evidenceIsUnsafe
    ? [
        "The demand signal does not meet the autonomy threshold.",
        ...(scenario.dataWarnings ?? []),
        "Refresh the forecast before committing purchasing budget.",
      ]
    : [
        `Demand plus safety stock requires ${calculatedNeed.toLocaleString()} net units after inventory and open orders.`,
        recommendation.quantity === recommendedQuantity
          ? "The original recommendation matches the policy quantity."
          : `The original ${recommendation.quantity}-unit recommendation should be changed to ${recommendedQuantity.toLocaleString()} units.`,
        constrained
          ? `The safe quantity is capped by executable capacity of ${executableCapacity.toLocaleString()} units.`
          : `The quantity respects the ${primarySupplier.casePack}-unit case pack and ${primarySupplier.minimumOrder}-unit MOQ.`,
      ];

  const summary = evidenceIsUnsafe
    ? "Pause the purchase and refresh the forecast before deciding."
    : decision === "ACCEPT"
      ? `Accept the ${recommendedQuantity.toLocaleString()}-unit recommendation.`
      : decision === "MODIFY"
        ? `Modify the recommendation to ${recommendedQuantity.toLocaleString()} units.`
        : "Do not place an additional order at this time.";

  return {
    decision,
    recommendedQuantity,
    calculatedNeed,
    targetStock,
    incomingBeforeHorizon,
    projectedCost,
    projectedCoverageDays,
    confidence,
    risk: evidenceIsUnsafe || constrained ? "high" : projectedCost > 2_000 ? "medium" : "low",
    approvalRequired:
      recommendedQuantity > 0 && projectedCost >= constraints.approvalThreshold,
    summary,
    reasons,
    checks,
  };
}
