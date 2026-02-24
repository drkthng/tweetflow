---
description: General coding rules for all phases of Retrocast
---

# General Coding Rules

These rules apply to ALL phases (Backend, Frontend, Electron). Every agent MUST follow them.

## 1. No Scope Creep

- **Only implement what is explicitly requested** in your task prompt.
- If you think something additional would be useful, add it to `docs/BACKLOG.md` instead of building it.
- Do NOT add "nice-to-have" features, extra endpoints, extra UI elements, or refactors that were not asked for.

## 2. Build Verification

- After **every significant change** (new file, new dependency, refactored module), verify the project still builds and runs.
- Follow `.agent/workflows/build-verify.md` for verification steps.
- Document the verification result in `docs/PROGRESS.md` (e.g., "✅ Backend builds after adding indicators module").

## 3. Incremental Development

- Make small, testable changes. Write one module → test it → move to the next.
- Do NOT write 500 lines across multiple files and then check if it works.
- Each commit-worthy unit of work should be: 1 module/component + its tests + verification.

## 4. Error Handling

- **Never silently swallow errors.** Every `try/except` (Python) or `try/catch` (TypeScript) must either:
  - Log the error with context, OR
  - Re-raise / re-throw with a meaningful message, OR
  - Return an error state to the caller.
- Bare `except:` or `catch {}` blocks are **forbidden**.

## 5. Comments

- Write comments for **WHY**, not **WHAT**. The code should be self-documenting for what it does.
- Required comments:
  - Business logic explanations (e.g., why a threshold is 0.5)
  - Non-obvious decisions (e.g., why we use sync instead of async for SQLite)
  - Workarounds (e.g., "yfinance returns MultiIndex columns, flatten here")
- Do NOT write comments like `# increment counter` above `counter += 1`.

## 6. File Size Limit

- **No single file should exceed 300 lines.**
- If a file grows beyond 300 lines, split it into logical sub-modules immediately.
- Measure: actual lines of code including comments and blank lines.

## 7. Dependencies

- Do NOT add dependencies that are not in the architecture plan (`.agent/context/ARCHITECTURE.md`).
- If you absolutely need an unlisted dependency:
  1. Document in `docs/OBSTACLES.md` why it's needed.
  2. Verify it doesn't conflict with existing dependencies.
  3. Pin its version appropriately.

## 8. Tracking File Updates (Mandatory)

After completing **any** task, update these files:

| File | What to update |
|------|---------------|
| `docs/PROGRESS.md` | Mark completed items ✅, add new items discovered |
| `docs/CHANGELOG.md` | Add entry with date, phase, type, and description |
| `docs/OBSTACLES.md` | Add entry if any new problem was encountered and solved |
| `docs/BACKLOG.md` | Add entry if any feature was intentionally deferred |

## 9. No Hardcoded Values

- API URLs, ports, file paths, magic numbers → use constants or environment variables.
- Thresholds, limits, defaults → define as named constants at module level.

## 10. Consistent Formatting

- Follow the conventions in `.agent/context/CONVENTIONS.md` without exception.
- When in doubt, match the style of existing code in the same file/module.
