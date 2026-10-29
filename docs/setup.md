# Setup

## What you need
- VS Code with the **Dev Containers** extension
- Docker Desktop (running)
- Git

## Open the project
1. Clone the repo and open the folder in VS Code.
2. When VS Code asks, choose **Reopen in Container** (or press `F1` and run *Dev Containers: Reopen in Container*).
3. Wait for the first build. It sets up Python, installs the tools, and starts a database.

## Everyday commands
Run these in the VS Code terminal (inside the container):

| Command | What it does |
|---|---|
| `make run` | Starts the backend at http://localhost:8000 (docs at `/docs`) |
| `make test` | Runs the tests |
| `make lint` | Checks code style |
| `make format` | Fixes code style automatically |
| `make migrate` | Brings your local database up to date with the latest table changes |
| `make migration name="add users"` | Creates a new migration file after you change a table class |

## Database
The dev container runs PostgreSQL beside the app. The backend finds it through the `DATABASE_URL` setting. Your data is kept in a Docker volume, so it survives restarts.

If you opened the container before this setting changed, rebuild it once: press `F1` and run *Dev Containers: Rebuild Container*.

Table changes are saved as migration files in `backend/migrations/versions/` and committed to Git. After pulling new code, run `make migrate`.

## Automatic checks
- **Before each commit** (pre-commit): trailing whitespace, code style, and the commit message format (`feat:`, `fix:`, `docs:`, `chore:`).
- **On every pull request** (GitHub Actions): lint, format check, migrations, a check that migrations match the table classes, and tests against a real PostgreSQL.
