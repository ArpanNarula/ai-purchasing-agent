export type Decision = "ACCEPT" | "MODIFY" | "REJECT" | "INVESTIGATE";

export type RiskLevel = "low" | "medium" | "high";

export interface InventorySnapshot {
  onHand: number;
  reserved: number;
  usable: number;
  capturedAt: string;
}

export interface DemandForecast {
  dailyUnits: number;
  horizonDays: number;
  safetyStock: number;
  confidence: number;
  generatedAt: string;
}

export interface OpenPurchaseOrder {
  id: string;
  supplierName: string;
  quantity: number;
  expectedDate: string;
  status: "confirmed" | "pending" | "delayed";
}

export interface SupplierTerms {
  id: string;
  name: string;
  unitCost: number;
  leadTimeDays: number;
  minimumOrder: number;
  casePack: number;
  availableCapacity: number;
  confirmationLimit?: number;
  reliability: number;
}

export interface ConstraintSnapshot {
  availableBudget: number;
  availableStorageUnits: number;
  approvalThreshold: number;
}

export interface PurchasingScenario {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  recommendation: {
    quantity: number;
    productId: string;
    productName: string;
    sku: string;
    nodeId: string;
    nodeName: string;
  };
  inventory: InventorySnapshot;
  forecast: DemandForecast;
  openPurchaseOrders: OpenPurchaseOrder[];
  primarySupplier: SupplierTerms;
  alternateSuppliers: SupplierTerms[];
  constraints: ConstraintSnapshot;
  dataWarnings?: string[];
}

export interface ConstraintCheck {
  name: string;
  status: "pass" | "warning" | "fail";
  detail: string;
}

export interface PolicyDecision {
  decision: Decision;
  recommendedQuantity: number;
  calculatedNeed: number;
  targetStock: number;
  incomingBeforeHorizon: number;
  projectedCost: number;
  projectedCoverageDays: number;
  confidence: number;
  risk: RiskLevel;
  approvalRequired: boolean;
  summary: string;
  reasons: string[];
  checks: ConstraintCheck[];
}

export interface AgentTraceStep {
  id: string;
  phase: "investigate" | "reason" | "guardrail" | "act" | "validate" | "recover";
  title: string;
  detail: string;
  status: "complete" | "warning" | "blocked";
  tool?: string;
  timestamp: string;
}

export interface AgentRun {
  id: string;
  scenarioId: string;
  mode: "demo" | "openai";
  status: "awaiting_approval" | "ready" | "completed" | "blocked";
  decision: PolicyDecision;
  trace: AgentTraceStep[];
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  productId: string;
  requestedQuantity: number;
  confirmedQuantity: number;
  unitCost: number;
  status: "confirmed" | "partially_confirmed" | "rejected";
  createdAt: string;
}

export interface ExecutionResult {
  runId: string;
  status: "validated" | "recovered" | "escalated" | "blocked";
  headline: string;
  detail: string;
  purchaseOrders: PurchaseOrder[];
  totalConfirmed: number;
  targetQuantity: number;
  trace: AgentTraceStep[];
}
