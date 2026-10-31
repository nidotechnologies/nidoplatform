import { ArrowRight, UserRound } from "lucide-react";

interface WorkflowCheckpointProps {
  title: string;
  status: string;
  ownerLabel: string;
  owner: string;
  nextAction: string;
  note?: string;
}

export function WorkflowCheckpoint({
  title,
  status,
  ownerLabel,
  owner,
  nextAction,
  note,
}: WorkflowCheckpointProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="inline-flex rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary">
          {status || "Not recorded"}
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{ownerLabel}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
            <UserRound size={14} className="shrink-0 text-muted-foreground" />
            <span className="truncate">{owner || "Not assigned"}</span>
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Next action</p>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-foreground">
            <ArrowRight size={14} className="mt-0.5 shrink-0 text-primary" />
            <span>{nextAction}</span>
          </p>
        </div>
      </div>
      {note && (
        <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
          {note}
        </p>
      )}
    </section>
  );
}
