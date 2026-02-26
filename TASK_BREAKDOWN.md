# CalSol Inventory Tracker - Task Breakdown

This is a large project. It is broken into the following phases:

## Phase 1: Project Structure & IaC (AWS SAM)
- Directory layout
- SAM template.yaml (API Gateway + Lambda + DynamoDB)
- Environment config

## Phase 2: Backend - Lambda Functions (Python 3.12)
- Auth (Google OAuth + user management)
- Cars CRUD
- Parts CRUD (with dynamic fields)
- Miles logging
- Part replacement workflow
- Spreadsheet upload
- Reports

## Phase 3: Frontend (React)
- Google Login
- Car selector
- Parts list / CRUD
- Miles entry
- Part replacement modal
- Spreadsheet upload
- Reports dashboard

## Phase 4: Setup Guides (Markdown)
- AWS account setup
- DynamoDB tables
- S3 + CloudFront
- Route 53 + domain
- Google OAuth setup
- GitHub Actions CI/CD
- SAM deploy instructions
