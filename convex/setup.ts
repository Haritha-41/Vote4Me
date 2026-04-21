import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { hashAccessCode, hashWithSha256, normalizeName } from "./security";

function validateName(name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 120) {
    throw new Error("Name must be between 2 and 120 characters.");
  }
  return trimmed;
}

function randomSixDigitToken() {
  const entropy = new Uint32Array(1);
  crypto.getRandomValues(entropy);
  return String(entropy[0] % 1_000_000).padStart(6, "0");
}

async function insertUniqueAuthToken(
  ctx: Parameters<typeof mutation>[0] extends never ? never : any,
  userId: string,
  issuedByUserId: string,
  now: number,
) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const authToken = randomSixDigitToken();
    const tokenHash = await hashWithSha256(authToken);
    const existing = await ctx.db
      .query("authTokens")
      .withIndex("by_token_hash", (queryBuilder: any) => queryBuilder.eq("tokenHash", tokenHash))
      .unique();

    if (existing) {
      continue;
    }

    await ctx.db.insert("authTokens", {
      userId,
      tokenHash,
      status: "active",
      issuedByUserId,
      createdAt: now,
      updatedAt: now,
    });

    return authToken;
  }

  throw new Error("Unable to allocate a unique authentication token.");
}

export const bootstrapAdmin = mutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUsers = await ctx.db.query("users").take(1);
    if (existingUsers.length > 0) {
      throw new Error("Bootstrap already completed.");
    }

    const name = validateName(args.name);
    const normalizedName = normalizeName(name);
    const placeholderAccessCodeHash = await hashAccessCode(crypto.randomUUID());

    const adminId = await ctx.db.insert("users", {
      name,
      normalizedName,
      email: args.email?.trim() || undefined,
      accessCodeHash: placeholderAccessCodeHash,
      ageConfirmed: true,
      eligibleElections: [],
      votedElections: [],
      role: "admin",
    });

    const authToken = randomSixDigitToken();
    const tokenHash = await hashWithSha256(authToken);
    const now = Date.now();
    await ctx.db.insert("authTokens", {
      userId: adminId,
      tokenHash,
      status: "active",
      issuedByUserId: adminId,
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      adminId,
      normalizedName,
      authToken,
    };
  },
});

export const recoverAdminTokenForTesting = mutation({
  args: {
    adminName: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedName = normalizeName(args.adminName);
    const adminUser = await ctx.db
      .query("users")
      .withIndex("by_normalized_name", (queryBuilder) =>
        queryBuilder.eq("normalizedName", normalizedName),
      )
      .unique();

    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("Admin user not found.");
    }

    const now = Date.now();
    const activeTokens = await ctx.db
      .query("authTokens")
      .withIndex("by_user_status", (queryBuilder) =>
        queryBuilder.eq("userId", adminUser._id).eq("status", "active"),
      )
      .collect();

    await Promise.all(
      activeTokens.map((tokenDocument) =>
        ctx.db.patch(tokenDocument._id, {
          status: "revoked",
          revokedByUserId: adminUser._id,
          revokedAt: now,
          updatedAt: now,
        }),
      ),
    );

    const authToken = await insertUniqueAuthToken(
      ctx,
      adminUser._id,
      adminUser._id,
      now,
    );

    return {
      admin: {
        _id: adminUser._id,
        name: adminUser.name,
      },
      authToken,
    };
  },
});

export const recoverAnyAdminTokenForTesting = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const adminUser = users.find((user) => user.role === "admin");

    if (!adminUser) {
      throw new Error("No admin user found in this deployment.");
    }

    const now = Date.now();
    const activeTokens = await ctx.db
      .query("authTokens")
      .withIndex("by_user_status", (queryBuilder) =>
        queryBuilder.eq("userId", adminUser._id).eq("status", "active"),
      )
      .collect();

    await Promise.all(
      activeTokens.map((tokenDocument) =>
        ctx.db.patch(tokenDocument._id, {
          status: "revoked",
          revokedByUserId: adminUser._id,
          revokedAt: now,
          updatedAt: now,
        }),
      ),
    );

    const authToken = await insertUniqueAuthToken(
      ctx,
      adminUser._id,
      adminUser._id,
      now,
    );

    return {
      admin: {
        _id: adminUser._id,
        name: adminUser.name,
      },
      authToken,
    };
  },
});
