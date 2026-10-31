import { ReactNode, useState } from "react";
import { Download, Maximize2, MoreVertical } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  height?: number;
  actions?: ReactNode;
  className?: string;
}

export default function ChartCard({ title, subtitle, children, height = 280, actions, className = "" }: ChartCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1">
          {actions}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((p) => !p)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-1"
                onMouseLeave={() => setMenuOpen(false)}
              >
                {["Download PNG", "Download CSV", "View Fullscreen"].map((label) => (
                  <button
                    key={label}
                    onClick={() => { toast({ title: label }); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors text-left"
                  >
                    {label === "View Fullscreen" ? (
                      <Maximize2 className="w-3 h-3 text-gray-400" />
                    ) : (
                      <Download className="w-3 h-3 text-gray-400" />
                    )}
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div style={{ height }} className="p-4">
        {children}
      </div>
    </div>
  );
}
