import {
  Calendar,
  Settings,
  Plus,
  ChevronDown,
} from "lucide-react";

export default function EWayBillsPage() {
  return (
    <div className="max-w-[1280px]space-y-4">

        {/* Header Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">

          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">
              e-Way Bills
            </h1>

            <div className="flex gap-2">
              <button className="flex items-center gap-2 border rounded-lg px-2 py-2 text-sm hover:bg-gray-50">
                <Settings size={16} />
                Change e-Way Bill Portal Settings
              </button>

              <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-2 py-2 rounded-lg text-sm">
                <Plus size={16} />
                New
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="border rounded-lg p-3">
            <div className="flex flex-wrap gap-3">

              {/* Transaction Period */}
              <div className="flex items-center gap-2 border rounded-lg px-2 py-2 min-w-[220px]">
                <span className="text-sm text-gray-500">
                  Transaction Period:
                </span>

                <Calendar size={16} className="text-gray-500" />

                <span className="text-sm font-medium">
                  This Month
                </span>

                <ChevronDown size={16} />
              </div>

              {/* Transaction Type */}
              <div className="flex items-center justify-between border rounded-lg px-2 py-2 min-w-[220px]">
                <span className="text-sm text-gray-500">
                  Transaction Type:
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    Invoices
                  </span>
                  <ChevronDown size={16} />
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between border rounded-lg px-2 py-2 min-w-[250px]">
                <span className="text-sm text-gray-500">
                  e-Way Bill Status:
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    Not Generated (0)
                  </span>
                  <ChevronDown size={16} />
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white border border-gray-200 rounded-xl">

          <div className="p-4">
            <div className="border border-gray-200 rounded-xl overflow-hidden">

              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">

                    <th className="w-12 p-4">
                      <input type="checkbox" />
                    </th>

                    <th className="text-left text-xs uppercase tracking-wider text-gray-500 font-semibold">
                      Date
                    </th>

                    <th className="text-left text-xs uppercase tracking-wider text-gray-500 font-semibold">
                      Transaction#
                    </th>

                    <th className="text-left text-xs uppercase tracking-wider text-gray-500 font-semibold">
                      Customer Name
                    </th>

                    <th className="text-left text-xs uppercase tracking-wider text-gray-500 font-semibold">
                      Customer GSTIN
                    </th>

                    <th className="text-left text-xs uppercase tracking-wider text-gray-500 font-semibold">
                      Expiry Date
                    </th>

                    <th className="text-right pr-6 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody>
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center py-16 text-gray-500"
                    >
                      Yay! You do not have any pending invoices for
                      which e-way bills have to be generated.
                    </td>
                  </tr>
                </tbody>
              </table>

            </div>
          </div>

        </div>
    </div>
  );
}