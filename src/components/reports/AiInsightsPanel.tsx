import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, Info } from "lucide-react";

interface Insight {
  type: "positive" | "negative" | "warning" | "info";
  text: string;
}

interface AiInsightsPanelProps {
  insights: Insight[];
}

const ICONS = {
  positive: <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />,
  negative: <TrendingDown className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />,
  info: <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />,
};

const BG = {
  positive: "bg-emerald-50 border-emerald-100",
  negative: "bg-red-50 border-red-100",
  warning: "bg-amber-50 border-amber-100",
  info: "bg-blue-50 border-blue-100",
};

export default function AiInsightsPanel({ insights }: AiInsightsPanelProps) {
  if (!insights.length) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">AI Insights</h3>
          <p className="text-xs text-gray-400">Intelligent observations from your data</p>
        </div>
      </div>
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <div key={i} className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border ${BG[insight.type]}`}>
            {ICONS[insight.type]}
            <p className="text-xs text-gray-700 leading-relaxed">{insight.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
