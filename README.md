# Voter Analysis

Internal web app for analysing Rajasthan SEC panchayat electoral rolls (Hindi PDFs).

## Features

- Upload ward PDFs → Gemini AI extracts voter data → stored in PostgreSQL
- Search voters by EPIC number or name (Hindi / English)
- Browse by ward with gender, age and sort filters
- Ward statistics — age groups, gender split, hamlet breakdown
- Family inference — finds relatives from same household automatically
- English / Hindi UI toggle

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy |
| Database | PostgreSQL |
| AI | Google Gemini (free tier) |
| Storage | Cloudflare R2 (optional, falls back to local) |

## Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker (for PostgreSQL)

### 1. Start the database

```bash
docker-compose up -d
```

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Mac/Linux

pip install -r requirements.txt

cp .env.example .env
# Edit .env — add your GEMINI_API_KEY

python -m app.db               # create tables
python scripts/create_user.py admin@example.com yourpassword

uvicorn app.main:app --reload
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

```env
DATABASE_URL=postgresql+psycopg://voter:voter@localhost:5433/voter_analysis
GEMINI_API_KEY=your_key_from_aistudio.google.com
GEMINI_MODEL=gemini-2.0-flash

# Optional — Cloudflare R2 for PDF storage
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=voter-pdfs
```

Get a free Gemini API key at [aistudio.google.com](https://aistudio.google.com).

## Usage

1. **Import PDFs** — upload ward electoral roll PDFs, extraction runs automatically
2. **Search Voters** — search by EPIC number (exact) or name (fuzzy)
3. **Browse by Ward** — filter by gender/age, view ward statistics
4. **Family tab** — on any voter detail, see household members and inferred relationships
