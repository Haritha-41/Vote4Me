# Secure Voting Web Application

This app now uses the Antigravity-style voting UI and a token-only authentication flow.

## Core Product Behavior

- Login uses a **single 6-digit auth token**.
- No name/password/access-code input on login.
- One user can have one active auth token at a time.
- Admins can issue, rotate, and revoke tokens.
- Voting constraints remain backend-enforced:
  - one person -> one vote per election
  - no vote edits after submission
  - unauthorized election access blocked

## Main Routes

- `/` -> Landing page
- `/login` -> Token login (6 digits)
- `/dashboard` -> Voter dashboard
- `/voting?electionId=...` -> Ballot page
- `/admin` -> Admin dashboard + token controls

## Convex Tables (Additive)

- Existing: `users`, `elections`, `votes`, `sessions`, `loginAttempts`, `usedVoteNonces`, `appSettings`
- New: `authTokens`

## New Admin Token Operations

- `admin.issueUserToken`
- `admin.rotateUserToken`
- `admin.revokeUserToken`
- `admin.getVotingAdminSnapshot`

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Start Convex:

```bash
npm run dev:convex
```

3. Configure frontend env in `.env.local`:

```bash
VITE_CONVEX_URL=https://<your-convex-deployment>.convex.cloud
```

4. Start frontend:

```bash
npm run dev
```

## First Admin Bootstrap

Run `setup.bootstrapAdmin` once (only works when `users` table is empty):

```json
{
  "name": "System Admin",
  "email": "admin@example.com"
}
```

The mutation returns a 6-digit `authToken`. Use it at `/login`.

## Testing Helpers

Admin dashboard includes:

- Create mock election package (creates voter + election + auth token)
- Issue token for any user (new or existing)
- Rotate/revoke user tokens

## Build

```bash
npm run build
```
