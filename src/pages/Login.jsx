import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../hooks/useSession";
import { Card, PillButton } from "../components/ui";

function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, authError, user } = useSession();
  const [authToken, setAuthToken] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(user?.role === "admin" ? "/admin" : "/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate, user]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!/^\d{6}$/.test(authToken.trim())) {
      setError("Enter a valid 6-digit authentication token.");
      return;
    }

    setIsSubmitting(true);

    try {
      const signedInUser = await login({ authToken: authToken.trim() });
      navigate(signedInUser?.role === "admin" ? "/admin" : "/dashboard", {
        replace: true,
      });
    } catch (submitError) {
      setError(submitError?.message ?? "Sign-in failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f7ff] p-6">
      <Card className="w-full max-w-md p-7">
        <p className="mb-2 text-xs text-slate-500">Citizen Access</p>
        <h1 className="mb-3 text-3xl font-bold text-slate-900">Sign in with your assigned voting token</h1>
        <p className="mb-5 text-sm text-slate-600">Enter your one-time issued six-digit authentication token.</p>

        {(error || authError) && (
          <p
            className="mb-4 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700"
            role="alert"
          >
            {error || authError}
          </p>
        )}

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700" htmlFor="authToken">
              Authentication Token
            </label>
            <input
              id="authToken"
              name="authToken"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-center text-lg tracking-[0.35em] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-googleBlue"
              value={authToken}
              onChange={(event) => setAuthToken(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              aria-required="true"
            />
          </div>

          <PillButton type="submit" disabled={isSubmitting} color="googleBlue" className="w-full disabled:opacity-60">
            {isSubmitting ? "Verifying..." : "Verify and Continue"}
          </PillButton>
        </form>

        <p className="mt-5 text-center text-xs text-slate-500">Need a token? Contact your election administrator.</p>
        <p className="mt-2 text-center text-sm">
          <Link to="/" className="font-medium text-googleBlue hover:brightness-110">
            Back to landing
          </Link>
        </p>
      </Card>
    </main>
  );
}

export default Login;
