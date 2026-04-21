import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import "./index.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim();

function ConfigErrorScreen() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6">
      <section className="w-full rounded-xl border border-rose-300/40 bg-rose-500/10 p-6 text-rose-100">
        <h1 className="text-xl font-semibold">Missing App Configuration</h1>
        <p className="mt-3 text-sm">
          Set <code className="font-mono">VITE_CONVEX_URL</code> in your deployment environment
          variables and redeploy.
        </p>
        <p className="mt-2 text-sm">
          Example value:{" "}
          <code className="font-mono">https://your-deployment.convex.cloud</code>
        </p>
      </section>
    </main>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));

if (!convexUrl) {
  root.render(
    <React.StrictMode>
      <ConfigErrorScreen />
    </React.StrictMode>,
  );
} else {
  const convex = new ConvexReactClient(convexUrl);

  root.render(
    <React.StrictMode>
      <ConvexProvider client={convex}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConvexProvider>
    </React.StrictMode>,
  );
}
