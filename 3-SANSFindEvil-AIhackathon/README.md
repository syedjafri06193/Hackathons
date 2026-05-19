# FIND EVIL! — Autonomous AI Incident Response

> Submission for the **FIND EVIL! Hackathon** hosted by SANS Institute
> *AI threats strike in minutes. Build the defender that responds in seconds.*

---

## 🗓 Event Details

| Detail | Info |
|---|---|
| **Sponsor / Host** | SANS Institute |
| **Format** | 100% Online |
| **Submission Period** | April 15 – June 15, 2026 @ 11:45 PM EDT |
| **Judging Period** | June 19 – July 3, 2026 |
| **Winners Announced** | On or around July 8, 2026 |
| **Devpost Page** | [findevil.devpost.com](https://findevil.devpost.com) |
| **Eligible Team Size** | Solo or teams of up to 5 |
| **Prize Pool** | $22,000+ in cash + SANS training & summit passes |

---

## 📌 Project Overview

> _[Replace this section with your project description]_

**Project Name:** [Your Project Name]

**Team Members:** [List team members]

**Agentic Framework Used:** [Claude Code / OpenClaw / AutoGen / CrewAI / LangGraph / Cursor / Cline / Aider]

**Case Data Type(s) Analyzed:** [Disk image / Memory capture / Log files / Network capture / Remote endpoint via MCP]

### What It Does

_Describe what your autonomous IR agent does in 2–3 sentences._

### The Problem It Solves

_Describe the incident response challenge your agent addresses. Think: what would a senior analyst do at 3 AM during an active incident — and how does your agent replicate that?_

### How We Built It

_Describe the architecture, tools, MCP integrations, and reasoning strategies used._

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Platform** | SANS SIFT Workstation (Linux) |
| **Agentic Framework** | [e.g., Claude Code / OpenClaw] |
| **MCP Integration** | Protocol SIFT MCP Server |
| **Language(s)** | [e.g., Python, Bash] |
| **Evidence Types** | [e.g., disk images, memory captures, log files] |
| **Other Tools** | [e.g., Volatility, Plaso, Autopsy, custom parsers] |

---

## 🏗 Architecture

> _A clear visual showing how components connect is required for submission._

```
Evidence Input (disk image / memory / logs / pcap)
        │
        ▼
  SIFT Workstation
        │
        ▼
  Protocol SIFT MCP Server
        │
        ▼
  Agentic Framework (Claude Code / OpenClaw)
     ├─► Reasoning & Planning
     ├─► Tool Execution (SIFT tools via MCP)
     ├─► Self-Correction Loop
     └─► Accuracy Validation
        │
        ▼
  Structured Investigative Narrative (output)
        │
        ▼
  Audit Trail / Execution Logs
```

> See `architecture.png` for the full component diagram. _(replace this with your actual diagram)_

---

## 🚀 Getting Started

### Prerequisites

```bash
# 1. Download the SIFT Workstation OVA
# https://www.sans.org/tools/sift-workstation

# 2. Install Protocol SIFT (after logging into SIFT VM)
curl -fsSL https://raw.githubusercontent.com/teamdfir/protocol-sift/main/install.sh | bash

# 3. Join the Protocol SIFT Slack for sample case data and MCP server details
# https://join.slack.com/t/protocolsift/...
```

### Installation

```bash
git clone https://github.com/your-org/your-repo.git
cd your-repo
pip install -r requirements.txt   # or: npm install
```

### Configuration

```bash
# Set your MCP server endpoint and agent credentials
cp .env.example .env
# Edit .env with your Protocol SIFT MCP endpoint and API keys
```

### Running the Agent

```bash
# Run against a local evidence image
python agent.py --evidence /path/to/disk.img

# Or follow judge-friendly step-by-step instructions:
# See SETUP.md for full local deployment walkthrough
```

---

## 📋 Submission Checklist

All of the following are required per the official rules:

- [ ] **Working agent** that extends Protocol SIFT's autonomous IR capability
- [ ] **Self-correction** — agent detects and resolves errors without human intervention
- [ ] **Accuracy validation** — all findings traceable to specific artifacts, files, offsets, or log entries
- [ ] **Analytical reasoning** — output presented as a structured investigative narrative (not a raw execution log)
- [ ] **Public code repository** with MIT or Apache 2.0 license visible in the About section
- [ ] **README with setup instructions** (this file)
- [ ] **Local run instructions** or live deployment URL for judges
- [ ] **Demo video** (under 5 minutes) — screencast of live terminal execution with audio narration showing the agent working against real evidence, including at least one self-correction sequence (uploaded to YouTube/Vimeo/Youku)
- [ ] **Architecture diagram** — visual showing agent, SIFT tools, MCP servers, evidence sources, output pipeline
- [ ] **Evidence dataset documentation** — what was tested, source of data, what the agent found
- [ ] **Accuracy report** — self-assessment of findings, false positives, missed artifacts, hallucinated claims
- [ ] **Agent execution logs** — full agent communication and tool execution sequence with timestamps

**Demo Video:** [Link to YouTube/Vimeo/Youku]

---

## 🎯 Agent Capabilities

### Self-Correction
_Describe how your agent detects and corrects its own errors or inconsistencies without human prompting._

### Accuracy Validation
_Describe how your agent traces every finding to a specific artifact, file, offset, or log entry._

### Analytical Reasoning
_Describe how your agent structures output as an investigative narrative rather than a raw execution log._

---

## 📊 Evidence Dataset

| Field | Details |
|---|---|
| **Dataset Source** | [e.g., Sample case data from Protocol SIFT Slack / custom-built test dataset] |
| **Case Data Types** | [e.g., NTFS disk image, Windows memory capture] |
| **What the Agent Found** | [Summary of findings] |

---

## 🔬 Accuracy Report

_Honesty is valued over perfection in this hackathon._

| Finding Type | Count | Notes |
|---|---|---|
| Confirmed findings | — | Verified against ground truth |
|
 Inferences | — | Flagged as inferred, not confirmed |
| False positives | — | Agent identified and flagged during testing |
| Missed artifacts | — | Known gaps documented here |
| Hallucinated claims | — | Caught during self-correction testing |

---

## 📜 Agent Execution Logs

> Judges must be able to trace any finding back to the specific tool execution that produced it.

Logs are available in `/logs/` directory:

```
logs/
├── agent_execution_YYYY-MM-DD.log   # Full tool call sequence with timestamps
├── tool_outputs/                    # Raw tool output per execution step
└── self_correction_events.log       # Iterations where agent caught and fixed errors
```

---

## 🏆 Prizes

| Place | Prize |
|---|---|
| 🥇 **1st — SLAYED EVIL** | $10,000 cash + SANS Summit pass & hotel (per team member) + SANS OnDemand course (per team member) + SANS Webcast presentation |
| 🥈 **2nd — HUNTED EVIL** | $7,500 cash + SANS Summit pass & hotel (per team member) + SANS OnDemand course (per team member) + SANS Webcast presentation |
| 🥉 **3rd — FOUND EVIL** | $4,500 cash + SANS OnDemand course (per team member) |

---

## ⚖️ Judging Criteria

Submissions are evaluated on six equally weighted criteria:

1. **Autonomous Execution Quality** — Does the agent reason about next steps, handle failures, and self-correct in real time?
2. **IR Accuracy** — Are findings correct? Are hallucinations caught and flagged? Are confirmed findings distinguished from inferences?
3. **Breadth and Depth of Analysis** — How much case data can the agent handle? Depth on fewer types beats shallow coverage of many.
4. **Constraint Implementation** — Are guardrails architectural or prompt-based? Are security boundaries tested for bypass?
5. **Audit Trail Quality** — Can judges trace any finding back to the specific tool execution that produced it?
6. **Usability and Documentation** — Can another practitioner deploy and build on this?

---

## 🔗 Resources

- 🖥 [Hackathon Devpost Page](https://findevil.devpost.com)
- 📜 [Official Rules](https://findevil.devpost.com/rules)
- 📦 [SIFT Workstation Download](https://www.sans.org/tools/sift-workstation)
- 🔧 [Protocol SIFT GitHub](https://github.com/teamdfir/protocol-sift)
- 💬 [Protocol SIFT Slack](https://join.slack.com/t/protocolsift) — sample case data, MCP endpoint, mentors

---

## 📝 License

This project is released under the [MIT License](LICENSE) / [Apache 2.0 License](LICENSE).

> ⚠️ **Required:** Your repository must include an MIT or Apache 2.0 license file that is detectable and visible at the top of the repository page (in the About section) to be eligible for judging.
