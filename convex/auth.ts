import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { getAuthenticatedUser } from "./authHelpers";
import { generateSessionToken, hashWithSha256 } from "./security";

const INVALID_CREDENTIALS_MESSAGE = "Invalid credentials.";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const LOGIN_WINDOW_MS = 1000 * 60 * 10;
const LOGIN_BLOCK_MS = 1000 * 60 * 15;
const MAX_LOGIN_ATTEMPTS = 5;
const AUTH_TOKEN_REGEX = /^[0-9]{6}$/;

function validateLoginInput(token: string) {
  if (!AUTH_TOKEN_REGEX.test(token.trim())) {
    throw new Error(INVALID_CREDENTIALS_MESSAGE);
  }
}

async function getAttemptRecord(ctx: MutationCtx, identifier: string) {
  return ctx.db.query("loginAttempts").withIndex("by_identifier", (query) => query.eq("identifier", identifier)).unique();
}

async function assertNotBlocked(ctx: MutationCtx, identifier: string, now: number) {
  const attemptRecord = await getAttemptRecord(ctx, identifier);
  if (attemptRecord?.blockedUntil && attemptRecord.blockedUntil > now) {
    throw new Error("Too many failed login attempts. Try again later.");
  }
}

async function recordFailedAttempt(ctx: MutationCtx, identifier: string, now: number) {
  const attemptRecord = await getAttemptRecord(ctx, identifier);

  if (!attemptRecord) {
    await ctx.db.insert("loginAttempts", {
      identifier,
      attemptWindowStart: now,
      attemptCount: 1,
    });
    return;
  }

  if (now - attemptRecord.attemptWindowStart > LOGIN_WINDOW_MS) {
    await ctx.db.patch(attemptRecord._id, {
      attemptWindowStart: now,
      attemptCount: 1,
      blockedUntil: undefined,
    });
    return;
  }

  const nextAttemptCount = attemptRecord.attemptCount + 1;

  await ctx.db.patch(attemptRecord._id, {
    attemptCount: nextAttemptCount,
    blockedUntil: nextAttemptCount >= MAX_LOGIN_ATTEMPTS ? now + LOGIN_BLOCK_MS : undefined,
  });
}

async function clearFailedAttempts(ctx: MutationCtx, identifier: string, now: number) {
  const attemptRecord = await getAttemptRecord(ctx, identifier);
  if (!attemptRecord) {
    return;
  }

  await ctx.db.patch(attemptRecord._id, {
    attemptWindowStart: now,
    attemptCount: 0,
    blockedUntil: undefined,
  });
}

async function revokeActiveSessions(ctx: MutationCtx, userId: Id<"users">, now: number) {
  const existingSessions = await ctx.db.query("sessions").withIndex("by_user_id", (query) => query.eq("userId", userId)).collect();

  await Promise.all(
    existingSessions
      .filter((session) => !session.revokedAt)
      .map((session) =>
        ctx.db.patch(session._id, {
          revokedAt: now,
        }),
      ),
  );
}

export const login = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    validateLoginInput(args.token);

    const now = Date.now();
    const normalizedToken = args.token.trim();
    const tokenHash = await hashWithSha256(normalizedToken);
    const identifier = await hashWithSha256(`login_attempt:${normalizedToken}`);
    await assertNotBlocked(ctx, identifier, now);

    const authToken = await ctx.db
      .query("authTokens")
      .withIndex("by_token_hash", (query) => query.eq("tokenHash", tokenHash))
      .unique();

    if (!authToken || authToken.status !== "active") {
      await recordFailedAttempt(ctx, identifier, now);
      throw new Error(INVALID_CREDENTIALS_MESSAGE);
    }

    const user = await ctx.db.get(authToken.userId);
    if (!user) {
      await recordFailedAttempt(ctx, identifier, now);
      throw new Error("Invalid token assignment.");
    }

    await clearFailedAttempts(ctx, identifier, now);
    await revokeActiveSessions(ctx, user._id, now);

    const sessionToken = generateSessionToken();
    const sessionTokenHash = await hashWithSha256(sessionToken);
    await ctx.db.insert("sessions", {
      userId: user._id,
      tokenHash: sessionTokenHash,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });

    return {
      token: sessionToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email ?? null,
        role: user.role,
        eligibleElections: user.eligibleElections,
        votedElections: user.votedElections,
      },
    };
  },
});

export const logout = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const tokenHash = await hashWithSha256(args.token.trim());
    const session = await ctx.db.query("sessions").withIndex("by_token_hash", (query) => query.eq("tokenHash", tokenHash)).unique();

    if (!session) {
      return { success: true };
    }

    await ctx.db.patch(session._id, {
      revokedAt: Date.now(),
    });

    return { success: true };
  },
});

export const me = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx, args.token);

    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email ?? null,
        role: user.role,
        eligibleElections: user.eligibleElections,
        votedElections: user.votedElections,
      },
    };
  },
});
