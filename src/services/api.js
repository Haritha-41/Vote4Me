import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error("Missing VITE_CONVEX_URL environment variable.");
}

const client = new ConvexHttpClient(convexUrl);

async function executeConvexRequest(request) {
  try {
    return await request();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("failed to fetch")) {
      throw new Error(
        "Cannot reach Convex backend. Start `npm run dev:convex` and verify VITE_CONVEX_URL.",
      );
    }
    throw error;
  }
}

function sanitizeName(name) {
  return name.trim();
}

function sanitizeAuthToken(authToken) {
  return authToken.trim();
}

export async function loginUser({ authToken }) {
  return executeConvexRequest(() =>
    client.mutation(api.auth.login, {
      token: sanitizeAuthToken(authToken),
    }),
  );
}

export async function logoutUser(token) {
  return executeConvexRequest(() => client.mutation(api.auth.logout, { token }));
}

export async function getCurrentUser(token) {
  return executeConvexRequest(() => client.query(api.auth.me, { token }));
}

export async function listEligibleElections(token) {
  return executeConvexRequest(() =>
    client.query(api.election.listEligibleElections, { token }),
  );
}

export async function getVoterDashboardSnapshot(token) {
  return executeConvexRequest(() =>
    client.query(api.election.getVoterDashboardSnapshot, { token }),
  );
}

export async function getElectionForVote(token, electionId) {
  return executeConvexRequest(() =>
    client.query(api.election.getElectionForVote, { token, electionId }),
  );
}

export async function submitVote({ token, electionId, candidateId, nonce }) {
  return executeConvexRequest(() =>
    client.mutation(api.vote.submitVote, {
      token,
      electionId,
      candidateId,
      nonce,
    }),
  );
}

export async function getAdminTestingSettings(token) {
  return executeConvexRequest(() =>
    client.query(api.admin.getTestingSettings, { token }),
  );
}

export async function setAdminTestingSettings({ token, allowAdminVoteReset }) {
  return executeConvexRequest(() =>
    client.mutation(api.admin.setTestingSettings, {
      token,
      allowAdminVoteReset,
    }),
  );
}

export async function createMockElectionPackage(token) {
  return executeConvexRequest(() =>
    client.mutation(api.admin.createMockElectionPackage, { token }),
  );
}

export async function listAllElectionsForAdmin(token) {
  return executeConvexRequest(() =>
    client.query(api.admin.listAllElections, { token }),
  );
}

export async function listElectionVotes({ token, electionId }) {
  return executeConvexRequest(() =>
    client.query(api.admin.listElectionVotes, { token, electionId }),
  );
}

export async function removeVoteForUser({ token, electionId, userId }) {
  return executeConvexRequest(() =>
    client.mutation(api.admin.removeVoteForUser, {
      token,
      electionId,
      userId,
    }),
  );
}

export async function getVotingAdminSnapshot(token) {
  return executeConvexRequest(() =>
    client.query(api.admin.getVotingAdminSnapshot, { token }),
  );
}

export async function issueUserToken({ token, name, email, role, eligibleElections }) {
  return executeConvexRequest(() =>
    client.mutation(api.admin.issueUserToken, {
      token,
      name: sanitizeName(name),
      email: email?.trim() || undefined,
      role,
      eligibleElections,
    }),
  );
}

export async function rotateUserToken({ token, userId }) {
  return executeConvexRequest(() =>
    client.mutation(api.admin.rotateUserToken, {
      token,
      userId,
    }),
  );
}

export async function revokeUserToken({ token, userId }) {
  return executeConvexRequest(() =>
    client.mutation(api.admin.revokeUserToken, {
      token,
      userId,
    }),
  );
}
