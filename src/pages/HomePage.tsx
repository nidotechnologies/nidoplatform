export default function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome to NIDO Procurement Platform</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Your centralized procurement management system</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Orders', value: '1,234', trend: '+12%' },
          { label: 'Active Vendors', value: '89', trend: '+5%' },
          { label: 'Pending Approvals', value: '23', trend: '-8%' },
          { label: 'This Month Sales', value: '$45,231', trend: '+23%' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">{stat.label}</p>
            <div className="flex items-end justify-between mt-2">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              <span className="text-green-600 text-xs font-medium">{stat.trend}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Order #{1000 + i}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Vendor • 2 hours ago</p>
              </div>
              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">Processing</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
