export function Card({ children, className = "" }) {
  return <div className={`rounded-xl border border-blue-100 bg-white shadow-soft ${className}`}>{children}</div>;
}

export function PillButton({ children, color = "googleBlue", className = "", ...props }) {
  const colorMap = {
    googleBlue: "bg-googleBlue text-white",
    googleRed: "bg-googleRed text-white",
    googleYellow: "bg-googleYellow text-[#1a1a1a]",
    googleGreen: "bg-googleGreen text-white",
  };

  return (
    <button
      className={`rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${colorMap[color] ?? colorMap.googleBlue} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Stat({ label, value, bg }) {
  return (
    <div className={`rounded-xl p-4 ${bg}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
