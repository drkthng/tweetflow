---
description: First thing a new agent should read when starting work on Retrocast
---

# New Agent Onboarding

Welcome. You are working on **Retrocast** — a desktop application for statistical analysis of financial markets.

## Read These Files IN ORDER

Do not skip any step. Each file builds on the previous one.

| Step | File | Purpose |
|------|------|---------|
| 1 | This file (`new-agent-onboarding.md`) | Orientation |
| 2 | `docs/PROGRESS.md` | What's done and what's next |
| 3 | `docs/OBSTACLES.md` | Known problems and their solutions |
| 4 | `.agent/context/ARCHITECTURE.md` | System design and data flow |
| 5 | `.agent/context/CONVENTIONS.md` | Naming, formatting, API conventions |
| 6 | `.agent/context/TESTING.md` | Testing strategy and requirements |
| 7 | `.agent/rules/01-general.md` | General rules (all phases) |
| 8 | `.agent/rules/0X-*.md` for your phase | Phase-specific rules |
| 9 | `.agent/workflows/build-verify.md` | Run build verification NOW |
| 10 | Your task prompt | Read carefully before starting |

## Phase Identification

Determine which phase you are working on:

| Phase | Directory | Rules File |
|-------|-----------|------------|
| Phase 1: Python Backend | `backend/` | `.agent/rules/02-python-backend.md` |
| Phase 2: React Frontend | `frontend/` | `.agent/rules/03-react-frontend.md` |
| Phase 3: Electron Shell | `electron/` | `.agent/rules/04-electron.md` |

## After Reading

1. Run build verification (Step 9 above). If it fails, **fix the build first**.
2. Follow `.agent/workflows/pre-task.md` before starting your task.
3. Follow `.agent/workflows/during-task.md` while working.
4. Follow `.agent/workflows/post-task.md` when done.

**You are now ready to begin.**
