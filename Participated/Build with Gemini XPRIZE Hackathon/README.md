# FairClaim — Comprehensive Technical Documentation

**Version:** 1.0  
**Prepared:** July 2, 2026  
**Scope:** Full technical reference for the FairClaim MVP (Build with Gemini XPRIZE submission)  
**Audience:** Solo developer building and operating the system through August 17, 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Repository Structure](#2-repository-structure)
3. [Environment Configuration](#3-environment-configuration)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Backend Architecture](#5-backend-architecture)
6. [The Agent Pipeline — Deep Specification](#6-the-agent-pipeline--deep-specification)
7. [Statute Reference Library](#7-statute-reference-library)
8. [Data Model — Full Schema](#8-data-model--full-schema)
9. [API Reference](#9-api-reference)
10. [Payment Integration](#10-payment-integration)
11. [PDF Generation](#11-pdf-generation)
12. [Email System](#12-email-system)
13. [Authentication & Session Management](#13-authentication--session-management)
14. [Security & Trust Guardrails](#14-security--trust-guardrails)
15. [Infrastructure & Deployment](#15-infrastructure--deployment)
16. [Monitoring & Observability](#16-monitoring--observability)
17. [Error Handling & Recovery](#17-error-handling--recovery)
18. [Testing Strategy](#18-testing-strategy)
19. [Prompt Engineering Reference](#19-prompt-engineering-reference)
20. [Development Setup Guide](#20-development-setup-guide)
21. [Runbook — Operations During Competition Window](#21-runbook--operations-during-competition-window)

---

## 1. System Overview

FairClaim is an AI-native document preparation service. A paying customer describes their consumer dispute; an asynchronous five-stage Gemini agent pipeline produces a statute-cited demand letter; the customer receives a polished PDF within ten minutes of payment.

### 1.1 Core Data Flow

```
Customer fills intake form
  └─► Stripe Checkout (payment gate)
        └─► Webhook: order created in Firestore, job enqueued in Cloud Tasks
              └─► Cloud Run Worker picks up job
                    ├─► Stage 1: Intake Validation & Extraction   (Gemini Flash)
                    ├─► Stage 2: Jurisdiction Research             (Gemini Flash + YAML library)
                    ├─► Stage 3: Drafting                         (Gemini Pro)
                    ├─► Stage 4: Adversarial QA                   (Gemini Flash)
                    └─► Stage 5: Escalation Guidance (paid tier)  (Gemini Flash)
                          └─► PDF rendered from HTML template
                                └─► PDF stored in Cloud Storage
                                      └─► Delivery email sent
                                            └─► Order status → "delivered"
                                                  └─► Day-7 / Day-21 follow-up tasks scheduled
```

### 1.2 Architectural Principles

**Nothing AI in the request path.** The HTTP layer is synchronous and returns fast. AI work happens in an async worker. This prevents timeout failures from ever causing payment issues.

**Narrow-contract stages.** Each pipeline stage has a single, testable responsibility. Structured JSON output from every non-drafting stage makes downstream stages deterministic about their inputs.

**Curated library over model recall.** Statute citations come from a hand-verified YAML dataset. The model selects and applies from the library; it never free-recalls legal citations.

**Fail toward review, not toward error.** Pipeline failures park orders in a human review queue rather than failing the order. The customer never sees a broken state.

---

## 2. Repository Structure

```
fairclaim/
├── app/                          # Next.js App Router
│   ├── (marketing)/              # Route group: public-facing pages
│   │   ├── page.tsx              # Homepage
│   │   ├── [state]/[vertical]/   # Dynamic vertical landing pages
│   │   │   └── page.tsx
│   │   ├── how-it-works/
│   │   ├── pricing/
│   │   └── legal/
│   │       ├── terms/
│   │       └── privacy/
│   ├── (app)/                    # Route group: authenticated customer area
│   │   ├── intake/
│   │   │   └── page.tsx          # Multi-step intake form
│   │   ├── checkout/
│   │   │   └── page.tsx          # Pre-checkout summary
│   │   ├── orders/
│   │   │   ├── page.tsx          # Order list
│   │   │   └── [orderId]/
│   │   │       └── page.tsx      # Order detail / letter view
│   │   └── layout.tsx
│   ├── api/                      # Next.js API routes
│   │   ├── webhooks/
│   │   │   └── stripe/
│   │   │       └── route.ts      # Stripe webhook handler
│   │   ├── orders/
│   │   │   ├── route.ts          # GET /api/orders (list)
│   │   │   └── [orderId]/
│   │   │       ├── route.ts      # GET /api/orders/:id
│   │   │       └── revision/
│   │   │           └── route.ts  # POST /api/orders/:id/revision
│   │   ├── intake/
│   │   │   └── route.ts          # POST /api/intake (save draft intake)
│   │   ├── upload/
│   │   │   └── route.ts          # POST /api/upload (signed URL generation)
│   │   ├── outcomes/
│   │   │   └── route.ts          # POST /api/outcomes (day-7/21 one-click)
│   │   └── admin/                # Internal dashboard (IP-restricted)
│   │       ├── orders/
│   │       │   └── route.ts
│   │       └── metrics/
│   │           └── route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/                   # Shared React components
│   ├── intake/
│   │   ├── DisputeTypeSelector.tsx
│   │   ├── StateSelector.tsx
│   │   ├── TimelineFields.tsx
│   │   ├── AmountsFields.tsx
│   │   ├── DocumentUpload.tsx
│   │   └── IntakeReview.tsx
│   ├── orders/
│   │   ├── OrderStatusBadge.tsx
│   │   ├── LetterViewer.tsx
│   │   └── RevisionRequest.tsx
│   ├── admin/
│   │   ├── MetricsDashboard.tsx
│   │   ├── ReviewQueue.tsx
│   │   └── OrderApprover.tsx
│   └── ui/                       # Generic UI primitives
├── lib/                          # Shared server-side logic
│   ├── gemini/
│   │   ├── client.ts             # Gemini API client wrapper
│   │   ├── stages/
│   │   │   ├── stage1-intake.ts
│   │   │   ├── stage2-jurisdiction.ts
│   │   │   ├── stage3-draft.ts
│   │   │   ├── stage4-qa.ts
│   │   │   └── stage5-escalation.ts
│   │   └── schemas/              # Zod schemas for structured outputs
│   ├── firestore/
│   │   ├── client.ts
│   │   ├── orders.ts
│   │   ├── customers.ts
│   │   ├── letters.ts
│   │   ├── pipeline-runs.ts
│   │   └── outcomes.ts
│   ├── storage/
│   │   └── client.ts             # Cloud Storage helpers
│   ├── pdf/
│   │   ├── renderer.ts           # HTML-to-PDF via Puppeteer/WeasyPrint
│   │   └── templates/
│   │       ├── demand-letter.html
│   │       └── cover-note.html
│   ├── email/
│   │   ├── client.ts             # Resend/Postmark wrapper
│   │   └── templates/
│   │       ├── delivery.ts
│   │       ├── outcome-day7.ts
│   │       └── outcome-day21.ts
│   ├── statute-library/
│   │   ├── loader.ts             # Parses YAML → typed structures
│   │   └── data/                 # YAML statute files per state/vertical
│   │       ├── CA/
│   │       │   ├── security-deposit.yaml
│   │       │   ├── contractor.yaml
│   │       │   ├── airline.yaml
│   │       │   └── subscription.yaml
│   │       └── ... (per state)
│   ├── queue/
│   │   └── tasks.ts              # Cloud Tasks enqueue/dequeue helpers
│   └── stripe/
│       └── client.ts             # Stripe SDK wrapper
├── worker/                       # Standalone Cloud Run worker
│   ├── index.ts                  # HTTP server: POST /process-order
│   └── pipeline.ts               # Orchestrates stages 1–5
├── scripts/
│   ├── seed-statute-library.ts   # Populate YAML from statute text + Gemini
│   ├── run-golden-set.ts         # Regression: run pipeline on golden cases
│   └── backfill-outcomes.ts      # One-off: send follow-ups for older orders
├── statute-library/              # Source of truth for statute YAML files
│   └── ... (same structure as lib/statute-library/data)
├── golden-set/                   # Anonymized test cases + expected outputs
│   ├── cases/
│   │   └── *.json
│   └── expected/
│       └── *.json
├── prompts/                      # Versioned prompts with changelogs
│   ├── CHANGELOG.md
│   ├── stage1-intake.md
│   ├── stage2-jurisdiction.md
│   ├── stage3-draft.md
│   ├── stage4-qa.md
│   └── stage5-escalation.md
├── Dockerfile.app
├── Dockerfile.worker
├── cloudbuild.yaml
├── .env.local.example
└── package.json
```

---

## 3. Environment Configuration

### 3.1 Required Environment Variables

```bash
# ─── Gemini ───────────────────────────────────────────────────────────────────
GOOGLE_GENERATIVE_AI_API_KEY=        # From AI Studio; used in both app and worker
GEMINI_FLASH_MODEL=gemini-1.5-flash  # Verify current model name in AI Studio at build time
GEMINI_PRO_MODEL=gemini-1.5-pro      # Used for Stage 3 drafting only

# ─── Google Cloud ─────────────────────────────────────────────────────────────
GOOGLE_CLOUD_PROJECT=                # GCP project ID
GOOGLE_CLOUD_REGION=us-central1
FIRESTORE_DATABASE=(default)         # Or named DB if created separately
CLOUD_STORAGE_BUCKET=fairclaim-uploads
CLOUD_TASKS_QUEUE=fairclaim-pipeline-queue
CLOUD_TASKS_WORKER_URL=              # Full URL of the worker Cloud Run service
CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL=   # SA used to invoke the worker

# ─── Stripe ───────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=              # Exposed to client via NEXT_PUBLIC_
STRIPE_WEBHOOK_SECRET=               # From Stripe Dashboard → Webhooks

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=  # Same value as above, Next.js public prefix

# Stripe Price IDs (create in Dashboard)
STRIPE_PRICE_DEMAND_LETTER=          # $39 base tier
STRIPE_PRICE_ESCALATION_PACK=        # $59 tier
STRIPE_PRICE_RESPONSE_REVIEW=        # $19 add-on

# ─── Email ────────────────────────────────────────────────────────────────────
RESEND_API_KEY=                      # Or POSTMARK_SERVER_TOKEN
EMAIL_FROM=letters@fairclaim.com
EMAIL_FROM_NAME=FairClaim

# ─── App ──────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://fairclaim.com
ADMIN_IP_ALLOWLIST=                  # Comma-separated; restricts /admin routes
ADMIN_SECRET_TOKEN=                  # Bearer token for admin API routes
REVIEW_QUEUE_WEBHOOK_URL=            # Optional: Slack or email alert on parked orders

# ─── Feature Flags ────────────────────────────────────────────────────────────
PIPELINE_AUTO_APPROVE=false          # true only after manual review week is complete
PIPELINE_FORCE_REVIEW_QUEUE=true     # Overrides auto-approve; set false to go fully automated
```

### 3.2 Secret Management

Store all secrets in Google Cloud Secret Manager and mount them as environment variables in Cloud Run. Never commit `.env.local` to version control. Reference secrets in `cloudbuild.yaml` using `secretEnv`.

```yaml
# cloudbuild.yaml (excerpt)
availableSecrets:
  secretManager:
    - versionName: projects/$PROJECT_ID/secrets/STRIPE_SECRET_KEY/versions/latest
      env: STRIPE_SECRET_KEY
    - versionName: projects/$PROJECT_ID/secrets/GOOGLE_GENERATIVE_AI_API_KEY/versions/latest
      env: GOOGLE_GENERATIVE_AI_API_KEY
    # ... all other secrets
```

---

## 4. Frontend Architecture

### 4.1 Page Map

| Route | Purpose | Auth required |
|---|---|---|
| `/` | Homepage: headline, value prop, how-it-works, CTA | No |
| `/[state]/[vertical]` | SEO landing page (e.g., `/california/security-deposit`) | No |
| `/how-it-works` | Detailed product explainer | No |
| `/pricing` | Tier comparison table | No |
| `/legal/terms` | Terms of service | No |
| `/legal/privacy` | Privacy policy | No |
| `/intake` | Multi-step intake form | Session (email collected at start) |
| `/checkout` | Pre-payment review | Session |
| `/orders` | Customer order history | Email link / session |
| `/orders/[orderId]` | Order status + letter view + revision | Email link / session |
| `/admin` | Internal metrics dashboard (IP-restricted) | IP + bearer token |

### 4.2 Intake Form — Multi-Step Flow

The intake form is the primary UX. Each step validates before advancing. All state is stored in component state and synced to `localStorage` as a draft, so closing the tab doesn't lose progress.

**Step 1 — Dispute Type Selection**  
Radio cards: Security Deposit · Contractor / Home Services · Airline / Travel Refund · Subscription / Billing  
Output: `dispute_class: "security_deposit" | "contractor" | "airline" | "subscription"`

**Step 2 — State Selection**  
Searchable dropdown of US states + DC.  
Inline note if selected state is covered in the statute library vs. falling back to general-principles letter. This is surfaced from a static JSON list bundled with the app.

**Step 3 — Dispute Details**  
Fields vary by `dispute_class`. See Section 6.1 for the full field set. All fields are optional at the form level; Stage 1 of the pipeline determines what is actually required and emails the customer if something critical is missing.

**Step 4 — Document Upload (optional)**  
Accepts PDF, JPG, PNG up to 10 MB. Upload goes to `/api/upload` which returns a signed GCS URL; the file is PUT directly from the browser to GCS. The Firestore order record stores the GCS path, not the file content.

**Step 5 — Contact & Tier Selection**  
Email address (used as the identity anchor). Tier radio: Demand Letter ($39) or Letter + Escalation Pack ($59). Optional add-on: Response Review (+$19, shown as a checkbox that dynamically updates the displayed total).

**Step 6 — Review & Pay**  
Summary of entered details. Clicking "Pay" creates an intake record in Firestore (status: `intake_draft`), then redirects to Stripe Checkout.

### 4.3 Order Status Page

The `/orders/[orderId]` page polls `/api/orders/[orderId]` every 10 seconds while status is `processing`. Once `delivered`, it shows:

- The rendered letter (HTML view, not PDF download — keeps them on the page longer)
- A "Download PDF" button (signed GCS URL, 1-hour expiry)
- Plain-English cover note
- "Request a Revision" button (visible while `revision_count < 1`)
- For Escalation Pack customers: small-claims roadmap, follow-up letter, evidence checklist

### 4.4 Admin Dashboard

Available at `/admin`, IP-restricted and bearer-token gated. Renders:

- Orders per day (last 30 days) — bar chart
- Cumulative revenue — line chart
- Review queue: list of orders requiring action with one-click Approve/Flag buttons
- Pipeline health: median delivery time, QA failure rate, cost per order (last 24 h / 7 d)
- Outcome funnel: delivered → day-7 email sent → day-7 response received → recovery reported

---

## 5. Backend Architecture

### 5.1 Next.js API Routes — Responsibility Boundaries

Each API route has a single job. Authentication logic is centralized in a `withAuth` middleware. No AI calls happen in API routes.

### 5.2 Stripe Webhook Handler (`/api/webhooks/stripe`)

This is the most critical route in the system. It must be correct; losing a payment event means a customer paid and got nothing.

```typescript
// Condensed logic — see full implementation in app/api/webhooks/stripe/route.ts

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  // Idempotency: check if this event_id has already been processed
  const existing = await getProcessedEvent(event.id);
  if (existing) return new Response('Already processed', { status: 200 });

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata!; // Contains order_id, customer_id, tier set at checkout creation

    await db.orders.updateStatus(metadata.order_id, 'paid', {
      stripe_payment_intent: session.payment_intent as string,
      stripe_session_id: session.id,
      amount_paid: session.amount_total! / 100,
    });

    await enqueueOrder(metadata.order_id);
    await markEventProcessed(event.id);
  }

  return new Response('OK', { status: 200 });
}
```

**Important implementation details:**
- The raw request body must be read as text (not JSON) before signature verification. Next.js body parsing must be disabled for this route.
- Idempotency check on `event.id` prevents double-processing if Stripe retries.
- `enqueueOrder` creates a Cloud Tasks task targeting the worker's `/process-order` endpoint.
- Any error after `markEventProcessed` is a bug, not a duplicate. Log aggressively.

### 5.3 Worker Service

The worker is a separate Cloud Run service (not a Next.js route) because pipeline runs can take 60–120 seconds and Cloud Run has a 60-second request timeout by default for the app service. The worker's Cloud Run service is configured with `--timeout=300`.

```typescript
// worker/index.ts
import express from 'express';
import { runPipeline } from './pipeline';

const app = express();
app.use(express.json());

// Validate the request comes from Cloud Tasks
app.use((req, res, next) => {
  const taskHeader = req.headers['x-cloudtasks-taskname'];
  if (!taskHeader) return res.status(403).json({ error: 'Not a Cloud Tasks request' });
  next();
});

app.post('/process-order', async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: 'Missing orderId' });

  // Respond 200 immediately so Cloud Tasks doesn't retry while we're working
  res.status(200).json({ accepted: true });

  // Run pipeline asynchronously
  runPipeline(orderId).catch(err => {
    console.error(`Pipeline failed for order ${orderId}:`, err);
    // parkOrderInReviewQueue is called inside runPipeline on failure
  });
});

app.listen(8080);
```

Note the pattern: respond 200 before the async work begins. Cloud Tasks will not retry a 200 response. If the worker crashes mid-pipeline, Cloud Tasks will retry (which is fine — Stage 1 extraction is idempotent by design if the order status is checked first).

---

## 6. The Agent Pipeline — Deep Specification

### 6.1 Stage 1 — Intake Validation & Extraction

**Model:** Gemini Flash  
**Input:** Raw intake fields + extracted text from uploaded documents (via Gemini multimodal if documents present)  
**Output:** Normalized `CaseFile` JSON + completeness verdict

**Intake field set by dispute class:**

```typescript
// Shared across all classes
interface BaseIntakeFields {
  dispute_class: 'security_deposit' | 'contractor' | 'airline' | 'subscription';
  state: string;              // Two-letter abbreviation
  customer_name: string;
  customer_address: string;
  customer_email: string;
  other_party_name: string;
  other_party_address: string;
  other_party_email?: string;
  incident_date: string;      // ISO date: when the wrong happened
  notice_given_date?: string; // Date customer notified other party
  demand_amount: number;      // Dollar amount customer is seeking
  description: string;        // Free text: what happened
  uploaded_doc_paths: string[]; // GCS paths
}

interface SecurityDepositFields extends BaseIntakeFields {
  lease_start_date: string;
  lease_end_date: string;
  move_out_date: string;
  deposit_amount: number;
  deposit_returned_amount: number; // 0 if nothing returned
  landlord_name: string;
  landlord_address: string;
  property_address: string;
  deductions_claimed?: string; // What landlord claimed to deduct for
}

interface ContractorFields extends BaseIntakeFields {
  contract_date?: string;
  deposit_paid: number;
  work_completed: boolean;
  work_completion_date?: string;
  contract_amount: number;
  amount_paid_total: number;
}

interface AirlineFields extends BaseIntakeFields {
  airline_name: string;
  flight_number?: string;
  flight_date: string;
  cancellation_type: 'airline_cancelled' | 'significant_delay' | 'customer_cancelled';
  delay_hours?: number;
  refund_requested_date?: string;
  refund_denied: boolean;
}

interface SubscriptionFields extends BaseIntakeFields {
  company_name: string;
  service_name: string;
  cancellation_date: string;
  cancellation_method: 'email' | 'phone' | 'online' | 'in_person';
  continued_charges_count: number;
  continued_charges_total: number;
  last_charge_date: string;
}
```

**Stage 1 output schema:**

```typescript
interface CaseFile {
  // Normalized party information
  customer: { name: string; address: string; email: string; };
  respondent: { name: string; address: string; email?: string; };
  
  // Dispute metadata
  dispute_class: DisputeClass;
  state: string;
  jurisdiction_notes: string; // E.g., "case appears to involve San Francisco, which has additional local ordinances"
  
  // Financials
  original_amount: number;    // What customer paid/is owed
  demand_amount: number;      // What they're asking for (may differ if statutory multiplier applies)
  amount_computation_notes: string;
  
  // Timeline
  key_dates: Array<{ label: string; date: string; significance: string; }>;
  days_elapsed: number;       // From incident_date to today
  
  // Document summary
  documents_processed: Array<{ filename: string; summary: string; key_facts_extracted: string[]; }>;
  
  // Completeness
  completeness_verdict: 'complete' | 'needs_followup';
  missing_fields: Array<{ field: string; why_needed: string; }>;
  
  // Dispute-class-specific extracted fields
  class_data: SecurityDepositCaseData | ContractorCaseData | AirlineCaseData | SubscriptionCaseData;
}
```

**Completeness handling:** If `completeness_verdict === 'needs_followup'`, Stage 1 sends an email to the customer (via the email service) listing the missing fields and a link back to their intake. The order is parked at `status: 'awaiting_intake_completion'`. This is not a failure; it's a designed state.

**Critical fields by class (order will not proceed without these):**

| Class | Critical fields |
|---|---|
| security_deposit | `move_out_date`, `deposit_amount`, `landlord_address`, `property_address` |
| contractor | `deposit_paid`, `contract_date` OR `description` with date reference |
| airline | `airline_name`, `flight_date`, `cancellation_type` |
| subscription | `cancellation_date`, `continued_charges_total` |

---

### 6.2 Stage 2 — Jurisdiction Research

**Model:** Gemini Flash  
**Input:** `CaseFile` from Stage 1 + statute library loaded for `(state, dispute_class)`  
**Output:** `StatuteSet` — the specific laws that apply, with computed deadlines and penalties

The model does **not** recall statutes from training. It selects from the curated library. The prompt provides the full library entry for the relevant state/class and instructs the model to select and apply applicable provisions.

```typescript
interface StatuteSet {
  primary_statutes: Array<{
    citation: string;         // E.g., "Cal. Civ. Code § 1950.5"
    plain_language: string;   // One sentence
    how_it_applies: string;   // Why it applies to this specific case
    library_id: string;       // Internal ID confirming it came from the library
  }>;
  
  deadlines_violated: Array<{
    citation: string;
    deadline_description: string;  // E.g., "21 days to return deposit after move-out"
    deadline_date: string;         // Computed: move_out_date + 21 days
    days_overdue: number;          // Computed
  }>;
  
  penalty_provisions: Array<{
    citation: string;
    description: string;           // E.g., "up to 2x deposit amount if willful"
    computed_penalty_min: number;
    computed_penalty_max: number;
    penalty_condition: string;     // What the customer must prove to claim it
  }>;
  
  total_demand_floor: number;      // Original amount
  total_demand_ceiling: number;    // Original + max statutory penalties
  recommended_demand: number;      // What Stage 3 should demand (typically ceiling for leverage)
  
  notice_requirements: string[];   // Any required pre-suit notice steps
  fallback_used: boolean;          // true if state not in library
  fallback_note?: string;          // Message to include in letter if fallback
}
```

**Fallback behavior:** If the state is not in the library for the given dispute class, Stage 2 sets `fallback_used: true` and populates statutes using only federal law (DOT rules for airline, FTC for subscriptions) or general contract law principles. The letter and cover note will explicitly tell the customer no state statute was cited and recommend verifying locally.

---

### 6.3 Stage 3 — Drafting

**Model:** Gemini Pro  
**Input:** `CaseFile` + `StatuteSet`  
**Output:** `DraftLetter` (Markdown, rendered against a strict skeleton) + `CoverNote`

This is the only stage where writing quality is the primary output. Pro is used here and nowhere else.

**Letter skeleton (enforced in prompt):**

```
[DATE]

[RESPONDENT NAME]
[RESPONDENT ADDRESS]

Re: Demand for [TYPE] — [BRIEF DESCRIPTION]

Dear [RESPONDENT NAME OR "Sir/Madam"],

I. BACKGROUND

[3–5 sentences: who the customer is, what the relationship was, 
the relevant dates, and what happened.]

II. YOUR LEGAL OBLIGATIONS

[For each primary statute:
  - State the requirement in plain language
  - Cite the statute
  - State how the respondent violated it, with specific dates/amounts]

III. DEMAND

[Specific dollar amount with computation:
  - Original amount: $X
  - [Statutory penalty provision]: up to $Y (cite statute)
  - Total demand: $Z
  
  You are directed to remit $[amount] by [date = today + 14 days].]

IV. CONSEQUENCES OF NON-RESPONSE

[If payment is not received by [deadline], I will pursue all 
available legal remedies including filing in [state] small claims 
court, which may result in additional costs and fees being 
awarded against you.]

Sincerely,

[CUSTOMER NAME]
[CUSTOMER ADDRESS]
[CUSTOMER EMAIL]

---
NOTICE: This letter was prepared by the sender and does not 
constitute legal advice from FairClaim or any attorney.
```

**Content rules enforced in drafting prompt and checked by QA:**
1. Every dollar figure must trace to an intake field or a statutory multiplier computation. No invented numbers.
2. Every statute cited must appear in the `StatuteSet`. The drafting prompt includes the statute set as context and instructs the model to use only those citations.
3. Letter is written in first person from the customer. FairClaim is never the author.
4. No legal conclusions beyond what the cited statute plainly states (e.g., "you violated Section X which required Y" is fine; "you are liable for fraud" is not unless a fraud statute is cited).
5. Tone is formal, firm, and professional — not threatening or abusive.

**Cover note format:**
A separate 200–300 word plain-English companion document that explains: what the letter says, why the cited statutes matter, what the customer should expect, and what to do next. Written in second person ("Your letter cites...").

---

### 6.4 Stage 4 — Adversarial QA

**Model:** Gemini Flash  
**Input:** `DraftLetter` + `StatuteSet` + `CaseFile`  
**Output:** `QAResult` — pass or structured critique

This stage runs as a separate model call with a "prosecutor" persona specifically instructed to find problems.

**QA checks performed:**

```typescript
interface QAResult {
  verdict: 'pass' | 'fail';
  
  citation_checks: Array<{
    citation_found_in_letter: string;
    exists_in_statute_set: boolean;
    matches_case_facts: boolean;
    issue?: string;
  }>;
  
  arithmetic_checks: Array<{
    figure_in_letter: number;
    computed_value: number;
    match: boolean;
    issue?: string;
  }>;
  
  date_checks: Array<{
    date_in_letter: string;
    source: string;       // Which intake field this should match
    match: boolean;
    issue?: string;
  }>;
  
  advice_check: {
    passed: boolean;
    flagged_sentences: string[]; // Sentences that read as FairClaim giving legal advice
  };
  
  authorship_check: {
    passed: boolean;
    issues: string[]; // Sentences that imply FairClaim is the author
  };
  
  critique_for_retry?: string; // If verdict is 'fail': structured critique fed back to Stage 3
}
```

**Retry logic:** On `verdict: 'fail'`, Stage 3 is called again with the critique appended to the prompt: `"A quality reviewer found the following issues. Fix all of them: [critique]"`. The retry produces a new draft which is sent back to Stage 4. On a second failure, the order is parked in the review queue with both draft versions and the QA critiques attached.

---

### 6.5 Stage 5 — Escalation Guidance (Paid Tier)

**Model:** Gemini Flash  
**Input:** `CaseFile` + `StatuteSet` + per-state procedural reference  
**Output:** Three documents: small-claims roadmap, follow-up letter template, evidence checklist

**Per-state procedural reference schema (YAML, separate from statute library):**

```yaml
# statute-library/data/CA/small-claims-procedure.yaml
state: CA
court_name: "California Small Claims Court"
filing_venue_rule: "File in the county where the defendant lives or where the contract was signed"
amount_limit_individual: 12500
amount_limit_business: 6250
filing_fee_ranges:
  - up_to: 1500
    fee: 30
  - up_to: 5000
    fee: 50
  - up_to: 12500
    fee: 75
service_methods: ["personal service", "certified mail with return receipt"]
timeline_days_to_hearing: "30–70 days after filing"
self_help_url: "https://www.courts.ca.gov/selfhelp-smallclaims.htm"
notes: "California requires plaintiff to appear in person; no attorneys allowed"
```

**Small-claims roadmap format:**
A step-by-step checklist (1–8 steps) specific to the county if determinable from the respondent's address, otherwise to the state. Each step includes what to do, estimated time, and estimated cost. Includes the self-help URL.

---

### 6.6 Pipeline Orchestration

```typescript
// worker/pipeline.ts
export async function runPipeline(orderId: string): Promise<void> {
  const order = await db.orders.get(orderId);
  
  // Idempotency: if already delivered, skip
  if (order.status === 'delivered') return;
  
  await db.orders.updateStatus(orderId, 'processing');

  try {
    // Load intake data
    const intakeData = await db.intakes.get(orderId);
    
    // Stage 1
    const caseFile = await runStage('stage1', orderId, () => 
      stage1IntakeValidation(intakeData)
    );
    
    if (caseFile.completeness_verdict === 'needs_followup') {
      await sendCompletionRequestEmail(order.customer_email, caseFile.missing_fields, orderId);
      await db.orders.updateStatus(orderId, 'awaiting_intake_completion');
      return;
    }
    
    // Stage 2
    const statuteSet = await runStage('stage2', orderId, () =>
      stage2JurisdictionResearch(caseFile)
    );
    
    // Stage 3
    const draft = await runStage('stage3', orderId, () =>
      stage3Draft(caseFile, statuteSet)
    );
    
    // Stage 4 (with retry)
    let qaResult = await runStage('stage4', orderId, () =>
      stage4QA(draft, statuteSet, caseFile)
    );
    
    let finalDraft = draft;
    if (qaResult.verdict === 'fail') {
      const retryDraft = await runStage('stage3-retry', orderId, () =>
        stage3Draft(caseFile, statuteSet, qaResult.critique_for_retry)
      );
      qaResult = await runStage('stage4-retry', orderId, () =>
        stage4QA(retryDraft, statuteSet, caseFile)
      );
      finalDraft = retryDraft;
      
      if (qaResult.verdict === 'fail') {
        await parkInReviewQueue(orderId, { draft, retryDraft, qaResult });
        return;
      }
    }
    
    // Stage 5 (if paid tier)
    let escalationPack = null;
    if (order.tier === 'escalation_pack') {
      escalationPack = await runStage('stage5', orderId, () =>
        stage5Escalation(caseFile, statuteSet)
      );
    }
    
    // Render PDF
    const pdfPath = await renderAndStorePDF(orderId, finalDraft, escalationPack);
    
    // Save letter
    await db.letters.save(orderId, { draft: finalDraft, pdf_path: pdfPath, qa_result: qaResult });
    
    // Deliver
    await sendDeliveryEmail(order.customer_email, orderId, pdfPath);
    await db.orders.updateStatus(orderId, 'delivered');
    
    // Schedule follow-ups
    await scheduleOutcomeFollowup(orderId, order.customer_email, 7);
    await scheduleOutcomeFollowup(orderId, order.customer_email, 21);
    
  } catch (err) {
    await parkInReviewQueue(orderId, { error: String(err) });
    throw err;
  }
}

// Wrapper that logs timing, tokens, and cost for every stage
async function runStage<T>(
  stage: string,
  orderId: string,
  fn: () => Promise<{ result: T; usage: GeminiUsage }>
): Promise<T> {
  const start = Date.now();
  const { result, usage } = await fn();
  await db.pipelineRuns.log({
    order_id: orderId,
    stage,
    latency_ms: Date.now() - start,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    estimated_cost_usd: computeCost(stage, usage),
    passed: true,
  });
  return result;
}
```

---

## 7. Statute Reference Library

### 7.1 Structure and Philosophy

The library is the primary defense against incorrect legal citations. It is a human-verified, version-controlled YAML dataset. The AI selects from the library; it never invents citations. Every entry must be verified against the actual state statute text before committing.

### 7.2 Entry Schema (Security Deposit — Full Example)

```yaml
# statute-library/data/CA/security-deposit.yaml
state: CA
dispute_class: security_deposit
last_verified: "2026-01-15"
verified_by: "manual review against Cal. Civ. Code"
notes: "San Francisco has additional local ordinances (see sf-security-deposit.yaml)"

statutes:
  - id: CA-SD-001
    citation: "Cal. Civ. Code § 1950.5(g)"
    short_name: "Deposit Return Deadline"
    plain_language: "Landlord must return security deposit within 21 days of move-out"
    deadline_rule:
      trigger_field: "move_out_date"
      days: 21
      type: "calendar"
    applies_when: "always"
    
  - id: CA-SD-002
    citation: "Cal. Civ. Code § 1950.5(h)"
    short_name: "Itemized Statement Requirement"
    plain_language: "If deductions are made, landlord must provide an itemized statement of deductions within 21 days"
    applies_when: "deposit_returned_amount < deposit_amount"
    
  - id: CA-SD-003
    citation: "Cal. Civ. Code § 1950.5(l)"
    short_name: "Bad Faith Penalty"
    plain_language: "If landlord acts in bad faith, tenant may recover twice the deposit amount as a penalty"
    penalty:
      type: "multiplier"
      multiplier: 2
      base_field: "deposit_amount"
      condition: "bad_faith"
      condition_note: "Bad faith is inferred when landlord fails to return deposit without reason after the 21-day deadline with no itemization"
    applies_when: "days_since_move_out > 21 AND deposit_returned_amount == 0 AND no_itemization_provided"
    
  - id: CA-SD-004
    citation: "Cal. Civ. Code § 1950.5(b)"
    short_name: "Permitted Deductions Only"
    plain_language: "Landlord may only deduct for unpaid rent, cleaning costs beyond normal wear and tear, damage beyond normal wear and tear, and restoration costs"
    applies_when: "deductions_claimed IS NOT NULL"

required_notice: null
small_claims_limit: 12500
```

**Other vertical entry schemas** follow the same pattern with dispute-class-appropriate fields.

### 7.3 Library Coverage Build Plan

```
Week 1 (Jul 4–10):  Security deposit vertical, top 10 states by population
                    CA, TX, FL, NY, PA, IL, OH, GA, NC, MI
                    
Week 2 (Jul 11–17): All 4 verticals, same 10 states

Week 3+:            Add states on demand as orders arrive from other states
                    ~30 min per state/vertical to draft + verify
```

### 7.4 Library Loader

```typescript
// lib/statute-library/loader.ts
import { parse } from 'yaml';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';

interface StatuteLibraryEntry { /* matches YAML schema */ }

// Loaded once at worker startup; refreshed on deploy
const library = new Map<string, StatuteLibraryEntry>();

export function loadStatuteLibrary(): void {
  const dataDir = path.join(process.cwd(), 'statute-library', 'data');
  const states = readdirSync(dataDir);
  
  for (const state of states) {
    const stateDir = path.join(dataDir, state);
    const files = readdirSync(stateDir).filter(f => f.endsWith('.yaml'));
    
    for (const file of files) {
      const content = readFileSync(path.join(stateDir, file), 'utf-8');
      const entry = parse(content) as StatuteLibraryEntry;
      const key = `${state}:${entry.dispute_class}`;
      library.set(key, entry);
    }
  }
}

export function getStatuteEntry(state: string, disputeClass: string): StatuteLibraryEntry | null {
  return library.get(`${state}:${disputeClass}`) ?? null;
}

export function getCoveredStates(disputeClass: string): string[] {
  return Array.from(library.keys())
    .filter(k => k.endsWith(`:${disputeClass}`))
    .map(k => k.split(':')[0]);
}
```

---

## 8. Data Model — Full Schema

### 8.1 Firestore Collections

All documents use auto-generated IDs unless noted. Timestamps are Firestore `Timestamp` objects.

**`customers`**
```typescript
interface CustomerDoc {
  id: string;             // Auto-generated
  email: string;          // Lowercase, trimmed; unique index
  created_at: Timestamp;
  order_count: number;    // Incremented on each new order
  last_order_at: Timestamp;
}
```

**`orders`**
```typescript
type OrderStatus = 
  | 'intake_draft'              // Form in progress, not yet paid
  | 'paid'                      // Payment confirmed, not yet processing
  | 'processing'                // Worker running pipeline
  | 'awaiting_intake_completion' // Missing required fields
  | 'review'                    // Parked for human review
  | 'delivered'                 // Letter sent to customer
  | 'revision_requested'        // Customer requested a revision
  | 'revision_delivered';       // Revision letter sent

interface OrderDoc {
  id: string;
  customer_id: string;
  customer_email: string;       // Denormalized for queries without join
  
  tier: 'demand_letter' | 'escalation_pack';
  add_ons: ('response_review')[];
  
  status: OrderStatus;
  dispute_class: DisputeClass;
  state: string;
  
  // Financials
  amount_paid_cents: number;
  stripe_session_id: string;
  stripe_payment_intent: string;
  
  // Document references
  intake_doc_paths: string[];   // GCS paths of uploaded documents
  letter_id?: string;           // Reference to letters collection
  
  // Timestamps
  created_at: Timestamp;
  paid_at?: Timestamp;
  processing_started_at?: Timestamp;
  delivered_at?: Timestamp;
  
  // Review queue metadata
  review_reason?: string;
  reviewed_at?: Timestamp;
  reviewed_by?: string;         // "admin" or email
  
  revision_count: number;       // Max 1 for base tier
}
```

**`intakes`** (sub-collection: `orders/{orderId}/intake`)
```typescript
interface IntakeDoc {
  order_id: string;
  raw_fields: Record<string, unknown>;  // Everything the customer submitted
  normalized_case_file?: CaseFile;      // Set after Stage 1
  updated_at: Timestamp;
}
```

**`letters`** (sub-collection: `orders/{orderId}/letters`)
```typescript
interface LetterDoc {
  order_id: string;
  version: number;            // 1 = original, 2 = revision
  
  draft_markdown: string;     // Stage 3 output
  cover_note_markdown: string;
  qa_result: QAResult;
  
  pdf_path: string;           // GCS path
  pdf_signed_url?: string;    // Cached; regenerate on expiry
  pdf_signed_url_expires_at?: Timestamp;
  
  created_at: Timestamp;
}
```

**`pipeline_runs`** (sub-collection: `orders/{orderId}/pipeline_runs`)
```typescript
interface PipelineRunDoc {
  order_id: string;
  stage: string;              // 'stage1', 'stage2', 'stage3', 'stage4', 'stage4-retry', 'stage5'
  model: string;
  
  input_hash: string;         // SHA-256 of stage input; used for dedup/debugging
  passed: boolean;
  error?: string;
  
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  
  logged_at: Timestamp;
}
```

**`outcomes`**
```typescript
interface OutcomeDoc {
  order_id: string;
  customer_email: string;
  
  day7_email_sent_at?: Timestamp;
  day7_response?: 'paid' | 'responded' | 'nothing';
  day7_responded_at?: Timestamp;
  
  day21_email_sent_at?: Timestamp;
  day21_response?: 'paid' | 'responded' | 'nothing';
  day21_responded_at?: Timestamp;
  
  recovered_amount?: number;
  testimonial_text?: string;
  testimonial_permission: boolean;
  testimonial_public: boolean;   // Set by admin when used in marketing
  
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

**`events`** (Stripe webhook idempotency)
```typescript
interface ProcessedEventDoc {
  id: string;                 // Stripe event ID (used as document ID)
  processed_at: Timestamp;
}
```

### 8.2 Firestore Indexes

```json
{
  "indexes": [
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "customer_email", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "outcomes",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "testimonial_permission", "order": "ASCENDING" },
        { "fieldPath": "recovered_amount", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### 8.3 Cloud Storage Bucket Structure

```
fairclaim-uploads/
├── uploads/
│   └── {orderId}/
│       └── {timestamp}-{originalFilename}    # Raw customer uploads
├── pdfs/
│   └── {orderId}/
│       ├── letter-v1.pdf                     # Original letter
│       └── letter-v2.pdf                     # Revision (if any)
└── exports/                                  # Admin exports; manually created
    └── ...
```

**Lifecycle rule:** Objects in `uploads/` are deleted after 30 days (configured via GCS lifecycle policy). Objects in `pdfs/` are retained for 1 year (customer may need to re-download).

---

## 9. API Reference

All API routes are Next.js Route Handlers. Authentication is via the customer's email address tied to their session (magic link / email OTP). Admin routes are additionally IP-restricted.

### 9.1 Customer-Facing Routes

**`POST /api/intake`** — Save intake draft  
Request: `{ intakeFields: IntakeFields }`  
Response: `{ orderId: string }` (creates `intake_draft` order)

**`POST /api/upload`** — Get signed upload URL  
Request: `{ orderId: string; filename: string; mimeType: string }`  
Response: `{ signedUrl: string; gcsPath: string }`  
Note: Creates the GCS object path; client PUTs the file directly to the signed URL.

**`POST /api/checkout`** — Create Stripe Checkout session  
Request: `{ orderId: string; tier: Tier; addOns: AddOn[] }`  
Response: `{ checkoutUrl: string }` — redirect to this URL  
Note: Validates the order exists and is in `intake_draft` status; creates Stripe session with `metadata: { order_id, customer_id, tier }`.

**`GET /api/orders`** — List customer's orders  
Auth: Session (customer sees only their own orders)  
Response: `{ orders: OrderSummary[] }`

**`GET /api/orders/[orderId]`** — Order detail  
Auth: Session (must own order) or admin token  
Response: `{ order: OrderDoc; letter?: LetterDoc; signedPdfUrl?: string }`

**`POST /api/orders/[orderId]/revision`** — Request a revision  
Request: `{ feedback: string }` — what to change  
Response: `{ accepted: boolean; message: string }`  
Note: Only accepted if `revision_count < 1` and order is `delivered`. Creates a new pipeline run for stages 3–4 with the feedback appended.

**`POST /api/outcomes`** — One-click outcome response  
Request: `{ token: string; response: 'paid' | 'responded' | 'nothing' }` — token is a signed JWT with `orderId` and `day` embedded  
Response: `{ thanks: string }`  
Note: This endpoint is linked from follow-up emails. No auth session required; the signed token is the authentication.

### 9.2 Admin Routes (IP-restricted + Bearer token)

**`GET /api/admin/orders`** — Full order list with filters  
Query params: `status`, `since`, `limit`, `offset`  
Response: `{ orders: OrderDoc[]; total: number }`

**`POST /api/admin/orders/[orderId]/approve`** — Approve a review-queue order  
Body: `{ action: 'approve' | 'flag'; note?: string }`  
On approve: triggers PDF render + delivery email.

**`GET /api/admin/metrics`** — Aggregated metrics  
Response:  
```typescript
{
  orders_total: number;
  orders_by_status: Record<OrderStatus, number>;
  orders_by_day: Array<{ date: string; count: number; revenue_usd: number }>;
  revenue_total_usd: number;
  revenue_by_tier: Record<Tier, number>;
  pipeline: {
    median_latency_ms: number;
    qa_failure_rate: number;
    cost_per_order_usd: number;
    review_queue_size: number;
  };
  outcomes: {
    day7_response_rate: number;
    day21_response_rate: number;
    total_recovered_usd: number;
    testimonial_count: number;
  };
}
```

**`GET /api/admin/metrics/total-recovered`** — Public-safe aggregate  
Response: `{ total_recovered_usd: number; customer_count: number }` — used by the website's "total recovered" counter.

---

## 10. Payment Integration

### 10.1 Checkout Session Creation

```typescript
// lib/stripe/client.ts
export async function createCheckoutSession(params: {
  orderId: string;
  customerId: string;
  customerEmail: string;
  tier: Tier;
  addOns: AddOn[];
}): Promise<string> {
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price: tierToPriceId(params.tier),
      quantity: 1,
    },
  ];
  
  if (params.addOns.includes('response_review')) {
    lineItems.push({ price: process.env.STRIPE_PRICE_RESPONSE_REVIEW!, quantity: 1 });
  }
  
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems,
    customer_email: params.customerEmail,
    metadata: {
      order_id: params.orderId,
      customer_id: params.customerId,
      tier: params.tier,
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/orders/${params.orderId}?payment=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/intake?cancelled=true`,
    allow_promotion_codes: false,   // No discount codes during competition window
    payment_intent_data: {
      description: `FairClaim — ${tierLabel(params.tier)}`,
    },
  });
  
  return session.url!;
}
```

### 10.2 Refund Flow

Refunds are processed manually via Stripe Dashboard (no automated refund API route needed for competition scope). The 7-day unconditional refund policy means: when a customer emails for a refund within 7 days, log into Stripe and issue a full refund. Update `order.status` to `'refunded'` in Firestore.

---

## 11. PDF Generation

### 11.1 Approach

Letters are HTML templates rendered server-side to PDF. Using `@playwright/test` (Playwright's PDF generation via headless Chromium) or a lightweight library like `pdf-lib` + HTML. The recommended approach for this scale is **Puppeteer on the worker** (Chromium is available in the worker Docker image).

```typescript
// lib/pdf/renderer.ts
import puppeteer from 'puppeteer';

export async function renderLetterToPDF(params: {
  letterMarkdown: string;
  coverNoteMarkdown: string;
  customerName: string;
  orderId: string;
}): Promise<Buffer> {
  const html = buildLetterHTML(params); // Compile Markdown → HTML + inject into template
  
  const browser = await puppeteer.launch({ 
    args: ['--no-sandbox', '--disable-setuid-sandbox'] // Required in Cloud Run
  });
  
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  
  const pdf = await page.pdf({
    format: 'Letter',
    margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
    printBackground: false,
  });
  
  await browser.close();
  return pdf;
}
```

### 11.2 Letter HTML Template

```html
<!-- lib/pdf/templates/demand-letter.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 12pt;
      line-height: 1.5;
      color: #000;
    }
    .date { margin-bottom: 2em; }
    .recipient { margin-bottom: 2em; }
    .re-line { margin-bottom: 2em; font-weight: bold; }
    h2 { font-size: 12pt; text-transform: uppercase; margin-top: 1.5em; }
    .signature-block { margin-top: 3em; }
    .disclaimer {
      margin-top: 3em;
      padding-top: 1em;
      border-top: 1px solid #999;
      font-size: 9pt;
      color: #555;
    }
    /* Ensure no FairClaim branding in the letter itself */
  </style>
</head>
<body>
  {{LETTER_CONTENT}}
  <div class="disclaimer">
    NOTICE: This letter was prepared by the sender. It does not constitute legal advice from 
    FairClaim or any licensed attorney. The sender is responsible for reviewing this letter 
    before sending.
  </div>
</body>
</html>
```

### 11.3 Cover Note Template

The cover note has light FairClaim branding (logo, support email) since it's a separate document the customer keeps for their own reference and is not sent to the other party.

---

## 12. Email System

### 12.1 Email Templates

**Delivery email** (triggered: order status → `delivered`)
```
Subject: Your demand letter is ready — FairClaim Order #[SHORT_ID]

Hi [NAME],

Your demand letter is ready. You can view it and download the PDF here:

  [BUTTON: View Your Letter]

What's in your package:
• Demand letter citing [STATUTE SUMMARY]
• Plain-English cover note explaining your rights
[• Small-claims roadmap for [STATE] (Escalation Pack)]

Next steps:
1. Review the letter carefully to confirm all facts are accurate.
2. Send it via certified mail with return receipt requested.
3. Keep a copy and save your tracking number.

We'll check in with you in 7 days to see if you heard back.

Questions? Reply to this email.

FairClaim — Not a law firm. Not legal advice. You're representing yourself.
```

**Day-7 outcome follow-up**
```
Subject: Did they respond? — your FairClaim demand letter

Hi [NAME],

It's been about a week since you sent your demand letter. How did it go?

  [BUTTON: They paid / resolved it ✓]
  [BUTTON: They responded (but not resolved)]  
  [BUTTON: No response yet]

Your answer helps us understand what's working and improves our product. 
It only takes one click.

If you haven't sent the letter yet, you have time — most demand letter deadlines 
are 14–30 days from the date on the letter.
```

**Day-21 outcome follow-up**
```
Subject: 3-week update — your FairClaim letter

Subject line alternates to: "Quick question about your landlord / contractor / etc."

Hi [NAME],

Three weeks ago you sent a demand letter through FairClaim. We're curious about the outcome.

  [BUTTON: I got my money back 🎉]
  [BUTTON: Still going back and forth]
  [BUTTON: No movement — thinking about small claims]
  [BUTTON: Gave up / other]

If you got a resolution, we'd love to share your story (anonymously) to help others 
in the same situation. Reply to this email if you're open to it.
```

### 12.2 Outcome One-Click Tokens

The buttons in follow-up emails link to `/api/outcomes?token=SIGNED_JWT`. The JWT contains `{ orderId, day, iat, exp }`, signed with `ADMIN_SECRET_TOKEN`. Expiry: 90 days. This allows one-click responses without the customer needing to log in.

```typescript
import jwt from 'jsonwebtoken';

export function createOutcomeToken(orderId: string, day: 7 | 21): string {
  return jwt.sign(
    { orderId, day },
    process.env.ADMIN_SECRET_TOKEN!,
    { expiresIn: '90d' }
  );
}

export function verifyOutcomeToken(token: string): { orderId: string; day: 7 | 21 } {
  return jwt.verify(token, process.env.ADMIN_SECRET_TOKEN!) as any;
}
```

---

## 13. Authentication & Session Management

### 13.1 Customer Authentication

For the competition window, a lightweight magic-link approach is sufficient. No passwords; no OAuth.

**Flow:**
1. Customer enters email at the start of intake.
2. An email is sent with a one-time 6-digit code (valid 15 minutes).
3. Code is entered on a verification screen; a session cookie is issued (30-day expiry).
4. Session is tied to the email; all orders with that email are visible.

**Implementation:** Use `iron-session` for session cookie management. Store the OTP in Firestore with a 15-minute TTL (`expires_at` field; delete on use).

**Alternative (simpler for competition window):** Skip authentication entirely. Deliver the order via email with a signed link to view/download. The order page is accessible via a secret URL (`/orders/[orderId]?token=SIGNED_TOKEN`). This is simpler to build and sufficient for the competition window.

---

## 14. Security & Trust Guardrails

### 14.1 Input Screening (Intake Gate)

Before any order proceeds to the pipeline, Stage 1 checks for dispute classes the product must not touch:

```typescript
const BLOCKED_DISPUTE_PATTERNS = [
  'criminal',
  'divorce', 'custody', 'child support',
  'personal injury', 'bodily harm',
  'active litigation', 'pending lawsuit',
  'immigration',
  'bankruptcy',
];

// Stage 1 prompt includes: "If the dispute involves any of the following topics, 
// set dispute_class to 'blocked' and provide a brief reason."
```

If `dispute_class === 'blocked'`: issue an automatic refund via Stripe, send a polite email explaining FairClaim cannot help with this type of dispute, and suggest the customer contact a local legal aid organization.

### 14.2 Amount Ceiling

Disputes above the small-claims limit for the relevant state are flagged (not blocked): the letter is produced, but a note in the cover note tells the customer the amount exceeds small-claims jurisdiction and they should consult an attorney for the litigation path.

### 14.3 Rate Limiting

- `/api/intake`: 10 requests per IP per hour
- `/api/upload`: 5 requests per IP per hour
- `/api/checkout`: 3 requests per IP per hour
- `/api/outcomes`: 50 requests per IP per hour (follow-up links)
- Stripe Checkout: natural rate limit via Stripe

Implement using `@upstash/ratelimit` (Redis) or a simple in-memory store (sufficient at competition volume).

### 14.4 Disposable Email Detection

Check the customer's email against a disposable-domain blocklist (e.g., `mailinator.com`, `guerrillamail.com`) before allowing checkout. Free blocklist packages available on npm.

### 14.5 Data Handling Commitments (Enforced Technically)

| Commitment | Technical enforcement |
|---|---|
| Documents deleted after 30 days | GCS lifecycle rule on `uploads/` prefix |
| Documents not used for training | Never sent to Gemini with `allow_model_training: true` (this is the default; verify) |
| Documents isolated per order | GCS paths include `orderId`; Stage 1 prompt receives only this order's documents |
| Encryption at rest | GCS and Firestore encrypt at rest by default on Google Cloud |
| No other customer's data in prompts | Prompts are assembled per-order; no cross-order context |

### 14.6 Disclaimer Placement

The phrase "Not a law firm. Not legal advice. You are responsible for reviewing before sending." must appear in ALL of:
- Intake form (above the submit button)
- Pre-checkout review page
- Order status page
- Letter cover note (first paragraph)
- Delivery email (footer)
- Website footer (every page)

---

## 15. Infrastructure & Deployment

### 15.1 Cloud Run Services

| Service | CPU | Memory | Min instances | Max instances | Timeout |
|---|---|---|---|---|---|
| `fairclaim-app` | 1 vCPU | 512 MB | 0 | 10 | 60s |
| `fairclaim-worker` | 2 vCPU | 2 GB | 0 (scales to zero) | 5 | 300s |

Worker needs 2 GB because Puppeteer/Chromium is memory-hungry.

### 15.2 Cloud Build Pipeline (`cloudbuild.yaml`)

```yaml
steps:
  # Run tests
  - name: 'node:20'
    entrypoint: 'npm'
    args: ['run', 'test']
    
  # Build app image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/fairclaim-app:$COMMIT_SHA', 
           '-f', 'Dockerfile.app', '.']
    
  # Build worker image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/fairclaim-worker:$COMMIT_SHA',
           '-f', 'Dockerfile.worker', '.']
    
  # Push images
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/fairclaim-app:$COMMIT_SHA']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/fairclaim-worker:$COMMIT_SHA']
    
  # Deploy app
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - run
      - deploy
      - fairclaim-app
      - '--image=gcr.io/$PROJECT_ID/fairclaim-app:$COMMIT_SHA'
      - '--region=us-central1'
      - '--platform=managed'
      - '--allow-unauthenticated'
      
  # Deploy worker (no external traffic; invoked by Cloud Tasks only)
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - run
      - deploy
      - fairclaim-worker
      - '--image=gcr.io/$PROJECT_ID/fairclaim-worker:$COMMIT_SHA'
      - '--region=us-central1'
      - '--platform=managed'
      - '--no-allow-unauthenticated'  # Only Cloud Tasks SA can invoke

trigger:
  branch: main
```

### 15.3 Cloud Tasks Queue Configuration

```
Queue name: fairclaim-pipeline-queue
Max concurrent dispatches: 5     # Match worker max instances
Max attempts: 3
Min backoff: 10s
Max backoff: 300s
```

### 15.4 Domain and DNS

Configure `fairclaim.com` → Cloud Run app service via Google Cloud Load Balancer or direct CNAME (Cloud Run provides a managed TLS certificate).

Subdomains: none needed for competition scope.

---

## 16. Monitoring & Observability

### 16.1 Internal Metrics Dashboard

The admin dashboard at `/admin` is the primary ops tool. It is built as a Next.js page that calls `/api/admin/metrics` and renders charts using a lightweight charting library (e.g., Chart.js via CDN, or Recharts).

**Charts to render:**

1. **Orders per day** (bar chart, last 30 days) — primary evidence for the submission
2. **Cumulative revenue** (line chart) — second screenshot for the submission
3. **Pipeline health** (four stat cards):
   - Median delivery time (target: <10 min)
   - QA failure rate (target: <10%)
   - Cost per order (target: <$2)
   - Review queue depth (target: 0)
4. **Outcome funnel** (horizontal bar):
   - Delivered → Day-7 email sent → Day-7 response → Recovery reported
5. **Total recovered counter** (large number, bold) — the impact metric

### 16.2 Alerting

Configure email alerts (via Cloud Monitoring or a simple cron + email) for:

- Any order in `review` status for more than 2 hours
- QA failure rate > 20% in the last 24 hours
- Pipeline not processing (no `delivered` orders in 4 hours during business hours)
- Stripe webhook failures (check Stripe Dashboard → Webhooks → Failed deliveries)

### 16.3 Log Strategy

Every pipeline stage logs to Firestore (`pipeline_runs` sub-collection). Structured logs from the worker also go to Cloud Logging automatically. Key log lines to emit:

```
[pipeline] Order {orderId} started
[stage1] Order {orderId} extraction complete — {fields_extracted} fields, completeness: {verdict}
[stage2] Order {orderId} jurisdiction: {state}/{class} — {statute_count} statutes, library_hit: {hit}
[stage3] Order {orderId} draft complete — {word_count} words
[stage4] Order {orderId} QA verdict: {verdict} — {issue_count} issues
[stage4-retry] Order {orderId} retry QA verdict: {verdict}
[pipeline] Order {orderId} parked in review queue — reason: {reason}
[pipeline] Order {orderId} delivered — total_latency_ms: {ms}, cost_usd: {cost}
```

---

## 17. Error Handling & Recovery

### 17.1 Error Categories

| Category | Example | Handling |
|---|---|---|
| **Intake completeness** | Missing move-out date | Email customer for missing fields; park at `awaiting_intake_completion` |
| **Stage failure (1st attempt)** | Gemini API 503 | Retry once with same input; brief sleep before retry |
| **Stage failure (2nd attempt)** | Persistent API error | Park in review queue; alert owner |
| **QA failure (1st attempt)** | Wrong statute applied | Retry Stage 3 with critique; |
| **QA failure (2nd attempt)** | Still failing | Park in review queue; attach both drafts |
| **PDF render failure** | Chromium crash | Retry once; if fails, park with `error: 'pdf_render_failed'` |
| **Email delivery failure** | Transient email provider error | Retry 3x with exponential backoff; log permanently if all fail |
| **Payment/webhook failure** | Stripe delivery failure | Stripe retries for 72 hours; monitor Stripe Dashboard |
| **Blocked dispute** | Criminal matter | Auto-refund + polite rejection email |

### 17.2 Review Queue Operations

The review queue is the catch-all. An order in `review` status has:
- The reason for parking attached (`review_reason` field)
- All pipeline stage outputs attached in `pipeline_runs` sub-collection
- A one-click approve button in the admin dashboard

**Approve flow (admin action):**
1. Admin clicks "Approve" in the dashboard
2. If a good draft exists: renders PDF from the best available draft and sends delivery email
3. If no good draft: admin can paste corrected content into a text area, which is used for PDF rendering
4. Order status → `delivered`

---

## 18. Testing Strategy

### 18.1 Golden Set Regression Tests

15 anonymized real cases (seeded from Phase 0 manual orders) with verified expected outputs. Run after every prompt change.

```bash
npm run test:golden-set
# Runs pipeline against all cases in /golden-set/cases/*.json
# Diffs output against /golden-set/expected/*.json
# Fails if any citation in output is not in the statute library
# Fails if any dollar figure doesn't match computation
# Reports QA verdict for each case
```

### 18.2 Unit Tests

Key units to test in isolation:
- Statute library loader (covers all states in the data directory, no missing keys)
- Stage 1 field normalization (date parsing, amount parsing)
- Stage 2 statute selection (given a case file, returns correct library entries)
- Stage 4 QA arithmetic check
- Outcome token sign/verify
- PDF template rendering (produces non-empty buffer)

### 18.3 Integration Tests (Lightweight)

A single end-to-end smoke test per commit:
1. POST a synthetic intake to `/api/intake` → get orderId
2. Simulate a Stripe webhook `checkout.session.completed`
3. Poll `/api/orders/[orderId]` until `status === 'delivered'` (timeout: 5 minutes)
4. Assert the `letter` document exists in Firestore
5. Assert a PDF exists at the expected GCS path

Run this test in Cloud Build on the staging environment before deploying to production.

---

## 19. Prompt Engineering Reference

### 19.1 Version Control Convention

Prompts live in `/prompts/`. Each file is a Markdown document with a changelog header:

```markdown
# Stage 3 — Drafting Prompt
# Version: 1.4
# Last changed: 2026-07-09
# Changed by: [author]
# Change: Fixed tone in consequences paragraph — was too aggressive, flagged in QA

---
[PROMPT TEXT BELOW]
```

The `CHANGELOG.md` in `/prompts/` tracks the version history and what changed between versions. Before deploying a prompt change, run the golden set and diff the results.

### 19.2 Stage-Level Prompt Skeletons

**Stage 1 System Prompt (abridged):**
```
You are a legal document intake processor. Your job is to normalize customer-submitted 
dispute information into a structured case file.

You will receive:
- Raw intake form fields (JSON)
- Text extracted from uploaded documents (if provided)

You must output a single valid JSON object matching the CaseFile schema exactly.
No preamble. No markdown. Just the JSON.

Rules:
- Normalize all dates to ISO 8601 (YYYY-MM-DD)
- Normalize all amounts to numbers (remove $ signs, commas)
- If a field is ambiguous, choose the most conservative interpretation
- completeness_verdict is 'needs_followup' only if a critical field is truly missing 
  and cannot be inferred
- Never invent information. If a value is not in the input, leave the field null.
```

**Stage 2 System Prompt (abridged):**
```
You are a jurisdiction researcher. You will be given a case file and a statute library 
entry for the relevant state and dispute class.

IMPORTANT: You may ONLY cite statutes that appear in the provided library. 
Do not recall statutes from memory. Do not cite statutes not in the library.

Your job is to:
1. Select the applicable statutes from the library for this specific case
2. Compute deadlines based on the case's dates
3. Compute the maximum statutory penalty based on the case's amounts
4. Determine the recommended demand amount

Output a single valid JSON object matching the StatuteSet schema. No preamble. No markdown.
```

**Stage 3 System Prompt (abridged):**
```
You are a professional legal document drafter. You write demand letters on behalf of 
consumers who are representing themselves.

The letter must:
- Be written in first person as if the customer is the author. Never mention FairClaim.
- Follow the provided skeleton structure exactly (sections I through IV)
- Cite ONLY the statutes provided in the statute set
- Include ONLY dollar figures that appear in the case file or are computed from 
  statutory multipliers shown in the statute set
- Be firm, professional, and specific — not threatening or abusive
- End with the customer's name and contact information as the signatory

[STATUTE SET]
{statuteSet}

[CASE FILE]
{caseFile}

[REVISION FEEDBACK, if any]
{revisionFeedback}

Draft the letter in Markdown, following the skeleton. Then draft the cover note.
Separate them with "---COVER NOTE---".
```

**Stage 4 System Prompt (abridged):**
```
You are an adversarial quality reviewer for a legal document preparation service. 
Your job is to find errors that could embarrass the customer or constitute practicing law.

Review the following demand letter and check for:
1. CITATIONS: Every statute cited must appear in the provided statute set. 
   Flag any citation not in the statute set as a critical error.
2. ARITHMETIC: Every dollar figure must trace to the case file or a statutory computation. 
   Verify all arithmetic. Flag any discrepancy.
3. DATES: All dates must match the case file. Flag any inconsistency.
4. ADVICE: The letter must not assert legal conclusions beyond what the cited statutes 
   plainly provide. Flag any sentence that reads as legal advice.
5. AUTHORSHIP: The letter must appear to be written by the customer. 
   Flag any reference to FairClaim or any AI service.

Output: A JSON QAResult object. If verdict is 'fail', the critique_for_retry must be 
specific enough for the drafter to fix the issue without additional context.
```

### 19.3 Structured Output Configuration

All stages except Stage 3 use Gemini's structured output mode with a JSON schema:

```typescript
const result = await geminiClient.generateContent({
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: caseFileSchema,  // Zod schema converted to JSON Schema
    temperature: 0.1,                // Low temperature for factual/structured tasks
    maxOutputTokens: 4096,
  },
});
```

Stage 3 (drafting) uses `responseMimeType: 'text/plain'` and higher temperature (0.7) for better prose quality.

---

## 20. Development Setup Guide

### 20.1 Prerequisites

- Node.js 20+
- Google Cloud CLI (`gcloud`)
- A Google Cloud project with billing enabled
- A Stripe account (test mode for development)
- A Resend or Postmark account for email

### 20.2 Initial Setup

```bash
# 1. Clone and install
git clone https://github.com/[username]/fairclaim
cd fairclaim
npm install

# 2. Copy environment template
cp .env.local.example .env.local
# Fill in all values in .env.local

# 3. Set up Google Cloud
gcloud auth login
gcloud config set project [YOUR_PROJECT_ID]

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  cloudtasks.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com

# Create Firestore database (native mode)
gcloud firestore databases create --region=us-central1

# Create GCS bucket
gsutil mb -l us-central1 gs://fairclaim-uploads
gsutil lifecycle set gcs-lifecycle.json gs://fairclaim-uploads

# Create Cloud Tasks queue
gcloud tasks queues create fairclaim-pipeline-queue \
  --location=us-central1 \
  --max-concurrent-dispatches=5 \
  --max-attempts=3

# 4. Set up Stripe
# - Create products and prices in Stripe Dashboard
# - Copy price IDs to .env.local
# - Set up webhook in Stripe Dashboard pointing to https://[your-domain]/api/webhooks/stripe
# - Copy webhook signing secret to .env.local

# 5. Run development server
npm run dev

# 6. Load statute library
npm run seed-statutes -- --state=CA --class=security_deposit

# 7. Run golden set (will mostly fail until prompts are tuned)
npm run test:golden-set
```

### 20.3 Local Pipeline Testing

The worker can be tested locally without Cloud Tasks:

```bash
# Start the worker locally
cd worker && npm run dev

# In another terminal, trigger a test order:
curl -X POST http://localhost:8080/process-order \
  -H "Content-Type: application/json" \
  -H "x-cloudtasks-taskname: test-task" \
  -d '{"orderId": "test-order-123"}'

# The order must already exist in Firestore (create via the intake form in dev mode)
```

---

## 21. Runbook — Operations During Competition Window

### 21.1 Daily Checklist (5 minutes)

```
□ Check admin dashboard: any orders in review queue?
□ Check Stripe Dashboard: any failed webhook deliveries?
□ Check Cloud Run logs: any errors in the last 24h?
□ Screenshot Stripe revenue dashboard (weekly cumulative; do this every 3 days)
□ Respond to any customer emails
```

### 21.2 Review Queue Processing

When an order is parked in the review queue:
1. Open the order in the admin dashboard
2. Review the pipeline run logs to understand what failed
3. If it's a prompt issue: fix the prompt, run golden set, deploy
4. If it's a statute library gap: add the missing entry, verify, deploy
5. If the draft is good but QA is overly strict: approve the order manually
6. Always document what caused the park in the `review_reason` field

### 21.3 Handling a Wrong Citation (Emergency)

If a customer reports (or you discover) an incorrect statute citation in a delivered letter:

1. **Immediately:** Email the customer, apologize, and explain the letter should not be sent until corrected. Offer an unconditional refund if they prefer.
2. **Fix the source:** Determine whether the error is in the prompt or the statute library. Fix the source, not just the individual letter.
3. **Reprocess:** Run the order through the pipeline again (manual trigger) to produce a corrected letter.
4. **Deliver corrected version:** Email the customer with the corrected letter; note what changed.
5. **Run golden set:** Verify the fix doesn't break other cases.

### 21.4 Submission Evidence Collection Schedule

| Week | What to capture |
|---|---|
| Jul 1–7 | Screenshot Stripe dashboard; note first paying customer; save Phase 0 manual order records |
| Jul 8–14 | First automated pipeline run — screenshot the order flow; export pipeline logs |
| Jul 15–21 | Week-over-week order count chart; first customer outcome response |
| Jul 22–28 | First "I got my money back" testimonial; total recovered counter screenshot |
| Jul 29–Aug 4 | Channel conversion data; week-4 Stripe screenshot |
| Aug 5–11 | Compile all testimonials; finalize impact numbers; record demo video |
| Aug 12–15 | Write submission; assemble package; submit by August 15 |

### 21.5 Key URLs (fill in after deploy)

```
Production app:     https://fairclaim.com
Admin dashboard:    https://fairclaim.com/admin
Cloud Run console:  https://console.cloud.google.com/run?project=[PROJECT_ID]
Firestore console:  https://console.cloud.google.com/firestore?project=[PROJECT_ID]
Stripe Dashboard:   https://dashboard.stripe.com
Cloud Logging:      https://console.cloud.google.com/logs?project=[PROJECT_ID]
Devpost submission: https://devpost.com/[your-submission-url]
```

---

*End of FairClaim Technical Documentation v1.0*  
*Next review: after Phase 1 build (July 14) to update with any implementation deviations.*
