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

## Automatic checks
- **Before each commit** (pre-commit): trailing whitespace, code style, and the commit message format (`feat:`, `fix:`, `docs:`, `chore:`).
- **On every pull request** (GitHub Actions): lint, format check, and tests.
