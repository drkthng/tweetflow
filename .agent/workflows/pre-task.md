---
description: Checklist to complete BEFORE starting any task
---

# Pre-Task Checklist

Complete **every step** in order before writing any code.

## Steps

1. **Read current progress**
   - Open `docs/PROGRESS.md` and understand what has been completed and what is pending.
   - Note which phase you are in (Phase 1 / 2 / 3).

2. **Read known obstacles**
   - Open `docs/OBSTACLES.md` and read all entries.
   - If your task touches any area with a documented obstacle, read the solution carefully.

3. **Read the architecture**
   - Open `.agent/context/ARCHITECTURE.md` to understand the full system design.
   - Identify which components your task affects.

4. **Read coding conventions**
   - Open `.agent/context/CONVENTIONS.md` for naming, formatting, and API conventions.

5. **Read your phase-specific rules**
   - Phase 1 (Backend): `.agent/rules/02-python-backend.md`
   - Phase 2 (Frontend): `.agent/rules/03-react-frontend.md`
   - Phase 3 (Electron): `.agent/rules/04-electron.md`
   - Always also read: `.agent/rules/01-general.md` and `.agent/rules/05-git-and-secrets.md`

6. **Verify the current build**
   - Follow `.agent/workflows/build-verify.md` for your phase.
   - If the build is broken, **fix it FIRST** before starting your task.

7. **Log your start**
   - Add an entry to `docs/PROGRESS.md`:
     ```
     | YYYY-MM-DD | [Your Agent ID] | Starting: [task description] | 🔄 |
     ```

8. **Create a feature branch** (if not already on one)
   - `git checkout -b feature/[phase]-[short-description]`

9. **You are now ready to begin.** Follow `.agent/workflows/during-task.md` while working.
