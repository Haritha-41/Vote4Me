import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthenticatedUser } from "./authHelpers";

function mapElectionForUser(election: {
  _id: string;
  title: string;
  description: string;
  isActive: boolean;
}) {
  return {
    _id: election._id,
    title: election.title,
    description: election.description,
    isActive: election.isActive,
  };
}

export const listEligibleElections = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx, args.token);

    const elections = await Promise.all(
      user.eligibleElections.map(async (electionId) => {
        const election = await ctx.db.get(electionId);
        if (!election) {
          return null;
        }

        return {
          ...mapElectionForUser(election),
          hasVoted: user.votedElections.includes(election._id),
        };
      }),
    );

    return {
      elections: elections.filter((election): election is NonNullable<typeof election> => election !== null),
    };
  },
});

export const getVoterDashboardSnapshot = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx, args.token);

    const elections = await Promise.all(
      user.eligibleElections.map(async (electionId) => {
        const election = await ctx.db.get(electionId);
        if (!election) {
          return null;
        }

        const voteCount = await ctx.db
          .query("votes")
          .withIndex("by_election", (queryBuilder) => queryBuilder.eq("electionId", election._id))
          .collect();

        return {
          _id: election._id,
          title: election.title,
          description: election.description,
          status: election.isActive ? "live" : "closed",
          hasVoted: user.votedElections.includes(election._id),
          candidateCount: election.candidates.length,
          voteCount: voteCount.length,
        };
      }),
    );

    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email ?? null,
        role: user.role,
      },
      elections: elections.filter((election): election is NonNullable<typeof election> => election !== null),
    };
  },
});

export const getElectionForVote = query({
  args: {
    token: v.string(),
    electionId: v.id("elections"),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx, args.token);

    if (!user.eligibleElections.includes(args.electionId)) {
      throw new Error("Unauthorized election access.");
    }

    const election = await ctx.db.get(args.electionId);
    if (!election) {
      throw new Error("Election not found.");
    }

    return {
      election: {
        _id: election._id,
        title: election.title,
        description: election.description,
        candidates: election.candidates,
        isActive: election.isActive,
        hasVoted: user.votedElections.includes(election._id),
      },
    };
  },
});

export const getResults = query({
  args: {
    token: v.string(),
    electionId: v.id("elections"),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx, args.token);
    if (user.role !== "admin") {
      throw new Error("Only admins can view election results.");
    }

    const election = await ctx.db.get(args.electionId);
    if (!election) {
      throw new Error("Election not found.");
    }

    if (election.isActive) {
      throw new Error("Results are available only after the election ends.");
    }

    const votes = await ctx.db.query("votes").withIndex("by_election", (query) => query.eq("electionId", args.electionId)).collect();
    const counts = election.candidates.reduce<Record<string, number>>((accumulator, candidate) => {
      accumulator[candidate.id] = 0;
      return accumulator;
    }, {});

    for (const vote of votes) {
      if (counts[vote.candidateId] === undefined) {
        continue;
      }
      counts[vote.candidateId] += 1;
    }

    return {
      election: {
        _id: election._id,
        title: election.title,
      },
      totalVotes: votes.length,
      results: election.candidates.map((candidate) => ({
        candidateId: candidate.id,
        candidateName: candidate.name,
        count: counts[candidate.id] ?? 0,
      })),
    };
  },
});
