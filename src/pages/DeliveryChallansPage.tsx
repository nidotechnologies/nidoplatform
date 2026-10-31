import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Archive, Download, Eye, MoreHorizontal, Pencil, Plus, Upload } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadDCPdf } from "@/lib/dcPdfGenerator";
import { getChallans, getDCDetail, removeChallan, type DCListItem } from "@/lib/dcStore";

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DeliveryChallansPage() {
  const navigate = useNavigate();

  // Always read fresh from store on mount (picks up newly created challans)
  const [challans, setChallans] = useState<DCListItem[]>(() => getChallans());
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleArchive = (id: string) => {
    removeChallan(id);
    setChallans(getChallans());
    toast.success("Challan archived");
  };

  const handleDownload = async (challan: DCListItem) => {
    const dc = getDCDetail(challan.id);
    if (!dc) { toast.error("DC data not found"); return; }
    setLoadingId(challan.id + "_dl");
    try {
      await downloadDCPdf(dc, `${dc.challanNo}.pdf`);
      toast.success(`${dc.challanNo}.pdf downloaded`);
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setLoadingId(null);
    }
  };

  const handlePreview = (challan: DCListItem) => {
    navigate(`/sales/delivery-challans/${challan.id}/preview`);
  };

  const statusBadge = (status: string) => (
    <span
      className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold ${
        status === "OPEN" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
      }`}
    >
      {status}
    </span>
  );

  return (
    <>
      <div className="min-h-screen bg-white">
        {/* ── Header ── */}
        <div className="border-b border-gray-200/70">
          <div className="px-6 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Delivery Challans</h1>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <Upload size={15} /> Export
              </button>
              <button
                onClick={() => navigate("/sales/delivery-challans/create")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Plus size={15} /> New
              </button>
              <button className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 transition-colors">
                <MoreHorizontal size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="px-6 py-6">
          <div className="rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {["Date", "Delivery Challan#", "Reference Number", "Customer Name", "Status", "Invoice Status", "Amount", "Actions"].map((h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-500 ${
                        i === 6 ? "text-right" : i === 7 ? "text-center" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {challans.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                      No delivery challans found.
                    </td>
                  </tr>
                )}
                {challans.map((c) => {
                  const isLoading = loadingId?.startsWith(c.id);
                  return (
                    <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors last:border-0">
                      <td className="px-4 py-3 text-gray-600">{c.date}</td>
                      <td
                        className="px-4 py-3 font-medium text-blue-600 cursor-pointer hover:underline"
                        onClick={() => handlePreview(c)}
                      >
                        {c.number}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{c.referenceNumber}</td>
                      <td className="px-4 py-3 text-gray-700">{c.customerName}</td>
                      <td className="px-4 py-3">{statusBadge(c.status)}</td>
                      <td className="px-4 py-3 text-gray-600">{c.invoiceStatus}</td>
                      <td className="px-4 py-3 text-right text-gray-900 font-medium">
                        ₹{c.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              disabled={!!isLoading}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-40"
                            >
                              {isLoading ? (
                                <span className="block w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                              ) : (
                                <MoreHorizontal size={16} />
                              )}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={() => handlePreview(c)}>
                              <Eye size={14} /> Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={() => toast.info(`Edit ${c.number}`)}>
                              <Pencil size={14} /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={() => handleDownload(c)}>
                              <Download size={14} /> Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                              onSelect={() => handleArchive(c.id)}
                            >
                              <Archive size={14} /> Archive
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
