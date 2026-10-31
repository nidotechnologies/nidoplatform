interface KpiCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  iconBg?: string;
  sparkline?: number[];
  prefix?: string;
  suffix?: string;
  loading?: boolean;
}

export default function KpiCard({
  title,
  value,
  change,
  icon,
  iconBg = "bg-blue-50",
  sparkline,
  prefix = "",
  suffix = "",
  loading = false,
}: KpiCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-2/3 mb-3" />
        <div className="h-8 bg-gray-100 rounded w-1/2 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-1/3" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 leading-tight">
            {prefix}{typeof value === "number" ? value.toLocaleString() : value}{suffix}
          </p>
        </div>
        <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
      </div>

    </div>
  );
}
