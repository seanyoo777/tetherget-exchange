# Platform Quality Checklist (Top Standard)

This document is the execution baseline to build a production-grade exchange platform.
Update this file continuously as implementation progresses.

## 0) How To Use

- Keep status only as one of: `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`
- Every completed item must include:
  - Completion date (KST)
  - Owner
  - Verification evidence (test/log/screenshot/metric)
- If an item regresses, move it back to `IN_PROGRESS` immediately.

---

## 1) Product Reliability (Order / Position / Balance Integrity)

### 1.1 Authoritative Engine
- [ ] `TODO` Server-side authoritative order and fill engine (no client-trust settlement)
- [ ] `TODO` Deterministic order state transitions (`NEW -> PARTIAL -> FILLED/CANCELED/REJECTED`)
- [ ] `TODO` Idempotent order submission (`clientOrderId` + dedupe window)
- [ ] `TODO` Position updates are atomic with fill events

### 1.2 Ledger Consistency
- [ ] `TODO` Double-entry style wallet ledger for all balance changes
- [ ] `TODO` Reconciliation job (orders/fills/wallet deltas consistency check)
- [ ] `TODO` Negative balance prevention guardrail
- [ ] `TODO` Daily consistency report with alerting

### 1.3 Risk Controls
- [ ] `TODO` Pre-trade checks (margin, leverage cap, position limits)
- [ ] `TODO` Circuit breaker for abnormal volatility spikes
- [ ] `TODO` Liquidation and ADL simulation consistency tests

---

## 2) Performance & Latency

### 2.1 API / Engine
- [ ] `TODO` p95 order request latency target defined and measured
- [ ] `TODO` p99 fill processing latency target defined and measured
- [ ] `TODO` Backpressure handling under burst load

### 2.2 Frontend UX
- [ ] `IN_PROGRESS` Speed order panel optimized for dense HTS workflow
- [ ] `TODO` Input-to-order action latency instrumentation
- [ ] `TODO` Frame-drop monitoring for heavy order book updates

### 2.3 Market Data
- [ ] `IN_PROGRESS` Multi-source market adapters with fallback
- [ ] `TODO` Quote staleness detection and UI warning badges
- [ ] `TODO` Data gap auto-heal and replay logic

---

## 3) Security & Compliance

### 3.1 Auth / Session / Permissions
- [ ] `TODO` JWT/session hardening and rotation policy
- [ ] `TODO` RBAC coverage for admin/super-admin actions
- [ ] `TODO` Sensitive routes require explicit permission checks

### 3.2 Account Protection
- [ ] `TODO` 2FA mandatory for high-risk actions (withdrawal/admin approvals)
- [ ] `TODO` Device/IP anomaly detection and challenge flow
- [ ] `TODO` Brute-force and credential stuffing mitigation

### 3.3 Auditability
- [ ] `IN_PROGRESS` Admin/audit logs captured for major actions
- [ ] `TODO` Tamper-evident audit log storage
- [ ] `TODO` Compliance export pipeline and retention policy

---

## 4) Operations Excellence

### 4.1 Observability
- [ ] `TODO` Unified logs (request id / user id / order id correlation)
- [ ] `TODO` Metrics dashboards (error rate, latency, queue depth, fills/sec)
- [ ] `TODO` Alerts with severity levels and owner routing

### 4.2 Deployment & Recovery
- [ ] `TODO` Zero-downtime deployment strategy
- [ ] `TODO` One-click rollback for bad releases
- [ ] `TODO` Incident runbook with RTO/RPO targets

### 4.3 Data & Backup
- [ ] `TODO` DB backup cadence and restore verification drills
- [ ] `TODO` Point-in-time recovery verification

---

## 5) QA & Release Gates

### 5.1 Automated Tests
- [ ] `TODO` Unit tests for order/risk/math functions
- [ ] `TODO` Integration tests for order lifecycle and wallet updates
- [ ] `TODO` E2E flows for login/trade/cancel/withdraw/admin actions

### 5.2 Non-Functional Tests
- [ ] `TODO` Load test scenarios (normal, burst, degraded dependencies)
- [ ] `TODO` Chaos tests for market data outage / partial backend outage
- [ ] `TODO` Security checks (dependency scan, secret scan, OWASP baseline)

### 5.3 Release Policy
- [ ] `TODO` No release without green CI + critical alerts clean
- [ ] `TODO` Define severity-based release blocker list (P0/P1)

---

## 6) Customer Experience Readiness

### 6.1 Trading UX
- [ ] `IN_PROGRESS` HTS-style speed panel with quick actions and shortcuts
- [ ] `TODO` Error messaging quality pass (actionable, localized, concise)
- [ ] `TODO` Order confirmation and safety toggles per user profile

### 6.2 Supportability
- [ ] `TODO` CS diagnostic panel (user timeline: login/order/fill/withdraw)
- [ ] `TODO` In-app status page and outage communication flow
- [ ] `TODO` FAQ and onboarding guides for first-time traders

---

## 7) Current Sprint Focus (Highest ROI)

1. `IN_PROGRESS` Stabilize speed trading core loop (MIT/OCO/open-order automation)
2. `TODO` Convert engine-critical state transitions to server-authoritative path
3. `TODO` Add automated integration tests for order->fill->position->wallet
4. `TODO` Add observability (structured logs + baseline metrics + alerts)
5. `TODO` Harden auth/session and admin permission boundaries

---

## 8) Weekly Review Template

- Week: `YYYY-MM-DD` (KST)
- Platform readiness score: `__ / 100`
- Top 3 risks:
  1. ...
  2. ...
  3. ...
- Top 3 wins:
  1. ...
  2. ...
  3. ...
- Next week must-fix:
  1. ...
  2. ...
  3. ...

---

## 9) Initial Scoring (2026-05-09 KST)

- Overall platform readiness: `42 / 100`
- Reliability / integrity: `30 / 100`
- Performance / UX: `60 / 100`
- Security / compliance: `28 / 100`
- Operations / observability: `20 / 100`
- QA / release gate: `25 / 100`
- Customer trading experience: `70 / 100`

### Why this score

- Strong progress in speed trading UX and workflow density.
- Core backend-authoritative engine/ledger/reconciliation is not complete.
- Test automation and production observability are still limited.
- Security hardening and release controls are not yet at production bar.

---

## 10) 3-Day Execution Plan (Immediate)

### Day 1 - Engine Integrity Baseline

1. `IN_PROGRESS` Define canonical order lifecycle state machine in backend.
2. `TODO` Add idempotent order submission key path (`clientOrderId`).
3. `TODO` Add server-side fill event format and deterministic transition guards.
4. `TODO` Add minimal integrity checks (no invalid transition, no negative qty/balance).

Deliverable:
- Backend order flow spec + first implementation PR.

### Day 2 - Test & Reconciliation

1. `TODO` Add integration tests for `order -> fill -> position -> wallet`.
2. `TODO` Add reconciliation command to compare fills and wallet deltas.
3. `TODO` Add test fixtures for MIT/OCO/open-order auto-fill scenarios.
4. `TODO` Add CI job to run integration test suite.

Deliverable:
- Green integration test pipeline + reconciliation report output.

### Day 3 - Observability & Security Baseline

1. `TODO` Add structured log fields (`requestId`, `userId`, `orderId`, `symbol`).
2. `TODO` Add initial metrics (order latency, reject rate, fill throughput).
3. `TODO` Add alert rule prototypes (error spike, stale market feed).
4. `TODO` Harden session/permission checks on sensitive admin/trade paths.

Deliverable:
- Monitoring dashboard draft + first alert set + auth hardening patch.

---

## 11) Code Work Order (Do In Sequence)

1. `backend` order engine state model and transition validator
2. `backend` idempotency and fill commit transaction boundary
3. `backend` wallet ledger consistency guard
4. `backend` reconciliation worker / command
5. `tests` integration suite for order/fill/position/wallet
6. `observability` structured logs, metrics, alerts
7. `frontend` final UX polish after engine/test baseline is stable

Rule:
- Do not prioritize new UI features above items 1~5 unless it is a blocker fix.

