# PaperTrail Codex Agent Instructions

## General Rules

- Always read docs/DEVELOPMENT_PLAN.md before making changes.
- Do not push directly to main.
- Work on branches named codex/<task-name>.
- Keep changes scoped to the assigned task.
- Do not introduce new libraries without updating docs/DEVELOPMENT_PLAN.md.
- Do not commit secrets, API keys, .env files, or credentials.
- Do not modify GitHub repository settings.
- Do not merge Pull Requests.

## Testing

Before opening a PR, run relevant tests:

Backend:
- pytest
- ruff
- mypy if configured

Frontend:
- npm run lint
- npm run typecheck
- npm test if configured

## Pull Request Requirements

Each PR must include:

- Summary
- Files changed
- Tests run
- Risks
- Follow-up tasks

## Architecture Rules

- Backend route handlers should not call LLM APIs directly.
- LLM logic belongs in backend/app/services/llm/.
- PDF parsing belongs in backend/app/services/pdf/.
- Retrieval logic belongs in backend/app/services/retrieval/.
- Frontend API calls must go through frontend/lib/api.ts.
- Database schema changes require Alembic migrations.