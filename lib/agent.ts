import OpenAI from "openai";
import { evaluatePurchase } from "./policy";
import { getScenario } from "./scenarios";
import { store } from "./store";
import { AgentRun, AgentTraceStep, PurchasingScenario } from "./types";

function trace(
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

function deterministicInvestigation(scenario: PurchasingScenario) {
  const incoming = scenario.openPurchaseOrders.reduce(
    (sum, po) => sum + po.quantity,
    0,
  );

  return [
    trace(
      "investigate",
      "Inventory inspected",
      `${scenario.inventory.onHand} on hand − ${scenario.inventory.reserved} reserved = ${scenario.inventory.usable} usable units.`,
      "complete",
      "get_inventory",
    ),
    trace(
      "investigate",
      "Demand evidence checked",
      `${scenario.forecast.dailyUnits} units/day over ${scenario.forecast.horizonDays} days with ${scenario.forecast.safetyStock} units of safety stock.`,
      scenario.forecast.confidence < 0.7 ? "warning" : "complete",
      "get_demand_forecast",
    ),
    trace(
      "investigate",
      "Open orders reconciled",
      `${scenario.openPurchaseOrders.length} open PO${scenario.openPurchaseOrders.length === 1 ? "" : "s"} contribute ${incoming} incoming units.`,
      "complete",
      "list_open_purchase_orders",
    ),
    trace(
      "investigate",
      "Supplier terms loaded",
      `${scenario.primarySupplier.name}: ${scenario.primarySupplier.leadTimeDays}-day lead time, MOQ ${scenario.primarySupplier.minimumOrder}, case pack ${scenario.primarySupplier.casePack}.`,
      "complete",
      "get_supplier_terms",
    ),
    trace(
      "investigate",
      "Budget and storage checked",
      `$${scenario.constraints.availableBudget.toLocaleString()} budget and ${scenario.constraints.availableStorageUnits.toLocaleString()} storage units available.`,
      "complete",
      "get_purchasing_constraints",
    ),
  ];
}

const tools = [
  {
    type: "function",
    name: "get_inventory",
    description: "Get current on-hand, reserved, and usable inventory.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_demand_forecast",
    description: "Get expected daily demand, horizon, safety stock, freshness, and confidence.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "list_open_purchase_orders",
    description: "List incoming purchase orders that may already cover demand.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_supplier_terms",
    description: "Get lead time, MOQ, case pack, cost, capacity, and reliability.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_purchasing_constraints",
    description: "Get available budget, storage capacity, and approval threshold.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "calculate_purchase_plan",
    description:
      "Run the authoritative quantity and constraint policy after gathering evidence.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "submit_recommendation",
    description: "Submit the agent's proposed decision for policy validation.",
    parameters: {
      type: "object",
      properties: {
        decision: {
          type: "string",
          enum: ["ACCEPT", "MODIFY", "REJECT", "INVESTIGATE"],
        },
        quantity: { type: "number" },
        rationale: { type: "string" },
      },
      required: ["decision", "quantity", "rationale"],
      additionalProperties: false,
    },
    strict: true,
  },
];

function toolResult(name: string, scenario: PurchasingScenario) {
  switch (name) {
    case "get_inventory":
      return scenario.inventory;
    case "get_demand_forecast":
      return scenario.forecast;
    case "list_open_purchase_orders":
      return scenario.openPurchaseOrders;
    case "get_supplier_terms":
      return {
        primary: scenario.primarySupplier,
        alternates: scenario.alternateSuppliers,
      };
    case "get_purchasing_constraints":
      return scenario.constraints;
    case "calculate_purchase_plan":
      return evaluatePurchase(scenario);
    default:
      return { acknowledged: true };
  }
}

async function openAIInvestigation(scenario: PurchasingScenario) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const input: unknown[] = [
    {
      role: "user",
      content: `Review purchasing scenario ${scenario.id}. The purchasing system recommends ${scenario.recommendation.quantity} units for ${scenario.recommendation.sku} at ${scenario.recommendation.nodeId}.`,
    },
  ];
  const agentTrace: AgentTraceStep[] = [];
  let proposed: { decision: string; quantity: number } | null = null;

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const response = (await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
      instructions:
        "You are a cautious purchasing agent. Gather inventory, demand, open PO, supplier, and constraint evidence using tools. Then call calculate_purchase_plan. Never do arithmetic yourself. Finally call submit_recommendation with the policy result. Missing or stale evidence must lead to INVESTIGATE.",
      input: input as never,
      tools: tools as never,
      tool_choice: "auto",
      parallel_tool_calls: false,
      store: false,
    })) as unknown as {
      output: Array<{
        type: string;
        call_id?: string;
        name?: string;
        arguments?: string;
      }>;
    };

    input.push(...response.output);
    const calls = response.output.filter((item) => item.type === "function_call");
    if (calls.length === 0) break;

    for (const call of calls) {
      const name = call.name ?? "unknown_tool";
      const result = toolResult(name, scenario);
      if (name === "submit_recommendation") {
        const args = JSON.parse(call.arguments ?? "{}") as {
          decision?: string;
          quantity?: number;
        };
        proposed = {
          decision: args.decision ?? "INVESTIGATE",
          quantity: args.quantity ?? 0,
        };
      } else {
        agentTrace.push(
          trace(
            name === "calculate_purchase_plan" ? "reason" : "investigate",
            name === "calculate_purchase_plan"
              ? "Policy calculation requested"
              : name.replaceAll("_", " "),
            `Live agent called ${name} and received structured evidence.`,
            "complete",
            name,
          ),
        );
      }
      input.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(result),
      });
    }
    if (proposed) break;
  }

  return { agentTrace, proposed };
}

export async function runAgent(scenarioId: string): Promise<AgentRun> {
  const scenario = getScenario(scenarioId);
  if (!scenario) throw new Error("Scenario not found");

  const mode: AgentRun["mode"] =
    process.env.AGENT_MODE === "openai" && process.env.OPENAI_API_KEY
      ? "openai"
      : "demo";
  let agentTrace: AgentTraceStep[] = [];
  let proposed: { decision: string; quantity: number } | null = null;

  if (mode === "openai") {
    try {
      const live = await openAIInvestigation(scenario);
      agentTrace = live.agentTrace;
      proposed = live.proposed;
    } catch (error) {
      agentTrace = deterministicInvestigation(scenario);
      agentTrace.push(
        trace(
          "guardrail",
          "Live model unavailable",
          `The deterministic policy safely completed the review. ${error instanceof Error ? error.message : "Unknown provider error."}`,
          "warning",
        ),
      );
    }
  } else {
    agentTrace = deterministicInvestigation(scenario);
  }

  const decision = evaluatePurchase(scenario);
  agentTrace.push(
    trace(
      "reason",
      "Net requirement calculated",
      `Target ${decision.targetStock} − usable ${scenario.inventory.usable} − incoming ${decision.incomingBeforeHorizon} = ${decision.calculatedNeed} units after pack rounding.`,
      "complete",
      "calculate_purchase_plan",
    ),
  );
  const proposalMatches =
    !proposed ||
    (proposed.decision === decision.decision &&
      proposed.quantity === decision.recommendedQuantity);
  agentTrace.push(
    trace(
      "guardrail",
      proposalMatches ? "Decision policy validated" : "Unsafe proposal corrected",
      proposalMatches
        ? "Quantity, supplier terms, budget, storage, and evidence thresholds all match the policy result."
        : `The model proposed ${proposed?.decision} ${proposed?.quantity}; policy enforced ${decision.decision} ${decision.recommendedQuantity}.`,
      proposalMatches ? "complete" : "warning",
      "validate_recommendation",
    ),
  );

  const run: AgentRun = {
    id: `RUN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    scenarioId,
    mode,
    status:
      decision.decision === "INVESTIGATE" || decision.decision === "REJECT"
        ? "blocked"
        : decision.approvalRequired
          ? "awaiting_approval"
          : "ready",
    decision,
    trace: agentTrace,
    createdAt: new Date().toISOString(),
  };
  store.runs.set(run.id, run);
  return run;
}
