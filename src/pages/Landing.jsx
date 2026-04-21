import { Link } from "react-router-dom";
import { Card, PillButton } from "../components/ui";

function Landing() {
  return (
    <main className="min-h-screen bg-[#f5f8ff] p-6 md:p-12">
      <div className="mx-auto max-w-6xl space-y-14 text-center">
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Secure National eVoting Platform</p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold text-slate-900 md:text-6xl">
            Vote from any device with a verified auth token
          </h1>
          <p className="mx-auto max-w-2xl text-slate-600">
            Authenticate with your unique six-digit token and vote only in currently eligible elections.
          </p>
          <div className="flex justify-center gap-3">
            <Link to="/login">
              <PillButton color="googleBlue">Start Voting</PillButton>
            </Link>
            <Link to="/login">
              <PillButton color="googleYellow">Admin Console</PillButton>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-4 text-left">
            <p className="font-semibold text-slate-900">Token Login</p>
            <p className="mt-1 text-sm text-slate-600">Single 6-digit authentication entry.</p>
          </Card>
          <Card className="p-4 text-left">
            <p className="font-semibold text-slate-900">Live Elections</p>
            <p className="mt-1 text-sm text-slate-600">Only authorized and active ballots are shown.</p>
          </Card>
          <Card className="p-4 text-left">
            <p className="font-semibold text-slate-900">Private Voting</p>
            <p className="mt-1 text-sm text-slate-600">Votes are private with strict one-vote enforcement.</p>
          </Card>
        </div>

        <div className="relative h-[420px]">
          <Card className="absolute left-1/2 top-8 h-64 w-[70%] -translate-x-1/2 bg-blue-50 p-4" />
          <Card className="absolute left-1/2 top-20 h-64 w-[74%] -translate-x-1/2 -rotate-3 p-4" />
          <Card className="absolute right-8 top-28 h-56 w-44 rotate-6 border-yellow-200 p-4" />
        </div>
      </div>
    </main>
  );
}

export default Landing;
