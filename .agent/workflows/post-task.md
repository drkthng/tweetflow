---
description: Checklist to complete AFTER finishing any task
---

# Post-Task Checklist

Complete **every step** before declaring your task done.

## 1. Build Verification

- [ ] Run full build verification for your phase (`.agent/workflows/build-verify.md`).
- [ ] All tests pass (if any exist).
- [ ] No console errors, no TypeScript errors, no Python import errors.

## 2. Update Tracking Files

- [ ] **`docs/PROGRESS.md`**:
  - Mark completed items with ✅ and today's date.
  - Add any new items discovered during implementation.
  - Update the overall phase status (⬜ → 🔄 → ✅).
- [ ] **`docs/CHANGELOG.md`**:
  - Add entries for everything created, changed, or fixed.
  - Format: `[YYYY-MM-DD] [Phase X] TYPE: Description`
- [ ] **`docs/OBSTACLES.md`**:
  - Add entries for any new problems encountered and solved.
- [ ] **`docs/BACKLOG.md`**:
  - Add entries for any features intentionally deferred.

## 3. Self-Review

- [ ] Any file > 300 lines? → Split it.
- [ ] Any `TODO` or `FIXME` comments left? → Resolve or move to `docs/BACKLOG.md`.
- [ ] Any hardcoded values that should be constants or env vars? → Fix.
- [ ] Any temp/debug code left? (`print()`, `console.log()`, test stubs) → Remove.
- [ ] All new files have proper imports and are reachable from the app entry point?

## 4. Final Verification

- [ ] All files are saved.
- [ ] `git status` shows only expected changes (no stray files).
- [ ] `.env` or secret files are NOT staged.
- [ ] Build verification passes one final time.

## 5. Handoff

- [ ] The next agent (or the same agent on the next task) can read `docs/PROGRESS.md` and understand exactly where the project stands.
- [ ] Your work is on a feature branch, ready for merge review.
