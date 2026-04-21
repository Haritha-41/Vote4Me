import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, Navigate } from "react-router-dom";
import { Card, PillButton } from "../components/ui";
import { useSession } from "../hooks/useSession";
import { getElectionForVote, submitVote } from "../services/api";

function Vote() {
  const location = useLocation();
  const { token, setUser, user } = useSession();
  const electionId = useMemo(() => new URLSearchParams(location.search).get("electionId") ?? "", [location.search]);

  const [election, setElection] = useState(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchElection() {
      if (!electionId) {
        setError("Missing election id.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const response = await getElectionForVote(token, electionId);
        if (cancelled) return;
        setElection(response.election);
      } catch (fetchError) {
        if (cancelled) return;
        setError(fetchError?.message ?? "Unable to load election details.");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchElection();

    return () => {
      cancelled = true;
    };
  }, [electionId, token]);

  if (user?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  async function handleSubmitVote() {
    setError("");
    setSuccessMessage("");

    if (!selectedCandidateId) {
      setError("Select a candidate before submitting your vote.");
      return;
    }

    setIsSubmitting(true);

    try {
      await submitVote({
        token,
        electionId,
        candidateId: selectedCandidateId,
        nonce: crypto.randomUUID(),
      });

      setElection((previous) => (previous ? { ...previous, hasVoted: true } : previous));
      setUser((previousUser) =>
        previousUser
          ? {
              ...previousUser,
              votedElections: previousUser.votedElections.includes(electionId)
                ? previousUser.votedElections
                : [...previousUser.votedElections, electionId],
            }
          : previousUser,
      );

      setSuccessMessage("Vote submitted successfully.");
    } catch (submitError) {
      setError(submitError?.message ?? "Vote submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isVotingLocked = !election?.isActive || Boolean(election?.hasVoted);

  return (
    <main className="min-h-screen bg-[#f7faff] p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-4xl font-bold text-slate-900">{election?.title ?? "Election Ballot"}</h1>
          <p className="text-xs text-slate-500">Token verified • Ballot access active</p>
        </div>

        {error && (
          <p className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700" role="alert">
            {error}
          </p>
        )}
        {successMessage && (
          <p className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700" role="status">
            {successMessage}
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr,340px]">
          <div className="space-y-3">
            {isLoading ? <Card className="p-4">Loading ballot...</Card> : null}

            {(election?.candidates ?? []).map((candidate) => {
              const isSelected = candidate.id === selectedCandidateId;
              return (
                <button key={candidate.id} type="button" onClick={() => setSelectedCandidateId(candidate.id)} className="w-full text-left">
                  <Card className={`flex items-center justify-between p-4 ${isSelected ? "border-2 border-[#6D5EF8] bg-blue-50" : ""}`}>
                    <span className="font-medium text-slate-900">{candidate.name}</span>
                    {isSelected ? <span className="text-xs font-semibold text-[#6D5EF8]">Selected</span> : null}
                  </Card>
                </button>
              );
            })}

            <div className="flex flex-wrap gap-2">
              <PillButton color="googleBlue" onClick={handleSubmitVote} disabled={isSubmitting || isVotingLocked || !selectedCandidateId}>
                {isSubmitting ? "Submitting..." : "Review Vote"}
              </PillButton>
              <Link to="/dashboard">
                <PillButton color="googleGreen">Back to Dashboard</PillButton>
              </Link>
            </div>
          </div>

          <Card className="bg-blue-50 p-4">
            <h2 className="font-semibold text-slate-900">Ballot Summary</h2>
            <p className="mt-2 text-sm text-slate-600">Selection: {election?.candidates?.find((candidate) => candidate.id === selectedCandidateId)?.name ?? "None"}</p>
            <p className="mt-2 text-xs text-slate-500">Election status: {election?.isActive ? "Open" : "Closed"}</p>
            {isVotingLocked ? <p className="mt-3 text-xs font-semibold text-amber-700">Voting is locked for this election.</p> : null}
          </Card>
        </div>
      </div>
    </main>
  );
}

export default Vote;
