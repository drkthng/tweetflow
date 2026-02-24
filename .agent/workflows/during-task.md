---
description: Checklist to follow DURING implementation of any task
---

# During-Task Checklist

Follow these rules while implementing. Check back on this list every 3–5 files created.

## Incremental Development

1. **Work in small increments** — create one module or component at a time.
2. After creating each new file, verify it **imports correctly** / **compiles without errors**.
3. After adding a new dependency, verify:
   - Install works (`pip install -r requirements.txt` or `npm install`)
   - Build still passes

## Phase-Specific Verification

4. **Backend (Phase 1):** After each new endpoint, verify it responds correctly.
   - Start the server, call the endpoint (curl or test), confirm the response.
5. **Frontend (Phase 2):** After each new component, verify it renders without errors.
   - Run `npm run dev`, open browser, check for console errors.
6. **Electron (Phase 3):** After each change, verify the app window still opens.

## Problem Handling

7. If you encounter a problem:
   - **First**: Check `docs/OBSTACLES.md` — maybe it's already solved.
   - **If new problem**: Solve it, then document in `docs/OBSTACLES.md` **immediately**.
   - Use this format:
     ```markdown
     ### [SHORT_TITLE]
     - **Date**: YYYY-MM-DD
     - **Phase**: 1/2/3
     - **Problem**: What went wrong
     - **Root Cause**: Why it happened
     - **Solution**: How it was fixed
     - **Prevention**: How to avoid it in the future
     - **Related Files**: Which files were affected
     ```

## Continuous Tracking

8. Keep `docs/PROGRESS.md` updated with completed sub-tasks as you go.
9. Do NOT skip error handling "to add later" — add it **now**.
10. Every 3–5 files created: run a full build verification (`.agent/workflows/build-verify.md`).

## Quality Gates

11. Before moving to the next module, confirm:
    - [ ] No `TODO` comments left (either implement or add to `docs/BACKLOG.md`)
    - [ ] No `print()` statements (Python) or `console.log()` (TypeScript) used for logging
    - [ ] Error handling is in place
    - [ ] File is under 300 lines
