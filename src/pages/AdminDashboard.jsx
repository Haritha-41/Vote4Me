import { useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Card, PillButton, Stat } from "../components/ui";
import { useSession } from "../hooks/useSession";
import {
  createMockElectionPackage,
  getAdminTestingSettings,
  getVotingAdminSnapshot,
  issueUserToken,
  listAllElectionsForAdmin,
  listElectionVotes,
  removeVoteForUser,
  revokeUserToken,
  rotateUserToken,
  setAdminTestingSettings,
} from "../services/api";

const CHART_COLORS = ["#5A67FF", "#2EB5FF", "#19B992", "#FB8C44", "#EA4335", "#34A853"];

function AdminDashboard() {
  const { token, user, logout } = useSession();
  const [snapshot, setSnapshot] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);
  const [isWorkingUserId, setIsWorkingUserId] = useState(null);
  const [adminMessage, setAdminMessage] = useState("");

  const [allowAdminVoteReset, setAllowAdminVoteReset] = useState(false);
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);
  const [adminElections, setAdminElections] = useState([]);
  const [selectedElectionId, setSelectedElectionId] = useState("");
  const [electionVotes, setElectionVotes] = useState([]);
  const [isLoadingVotes, setIsLoadingVotes] = useState(false);

  const [issueForm, setIssueForm] = useState({
    name: "",
    email: "",
    role: "voter",
  });

  const votesByElection = snapshot?.votesByElection ?? [];
  const maxVotes = useMemo(
    () => Math.max(...votesByElection.map((row) => row.votesCount), 1),
    [votesByElection],
  );

  async function loadSnapshot() {
    setIsLoading(true);
    setError("");
    try {
      const response = await getVotingAdminSnapshot(token);
      setSnapshot(response);
    } catch (fetchError) {
      setError(fetchError?.message ?? "Unable to load admin snapshot.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSnapshot();
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    async function loadResetControls() {
      try {
        const [settingsResponse, electionsResponse] = await Promise.all([
          getAdminTestingSettings(token),
          listAllElectionsForAdmin(token),
        ]);

        if (cancelled) {
          return;
        }

        setAllowAdminVoteReset(settingsResponse.allowAdminVoteReset);
        setAdminElections(electionsResponse.elections);
        setSelectedElectionId((previousElectionId) => {
          if (
            previousElectionId &&
            electionsResponse.elections.some((election) => election._id === previousElectionId)
          ) {
            return previousElectionId;
          }
          return electionsResponse.elections[0]?._id ?? "";
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError?.message ?? "Unable to load vote reset controls.");
        }
      }
    }

    void loadResetControls();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    async function loadVotes() {
      if (!selectedElectionId) {
        setElectionVotes([]);
        return;
      }

      setIsLoadingVotes(true);
      try {
        const votesResponse = await listElectionVotes({
          token,
          electionId: selectedElectionId,
        });
        if (!cancelled) {
          setElectionVotes(votesResponse.votes);
        }
      } catch (votesError) {
        if (!cancelled) {
          setError(votesError?.message ?? "Unable to load election votes.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingVotes(false);
        }
      }
    }

    void loadVotes();

    return () => {
      cancelled = true;
    };
  }, [selectedElectionId, token]);

  if (user?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleIssueToken() {
    if (issueForm.name.trim().length < 2) {
      setError("Enter a valid user name (minimum 2 characters).");
      return;
    }

    setIsSubmittingIssue(true);
    setError("");
    setAdminMessage("");

    try {
      const response = await issueUserToken({
        token,
        name: issueForm.name,
        email: issueForm.email || undefined,
        role: issueForm.role,
      });
      setAdminMessage(`Issued token for ${response.user.name}: ${response.authToken}`);
      setIssueForm((previous) => ({ ...previous, name: "", email: "" }));
      await loadSnapshot();
    } catch (issueError) {
      setError(issueError?.message ?? "Unable to issue token.");
    } finally {
      setIsSubmittingIssue(false);
    }
  }

  async function handleRotate(userId) {
    setIsWorkingUserId(userId);
    setError("");
    setAdminMessage("");
    try {
      const response = await rotateUserToken({ token, userId });
      setAdminMessage(`Rotated token for user ${userId}: ${response.authToken}`);
      await loadSnapshot();
    } catch (rotateError) {
      setError(rotateError?.message ?? "Unable to rotate token.");
    } finally {
      setIsWorkingUserId(null);
    }
  }

  async function handleRevoke(userId) {
    setIsWorkingUserId(userId);
    setError("");
    setAdminMessage("");
    try {
      const response = await revokeUserToken({ token, userId });
      setAdminMessage(`Revoked ${response.revokedCount} token(s) for user ${userId}.`);
      await loadSnapshot();
    } catch (revokeError) {
      setError(revokeError?.message ?? "Unable to revoke token.");
    } finally {
      setIsWorkingUserId(null);
    }
  }

  async function handleCreateMockElection() {
    setError("");
    setAdminMessage("");
    try {
      const response = await createMockElectionPackage(token);
      setAdminMessage(
        `Created mock election "${response.election.title}" and voter "${response.voter.name}". Token: ${response.voter.authToken}`,
      );
      await loadSnapshot();

      const electionsResponse = await listAllElectionsForAdmin(token);
      setAdminElections(electionsResponse.elections);
      setSelectedElectionId(response.election._id);
    } catch (createError) {
      setError(createError?.message ?? "Unable to create mock election package.");
    }
  }

  async function handleTestingToggle(event) {
    const nextValue = event.target.checked;
    const previousValue = allowAdminVoteReset;
    setAllowAdminVoteReset(nextValue);
    setIsSettingsSaving(true);
    setError("");
    setAdminMessage("");

    try {
      await setAdminTestingSettings({
        token,
        allowAdminVoteReset: nextValue,
      });
      setAdminMessage(nextValue ? "Vote reset testing enabled." : "Vote reset testing disabled.");
    } catch (toggleError) {
      setAllowAdminVoteReset(previousValue);
      setError(toggleError?.message ?? "Unable to update testing settings.");
    } finally {
      setIsSettingsSaving(false);
    }
  }

  async function handleRemoveVote(userId) {
    setError("");
    setAdminMessage("");
    try {
      const response = await removeVoteForUser({
        token,
        electionId: selectedElectionId,
        userId,
      });
      setAdminMessage(response.message ?? "Vote removed.");

      const [votesResponse, electionsResponse] = await Promise.all([
        listElectionVotes({ token, electionId: selectedElectionId }),
        listAllElectionsForAdmin(token),
      ]);
      setElectionVotes(votesResponse.votes);
      setAdminElections(electionsResponse.elections);
      await loadSnapshot();
    } catch (removeError) {
      setError(removeError?.message ?? "Unable to remove vote.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Admin Poll Dashboard</h1>
            <p className="text-slate-600">Live turnout and token lifecycle controls.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/dashboard">
              <PillButton color="googleYellow">Voter View</PillButton>
            </Link>
            <PillButton color="googleRed" onClick={logout}>Sign Out</PillButton>
          </div>
        </div>

        {error && (
          <p className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700" role="alert">
            {error}
          </p>
        )}
        {adminMessage && (
          <p className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700" role="status">
            {adminMessage}
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-4">
          <Stat label="Total Votes" value={String(snapshot?.stats?.totalVotes ?? 0)} bg="bg-blue-100" />
          <Stat label="Participation" value={`${snapshot?.stats?.participation ?? 0}%`} bg="bg-green-100" />
          <Stat label="Open Polls" value={String(snapshot?.stats?.openPolls ?? 0)} bg="bg-yellow-100" />
          <Stat label="Active Tokens" value={String(snapshot?.stats?.activeTokens ?? 0)} bg="bg-rose-100" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr,360px]">
          <Card className="p-4">
            <h2 className="mb-4 font-semibold text-slate-900">Votes by Election</h2>
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading chart...</p>
            ) : (
              <div className="flex h-44 items-end gap-2">
                {votesByElection.map((row, index) => (
                  <div key={row.electionId} className="flex flex-1 flex-col items-center justify-end gap-2">
                    <div
                      className="w-full rounded"
                      style={{
                        height: `${Math.max((row.votesCount / maxVotes) * 100, 8)}%`,
                        backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                      }}
                    />
                    <p className="line-clamp-1 text-xs text-slate-600">{row.title}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="bg-blue-50 p-4">
            <h2 className="mb-2 font-semibold text-slate-900">Current Poll Status</h2>
            {(snapshot?.pollStatuses ?? []).map((poll) => (
              <div key={poll.electionId} className="mb-2 flex items-center justify-between rounded bg-white px-3 py-2 text-sm">
                <span>{poll.title}</span>
                <span className={poll.status === "live" ? "text-googleBlue" : "text-slate-500"}>
                  {poll.status === "live" ? "Live" : "Closed"}
                </span>
              </div>
            ))}
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <h2 className="mb-3 font-semibold text-slate-900">Issue New Token</h2>
            <div className="space-y-3">
              <input
                type="text"
                value={issueForm.name}
                onChange={(event) => setIssueForm((previous) => ({ ...previous, name: event.target.value }))}
                className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-slate-900"
                placeholder="User name"
              />
              <input
                type="email"
                value={issueForm.email}
                onChange={(event) => setIssueForm((previous) => ({ ...previous, email: event.target.value }))}
                className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-slate-900"
                placeholder="Email (optional)"
              />
              <select
                value={issueForm.role}
                onChange={(event) => setIssueForm((previous) => ({ ...previous, role: event.target.value }))}
                className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-slate-900"
              >
                <option value="voter">Voter</option>
                <option value="admin">Admin</option>
              </select>
              <div className="flex gap-2">
                <PillButton color="googleBlue" className="w-full" onClick={handleIssueToken} disabled={isSubmittingIssue}>
                  {isSubmittingIssue ? "Issuing..." : "Issue Token"}
                </PillButton>
                <PillButton color="googleGreen" className="w-full" onClick={handleCreateMockElection}>
                  Create Mock Election
                </PillButton>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 font-semibold text-slate-900">Active Token Holders</h2>
            <div className="max-h-[300px] space-y-2 overflow-y-auto">
              {(snapshot?.tokenUsers ?? []).map((tokenUser) => (
                <div key={tokenUser.userId} className="flex items-center justify-between gap-2 rounded-lg border border-blue-100 bg-white px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{tokenUser.name}</p>
                    <p className="text-xs text-slate-500">
                      {tokenUser.role}
                      {tokenUser.email ? ` - ${tokenUser.email}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PillButton
                      color="googleGreen"
                      className="px-3 py-1 text-xs"
                      onClick={() => handleRotate(tokenUser.userId)}
                      disabled={isWorkingUserId === tokenUser.userId}
                    >
                      Rotate
                    </PillButton>
                    <PillButton
                      color="googleRed"
                      className="px-3 py-1 text-xs"
                      onClick={() => handleRevoke(tokenUser.userId)}
                      disabled={isWorkingUserId === tokenUser.userId}
                    >
                      Revoke
                    </PillButton>
                  </div>
                </div>
              ))}
              {!isLoading && (snapshot?.tokenUsers?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">No active tokens found.</p>
              ) : null}
            </div>
          </Card>
        </div>

        <Card className="p-4">
          <h2 className="mb-3 font-semibold text-slate-900">Vote Reset Testing</h2>
          <p className="mb-3 text-sm text-slate-600">
            Enable this in testing to remove voter ballots and allow revotes.
          </p>
          <label className="mb-4 flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
            <input
              type="checkbox"
              checked={allowAdminVoteReset}
              onChange={handleTestingToggle}
              disabled={isSettingsSaving}
              className="h-4 w-4 rounded border-slate-300 text-googleBlue focus:ring-googleBlue"
            />
            <span className="text-sm font-medium text-slate-700">Allow admins to remove votes for testing</span>
          </label>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-semibold text-slate-700" htmlFor="reset-election">
              Election
            </label>
            <select
              id="reset-election"
              value={selectedElectionId}
              onChange={(event) => setSelectedElectionId(event.target.value)}
              className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-slate-900"
            >
              {adminElections.map((election) => (
                <option key={election._id} value={election._id}>
                  {election.title} ({election.voteCount} votes)
                </option>
              ))}
            </select>
          </div>

          {isLoadingVotes ? (
            <p className="text-sm text-slate-500">Loading votes...</p>
          ) : electionVotes.length === 0 ? (
            <p className="text-sm text-slate-500">No votes recorded for selected election.</p>
          ) : (
            <div className="space-y-2">
              {electionVotes.map((vote) => (
                <div key={vote.voteId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-100 bg-white px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{vote.userName}</p>
                    <p className="text-xs text-slate-500">
                      {vote.candidateName} - {new Date(vote.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <PillButton
                    color="googleRed"
                    className="px-3 py-1 text-xs"
                    onClick={() => handleRemoveVote(vote.userId)}
                    disabled={!allowAdminVoteReset}
                  >
                    Remove Vote
                  </PillButton>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}

export default AdminDashboard;
