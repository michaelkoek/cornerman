# Deploying Cornerman to GitHub Pages

Cornerman is a fully static, client-side Vite + React PWA backed by Firebase
(Auth + Firestore). It ships as static files and is served from a project
subpath: **`https://<username>.github.io/cornerman/`**.

Deployment is automated via GitHub Actions (`.github/workflows/deploy.yml`) —
there is no `gh-pages` branch and no `gh-pages` npm package. Every push to
`main` builds `dist/` and publishes it through the official Pages actions.

---

## 1. Create the repo and push

Create a GitHub repo named exactly **`cornerman`** (the name must match the
`base: '/cornerman/'` in `vite.config.ts`, otherwise asset URLs 404).

```bash
# from the project root
git init                     # if not already a repo
git add -A
git commit -m "Initial commit"
git branch -M main
git remote add origin git@github.com:<username>/cornerman.git
git push -u origin main
```

## 2. Enable Pages via GitHub Actions

In the repo: **Settings → Pages → Build and deployment → Source = GitHub Actions.**

Do NOT pick "Deploy from a branch" — this project deploys the built artifact
through the workflow, not a branch.

## 3. Add the Firebase config secrets

The workflow injects the Firebase web config at build time from repo secrets.
Add all six under **Settings → Secrets and variables → Actions → New repository
secret**:

| Secret | Example value |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | `AIza...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `cornerman-xxxx.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `cornerman-xxxx` |
| `VITE_FIREBASE_APP_ID` | `1:1234567890:web:abc123` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `cornerman-xxxx.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `1234567890` |

Get these from Firebase console → Project settings → **Your apps → Web app →
SDK setup and configuration**. These are public web-app config values (safe to
embed in the client bundle); Firestore **security rules** — not secrecy of these
keys — are what protect the data.

## 4. Deploy

Push to `main` (or run the workflow manually via **Actions → Deploy to GitHub
Pages → Run workflow**). When it completes, the app is live at:

**`https://<username>.github.io/cornerman/`**

---

## Firebase Auth: authorize the Pages domain

Google sign-in will fail with `auth/unauthorized-domain` until you allow the
Pages host. In the Firebase console:

**Authentication → Settings → Authorized domains → Add domain →
`<username>.github.io`**

(You authorize the host `<username>.github.io`, not the full subpath.)

## Firestore security rules

Paste these in **Firestore Database → Rules** (source of truth:
`integrations/firestore-model.md`):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sessions/{id} {
      allow read: if request.auth != null && resource.data.uid == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.uid == request.auth.uid;
    }
    match /settings/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Composite indexes may be required for the client's queries (`uid` + `date`,
`uid` + `createdAt`). Firestore will surface a console link to create them the
first time a query needs one — follow it. See `integrations/firestore-model.md`
for the full data model and query patterns.

---

## SPA deep links (404 handling)

GitHub Pages has no server-side rewrites, so a hard navigation to a deep link
such as `…/cornerman/log/123` would normally 404. `public/404.html` handles this:
Pages serves it for any unknown path, and it redirects back to the app base
(`/cornerman/`) so `index.html` loads and the client-side router takes over.

- `public/.nojekyll` (empty) is included so Pages does not strip files/folders
  beginning with an underscore.
- The requested deep-link path is stashed in
  `sessionStorage['spa:redirectPath']` before the redirect. This is **optional**
  to consume: the app boots fine at the base route without it. If exact deep-link
  restoration is wanted, `index.html` (owned by the src agent) can read that key
  on startup and `navigate()` to it, then clear it. Without that companion
  snippet, deep links simply land on the app's home route — acceptable for a
  personal app.

## The base-path contract

`vite.config.ts` sets `base: '/cornerman/'`, which makes
`import.meta.env.BASE_URL === '/cornerman/'` at build time. The react-router
must use that as its basename:

```tsx
<BrowserRouter basename={import.meta.env.BASE_URL}> … </BrowserRouter>
```

If you rename the GitHub repo, update `base` in `vite.config.ts`, the `base`
constant in `public/404.html`, and this document to match.
