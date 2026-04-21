import type { MutationCtx, QueryCtx } from "./_generated/server";
import { hashWithSha256 } from "./security";

const MAX_TOKEN_LENGTH = 256;
const MIN_TOKEN_LENGTH = 32;

type ReaderCtx = MutationCtx | QueryCtx;

function assertTokenShape(token: string) {
  const normalizedToken = token.trim();

  if (normalizedToken.length < MIN_TOKEN_LENGTH || normalizedToken.length > MAX_TOKEN_LENGTH) {
    throw new Error("Unauthorized.");
  }
}

export async function getAuthenticatedUser(ctx: ReaderCtx, token: string) {
  assertTokenShape(token);

  const tokenHash = await hashWithSha256(token.trim());
  const session = await ctx.db.query("sessions").withIndex("by_token_hash", (query) => query.eq("tokenHash", tokenHash)).unique();

  if (!session) {
    throw new Error("Unauthorized.");
  }

  if (session.revokedAt) {
    throw new Error("Unauthorized.");
  }

  if (session.expiresAt <= Date.now()) {
    throw new Error("Session expired.");
  }

  const user = await ctx.db.get(session.userId);
  if (!user) {
    throw new Error("Unauthorized.");
  }

  return { session, user };
}
