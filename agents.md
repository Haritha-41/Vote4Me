# 🤖 AGENTS.md — Secure Voting Web Application

---

## 🧠 1. PROJECT CONTEXT

You are building a **Secure Voting Web Application** with strict requirements:

- One person → one vote (no duplicates, no revotes)
- Votes must remain **completely private**
- Only **authorized users with access codes** can vote
- Users can only vote in **assigned elections**
- Must follow **secure coding practices + accessibility standards**

---

## 🧱 2. TECH STACK (MANDATORY)

Frontend:

- React.js (Functional Components + Hooks)
- Tailwind CSS

Backend / Database:

- Convex

Deployment:

- Vercel

---

## ⚠️ 3. CRITICAL RULES (DO NOT VIOLATE)

1. ❌ NEVER allow multiple votes per user per election

2. ❌ NEVER expose vote data to other users

3. ❌ NEVER trust frontend validation alone

4. ❌ NEVER store access codes in plain text

5. ❌ NEVER allow unauthorized election access

6. ❌ NEVER allow vote modification after submission

7. ✅ ALWAYS validate on backend

8. ✅ ALWAYS hash sensitive data

9. ✅ ALWAYS enforce access control in backend

10. ✅ ALWAYS design for accessibility (WCAG)

---

## 🧩 4. CORE FEATURES TO IMPLEMENT

### 4.1 Authentication (Token-Based)

- User logs in using:
  - access_code
  - name (or identifier)

- Backend must:
  - Hash and compare access_code
  - Validate user eligibility
  - Return session/token

- Add:
  - age_confirmed (must be true)

---

### 4.2 Voting System

- User can vote only once per election

- Enforce using backend constraint:
  UNIQUE(user_id, election_id)

- After vote:
  - Lock voting permanently
  - Disable UI + enforce backend block

---

### 4.3 Vote Privacy

- Votes must NOT:
  - Be visible to other users
  - Be queryable publicly

- Only admin can view results AFTER election ends

---

### 4.4 Election Authorization

- Each user has:
  eligible_elections[]

- Only show:
  elections assigned to the user

---

### 4.5 Security

- Hash access codes (bcrypt or equivalent)
- Prevent:
  - replay attacks
  - duplicate submissions
  - unauthorized API access

---

## 🗄️ 5. DATABASE SCHEMA (CONVEX)

### users

{
\_id,
name,
access_code_hash,
age_confirmed,
eligible_elections: [election_id],
voted_elections: [election_id]
}

### elections

{
\_id,
title,
description,
candidates: [{ id, name }],
is_active
}

### votes

{
\_id,
user_id,
election_id,
candidate_id,
created_at
}

---

## 🔁 6. CORE LOGIC (MUST FOLLOW)

### LOGIN FLOW

1. Receive access_code
2. Hash + compare with DB
3. If invalid → reject
4. If valid:
   - create session
   - return user data

---

### VOTE FLOW

1. Receive vote request

2. Validate:
   - user exists
   - election is active
   - user eligible
   - user has NOT voted already

3. If any fail → reject

4. Insert vote

5. Update user.voted_elections

---

## 🧭 7. PROJECT STRUCTURE

### Frontend (React)

/src
/components
/pages
Login.jsx
Dashboard.jsx
Vote.jsx
/hooks
/services
api.js
/utils

---

### Backend (Convex)

/convex
schema.ts
auth.ts
vote.ts
election.ts

---

## 🧪 8. VALIDATION RULES

- Reject:
  - invalid access code
  - duplicate vote
  - unauthorized election access
  - inactive election

- Always:
  - sanitize inputs
  - validate types

---

## ♿ 9. ACCESSIBILITY REQUIREMENTS

- Use semantic HTML
- Add ARIA labels for inputs
- Ensure keyboard navigation
- Maintain color contrast
- Provide clear error messages

---

## 🧑‍💻 10. CODING STANDARDS

Frontend:

- camelCase → variables
- PascalCase → components
- Keep components modular

Backend:

- Separate concerns:
  - auth logic
  - voting logic
  - election logic

- Use clean, reusable functions

---

## 🔐 11. SECURITY REQUIREMENTS

- Use HTTPS only
- Hash all access codes
- Do NOT expose internal APIs
- Rate-limit sensitive endpoints (if possible)

---

## 🚀 12. DEPLOYMENT

- Frontend → Vercel
- Backend → Convex

---

## 📈 13. FUTURE (DO NOT IMPLEMENT NOW)

- OTP verification
- Multi-factor authentication
- Blockchain voting
- Audit logs

---

## 🧠 FINAL INSTRUCTION

You must:

- Follow ALL rules strictly
- Prioritize backend validation over frontend
- Ensure system is secure, scalable, and cleanly structured
- Do NOT skip constraints even if UI seems correct

Failure to enforce constraints = incorrect implementation

---

END OF FILE

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
