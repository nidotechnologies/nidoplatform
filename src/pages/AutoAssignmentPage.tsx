import { ArrowLeft, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import AutoAssignmentDemo from "@/components/auto-assignment-demo/AutoAssignmentDemo";

export default function AutoAssignmentPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="w-full px-2 py-2 sm:px-4 md:px-6 md:py-6">
        <Link
          to="/configuration"
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Configuration
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
            <Zap className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Auto Assignment Configuration</h1>
            <p className="text-sm text-muted-foreground">
              Configure and test tier-based order rotation using isolated demo data.
            </p>
          </div>
        </div>

        <AutoAssignmentDemo />
      </div>
    </div>
  );
}
