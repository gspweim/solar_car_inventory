# ☀️ CalSol Inventory Tracker

A full-stack web application for the **UC Berkeley Solar Car Team** to track parts inventory, log test miles, and analyze part reliability across their solar race cars.

---

## Features

- 🔐 **Google Sign-In** — team members log in with their `@berkeley.edu` (or any Google) account
- 🚗 **Multi-car support** — manage inventory for multiple cars (Zephyr, etc.)
- 🔩 **Parts inventory** — track parts by group (suspension, drivetrain, etc.) and location (front_right, etc.)
- 📏 **Miles logging** — log test sessions; miles automatically propagate to all active parts
- 🔁 **Part replacement** — retire a part with a reason (failure, upgrade, maintenance) and optionally auto-create a replacement
- 📋 **History log** — full audit trail of every part replacement
- 📊 **Engineering reports**:
  - **Likely to Fail** — risk score based on current miles vs. historical failure mileage
  - **High Miles** — parts with the most accumulated miles
  - **Miles Between Failures (MBF)** — average mileage at failure per part type
- 📤 **Spreadsheet upload** — bulk import parts from `.xlsx` or `.csv`
- 🏷️ **Custom fields** — admins can add custom fields (e.g., "Wrench Size", "Thread") that appear on all part forms
- 👥 **Role-based access** — `admin` (full access) and `readonly` roles

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  React SPA (S3 + CloudFront)                                │
│  - React 18, React Router, TanStack Query, Recharts         │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────────────┐
│  AWS API Gateway (REST)                                     │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  AWS Lambda (Python 3.12)                                   │
│  - auth/  cars/  parts/  miles/  reports/  upload/          │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  Amazon DynamoDB                                            │
│  - users, cars, parts, part_history, miles_log, part_fields │
└─────────────────────────────────────────────────────────────┘
```

**Infrastructure as Code**: AWS SAM (`template.yaml`)  
**CI/CD**: GitHub Actions (`.github/workflows/deploy.yml`)

---

## Project Structure

```
calsol_inventory/
├── template.yaml                  # AWS SAM IaC template
├── scripts/
│   └── build.sh                   # Distributes shared utils to all lambdas
├── backend/
│   └── lambdas/
│       ├── shared/utils.py        # Auth middleware, response helpers
│       ├── auth/                  # google_login, me, list_users, update_user
│       ├── cars/                  # list, create, update, delete
│       ├── parts/                 # list, get, create, update, replace, delete, history, fields
│       ├── miles/                 # log_miles, get_miles_log
│       ├── reports/               # high_miles, miles_between_failures, likely_to_fail
│       └── upload/                # upload_spreadsheet
├── frontend/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── api/client.js          # Axios API client
│       ├── hooks/useAuth.js       # Auth context + hook
│       ├── components/Layout.js   # Sidebar + topbar shell
│       └── pages/                 # One file per page
├── docs/
│   ├── 01-google-oauth-setup.md
│   └── 02-aws-setup.md
└── .github/workflows/deploy.yml   # CI/CD pipeline
```

---

## Quick Start (Local Development)

### Backend

```bash
# Install SAM CLI
brew install aws-sam-cli

# Configure AWS credentials
aws configure

# Distribute shared utils
bash scripts/build.sh

# First deploy (interactive)
sam deploy --guided
# Note the ApiUrl output
```

### Frontend

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local:
#   REACT_APP_API_URL=<your API Gateway URL>
#   REACT_APP_GOOGLE_CLIENT_ID=<your Google client ID>

npm install
npm start
# Opens at http://localhost:3000
```

---

## Deployment

See [`docs/01-google-oauth-setup.md`](docs/01-google-oauth-setup.md) and [`docs/02-aws-setup.md`](docs/02-aws-setup.md) for full setup instructions.

**Automated deployment** via GitHub Actions on every push to `main`.

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/google` | Exchange Google ID token for JWT |
| GET | `/auth/me` | Get current user |
| GET | `/auth/users` | List all users (admin) |
| PUT | `/auth/users/{id}` | Update user role/status (admin) |
| GET | `/cars` | List cars |
| POST | `/cars` | Create car (admin) |
| PUT | `/cars/{id}` | Update car (admin) |
| DELETE | `/cars/{id}` | Delete car (admin) |
| GET | `/cars/{id}/parts` | List parts (filter by group/location) |
| POST | `/cars/{id}/parts` | Create part (admin) |
| GET | `/cars/{id}/parts/{pid}` | Get part detail |
| PUT | `/cars/{id}/parts/{pid}` | Update part (admin) |
| POST | `/cars/{id}/parts/{pid}/replace` | Replace part (admin) |
| DELETE | `/cars/{id}/parts/{pid}` | Delete part (admin) |
| GET | `/cars/{id}/history` | Part replacement history |
| GET | `/part-fields` | List custom fields |
| POST | `/part-fields` | Create custom field (admin) |
| POST | `/cars/{id}/miles` | Log test miles (admin) |
| GET | `/cars/{id}/miles` | Get miles log |
| GET | `/cars/{id}/reports/high-miles` | High miles report |
| GET | `/cars/{id}/reports/mbf` | Miles between failures report |
| GET | `/cars/{id}/reports/likely-to-fail` | Likely to fail report |
| POST | `/cars/{id}/upload` | Bulk import parts from spreadsheet (admin) |

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and test locally
4. Push and open a PR against `main`
5. CI will run on your PR; merge triggers auto-deploy

---

## License

MIT — UC Berkeley Solar Car Team (CalSol)
