import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    normalizedName: v.string(),
    email: v.optional(v.string()),
    accessCodeHash: v.string(),
    ageConfirmed: v.boolean(),
    eligibleElections: v.array(v.id("elections")),
    votedElections: v.array(v.id("elections")),
    role: v.union(v.literal("voter"), v.literal("admin")),
  }).index("by_normalized_name", ["normalizedName"]),

  elections: defineTable({
    title: v.string(),
    description: v.string(),
    candidates: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
      }),
    ),
    isActive: v.boolean(),
  }),

  votes: defineTable({
    userId: v.id("users"),
    electionId: v.id("elections"),
    candidateId: v.string(),
    createdAt: v.number(),
  })
    .index("by_user_election", ["userId", "electionId"])
    .index("by_election", ["electionId"]),

  sessions: defineTable({
    userId: v.id("users"),
    tokenHash: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_user_id", ["userId"]),

  loginAttempts: defineTable({
    identifier: v.string(),
    attemptWindowStart: v.number(),
    attemptCount: v.number(),
    blockedUntil: v.optional(v.number()),
  }).index("by_identifier", ["identifier"]),

  usedVoteNonces: defineTable({
    userId: v.id("users"),
    nonceHash: v.string(),
    electionId: v.id("elections"),
    createdAt: v.number(),
  })
    .index("by_user_nonce", ["userId", "nonceHash"])
    .index("by_user_election", ["userId", "electionId"]),

  appSettings: defineTable({
    key: v.string(),
    allowAdminVoteReset: v.boolean(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  }).index("by_key", ["key"]),

  authTokens: defineTable({
    userId: v.id("users"),
    tokenHash: v.string(),
    status: v.union(v.literal("active"), v.literal("revoked")),
    issuedByUserId: v.optional(v.id("users")),
    revokedByUserId: v.optional(v.id("users")),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_status", ["status"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_created_at", ["userId", "createdAt"]),
});
