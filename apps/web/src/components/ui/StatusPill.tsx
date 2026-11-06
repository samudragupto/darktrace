interface StatusPillProps {
  status: "DETECTED" | "SIMULATED" | "ARCHIVED" | "REBATED" | "CLEAN";
  className?: string;
}

export function StatusPill({ status, className = "" }: StatusPillProps) {
  let style = "border-border text-muted";

  switch (status) {
    case "DETECTED":
      style = "border-accent/30 bg-accent/10 text-accent";
      break;
    case "SIMULATED":
      style = "border-info/30 bg-info/10 text-info";
      break;
    case "ARCHIVED":
      style = "border-arkiv/30 bg-arkiv/10 text-arkiv";
      break;
    case "REBATED":
      style = "border-good/30 bg-good/10 text-good";
      break;
    case "CLEAN":
      style = "border-border bg-surface text-muted";
      break;
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold border rounded-full uppercase tracking-wide whitespace-nowrap select-none ${style} ${className}`}
    >
      {status}
    </span>
  );
}

