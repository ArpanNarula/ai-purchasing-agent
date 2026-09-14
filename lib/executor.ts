import { evaluatePurchase, roundUpToPack } from "./policy";
import { getScenario } from "./scenarios";
import { store } from "./store";
import {
  AgentTraceStep,
  ExecutionResult,
  PurchaseOrder,
  SupplierTerms,
} from "./types";

function step(
  phase: AgentTraceStep["phase"],
  title: string,
  detail: string,
  status: AgentTraceStep["status"] = "complete",
  tool?: string,
): AgentTraceStep {
  return {
    id: crypto.randomUUID(),
    phase,
    title,
    detail,
    status,
    tool,
    timestamp: new Date().toISOString(),
  };
}

function createMockPurchaseOrder(
  productId: string,
  supplier: SupplierTerms,
  requestedQuantity: number,
): PurchaseOrder {
  const confirmedQuantity = Math.min(
    requestedQuantity,
    supplier.confirmationLimit ?? supplier.availableCapacity,
  );
  const order: PurchaseOrder = {
    id: `PO-${Math.floor(10_000 + Math.random() * 89_999)}`,
    supplierId: supplier.id,
    supplierName: supplier.name,
    productId,
    requestedQuantity,
    confirmedQuantity,
    unitCost: supplier.unitCost,
    status:
      confirmedQuantity === requestedQuantity
        ? "confirmed"
        : confirmedQuantity > 0
          ? "partially_confirmed"
          : "rejected",
    createdAt: new Date().toISOString(),
  };
  store.purchaseOrders.push(order);
  return order;
}

export function executeRun(runId: string): ExecutionResult {
  const existing = store.executions.get(runId);
  if (existing) return existing;

  const run = store.runs.get(runId);
  if (!run) throw new Error("Agent run not found");
  const scenario = getScenario(run.scenarioId);
  if (!scenario) throw new Error("Scenario not found");

  const latestDecision = evaluatePurchase(scenario);
  const executionTrace: AgentTraceStep[] = [
    step(
      "guardrail",
      "Pre-flight data revalidated",
      "Inventory, open POs, budget, storage, and supplier terms were re-read immediately before the write.",
      "complete",
      "revalidate_purchase_plan",
    ),
  ];

  if (
    latestDecision.decision === "INVESTIGATE" ||
    latestDecision.decision === "REJECT" ||
    latestDecision.recommendedQuantity !== run.decision.recommendedQuantity
  ) {
    const blocked: ExecutionResult = {
      runId,
      status: "blocked",
      headline: "Execution stopped by pre-flight validation",
      detail: "The current policy result no longer matches the approved plan.",
      purchaseOrders: [],
      totalConfirmed: 0,
      targetQuantity: run.decision.recommendedQuantity,
      trace: [
        ...executionTrace,
        step(
          "validate",
          "Approved plan is no longer safe",
          "No external write was made. The case has been returned to the buyer.",
          "blocked",
        ),
      ],
    };
    store.executions.set(runId, blocked);
    return blocked;
  }

  const primary = createMockPurchaseOrder(
    scenario.recommendation.productId,
    scenario.primarySupplier,
    latestDecision.recommendedQuantity,
  );
  executionTrace.push(
    step(
      "act",
      `${primary.id} sent to ${primary.supplierName}`,
      `Requested ${primary.requestedQuantity} units at $${primary.unitCost.toFixed(2)} each.`,
      "complete",
      "create_purchase_order",
    ),
  );

  if (primary.confirmedQuantity === primary.requestedQuantity) {
    executionTrace.push(
      step(
        "validate",
        "Purchase order independently verified",
        `The supplier confirmed all ${primary.confirmedQuantity} units and the persisted PO matches the approved plan.`,
        "complete",
        "get_purchase_order",
      ),
    );
    const result: ExecutionResult = {
      runId,
      status: "validated",
      headline: "Order placed and validated",
      detail: `${primary.confirmedQuantity} units are confirmed with ${primary.supplierName}.`,
      purchaseOrders: [primary],
      totalConfirmed: primary.confirmedQuantity,
      targetQuantity: latestDecision.recommendedQuantity,
      trace: executionTrace,
    };
    store.executions.set(runId, result);
    run.status = "completed";
    return result;
  }

  const shortfall = primary.requestedQuantity - primary.confirmedQuantity;
  executionTrace.push(
    step(
      "validate",
      "Supplier response did not match the action",
      `${primary.supplierName} confirmed only ${primary.confirmedQuantity} of ${primary.requestedQuantity} units. Shortfall: ${shortfall}.`,
      "warning",
      "validate_purchase_order",
    ),
  );

  const alternate = scenario.alternateSuppliers
    .filter((supplier) => supplier.availableCapacity >= supplier.minimumOrder)
    .sort((a, b) => b.reliability - a.reliability)[0];

  if (!alternate) {
    const escalated: ExecutionResult = {
      runId,
      status: "escalated",
      headline: "Supplier shortfall requires buyer attention",
      detail: `No qualified alternate can safely cover the ${shortfall}-unit shortfall.`,
      purchaseOrders: [primary],
      totalConfirmed: primary.confirmedQuantity,
      targetQuantity: latestDecision.recommendedQuantity,
      trace: [
        ...executionTrace,
        step(
          "recover",
          "Recovery escalated",
          "No alternate passed capacity and supplier-term checks.",
          "blocked",
          "find_alternate_supplier",
        ),
      ],
    };
    store.executions.set(runId, escalated);
    return escalated;
  }

  let recoveryQuantity = Math.max(
    alternate.minimumOrder,
    roundUpToPack(shortfall, alternate.casePack),
  );
  recoveryQuantity = Math.min(recoveryQuantity, alternate.availableCapacity);
  const committedCost = primary.confirmedQuantity * primary.unitCost;
  const remainingBudget = scenario.constraints.availableBudget - committedCost;
  const approvedSpendCeiling = latestDecision.projectedCost * 1.05;
  const remainingStorage =
    scenario.constraints.availableStorageUnits - primary.confirmedQuantity;
  const recoveryIsSafe =
    recoveryQuantity >= shortfall &&
    recoveryQuantity * alternate.unitCost <= remainingBudget &&
    committedCost + recoveryQuantity * alternate.unitCost <= approvedSpendCeiling &&
    recoveryQuantity <= remainingStorage &&
    recoveryQuantity % alternate.casePack === 0;

  if (!recoveryIsSafe) {
    const escalated: ExecutionResult = {
      runId,
      status: "escalated",
      headline: "Recovery plan exceeds a purchasing guardrail",
      detail: "The alternate supplier cannot cover the shortfall within budget, storage, or the 5% approved spend tolerance.",
      purchaseOrders: [primary],
      totalConfirmed: primary.confirmedQuantity,
      targetQuantity: latestDecision.recommendedQuantity,
      trace: [
        ...executionTrace,
        step(
          "recover",
          "Alternate order blocked",
          "The recovery quantity failed budget, storage, capacity, or pack-size validation.",
          "blocked",
          "validate_recovery_plan",
        ),
      ],
    };
    store.executions.set(runId, escalated);
    return escalated;
  }

  executionTrace.push(
    step(
      "recover",
      `${alternate.name} selected for recovery`,
      `${alternate.leadTimeDays}-day lead time · ${Math.round(alternate.reliability * 100)}% reliability · ${recoveryQuantity} units after case-pack rounding.`,
      "complete",
      "find_alternate_supplier",
    ),
  );
  const secondary = createMockPurchaseOrder(
    scenario.recommendation.productId,
    alternate,
    recoveryQuantity,
  );
  const totalConfirmed = primary.confirmedQuantity + secondary.confirmedQuantity;
  executionTrace.push(
    step(
      "act",
      `${secondary.id} sent to ${secondary.supplierName}`,
      `Recovery order requested and confirmed for ${secondary.confirmedQuantity} units.`,
      "complete",
      "create_recovery_purchase_order",
    ),
    step(
      "validate",
      "Combined outcome validated",
      `${totalConfirmed} units confirmed across two suppliers, covering the ${latestDecision.recommendedQuantity}-unit target with ${totalConfirmed - latestDecision.recommendedQuantity} units of pack rounding.`,
      "complete",
      "validate_combined_coverage",
    ),
  );

  const recovered: ExecutionResult = {
    runId,
    status: "recovered",
    headline: "Supplier shortfall recovered automatically",
    detail: `${primary.confirmedQuantity} units were retained with ${primary.supplierName}; ${secondary.confirmedQuantity} were confirmed with ${secondary.supplierName}.`,
    purchaseOrders: [primary, secondary],
    totalConfirmed,
    targetQuantity: latestDecision.recommendedQuantity,
    trace: executionTrace,
  };
  store.executions.set(runId, recovered);
  run.status = "completed";
  return recovered;
}
