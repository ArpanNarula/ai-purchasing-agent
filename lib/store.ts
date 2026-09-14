import { AgentRun, ExecutionResult, PurchaseOrder } from "./types";

interface DemoStore {
  runs: Map<string, AgentRun>;
  executions: Map<string, ExecutionResult>;
  purchaseOrders: PurchaseOrder[];
}

const globalStore = globalThis as typeof globalThis & {
  __buyerAgentStore?: DemoStore;
};

export const store: DemoStore =
  globalStore.__buyerAgentStore ?? {
    runs: new Map(),
    executions: new Map(),
    purchaseOrders: [],
  };

if (process.env.NODE_ENV !== "production") {
  globalStore.__buyerAgentStore = store;
}

export function resetStore() {
  store.runs.clear();
  store.executions.clear();
  store.purchaseOrders.splice(0, store.purchaseOrders.length);
}
