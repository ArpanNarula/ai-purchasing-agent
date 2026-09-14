# Evaluation approach

The evaluation is intentionally small and assertion-driven. Each case has an expected decision, required evidence, guardrails, action policy, and validation outcome. This makes failures diagnosable instead of hiding them behind a single subjective score.

## Scorecard

| Case | Expected decision | Required evidence | Expected action | Validation oracle |
| --- | --- | --- | --- | --- |
| Core recommendation review | `MODIFY` 800 → 624 | Inventory, forecast, open POs, supplier terms, budget, storage | Buyer approves; create PO | Persisted PO must match the approved quantity and supplier constraints |
| Exact recommendation | `ACCEPT` 800 | Same six sources | Buyer approves; create PO | Supplier confirms all 800 units |
| Purchasing constraint | `MODIFY` 800 → 528 | Demand need plus budget/storage intersection | Create only the safe capped quantity | Cost ≤ $4,320; quantity ≤ 540 storage units; pack size respected |
| Stale evidence | `INVESTIGATE` | Forecast age and confidence | No write | Assert zero created POs and a human-readable investigation reason |
| Supplier partial fulfilment | Detect 250 / 624 confirmation | Persisted supplier response plus alternate terms | Retain 250; source a 384-unit pack-rounded recovery PO | Combined confirmations cover 624; total cost/storage remain valid |

## What is evaluated

1. **Decision correctness** — expected classification and exact policy quantity.
2. **Investigation completeness** — the trace must include inventory, demand, open orders, supplier terms, and constraints.
3. **Constraint compliance** — budget, storage, MOQ, case pack, supplier capacity, and evidence quality.
4. **Action correctness** — the approved quantity, supplier, cost, and idempotent execution result.
5. **Outcome validation** — the system reads back the mock supplier response; an API success alone is insufficient.
6. **Recovery behaviour** — a mismatch enters recovery or escalation rather than being reported as success.

## Automated checks

Run:

```bash
npm test
```

The unit suite covers the deterministic policy and the end-to-end action/validation/recovery loop. The UI exposes the same events as an audit trail so a reviewer can compare the automated oracle with the visible behaviour.

## Known limitations

- The mock store is process-local and resets when the server restarts.
- Supplier responses are deterministic fixtures rather than asynchronous webhooks.
- The demo assumes all confirmed open POs arrive within the planning horizon.
- Monetary values are expressed in demo dollars for readability; currency conversion is outside scope.
