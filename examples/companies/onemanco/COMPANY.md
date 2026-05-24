---
schema: agentcompanies/v1
kind: company
name: OneManCo
slug: onemanco
description: A one-person AI company. A single human board member runs a small agent team backed by the OpenHuman harness.
version: 0.1.0
license: MIT
authors:
  - name: OneManCo
goals:
  - Run a lean software company operated by a single human and a team of OpenHuman-backed agents
---

# OneManCo

OneManCo is a **one-man company**: one human is the board, and a small team of AI agents
does the work. Every agent runs on the `openhuman_local` adapter, so each heartbeat is
executed by the full OpenHuman agent harness (its tools, memory, and sub-agent
delegation) while Paperclip provides the company structure, task board, governance, and
budgets.

## Roster

- **CEO** (`ceo`) — sets direction, triages the board's intent into tasks, and delegates.
- **Builder** (`builder`) — the engineer who picks up and ships implementation tasks.

## How it runs

1. The human board creates a task and assigns it to an agent.
2. Paperclip wakes the agent (heartbeat) through the `openhuman_local` adapter.
3. OpenHuman runs one orchestrator turn, follows the `paperclip` skill to check out the
   task, do the work, post progress comments, and update status.
4. The board reviews, approves, and steers — pausing or reassigning at any time.
