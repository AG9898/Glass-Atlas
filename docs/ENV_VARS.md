# Environment Variables — Glass Atlas

## Security Rules

- **Never commit real secrets to version control.**
- All secret variables must be accessed server-side only via `$env/static/private` or `$env/dynamic/private`. Never import them from `$env/static/public` or `$env/dynamic/public`.
- `PUBLIC_*` variables are browser-visible. Never assign a secret to a `PUBLIC_*` name.
- `.env.local` is gitignored. `.env.example` is committed with placeholder values only.
- Rotate any secret that is accidentally exposed immediately.

---

## Variable Matrix

| Variable | Required | Environments | Default | SvelteKit Import | Description |
|---|---|---|---|---|---|
| `DATABASE_URL` | Yes | All | — | `$env/dynamic/private` | Neon PostgreSQL connection string. Must include `?sslmode=require`. Uses dynamic import so the dev server starts without a DB configured (queries will fail at runtime until set). |
| `OPENROUTER_API_KEY` | Yes | All | — | `$env/static/private` | API key for OpenRouter (LLM + embeddings). Never expose client-side. |
| `OPENROUTER_BASE_URL` | No | All | `https://openrouter.ai/api/v1` | `$env/static/private` | Override the OpenRouter base URL. Useful for test mocking. |
| `OPENROUTER_MODEL` | No | All | `google/gemini-2.0-flash-001` | `$env/static/private` | Override the default LLM model used for chat. |
| `EMBEDDING_MODEL` | No | All | `text-embedding-3-small` | `$env/static/private` | Override the default embedding model. |
| `AUTH_SECRET` | Yes | All | — | `$env/static/private` | Random secret for Auth.js session signing. Generate: `openssl rand -hex 32`. |
| `AUTH_GITHUB_ID` | Yes | All | — | `$env/static/private` | GitHub OAuth app Client ID. |
| `AUTH_GITHUB_SECRET` | Yes | All | — | `$env/static/private` | GitHub OAuth app Client Secret. |
| `AUTH_TRUST_HOST` | No | — | — | `$env/static/private` | Vercel-specific workaround — not required on Railway. Do not set. |
| `CHAT_RATE_LIMIT` | No | All | `10` | `$env/static/private` | Max chat messages allowed per IP per hour. |
| `PUBLIC_SITE_URL` | Yes (production) | All | `http://localhost:5173` | `$env/static/public` | Canonical site URL used for OG tags and sitemap generation. |
| `BUCKET` | Yes (if first-party media uploads enabled) | Production (Railway bucket env) | — | `$env/static/private` | Railway bucket name for S3-compatible API calls. Use Railway bucket variable references. |
| `ENDPOINT` | Yes (if first-party media uploads enabled) | Production (Railway bucket env) | `https://storage.railway.app` | `$env/static/private` | Railway bucket S3 endpoint. |
| `REGION` | Yes (if first-party media uploads enabled) | Production (Railway bucket env) | `auto` | `$env/static/private` | Railway bucket region value for S3 client configuration. |
| `ACCESS_KEY_ID` | Yes (if first-party media uploads enabled) | Production (Railway bucket env) | — | `$env/static/private` | Railway bucket S3 access key ID. |
| `SECRET_ACCESS_KEY` | Yes (if first-party media uploads enabled) | Production (Railway bucket env) | — | `$env/static/private` | Railway bucket S3 secret access key. |

---

## Local Development Setup

1. Copy the example file:

   ```bash
   cp .env.example .env.local
   ```

2. Fill in `.env.local` with real values. This file is gitignored and will never be committed.

3. SvelteKit automatically loads `.env` and `.env.local`. Variables prefixed with `PUBLIC_` are available in both server and browser code. All others are server-only.

Minimum required values for local development:

```dotenv
# .env.local

# Database — use a Neon dev branch, not the production branch
# The glass_atlas Postgres schema is used; all tables are scoped to it via Drizzle pgSchema()
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require

# OpenRouter
OPENROUTER_API_KEY=sk-or-...

# Auth.js — create a GitHub OAuth app at https://github.com/settings/developers
# Callback URL for local dev: http://localhost:5173/auth/callback/github
AUTH_SECRET=<output of: openssl rand -hex 32>
AUTH_GITHUB_ID=your_github_client_id
AUTH_GITHUB_SECRET=your_github_client_secret

# Public
PUBLIC_SITE_URL=http://localhost:5173

# Optional (only if testing first-party uploads locally with a Railway bucket)
BUCKET=your-bucket-name
ENDPOINT=https://storage.railway.app
REGION=auto
ACCESS_KEY_ID=your_bucket_access_key_id
SECRET_ACCESS_KEY=your_bucket_secret
```

Optional overrides (only set if you need to change defaults):

```dotenv
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=google/gemini-2.0-flash-001
EMBEDDING_MODEL=text-embedding-3-small
CHAT_RATE_LIMIT=10
```

Optional upload variables (set only when implementing/testing first-party uploads):

```dotenv
BUCKET=your-bucket-name
ENDPOINT=https://storage.railway.app
REGION=auto
ACCESS_KEY_ID=your_bucket_access_key_id
SECRET_ACCESS_KEY=your_bucket_secret
```

The committed `.env.example` file contains all variable names with placeholder values. Keep it up to date whenever a new variable is added.

---

## Per-Environment Summary

### Local Development

Set in `.env.local` (gitignored).

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon dev branch connection string |
| `OPENROUTER_API_KEY` | Your OpenRouter key |
| `AUTH_SECRET` | Locally generated random hex |
| `AUTH_GITHUB_ID` | Dev GitHub OAuth app client ID |
| `AUTH_GITHUB_SECRET` | Dev GitHub OAuth app client secret |
| `PUBLIC_SITE_URL` | `http://localhost:5173` |

`AUTH_TRUST_HOST` is not needed locally.

If testing uploads locally, also set: `BUCKET`, `ENDPOINT`, `REGION`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`.

### Production (Railway)

Set via Railway dashboard under Project > Service > Variables. Railway encrypts variables at rest and never exposes them in build logs.

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon production branch connection string |
| `OPENROUTER_API_KEY` | Production OpenRouter key |
| `AUTH_SECRET` | Production random hex (separate from local) |
| `AUTH_GITHUB_ID` | Production GitHub OAuth app client ID |
| `AUTH_GITHUB_SECRET` | Production GitHub OAuth app client secret |
| `PUBLIC_SITE_URL` | `https://yourdomain.com` |
| `BUCKET` | Railway bucket name (variable reference) |
| `ENDPOINT` | Railway bucket endpoint (`https://storage.railway.app`) |
| `REGION` | Railway bucket region (`auto`) |
| `ACCESS_KEY_ID` | Railway bucket access key ID (variable reference) |
| `SECRET_ACCESS_KEY` | Railway bucket secret key (variable reference) |

`AUTH_TRUST_HOST` is not needed on Railway — do not set it.

Use separate GitHub OAuth apps for local and production so callback URLs stay distinct and credentials can be rotated independently.

Optional variables (`CHAT_RATE_LIMIT`, `OPENROUTER_MODEL`, `EMBEDDING_MODEL`, `OPENROUTER_BASE_URL`) only need to be set in Railway if you want to override the defaults in production. Bucket variables are required only when the first-party media upload path is enabled.
