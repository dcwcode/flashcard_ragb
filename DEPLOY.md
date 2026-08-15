# Deploying to Railway

This app uses **Next.js + SQLite** (the database and generated audio are stored in
a single SQLite file), so it must run on a host with a **persistent disk**. It will
**not** work on serverless hosts like Vercel. Railway is the easiest option that
supports persistent volumes.

## 1. Push to GitHub

Railway deploys from a Git repo.

```bash
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

## 2. Create the project on Railway

1. Go to <https://railway.app> and sign in (GitHub sign-in is easiest).
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select your repo. Railway auto-detects the Next.js app and runs the build from
   `railway.toml`.

## 3. Attach a persistent volume

SQLite (and stored audio) must survive restarts and redeploys:

1. Open your service → **Settings** → **Volumes**.
2. Add a volume with mount path `/data` (any name is fine).
3. Redeploy so the volume is created.

## 4. Set environment variables

Open the service → **Variables** and add:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `file:/data/db/production.db` |
| `NEXTAUTH_URL` | `https://<your-app>.up.railway.app` |
| `NEXTAUTH_SECRET` | a long random string (see below) |

Generate a secret locally with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

The start command in `railway.toml` already runs `prisma migrate deploy` before
starting the server, so the database is created automatically on first deploy.

## 5. Deploy

Click **Deploy** (or push a new commit). Once done, open your app's public URL.

---

## Free alternative: Fly.io

Fly.io offers a free allowance (a small VM + 3GB volume) that is enough for this app,
but requires a credit card on file and a Dockerfile/CLI setup:

```bash
brew install flyctl
fly launch --no-deploy      # creates fly.toml + Dockerfile (accept the defaults)
fly volumes create data --size 1
fly deploy
```

Then set the same env vars above (with `DATABASE_URL=file:/data/production.db`) via
`fly secrets set`.
