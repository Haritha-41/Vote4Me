import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getAuthenticatedUser } from "./authHelpers";
import { hashAccessCode, hashWithSha256, normalizeName } from "./security";

const SETTINGS_KEY = "global";
const RANDOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SIX_DIGIT_RANGE = 1_000_000;

type AdminCtx = MutationCtx | QueryCtx;

function assertAdmin(role: "voter" | "admin") {
  if (role !== "admin") {
    throw new Error("Admin access required.");
  }
}

function validateName(name: string) {
  const normalizedName = name.trim();
  if (normalizedName.length < 2 || normalizedName.length > 120) {
    throw new Error("Name is invalid.");
  }
  return normalizedName;
}

function validateAccessCode(accessCode: string) {
  const normalizedAccessCode = accessCode.trim();
  if (normalizedAccessCode.length < 6 || normalizedAccessCode.length > 128) {
    throw new Error("Access code length is invalid.");
  }
  return normalizedAccessCode;
}

function randomString(length: number) {
  const entropy = new Uint8Array(length);
  crypto.getRandomValues(entropy);
  return Array.from(entropy)
    .map((value) => RANDOM_ALPHABET[value % RANDOM_ALPHABET.length])
    .join("");
}

function randomSixDigitToken(): string {
  const entropy = new Uint32Array(1);
  crypto.getRandomValues(entropy);
  return String(entropy[0] % SIX_DIGIT_RANGE).padStart(6, "0");
}

async function revokeActiveAuthTokens(
  ctx: MutationCtx,
  userId: Id<"users">,
  revokedByUserId: Id<"users">,
  now: number,
) {
  const existing = await ctx.db
    .query("authTokens")
    .withIndex("by_user_status", (queryBuilder) =>
      queryBuilder.eq("userId", userId).eq("status", "active"),
    )
    .collect();

  await Promise.all(
    existing.map((tokenDocument) =>
      ctx.db.patch(tokenDocument._id, {
        status: "revoked",
        revokedByUserId,
        revokedAt: now,
        updatedAt: now,
      }),
    ),
  );
}

async function getTestingSettingsDocument(ctx: AdminCtx) {
  return ctx.db.query("appSettings").withIndex("by_key", (queryBuilder) => queryBuilder.eq("key", SETTINGS_KEY)).unique();
}

export const getTestingSettings = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx, args.token);
    assertAdmin(user.role);

    const settings = await getTestingSettingsDocument(ctx);
    return {
      allowAdminVoteReset: settings?.allowAdminVoteReset ?? false,
      updatedAt: settings?.updatedAt ?? null,
    };
  },
});

export const setTestingSettings = mutation({
  args: {
    token: v.string(),
    allowAdminVoteReset: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx, args.token);
    assertAdmin(user.role);

    const existing = await getTestingSettingsDocument(ctx);
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        allowAdminVoteReset: args.allowAdminVoteReset,
        updatedAt: now,
        updatedBy: user._id,
      });
    } else {
      await ctx.db.insert("appSettings", {
        key: SETTINGS_KEY,
        allowAdminVoteReset: args.allowAdminVoteReset,
        updatedAt: now,
        updatedBy: user._id,
      });
    }

    return {
      success: true,
      allowAdminVoteReset: args.allowAdminVoteReset,
      updatedAt: now,
    };
  },
});

export const createAdmin = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    accessCode: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx, args.token);
    assertAdmin(user.role);

    const name = validateName(args.name);
    const normalized = normalizeName(name);
    const existing = await ctx.db.query("users").withIndex("by_normalized_name", (queryBuilder) => queryBuilder.eq("normalizedName", normalized)).unique();

    if (existing) {
      throw new Error("A user with this name already exists.");
    }

    const now = Date.now();
    const placeholderAccessCodeHash = await hashAccessCode(randomString(24));
    const adminId = await ctx.db.insert("users", {
      name,
      normalizedName: normalized,
      accessCodeHash: placeholderAccessCodeHash,
      ageConfirmed: true,
      eligibleElections: [],
      votedElections: [],
      role: "admin",
    });

    const authToken = await insertUniqueAuthToken(ctx, adminId, user._id, now);

    return {
      userId: adminId,
      authToken,
    };
  },
});

export const createElection = mutation({
  args: {
    token: v.string(),
    title: v.string(),
    description: v.string(),
    candidates: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx, args.token);
    assertAdmin(user.role);

    if (args.title.trim().length < 3 || args.title.trim().length > 200) {
      throw new Error("Election title length is invalid.");
    }

    if (args.candidates.length < 2) {
      throw new Error("An election must include at least two candidates.");
    }

    const seenCandidateIds = new Set<string>();

    for (const candidate of args.candidates) {
      const normalizedCandidateId = candidate.id.trim();
      if (!normalizedCandidateId || normalizedCandidateId.length > 80) {
        throw new Error("Candidate id is invalid.");
      }
      if (seenCandidateIds.has(normalizedCandidateId)) {
        throw new Error("Candidate ids must be unique.");
      }
      seenCandidateIds.add(normalizedCandidateId);
    }

    return ctx.db.insert("elections", {
      title: args.title.trim(),
      description: args.description.trim(),
      candidates: args.candidates.map((candidate) => ({
        id: candidate.id.trim(),
        name: candidate.name.trim(),
      })),
      isActive: true,
    });
  },
});

export const createMockElectionPackage = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx, args.token);
    assertAdmin(user.role);

    const now = Date.now();
    const suffix = now.toString().slice(-6);
    const electionId = await ctx.db.insert("elections", {
      title: `Mock Election ${suffix}`,
      description: "Testing ballot for feature validation. One selection only.",
      candidates: [
        { id: `mock_a_${suffix}`, name: "Mock Candidate A" },
        { id: `mock_b_${suffix}`, name: "Mock Candidate B" },
        { id: `mock_c_${suffix}`, name: "Mock Candidate C" },
      ],
      isActive: true,
    });

    let voterName = `Mock Voter ${suffix}`;
    let normalizedVoterName = normalizeName(voterName);
    const nameConflict = await ctx.db
      .query("users")
      .withIndex("by_normalized_name", (queryBuilder) => queryBuilder.eq("normalizedName", normalizedVoterName))
      .unique();

    if (nameConflict) {
      voterName = `${voterName}-${randomString(3)}`;
      normalizedVoterName = normalizeName(voterName);
    }

    const accessCode = `MockVote#${randomString(8)}`;
    const accessCodeHash = await hashAccessCode(accessCode);
    const voterId = await ctx.db.insert("users", {
      name: voterName,
      normalizedName: normalizedVoterName,
      accessCodeHash,
      ageConfirmed: true,
      eligibleElections: [electionId],
      votedElections: [],
      role: "voter",
    });

    const authToken = await insertUniqueAuthToken(ctx, voterId, user._id, now);

    return {
      election: {
        _id: electionId,
        title: `Mock Election ${suffix}`,
      },
      voter: {
        _id: voterId,
        name: voterName,
        accessCode,
        authToken,
      },
    };
  },
});

export const createVoter = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    accessCode: v.string(),
    ageConfirmed: v.boolean(),
    eligibleElections: v.array(v.id("elections")),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx, args.token);
    assertAdmin(user.role);

    const name = validateName(args.name);

    if (!args.ageConfirmed) {
      throw new Error("Voter must confirm age eligibility.");
    }

    const normalized = normalizeName(name);
    const existing = await ctx.db.query("users").withIndex("by_normalized_name", (queryBuilder) => queryBuilder.eq("normalizedName", normalized)).unique();

    if (existing) {
      throw new Error("A voter with this name already exists.");
    }

    const now = Date.now();
    const placeholderAccessCodeHash = await hashAccessCode(randomString(24));
    const voterId = await ctx.db.insert("users", {
      name,
      normalizedName: normalized,
      accessCodeHash: placeholderAccessCodeHash,
      ageConfirmed: true,
      eligibleElections: args.eligibleElections,
      votedElections: [],
      role: "voter",
    });

    const authToken = await insertUniqueAuthToken(ctx, voterId, user._id, now);

    return {
      userId: voterId,
      authToken,
    };
  },
});

export const listAllElections = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx, args.token);
    assertAdmin(user.role);

    const elections = await ctx.db.query("elections").order("desc").collect();
    const electionRows = await Promise.all(
      elections.map(async (election) => {
        const votes = await ctx.db.query("votes").withIndex("by_election", (queryBuilder) => queryBuilder.eq("electionId", election._id)).collect();
        return {
          _id: election._id,
          title: election.title,
          description: election.description,
          isActive: election.isActive,
          voteCount: votes.length,
        };
      }),
    );

    return { elections: electionRows };
  },
});

export const listElectionVotes = query({
  args: {
    token: v.string(),
    electionId: v.id("elections"),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx, args.token);
    assertAdmin(user.role);

    const election = await ctx.db.get(args.electionId);
    if (!election) {
      throw new Error("Election not found.");
    }

    const votes = await ctx.db.query("votes").withIndex("by_election", (queryBuilder) => queryBuilder.eq("electionId", args.electionId)).collect();
    const candidateNameById = new Map(election.candidates.map((candidate) => [candidate.id, candidate.name]));
    const uniqueUserIds = Array.from(new Set(votes.map((vote) => vote.userId)));
    const users = await Promise.all(uniqueUserIds.map((userId) => ctx.db.get(userId)));
    const userNameById = new Map<string, string>();

    for (let index = 0; index < uniqueUserIds.length; index += 1) {
      const userId = uniqueUserIds[index];
      const userRecord = users[index];
      userNameById.set(String(userId), userRecord?.name ?? "Unknown Voter");
    }

    return {
      election: {
        _id: election._id,
        title: election.title,
        isActive: election.isActive,
      },
      votes: votes
        .sort((left, right) => right.createdAt - left.createdAt)
        .map((vote) => ({
          voteId: vote._id,
          userId: vote.userId,
          userName: userNameById.get(String(vote.userId)) ?? "Unknown Voter",
          candidateId: vote.candidateId,
          candidateName: candidateNameById.get(vote.candidateId) ?? "Unknown Candidate",
          createdAt: vote.createdAt,
        })),
    };
  },
});

export const removeVoteForUser = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    electionId: v.id("elections"),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx, args.token);
    assertAdmin(user.role);

    const settings = await getTestingSettingsDocument(ctx);
    if (!settings?.allowAdminVoteReset) {
      throw new Error("Admin vote reset is disabled. Enable it in dashboard testing settings.");
    }

    const election = await ctx.db.get(args.electionId);
    if (!election) {
      throw new Error("Election not found.");
    }

    const voter = await ctx.db.get(args.userId);
    if (!voter || voter.role !== "voter") {
      throw new Error("Voter not found.");
    }

    const vote = await ctx.db
      .query("votes")
      .withIndex("by_user_election", (queryBuilder) => queryBuilder.eq("userId", args.userId).eq("electionId", args.electionId))
      .unique();

    if (!vote) {
      return {
        success: false,
        message: "No vote exists for this voter in the selected election.",
      };
    }

    await ctx.db.delete(vote._id);

    const nonceDocuments = await ctx.db
      .query("usedVoteNonces")
      .withIndex("by_user_election", (queryBuilder) => queryBuilder.eq("userId", args.userId).eq("electionId", args.electionId))
      .collect();

    await Promise.all(nonceDocuments.map((nonceDocument) => ctx.db.delete(nonceDocument._id)));

    if (voter.votedElections.includes(args.electionId)) {
      await ctx.db.patch(voter._id, {
        votedElections: voter.votedElections.filter((votedElectionId) => votedElectionId !== args.electionId),
      });
    }

    return {
      success: true,
      message: "Vote removed. The voter can submit again for this election.",
    };
  },
});

export const setElectionStatus = mutation({
  args: {
    token: v.string(),
    electionId: v.id("elections"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx, args.token);
    assertAdmin(user.role);

    const election = await ctx.db.get(args.electionId);
    if (!election) {
      throw new Error("Election not found.");
    }

    await ctx.db.patch(args.electionId, {
      isActive: args.isActive,
    });

    return { success: true };
  },
});

async function insertUniqueAuthToken(
  ctx: MutationCtx,
  userId: Id<"users">,
  issuedByUserId: Id<"users">,
  now: number,
) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const authToken = randomSixDigitToken();
    const tokenHash = await hashWithSha256(authToken);
    const existing = await ctx.db
      .query("authTokens")
      .withIndex("by_token_hash", (queryBuilder) => queryBuilder.eq("tokenHash", tokenHash))
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

export const issueUserToken = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    role: v.optional(v.union(v.literal("voter"), v.literal("admin"))),
    eligibleElections: v.optional(v.array(v.id("elections"))),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx, args.token);
    assertAdmin(user.role);

    const now = Date.now();
    const name = validateName(args.name);
    const normalizedName = normalizeName(name);
    const role = args.role ?? "voter";
    let targetUser = await ctx.db
      .query("users")
      .withIndex("by_normalized_name", (queryBuilder) =>
        queryBuilder.eq("normalizedName", normalizedName),
      )
      .unique();

    if (!targetUser) {
      const placeholderAccessCodeHash = await hashAccessCode(randomString(24));
      const newUserId = await ctx.db.insert("users", {
        name,
        normalizedName,
        email: args.email?.trim() || undefined,
        accessCodeHash: placeholderAccessCodeHash,
        ageConfirmed: true,
        eligibleElections: args.eligibleElections ?? [],
        votedElections: [],
        role,
      });
      targetUser = await ctx.db.get(newUserId);
    } else {
      const patch: {
        name?: string;
        email?: string | undefined;
        role?: "voter" | "admin";
        eligibleElections?: Id<"elections">[];
      } = {};

      if (targetUser.name !== name) {
        patch.name = name;
      }
      if (args.email !== undefined) {
        patch.email = args.email.trim() || undefined;
      }
      if (targetUser.role !== role) {
        patch.role = role;
      }
      if (args.eligibleElections !== undefined && role === "voter") {
        patch.eligibleElections = args.eligibleElections;
      }

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(targetUser._id, patch);
        targetUser = await ctx.db.get(targetUser._id);
      }
    }

    if (!targetUser) {
      throw new Error("Unable to create or load target user.");
    }

    await revokeActiveAuthTokens(ctx, targetUser._id, user._id, now);
    const authToken = await insertUniqueAuthToken(ctx, targetUser._id, user._id, now);

    return {
      user: {
        _id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email ?? null,
        role: targetUser.role,
      },
      authToken,
    };
  },
});

export const rotateUserToken = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx, args.token);
    assertAdmin(user.role);

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("User not found.");
    }

    const now = Date.now();
    await revokeActiveAuthTokens(ctx, args.userId, user._id, now);
    const authToken = await insertUniqueAuthToken(ctx, args.userId, user._id, now);

    return {
      userId: args.userId,
      authToken,
    };
  },
});

export const revokeUserToken = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx, args.token);
    assertAdmin(user.role);

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("User not found.");
    }

    const now = Date.now();
    const activeTokens = await ctx.db
      .query("authTokens")
      .withIndex("by_user_status", (queryBuilder) =>
        queryBuilder.eq("userId", args.userId).eq("status", "active"),
      )
      .collect();

    await Promise.all(
      activeTokens.map((tokenDocument) =>
        ctx.db.patch(tokenDocument._id, {
          status: "revoked",
          revokedByUserId: user._id,
          revokedAt: now,
          updatedAt: now,
        }),
      ),
    );

    return {
      userId: args.userId,
      revokedCount: activeTokens.length,
    };
  },
});

export const getVotingAdminSnapshot = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx, args.token);
    assertAdmin(user.role);

    const [elections, votes, users, activeTokens] = await Promise.all([
      ctx.db.query("elections").order("desc").collect(),
      ctx.db.query("votes").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("authTokens").withIndex("by_status", (queryBuilder) => queryBuilder.eq("status", "active")).collect(),
    ]);

    const voteCountByElection = new Map<string, number>();
    for (const vote of votes) {
      const key = String(vote.electionId);
      voteCountByElection.set(key, (voteCountByElection.get(key) ?? 0) + 1);
    }

    const uniqueVoterIds = new Set(votes.map((vote) => String(vote.userId)));
    const totalVoters = users.filter((userRecord) => userRecord.role === "voter").length;
    const participation =
      totalVoters === 0
        ? 0
        : Math.round((uniqueVoterIds.size / totalVoters) * 10000) / 100;

    const userById = new Map(users.map((userRecord) => [String(userRecord._id), userRecord]));
    const tokenUsers = activeTokens
      .map((tokenDocument) => {
        const tokenUser = userById.get(String(tokenDocument.userId));
        if (!tokenUser) {
          return null;
        }

        return {
          userId: tokenUser._id,
          name: tokenUser.name,
          email: tokenUser.email ?? null,
          role: tokenUser.role,
          tokenIssuedAt: tokenDocument.createdAt,
        };
      })
      .filter(
        (
          tokenUser,
        ): tokenUser is {
          userId: Id<"users">;
          name: string;
          email: string | null;
          role: "voter" | "admin";
          tokenIssuedAt: number;
        } => tokenUser !== null,
      )
      .sort((left, right) => right.tokenIssuedAt - left.tokenIssuedAt);

    return {
      stats: {
        totalVotes: votes.length,
        participation,
        openPolls: elections.filter((election) => election.isActive).length,
        activeTokens: activeTokens.length,
      },
      votesByElection: elections.map((election) => ({
        electionId: election._id,
        title: election.title,
        votesCount: voteCountByElection.get(String(election._id)) ?? 0,
      })),
      pollStatuses: elections.map((election) => ({
        electionId: election._id,
        title: election.title,
        status: election.isActive ? "live" : "closed",
      })),
      tokenUsers,
    };
  },
});
