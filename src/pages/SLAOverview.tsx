import { AlertCircle, CheckCircle, Clock, TrendingDown } from "lucide-react";

const SLA_METRICS = [
  { label: "Response Time", value: "2.5 hrs", target: "4 hrs", status: "on_track", icon: Clock },
  { label: "Resolution Time", value: "24 hrs", target: "48 hrs", status: "on_track", icon: CheckCircle },
  { label: "Uptime", value: "99.9%", target: "99%", status: "exceeded", icon: TrendingDown },
  { label: "At Risk", value: "3", target: "0", status: "warning", icon: AlertCircle },
];

export default function SLAOverview() {
  return (
    <div className="min-h-screen bg-white">
      <div className="bg-transparent border-b border-gray-200/70">
        <div className="w-full px-2 md:px-4 lg:px-4 md:px-6 py-2 md:py-4">
          <div>
            <p className="text-xs text-gray-500">Operations / SLA</p>
            <h1 className="text-2xl font-bold">SLA Overview</h1>
          </div>
        </div>
      </div>

      <div className="w-full px-2 md:px-6 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 md:gap-6 mb-4 md:mb-6 md:mb-8">
          {SLA_METRICS.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="bg-white p-2 rounded-lg border">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-gray-600 text-sm">{metric.label}</p>
                    <p className="text-3xl font-bold mt-2">{metric.value}</p>
                    <p className="text-xs text-gray-500 mt-1">Target: {metric.target}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${
                    metric.status === "on_track" ? "bg-green-100 text-green-600" :
                    metric.status === "exceeded" ? "bg-blue-100 text-blue-600" :
                    "bg-red-100 text-red-600"
                  }`}>
                    <Icon size={24} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* SLA Breaches */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 md:gap-6 mb-4 md:mb-6 md:mb-8">
          <div className="bg-white p-2 rounded-lg border">
            <h3 className="font-semibold mb-4">Current SLA Status</h3>
            <div className="space-y-3">
              {[
                { vendor: "Global Supplies", status: "On Track", percentage: 95 },
                { vendor: "Tech Solutions", status: "At Risk", percentage: 78 },
                { vendor: "Equipment Rentals", status: "On Track", percentage: 92 },
              ].map((v) => (
                <div key={v.vendor}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{v.vendor}</span>
                    <span className={`font-semibold ${v.status === "On Track" ? "text-green-600" : "text-red-600"}`}>
                      {v.status}
                    </span>
                  </div>
                  <div className="bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div className={`h-full ${v.status === "On Track" ? "bg-green-500" : "bg-red-500"}`} 
                      style={{width: v.percentage + "%"}}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-2 rounded-lg border">
            <h3 className="font-semibold mb-4">Recent Alerts</h3>
            <div className="space-y-3">
              {[
                { type: "Warning", message: "Tech Solutions approaching SLA limit", date: "2024-01-20" },
                { type: "Info", message: "Global Supplies exceeded SLA", date: "2024-01-19" },
                { type: "Alert", message: "Equipment Rentals response delayed", date: "2024-01-18" },
              ].map((alert, idx) => (
                <div key={idx} className={`p-3 rounded-lg ${
                  alert.type === "Warning" ? "bg-yellow-50 border border-yellow-200" :
                  alert.type === "Info" ? "bg-blue-50 border border-blue-200" :
                  "bg-red-50 border border-red-200"
                }`}>
                  <p className="text-sm font-medium">{alert.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{alert.date}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detailed SLA Table */}
        <div className="bg-white p-2 rounded-lg border">
          <h3 className="font-semibold mb-4">SLA Details by Vendor</h3>
          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-2 text-left">Vendor</th>
                  <th className="px-4 py-2 text-left">Response Time</th>
                  <th className="px-4 py-2 text-left">Resolution</th>
                  <th className="px-4 py-2 text-left">Compliance</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "Global Supplies", response: "2 hrs", resolution: "20 hrs", compliance: "98%", status: "On Track" },
                  { name: "Tech Solutions Ltd", response: "3 hrs", resolution: "45 hrs", compliance: "85%", status: "At Risk" },
                  { name: "Equipment Rentals", response: "2.5 hrs", resolution: "22 hrs", compliance: "96%", status: "On Track" },
                ].map((vendor) => (
                  <tr key={vendor.name} className="border-b hover:bg-gray-50">
                    <td className="px- truncate4 py-2 font-medium">{vendor.name}</td>
                    <td className="px- truncate4 py-2">{vendor.response}</td>
                    <td className="px- truncate4 py-2">{vendor.resolution}</td>
                    <td className="px- truncate4 py-2">{vendor.compliance}</td>
                    <td className="px- truncate4 py-2">
                      <span className={`px-3 py-1 rounded text-xs font-semibold ${
                        vendor.status === "On Track" 
                          ? "bg-green-100 text-green-800" 
                          : "bg-red-100 text-red-800"
                      }`}>
                        {vendor.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
