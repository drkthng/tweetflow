---
description: How to verify the build works for each project phase of Retrocast
---

# Build Verification

Run the appropriate section(s) based on which phase(s) exist. If a phase has not been implemented yet, skip its section.

## Backend Verification (Phase 1)

```bash
cd backend

# 1. Install dependencies
pip install -r requirements.txt
# Expected: completes without errors

# 2. Verify imports
python -c "from app.main import app; print('Backend imports OK')"
# Expected: prints "Backend imports OK"

# 3. Start server
python run.py &
# Wait 3 seconds for startup

# 4. Health check
curl http://localhost:8000/health
# Expected: {"status": "ok"}

# 5. Run tests
python -m pytest tests/ -v
# Expected: all tests pass

# 6. Stop server (kill the background process)
```

## Frontend Verification (Phase 2)

```bash
cd frontend

# 1. Install dependencies
npm install
# Expected: completes without errors

# 2. Type check
npx tsc --noEmit
# Expected: no errors

# 3. Build
npm run build
# Expected: completes without errors or warnings

# 4. Dev server smoke test
npm run dev &
# Wait 3 seconds
curl http://localhost:5173
# Expected: returns HTML content

# 5. Stop dev server
```

## Electron Verification (Phase 3)

```bash
# From project root

# 1. TypeScript compilation
npx tsc -p tsconfig.electron.json
# Expected: compiles without errors

# 2. Dev mode launch
npm run dev
# Expected: Electron window opens showing the app
# Expected: Backend health check passes (visible in Electron logs)
```

## Integration Verification (All Phases)

```bash
# From project root
npm run dev
# Expected:
# - Backend starts and responds on http://localhost:8000/health
# - Frontend dev server starts on http://localhost:5173
# - Electron window opens and loads the frontend
# - No errors in any terminal output
```

## Quick Check (Minimum Viable Verification)

When you need a fast sanity check after a small change:

| Phase | Command | Expected |
|-------|---------|----------|
| Backend | `python -c "from app.main import app"` | No errors |
| Frontend | `npx tsc --noEmit` | No errors |
| Electron | `npx tsc -p tsconfig.electron.json` | No errors |
