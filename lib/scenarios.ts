import { PurchasingScenario } from "./types";

const capturedAt = "2026-09-14T08:30:00.000Z";
const generatedAt = "2026-09-14T06:00:00.000Z";

export const scenarios: PurchasingScenario[] = [
  {
    id: "recommendation-review",
    label: "Recommendation review + supplier recovery",
    shortLabel: "Core demo",
    description:
      "Review an 800-unit recommendation, correct the quantity, execute the purchase, and recover when the supplier confirms only 250 units.",
    recommendation: {
      quantity: 800,
      productId: "PRD-1842",
      productName: "Andes Sparkling Water · Lime 330 ml",
      sku: "AND-LIM-330-12",
      nodeId: "FC-BLR-07",
      nodeName: "Indiranagar Dark Store",
    },
    inventory: { onHand: 260, reserved: 80, usable: 180, capturedAt },
    forecast: {
      dailyUnits: 84,
      horizonDays: 11,
      safetyStock: 180,
      confidence: 0.91,
      generatedAt,
    },
    openPurchaseOrders: [
      {
        id: "PO-10418",
        supplierName: "BluePeak Beverages",
        quantity: 300,
        expectedDate: "2026-09-19",
        status: "confirmed",
      },
    ],
    primarySupplier: {
      id: "SUP-BPB",
      name: "BluePeak Beverages",
      unitCost: 4.8,
      leadTimeDays: 7,
      minimumOrder: 240,
      casePack: 24,
      availableCapacity: 900,
      confirmationLimit: 250,
      reliability: 0.88,
    },
    alternateSuppliers: [
      {
        id: "SUP-AQS",
        name: "AquaSource South",
        unitCost: 5,
        leadTimeDays: 5,
        minimumOrder: 120,
        casePack: 24,
        availableCapacity: 500,
        reliability: 0.96,
      },
    ],
    constraints: {
      availableBudget: 4_800,
      availableStorageUnits: 1_000,
      approvalThreshold: 2_000,
    },
  },
  {
    id: "clean-accept",
    label: "Recommendation is well-sized",
    shortLabel: "Accept",
    description:
      "All evidence supports the original 800-unit recommendation and the supplier can fulfil it in full.",
    recommendation: {
      quantity: 800,
      productId: "PRD-2004",
      productName: "Café Norte Cold Brew · Original 250 ml",
      sku: "CAF-CBR-250-24",
      nodeId: "FC-BLR-03",
      nodeName: "Koramangala Hub",
    },
    inventory: { onHand: 260, reserved: 60, usable: 200, capturedAt },
    forecast: {
      dailyUnits: 70,
      horizonDays: 12,
      safetyStock: 260,
      confidence: 0.94,
      generatedAt,
    },
    openPurchaseOrders: [
      {
        id: "PO-10405",
        supplierName: "Café Norte Distribution",
        quantity: 100,
        expectedDate: "2026-09-18",
        status: "confirmed",
      },
    ],
    primarySupplier: {
      id: "SUP-CND",
      name: "Café Norte Distribution",
      unitCost: 3.6,
      leadTimeDays: 6,
      minimumOrder: 200,
      casePack: 20,
      availableCapacity: 1_200,
      reliability: 0.97,
    },
    alternateSuppliers: [],
    constraints: {
      availableBudget: 5_000,
      availableStorageUnits: 1_100,
      approvalThreshold: 2_000,
    },
  },
  {
    id: "hard-constraint",
    label: "Need exceeds budget and storage",
    shortLabel: "Constrained",
    description:
      "Demand supports a larger buy, but budget and storage jointly cap the safe executable quantity.",
    recommendation: {
      quantity: 800,
      productId: "PRD-8721",
      productName: "Sol Laundry Pods · Fresh 24 pack",
      sku: "SOL-POD-024-FR",
      nodeId: "FC-MUM-11",
      nodeName: "Bandra Fulfilment Centre",
    },
    inventory: { onHand: 90, reserved: 30, usable: 60, capturedAt },
    forecast: {
      dailyUnits: 66,
      horizonDays: 14,
      safetyStock: 200,
      confidence: 0.89,
      generatedAt,
    },
    openPurchaseOrders: [],
    primarySupplier: {
      id: "SUP-SHC",
      name: "Sol Homecare",
      unitCost: 8,
      leadTimeDays: 10,
      minimumOrder: 120,
      casePack: 24,
      availableCapacity: 1_200,
      reliability: 0.93,
    },
    alternateSuppliers: [],
    constraints: {
      availableBudget: 4_320,
      availableStorageUnits: 540,
      approvalThreshold: 2_000,
    },
  },
  {
    id: "missing-evidence",
    label: "Forecast evidence is stale",
    shortLabel: "Investigate",
    description:
      "The purchase looks plausible, but low-confidence, stale forecast data makes an autonomous order unsafe.",
    recommendation: {
      quantity: 800,
      productId: "PRD-9180",
      productName: "Cosecha Avocado Oil · 500 ml",
      sku: "COS-AVO-500-06",
      nodeId: "FC-DEL-04",
      nodeName: "Saket Dark Store",
    },
    inventory: { onHand: 130, reserved: 45, usable: 85, capturedAt },
    forecast: {
      dailyUnits: 49,
      horizonDays: 14,
      safetyStock: 150,
      confidence: 0.48,
      generatedAt: "2026-08-23T06:00:00.000Z",
    },
    openPurchaseOrders: [],
    primarySupplier: {
      id: "SUP-COS",
      name: "Cosecha Foods",
      unitCost: 7.2,
      leadTimeDays: 8,
      minimumOrder: 120,
      casePack: 12,
      availableCapacity: 900,
      reliability: 0.95,
    },
    alternateSuppliers: [],
    constraints: {
      availableBudget: 7_500,
      availableStorageUnits: 1_000,
      approvalThreshold: 2_000,
    },
    dataWarnings: [
      "Forecast is 22 days old.",
      "Forecast confidence is below the 70% autonomy threshold.",
    ],
  },
];

export function getScenario(id: string) {
  return scenarios.find((scenario) => scenario.id === id);
}
