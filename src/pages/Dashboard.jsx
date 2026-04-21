import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Card, PillButton } from "../components/ui";
import { useSession } from "../hooks/useSession";
import { getVoterDashboardSnapshot } from "../services/api";

function Dashboard() {
  const { token, user, logout } = useSession();
  const [payload, setPayload] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboard() {
      setIsLoading(true);
      setError("");

      try {
        const response = await getVoterDashboardSnapshot(token);
        if (cancelled) return;
        setPayload(response);
      } catch (fetchError) {
        if (cancelled) return;
        setError(fetchError?.message ?? "Unable to load dashboard data.");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchDashboard();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (user?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  const elections = payload?.elections ?? [];

  return (
    <main className="min-h-screen bg-[#f7faff] p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Voter Dashboard</h1>
            <p className="text-slate-600">Choose from your current eligible elections.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">Authenticated</span>
            <PillButton color="googleRed" onClick={logout}>Sign Out</PillButton>
          </div>
        </div>

        {error && (
          <p className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700" role="alert">
            {error}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-[280px,1fr]">
          <Card className="bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Voter</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{payload?.user?.name ?? user?.name}</p>
            <p className="mt-1 text-sm text-slate-600">Eligible elections: {elections.length}</p>
            <Link to="/">
              <PillButton className="mt-4 w-full" color="googleBlue">Back to Landing</PillButton>
            </Link>
          </Card>

          <div className="space-y-3">
            {isLoading ? <Card className="p-4">Loading elections...</Card> : null}
            {!isLoading && elections.length === 0 ? (
              <Card className="p-4">
                <h2 className="font-semibold text-slate-900">No elections available</h2>
                <p className="mt-1 text-sm text-slate-600">Your account currently has no assigned elections.</p>
              </Card>
            ) : null}

            {elections.map((election) => (
              <Card key={election._id} className={`p-4 ${election.status === "live" ? "border-blue-200" : "border-yellow-200"}`}>
                <h2 className="font-semibold text-slate-900">{election.title}</h2>
                <p className="mb-3 text-sm text-slate-500">{election.description}</p>
                {election.status === "live" && !election.hasVoted ? (
                  <Link to={`/voting?electionId=${encodeURIComponent(election._id)}`}>
                    <PillButton color="googleBlue">Open Ballot</PillButton>
                  </Link>
                ) : election.status !== "live" ? (
                  <p className="text-sm text-slate-500">Voting is closed for this election.</p>
                ) : (
                  <p className="text-sm text-emerald-700">Vote already submitted.</p>
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

export default Dashboard;
