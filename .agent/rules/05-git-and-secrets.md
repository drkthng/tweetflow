---
description: Git hygiene and secret handling rules for Retrocast
---

# Git & Secrets Rules

These rules apply to ALL phases. Violations are critical security issues.

## 1. Never Commit Secrets

The following must **never** be committed to the repository:

| Item | Why |
|------|-----|
| `.env` files | Contains local config, paths, potential credentials |
| `*.db`, `*.sqlite`, `*.sqlite3` | User data, potentially large |
| `data/` directory | User-imported CSV files, cached data |
| Files containing API keys | Security |
| Files containing file paths with usernames | Privacy |

## 2. .env Handling

- `.env.example` is the **template** — commit this with **empty values**.
- `.env` is the **local config** — listed in `.gitignore`, never committed.
- Before creating or suggesting any file, ask yourself: **"Does this contain secrets or user-specific paths?"**
  - If yes → it goes in `.env` and is loaded at runtime.
  - If no → it can be committed.

## 3. .gitignore Coverage

The `.gitignore` must cover at minimum:

```
.env
*.db
*.sqlite
*.sqlite3
data/
__pycache__/
*.py[cod]
*.spec
.pytest_cache/
venv/
.venv/
node_modules/
frontend/dist/
electron/dist/
dist-electron/
build/
dist/
*.log
logs/
htmlcov/
.coverage
coverage/
.DS_Store
Thumbs.db
Desktop.ini
```

## 4. Commit Hygiene

- Write clear, descriptive commit messages.
- Format: `[Phase X] type: description` (e.g., `[Phase 1] feat: add scenario CRUD endpoints`).
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `infra`.
- Keep commits focused — one logical change per commit.
- Do NOT commit generated files (build output, compiled assets, coverage reports).
- **NEVER** commit before the user explicitly tells you to do so. This is a strict requirement.

## 5. Branch Strategy

- `main` — stable, always builds.
- `feature/phase-X-description` — feature branches for each major task.
- Merge to `main` only after full build verification passes.

## 6. Pre-Commit Checklist

Before every commit, verify:

- [ ] No `.env` files staged (`git diff --cached --name-only | grep -i "\.env$"` should return nothing)
- [ ] No database files staged
- [ ] No `data/` directory files staged
- [ ] No hardcoded secrets in any staged file
- [ ] `.gitignore` is up to date
- [ ] Build verification passes
