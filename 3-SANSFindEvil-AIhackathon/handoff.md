# SANS SIFT "Find Evil!" Hackathon — Project Handoff

## Hackathon Overview

**Event:** SANS SIFT Find Evil! AI Hackathon  
**Theme:** Autonomous Incident Response  
**Platform:** [findevil.devpost.com](https://findevil.devpost.com)  
**Sponsor:** SANS Institute, 495 Lowell St, Lexington, MA 02420

---

## Key Dates

| Milestone | Date |
|---|---|
| Submission Period Opens | April 15, 2026 — 12:00 PM EDT |
| Submission Deadline | June 15, 2026 — 11:45 PM EDT |
| Judging Period | June 19 – July 3, 2026 |
| Winners Announced | ~July 8, 2026 — 12:00 PM EDT |

---

## What We're Building

A working software application that extends **Protocol SIFT's autonomous incident response** capability using an agentic framework as the primary execution engine.

**Preferred Frameworks:** Claude Code or OpenClaw  
**Platform:** Linux terminal / SANS SIFT Workstation environment  
**Resources:** [https://github.com/sans-dfir/sift](https://github.com/sans-dfir/sift) — starter evidence datasets, practice MCP server endpoint, and sample code available on Protocol SIFT Slack at launch.

### The Agent Must Demonstrate

- **Self-correction** — detects and resolves errors or inconsistencies in its own output without human intervention
- **Accuracy validation** — all findings traceable to specific artifacts, files, offsets, or log entries
- **Analytical reasoning** — output presented as a structured investigative narrative, not a raw execution log

### Supported Evidence Types

- Disk images
- Memory captures
- Log files
- Network captures (PCAP)
- Remote endpoints via MCP

---

## Judging Criteria (equally weighted)

| Criterion | What Judges Ask |
|---|---|
| **Autonomous Execution Quality** | Does the agent reason about next steps, handle failures, and self-correct in real time? |
| **IR Accuracy** | Are findings correct? Hallucinations caught and flagged? Confirmed findings distinguished from inferences? |
| **Breadth and Depth of Analysis** | How much case data can the agent handle? Depth on fewer types beats shallow coverage of many. |
| **Constraint Implementation** | Are guardrails architectural or prompt-based? Were security boundaries tested for bypass? |
| **Audit Trail Quality** | Can judges trace any finding back to the specific tool execution that produced it? |
| **Usability and Documentation** | Can another practitioner deploy and build on this? |

> **Strategy:** Depth beats breadth. Pick 1–2 evidence types and nail the accuracy + audit trail.

---

## Submission Checklist

### Code Repository
- [ ] Public GitHub repo with **MIT or Apache 2.0** license (visible in About section)
- [ ] `README.md` with setup instructions and all dependencies documented
- [ ] All source code, assets, and instructions needed to run the project

### Demo Video (≤ 5 minutes)
- [ ] Screencast of **live terminal execution** with audio narration — no slides, no marketing
- [ ] Shows agent working against **real evidence**, including at least one **self-correction sequence**
- [ ] Uploaded publicly to YouTube, Vimeo, or Youku
- [ ] Link submitted on Hackathon Website
- [ ] No third-party copyrighted music or material

### Required Documentation
- [ ] **Architecture Diagram** — clear visual showing how components connect: agent, SIFT tools, MCP servers, evidence sources, output pipeline
- [ ] **Evidence Dataset Documentation** — what the agent was tested against, source of data, what the agent found
- [ ] **Accuracy Report** — self-assessment of findings accuracy; false positives, missed artifacts, hallucinated claims identified during testing. Honesty valued over perfection.
- [ ] **Agent Execution Logs** — structured logs showing full agent communication and tool execution sequence, with timestamps and token usage; iteration-over-iteration traces showing how the agent's approach changed

### Submission Form
- [ ] Text description explaining features and functionality
- [ ] Live deployment URL or step-by-step local setup instructions
- [ ] All above materials submitted before **June 15, 2026 at 11:45 PM EDT**

---

## Eligibility & Rules Summary

- Open to individuals, teams (up to 5), and organizations
- Must be of legal age in your jurisdiction
- **Not open to:** residents of Cuba, Iran, North Korea, Russia, Crimea, or other OFAC-designated territories; employees/agents of SANS or Devpost; any judge or their employer
- Project must be substantially new work created **April 15 – June 15, 2026**
- Pre-existing open-source libraries and the SIFT codebase may be used as a foundation — novel contribution must be clearly documented
- Third-party SDKs/APIs require authorization to use per their terms
- Repo must be public and open source
- All submission materials must be in English (or include English translation)
- Multiple submissions allowed, but each must be unique and substantially different

---

## Intellectual Property

- You retain ownership of your submission
- SANS gets a non-exclusive license to use submissions for judging and promotion
- Submission must be your original work, solely owned, and must not violate any third-party IP rights
- Open source software may be used if you comply with applicable licenses and build meaningfully on top of it

---

## Project Strategy Notes

- **Focus area:** [TBD — pick 1–2 evidence types]
- **Framework:** Claude Code (preferred; aligns with judging familiarity)
- **Differentiator:** [TBD — e.g., self-healing loop, hypothesis-driven IR, multi-source correlation]
- **Key risk:** Hallucination — the accuracy report requirement means judges will see every error; build detection in from day one

---

*Submission Period: April 15 – June 15, 2026 | findevil.devpost.com*
