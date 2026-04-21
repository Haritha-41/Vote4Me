import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthenticatedUser } from "./authHelpers";
import { hashWithSha256 } from "./security";

function validateVotePayload(candidateId: string, nonce: string) {
  if (candidateId.trim().length < 1 || candidateId.trim().length > 80) {
    throw new Error("Invalid candidate.");
  }

  if (nonce.trim().length < 12 || nonce.trim().length > 200) {
    throw new Error("Invalid request signature.");
  }
}

export const submitVote = mutation({
  args: {
    token: v.string(),
    electionId: v.id("elections"),
    candidateId: v.string(),
    nonce: v.string(),
  },
  handler: async (ctx, args) => {
    validateVotePayload(args.candidateId, args.nonce);

    const { user } = await getAuthenticatedUser(ctx, args.token);

    if (user.role !== "voter") {
      throw new Error("Only voter accounts can submit ballots.");
    }

    const election = await ctx.db.get(args.electionId);
    if (!election) {
      throw new Error("Election not found.");
    }

    if (!election.isActive) {
      throw new Error("Election is not active.");
    }

    if (!user.eligibleElections.includes(args.electionId)) {
      throw new Error("Unauthorized election access.");
    }

    if (user.votedElections.includes(args.electionId)) {
      throw new Error("Vote already submitted for this election.");
    }

    const isValidCandidate = election.candidates.some((candidate) => candidate.id === args.candidateId.trim());
    if (!isValidCandidate) {
      throw new Error("Candidate is not valid for this election.");
    }

    const nonceHash = await hashWithSha256(`${args.electionId}:${args.nonce.trim()}`);
    const existingNonce = await ctx.db
      .query("usedVoteNonces")
      .withIndex("by_user_nonce", (query) => query.eq("userId", user._id).eq("nonceHash", nonceHash))
      .unique();

    if (existingNonce) {
      throw new Error("Duplicate vote submission detected.");
    }

    const existingVote = await ctx.db
      .query("votes")
      .withIndex("by_user_election", (query) => query.eq("userId", user._id).eq("electionId", args.electionId))
      .unique();

    if (existingVote) {
      throw new Error("Vote already submitted for this election.");
    }

    const now = Date.now();
    await ctx.db.insert("votes", {
      userId: user._id,
      electionId: args.electionId,
      candidateId: args.candidateId.trim(),
      createdAt: now,
    });

    await ctx.db.insert("usedVoteNonces", {
      userId: user._id,
      electionId: args.electionId,
      nonceHash,
      createdAt: now,
    });

    await ctx.db.patch(user._id, {
      votedElections: [...user.votedElections, args.electionId],
    });

    return {
      success: true,
      submittedAt: now,
    };
  },
});
