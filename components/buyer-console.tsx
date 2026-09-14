"use client";

import {
  ArrowRight,
  Bot,
  Box,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  CircleStop,
  Clock3,
  CloudCog,
  Database,
  ExternalLink,
  FileCheck2,
  Gauge,
  Info,
  PackageCheck,
  RefreshCcw,
  Route,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Warehouse,
  X,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  AgentRun,
  AgentTraceStep,
  ExecutionResult,
  PurchasingScenario,
} from "@/lib/types";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

const decisionCopy = {
  ACCEPT: { eyebrow: "Recommendation accepted", tone: "green" },
  MODIFY: { eyebrow: "Adjustment recommended", tone: "amber" },
  REJECT: { eyebrow: "Purchase rejected", tone: "red" },
  INVESTIGATE: { eyebrow: "More evidence required", tone: "purple" },
} as const;

const phaseIcons = {
  investigate: Database,
  reason: Bot,
  guardrail: ShieldCheck,
  act: Zap,
  validate: FileCheck2,
  recover: Route,
};

function AgentStep({ item, isLast }: { item: AgentTraceStep; isLast: boolean }) {
  const Icon = phaseIcons[item.phase];
  return (
    <div className="trace-item">
      <div className="trace-rail">
        <span className={`trace-icon ${item.status}`}>
          {item.status === "blocked" ? <X size={15} /> : <Icon size={15} />}
        </span>
        {!isLast && <span className="trace-line" />}
      </div>
      <div className="trace-copy">
        <div className="trace-heading">
          <strong>{item.title}</strong>
          <span>{item.phase}</span>
        </div>
        <p>{item.detail}</p>
        {item.tool && <code>{item.tool}()</code>}
      </div>
    </div>
  );
}

function DemandSparkline() {
  return (
    <svg viewBox="0 0 260 62" className="sparkline" role="img" aria-label="Demand trend rising">
      <defs>
        <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff5a5f" stopOpacity=".26" />
          <stop offset="1" stopColor="#ff5a5f" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0,54 C18,50 24,46 42,48 C62,51 74,37 91,40 C108,43 116,34 132,35 C149,35 159,28 174,29 C191,31 202,18 216,21 C232,24 242,8 260,9 L260,62 L0,62 Z" fill="url(#area)" />
      <path d="M0,54 C18,50 24,46 42,48 C62,51 74,37 91,40 C108,43 116,34 132,35 C149,35 159,28 174,29 C191,31 202,18 216,21 C232,24 242,8 260,9" fill="none" stroke="#ff5a5f" strokeWidth="3" strokeLinecap="round" />
      <circle cx="260" cy="9" r="4" fill="#ff5a5f" />
    </svg>
  );
}

export function BuyerConsole({ initialScenarios }: { initialScenarios: PurchasingScenario[] }) {
  const [scenarioId, setScenarioId] = useState(initialScenarios[0].id);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [execution, setExecution] = useState<ExecutionResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scenario = useMemo(
    () => initialScenarios.find((item) => item.id === scenarioId) ?? initialScenarios[0],
    [initialScenarios, scenarioId],
  );

  async function runReview() {
    setIsRunning(true);
    setExecution(null);
    setError(null);
    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Agent run failed");
      setRun(payload.run);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Agent run failed");
    } finally {
      setIsRunning(false);
    }
  }

  async function executePlan() {
    if (!run) return;
    setIsExecuting(true);
    setError(null);
    try {
      const response = await fetch("/api/purchase-orders/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: run.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Execution failed");
      setExecution(payload.execution);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Execution failed");
    } finally {
      setIsExecuting(false);
    }
  }

  function selectScenario(id: string) {
    setScenarioId(id);
    setRun(null);
    setExecution(null);
    setError(null);
  }

  const finalTrace = execution ? [...(run?.trace ?? []), ...execution.trace] : run?.trace ?? [];
  const outcome = run ? decisionCopy[run.decision.decision] : null;
  const packLabel = scenario.recommendation.productName.match(/(\d+)\s*(ml|pack)/i);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Sparkles size={19} /></span>
          <div>
            <strong>Atlas</strong>
            <span>Purchasing intelligence</span>
          </div>
        </div>
        <div className="topbar-meta">
          <span className="environment"><span /> Simulation environment</span>
          <span className="divider" />
          <div className="avatar">AM</div>
          <div className="buyer-name"><strong>Alex Morgan</strong><span>Senior buyer</span></div>
          <ChevronDown size={16} />
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-title">
            <span>Evaluation scenarios</span>
            <small>{initialScenarios.length} prepared cases</small>
          </div>
          <nav className="scenario-list">
            {initialScenarios.map((item, index) => (
              <button
                key={item.id}
                className={`scenario-button ${item.id === scenarioId ? "active" : ""}`}
                onClick={() => selectScenario(item.id)}
              >
                <span className="scenario-index">0{index + 1}</span>
                <span className="scenario-copy"><strong>{item.shortLabel}</strong><small>{item.label}</small></span>
                {item.id === scenarioId && <ArrowRight size={16} />}
              </button>
            ))}
          </nav>

          <div className="sidebar-note">
            <ShieldCheck size={18} />
            <div><strong>Safe by design</strong><p>All writes are policy-checked and independently verified.</p></div>
          </div>
        </aside>

        <section className="content">
          <div className="content-header">
            <div>
              <div className="breadcrumbs"><span>Purchase recommendations</span><span>/</span><strong>{scenario.recommendation.sku}</strong></div>
              <h1>Recommendation review</h1>
              <p>{scenario.description}</p>
            </div>
            <button className="ghost-button"><ExternalLink size={15} /> View audit record</button>
          </div>

          {error && <div className="error-banner"><TriangleAlert size={18} /> {error}</div>}

          <div className="overview-grid">
            <article className="product-card panel">
              <div className="product-image">
                <span>{packLabel?.[1] ?? "SKU"}</span>
                <small>{packLabel?.[2] ?? "item"}</small>
              </div>
              <div className="product-details">
                <div className="label-row"><span className="pill neutral">{scenario.recommendation.sku}</span><span className="stock-live"><span /> Live inventory</span></div>
                <h2>{scenario.recommendation.productName}</h2>
                <p><Warehouse size={15} /> {scenario.recommendation.nodeName} · {scenario.recommendation.nodeId}</p>
                <div className="recommendation-quantity">
                  <div><span>System recommendation</span><strong>{scenario.recommendation.quantity}</strong><small>units</small></div>
                  <div className="recommendation-value"><span>Estimated value</span><strong>{money(scenario.recommendation.quantity * scenario.primarySupplier.unitCost)}</strong></div>
                </div>
              </div>
            </article>

            <article className="demand-card panel">
              <div className="card-label"><span>Demand velocity</span><span className="trend"><TrendingUp size={14} /> +18.4%</span></div>
              <div className="metric-line"><strong>{scenario.forecast.dailyUnits}</strong><span>units / day</span></div>
              <DemandSparkline />
              <div className="chart-footer"><span>14 days ago</span><span>Today</span></div>
            </article>
          </div>

          <div className="metrics-grid">
            <article className="metric-card"><div className="metric-icon coral"><Box size={18} /></div><div><span>Usable inventory</span><strong>{scenario.inventory.usable}</strong><small>{scenario.inventory.onHand} on hand · {scenario.inventory.reserved} reserved</small></div></article>
            <article className="metric-card"><div className="metric-icon blue"><PackageCheck size={18} /></div><div><span>Incoming stock</span><strong>{scenario.openPurchaseOrders.reduce((sum, po) => sum + po.quantity, 0)}</strong><small>{scenario.openPurchaseOrders.length || "No"} confirmed open PO{scenario.openPurchaseOrders.length === 1 ? "" : "s"}</small></div></article>
            <article className="metric-card"><div className="metric-icon green"><CircleDollarSign size={18} /></div><div><span>Available budget</span><strong>{money(scenario.constraints.availableBudget)}</strong><small>{Math.floor(scenario.constraints.availableBudget / scenario.primarySupplier.unitCost)} units at current cost</small></div></article>
            <article className="metric-card"><div className="metric-icon purple"><Warehouse size={18} /></div><div><span>Storage capacity</span><strong>{scenario.constraints.availableStorageUnits}</strong><small>units available at node</small></div></article>
          </div>

          {!run ? (
            <section className="ready-state panel">
              <div className="ready-icon"><Bot size={29} /></div>
              <div className="ready-copy">
                <span className="eyebrow">Buyer agent ready</span>
                <h2>Review this recommendation against every constraint</h2>
                <p>Atlas will investigate six sources, calculate the safe requirement, explain the decision, and prepare an auditable action.</p>
                <div className="tool-chips">
                  <span><Database size={13} /> Inventory</span><span><TrendingUp size={13} /> Forecast</span><span><PackageCheck size={13} /> Open POs</span><span><CloudCog size={13} /> Supplier</span><span><CircleDollarSign size={13} /> Budget</span><span><Warehouse size={13} /> Storage</span>
                </div>
              </div>
              <button className="primary-button" onClick={runReview} disabled={isRunning}>
                {isRunning ? <><RefreshCcw className="spin" size={17} /> Investigating…</> : <><Sparkles size={17} /> Run agent review</>}
              </button>
            </section>
          ) : (
            <div className="result-grid">
              <section className={`decision-panel panel ${outcome?.tone}`}>
                <div className="decision-topline">
                  <span className="eyebrow"><span className="pulse" /> {execution ? "Execution complete" : outcome?.eyebrow}</span>
                  <span className="mode-pill"><CloudCog size={13} /> {run.mode === "openai" ? "Live agent" : "Deterministic demo"}</span>
                </div>

                {execution ? (
                  <div className="execution-result">
                    <div className={`outcome-icon ${execution.status}`}><CheckCircle2 size={27} /></div>
                    <div><h2>{execution.headline}</h2><p>{execution.detail}</p></div>
                    <div className="coverage-badge"><span>Confirmed coverage</span><strong>{execution.totalConfirmed} / {execution.targetQuantity}</strong><small>units</small></div>
                  </div>
                ) : (
                  <>
                    <div className="decision-main">
                      <div>
                        <span>Agent decision</span>
                        <h2>{run.decision.decision === "MODIFY" ? "Buy" : run.decision.decision}</h2>
                      </div>
                      {run.decision.recommendedQuantity > 0 && <div className="decision-quantity"><strong>{run.decision.recommendedQuantity}</strong><span>units</span></div>}
                    </div>
                    <p className="decision-summary">{run.decision.summary}</p>
                    <div className="decision-math">
                      <div><span>Calculated need</span><strong>{run.decision.calculatedNeed} units</strong></div>
                      <ArrowRight size={16} />
                      <div><span>Projected cost</span><strong>{money(run.decision.projectedCost)}</strong></div>
                      <ArrowRight size={16} />
                      <div><span>Coverage</span><strong>{run.decision.projectedCoverageDays.toFixed(1)} days</strong></div>
                    </div>
                  </>
                )}

                {!execution && run.status !== "blocked" && (
                  <div className="approval-bar">
                    <div><ShieldCheck size={19} /><span><strong>Human approval required</strong><small>Includes guarded recovery within a 5% spend tolerance.</small></span></div>
                    <button className="primary-button dark" onClick={executePlan} disabled={isExecuting}>
                      {isExecuting ? <><RefreshCcw className="spin" size={16} /> Executing…</> : <>Approve & execute <ArrowRight size={16} /></>}
                    </button>
                  </div>
                )}

                {!execution && run.status === "blocked" && (
                  <div className="blocked-bar"><CircleStop size={19} /><div><strong>No purchase order will be created</strong><span>The case is safely paused until the evidence is refreshed.</span></div></div>
                )}
              </section>

              <aside className="confidence-panel panel">
                <div className="confidence-header"><span>Decision confidence</span><Info size={14} /></div>
                <div className="confidence-score"><strong>{percent(run.decision.confidence)}</strong><span className={`risk ${run.decision.risk}`}>{run.decision.risk} risk</span></div>
                <div className="confidence-track"><span style={{ width: percent(run.decision.confidence) }} /></div>
                <div className="check-list">
                  {run.decision.checks.map((check) => (
                    <div key={check.name} className="check-row">
                      <span className={`check-dot ${check.status}`}>{check.status === "pass" ? <Check size={12} /> : <TriangleAlert size={12} />}</span>
                      <div><strong>{check.name}</strong><small>{check.detail}</small></div>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          )}

          {run && (
            <div className="lower-grid">
              <section className="rationale-panel panel">
                <div className="section-title"><div><span>Why this decision</span><small>Policy-grounded rationale</small></div><Gauge size={18} /></div>
                <ol className="reason-list">
                  {run.decision.reasons.map((reason, index) => <li key={reason}><span>{index + 1}</span><p>{reason}</p></li>)}
                </ol>
                <div className="formula-box">
                  <span>Authoritative calculation</span>
                  <code>({run.decision.targetStock} target − {scenario.inventory.usable} usable − {run.decision.incomingBeforeHorizon} incoming) → {run.decision.calculatedNeed} pack-rounded</code>
                </div>
              </section>

              <section className="trace-panel panel">
                <div className="section-title"><div><span>Agent activity</span><small>{finalTrace.length} auditable steps · {execution ? "validated" : "in progress"}</small></div><Clock3 size={18} /></div>
                <div className="trace-list">
                  {finalTrace.map((item, index) => <AgentStep key={item.id} item={item} isLast={index === finalTrace.length - 1} />)}
                </div>
              </section>
            </div>
          )}

          {execution && (
            <section className="orders-panel panel">
              <div className="section-title"><div><span>Purchase orders created</span><small>Persisted mock supplier responses</small></div><PackageCheck size={18} /></div>
              <div className="orders-table">
                <div className="order-row header"><span>Purchase order</span><span>Supplier</span><span>Requested</span><span>Confirmed</span><span>Status</span></div>
                {execution.purchaseOrders.map((order) => (
                  <div className="order-row" key={order.id}>
                    <strong>{order.id}</strong><span>{order.supplierName}</span><span>{order.requestedQuantity} units</span><span>{order.confirmedQuantity} units</span><span className={`order-status ${order.status}`}>{order.status.replaceAll("_", " ")}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
