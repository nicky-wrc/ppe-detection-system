# PPE Detection System

Automatic Personal Protective Equipment (PPE) detection system for industrial safety monitoring.

This project provides:
- Real-time and file-based PPE detection
- Violation tracking and alert management
- Dashboard analytics (daily/hourly trends)
- Detection history and report export
- User authentication with register and password reset flow

## Tech Stack

### Frontend
- React + TypeScript
- Vite
- Tailwind CSS
- Recharts

### Backend
- FastAPI
- SQLAlchemy
- PostgreSQL
- Ultralytics YOLO (PPE detection)

## Project Structure

```text
ppe-detection-system/
  backend/
    app/
      api/
      core/
      models/
      schemas/
      services/
      ml/
    requirements.txt
    seed_admin.py
  frontend/
    src/
    package.json
  docs/
```

## Prerequisites

- Python 3.10+ (recommended 3.10 or 3.11)
- Node.js 18+ and npm
- PostgreSQL 14+

## Configuration

Backend settings are loaded from `backend/app/core/config.py` and optional `.env` file in `backend/`.

Default database URL:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ppe_detection
```

Create the database before running:

```sql
CREATE DATABASE ppe_detection;
```

## Installation and Run

### 1) Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend endpoints:
- API docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

### 2) Frontend

Open another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL:
- `http://localhost:5173`

## Initial Admin Account

If no admin account exists, create one with either:

### Option A: seed script

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python seed_admin.py
```

### Option B: API

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/v1/auth/init-admin"
```

Default admin credentials:
- Email: `admin@ppe-system.com`
- Password: `admin123`

## Authentication and Security Notes

- Login is token-based (Bearer token)
- Register flow is available from the login page
- Forgot password uses a reset-code confirmation flow:
  1. Request reset code
  2. Confirm code and set new password
- Reset code currently appears in backend log for development; integrate email provider for production

## Core Features

- Detection upload:
  - Image detection
  - Video detection
- Dashboard:
  - Total detections, violations, compliance rate
  - Daily compliance chart
  - Weekly violations chart
  - Export selected charts to PDF
- Alerts:
  - List alerts by detection
  - View details, acknowledge, resolve
- Reports:
  - Detection history table
  - Modal detail view
  - Download detection report as PDF with violation summary

## API Overview

Base URL:

```text
http://localhost:8000/api/v1
```

Main endpoint groups:
- `/auth`
- `/detection`
- `/alerts`
- `/zones`
- `/settings`

See full API schema in Swagger:
- `http://localhost:8000/docs`

## Notes on Data Isolation

Detection, analytics, and alert APIs are filtered by authenticated user to keep user data separated.

If testing with old shared data, restart backend and re-login to ensure latest server logic is applied.

## Troubleshooting

### Backend starts but login fails
- Check database connection and credentials
- Verify admin user exists via `seed_admin.py` or `/auth/init-admin`

### Frontend cannot call backend
- Ensure backend runs on port `8000`
- Check browser console/network for CORS or connection errors

### YOLO model not loading
- Ensure model files exist in `backend/` (for current model loader order)
- Check backend terminal logs for model load messages

## License

This repository is for project and educational use unless another license is specified by the repository owner.
