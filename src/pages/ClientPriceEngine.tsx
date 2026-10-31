import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon, Search } from 'lucide-react';
import {
  computeClientFinalPrice,
  getClientCommonSettings,
  getAllClientPricing,
  resolveClientProfitPct,
  syncAllPricesToClientCatalogs,
  type ClientPricingRow,
} from '@/lib/priceEngineStore';
import GlobalCategoryPricingPanel from './GlobalCategoryPricingPanel';

const fmt = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PRODUCTS_PER_PAGE = 10;

const SYNC_EVENTS = [
  'catalogUpdated',
  'vendorProductsUpdated',
  'nidoVendorsUpdated',
  'clientCatalogUpdated',
  'nidoClientsUpdated',
  'priceEngineSettingsUpdated',
];

export default function ClientPriceEngine() {
  const [rows, setRows] = useState<ClientPricingRow[]>([]);
  const [lastSyncCount, setLastSyncCount] = useState<number | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = () => setRows(getAllClientPricing());

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => {
      const haystack = [
        r.clientName,
        r.productName,
        r.masterProductCode,
        r.category,
        r.clientProductCode,
        r.winningVendor?.vendorName,
        r.winningVendor?.vendorProductCode,
        ...r.vendorComparisons.flatMap(v => [v.vendorName, v.vendorProductCode]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PRODUCTS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * PRODUCTS_PER_PAGE,
    currentPage * PRODUCTS_PER_PAGE,
  );

  const syncNow = () => {
    const updated = syncAllPricesToClientCatalogs();
    refresh();
    setLastSyncCount(updated);
    setLastSyncAt(new Date().toLocaleTimeString());
  };

  useEffect(() => {
    // Compute + sync immediately whenever the page loads or any underlying
    // data (master catalog, vendor listings, client catalogs, settings) changes.
    const handle = () => {
      refresh();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(syncNow, 400);
    };
    handle();
    SYNC_EVENTS.forEach(ev => window.addEventListener(ev, handle));
    return () => {
      SYNC_EVENTS.forEach(ev => window.removeEventListener(ev, handle));
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const syncedCount = rows.filter(r => r.calc).length;
  const toggle = (key: string) => setExpanded(current => ({ ...current, [key]: !current[key] }));

  return (
    <div className="max-w-full space-y-5 pb-10">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 uppercase tracking-wide">CLIENT PRICE ENGINE</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Automatically prices every product from its recommended vendor's landed cost using each client's own
            overhead/profit/discount/tax settings (configured on that client's Catalog page), and writes the result
            into that client's catalog Selling Price
          </p>
        </div>
        <Button onClick={syncNow} className="gap-2" size="sm">
          <RefreshCw size={14} /> Sync Now
        </Button>
      </div>

      {lastSyncAt && (
        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-2">
          <CheckCircle2 size={14} />
          Last synced at {lastSyncAt} — {lastSyncCount} catalog price{lastSyncCount === 1 ? '' : 's'} updated. Auto-syncs whenever
          Master Catalog, Vendor Listings, or Client Catalogs change.
        </div>
      )}

      {/* ── Centralized category pricing rules — applies to every client ── */}
      <GlobalCategoryPricingPanel />

      {/* ── Final price per client per product (settings are per-client, configured on Client Catalog page) ── */}
      <div className="border border-gray-300 rounded-lg p-4">
        <h2 className="text-xs font-bold text-blue-700 uppercase mb-3">
          Final Client Price by Client &amp; Product ({filteredRows.length} of {rows.length} entr{rows.length !== 1 ? 'ies' : 'y'} · {syncedCount} priced)
        </h2>

        <div className="relative mb-3 max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by client, product, code, category or vendor..."
            className="w-full text-xs pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {rows.length === 0 ? (
          <p className="text-xs text-gray-500 py-2 text-center">
            No client catalog entries found yet. Once clients have products in their catalog and vendor listings
            exist, the final client price is computed and pushed here automatically.
          </p>
        ) : filteredRows.length === 0 ? (
          <p className="text-xs text-gray-500 py-2 text-center">
            No entries match "{search}".
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse min-w-full">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="py-2 px-2 text-left font-semibold">Vendors</th>
                  <th className="py-2 px-2 text-left font-semibold">Client</th>
                  <th className="py-2 px-2 text-left font-semibold">Product</th>
                  <th className="py-2 px-2 text-left font-semibold">Category</th>
                  <th className="py-2 px-2 text-left font-semibold">Client Product Code</th>
                  <th className="py-2 px-2 text-left font-semibold">Recommended Vendor</th>
                  <th className="py-2 px-2 text-left font-semibold">Vendor Product Code</th>
                  <th className="py-2 px-2 text-right font-semibold">Landed Cost</th>
                  <th className="py-2 px-2 text-right font-semibold">Charges + Overhead</th>
                  <th className="py-2 px-2 text-right font-semibold">Profit</th>
                  <th className="py-2 px-2 text-right font-semibold">Discount</th>
                  <th className="py-2 px-2 text-right font-semibold">Tax</th>
                  <th className="py-2 px-2 text-right font-semibold">Final Selling Price</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((r, i) => {
                  const rowKey = `${r.clientId}-${r.masterProductCode}-${i}`;
                  const hasVendorOptions = r.vendorComparisons.length > 1;
                  const isExpanded = Boolean(expanded[rowKey]);
                  const clientSettings = getClientCommonSettings(r.clientId);
                  const clientProfitPct = resolveClientProfitPct(r.clientId, r.masterProductCode, r.category);

                  return (
                    <Fragment key={rowKey}>
                      <tr className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 align-top">
                          {hasVendorOptions && (
                            <button
                              type="button"
                              onClick={() => toggle(rowKey)}
                              aria-expanded={isExpanded}
                              aria-label={`${isExpanded ? 'Hide' : 'View'} all ${r.vendorComparisons.length} vendors for ${r.productName}`}
                              className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100 whitespace-nowrap"
                            >
                              {isExpanded ? <ChevronDown size={13} /> : <ChevronRightIcon size={13} />}
                              {isExpanded ? 'Hide vendors' : `View ${r.vendorComparisons.length} vendors`}
                            </button>
                          )}
                        </td>
                        <td className="py-2 px-2 font-medium text-gray-700">{r.clientName}</td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-gray-800">{r.productName}</div>
                          <div className="text-gray-400 text-xs">{r.masterProductCode}</div>
                        </td>
                        <td className="py-2 px-2 text-gray-600">{r.category || '—'}</td>
                        <td className="py-2 px-2 text-gray-700">{r.clientProductCode}</td>
                        {r.winningVendor && r.calc ? (
                          <>
                            <td className="py-2 px-2 text-green-700 font-medium">{r.winningVendor.vendorName}</td>
                            <td className="py-2 px-2 text-gray-700">{r.winningVendor.vendorProductCode}</td>
                            <td className="py-2 px-2 text-right">{fmt(r.landedCostPerUnit)}</td>
                            <td className="py-2 px-2 text-right">{fmt(r.calc.perUnitTotal)}</td>
                            <td className="py-2 px-2 text-right">{fmt(r.calc.profit)}</td>
                            <td className="py-2 px-2 text-right text-red-600">-{fmt(r.calc.discount)}</td>
                            <td className="py-2 px-2 text-right">{fmt(r.calc.tax)}</td>
                            <td className="py-2 px-2 text-right font-bold text-blue-800">{fmt(r.calc.finalPrice)}</td>
                          </>
                        ) : (
                          <td colSpan={8} className="py-2 px-2 text-amber-600">No active vendor — final price pending</td>
                        )}
                      </tr>
                      {isExpanded && r.vendorComparisons.map(vendor => {
                        const vendorCalc = computeClientFinalPrice(
                          vendor.landedCostPerUnit,
                          clientSettings,
                          clientProfitPct,
                          r.category,
                        );
                        const isRecommended = vendor.vendorId === r.winningVendor?.vendorId;
                        return (
                          <tr
                            key={`${rowKey}-${vendor.vendorId}`}
                            className={`border-b border-gray-50 bg-gray-50/50 ${isRecommended ? 'bg-green-50/60' : ''}`}
                          >
                            <td></td>
                            <td></td>
                            <td className="py-1.5 px-2 pl-8 text-gray-500">↳ {isRecommended ? 'Recommended' : 'Compared'}</td>
                            <td></td>
                            <td></td>
                            <td className="py-1.5 px-2 text-gray-700">{vendor.vendorName}</td>
                            <td className="py-1.5 px-2 text-gray-700">{vendor.vendorProductCode}</td>
                            <td className="py-1.5 px-2 text-right text-gray-700">{fmt(vendor.landedCostPerUnit)}</td>
                            <td className="py-1.5 px-2 text-right text-gray-700">{fmt(vendorCalc.perUnitTotal)}</td>
                            <td className="py-1.5 px-2 text-right text-gray-700">{fmt(vendorCalc.profit)}</td>
                            <td className="py-1.5 px-2 text-right text-red-600">-{fmt(vendorCalc.discount)}</td>
                            <td className="py-1.5 px-2 text-right text-gray-700">{fmt(vendorCalc.tax)}</td>
                            <td className="py-1.5 px-2 text-right font-bold text-blue-800">{fmt(vendorCalc.finalPrice)}</td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-3 mt-3 text-xs text-gray-600">
              <span>
                Showing {(currentPage - 1) * PRODUCTS_PER_PAGE + 1}–{Math.min(currentPage * PRODUCTS_PER_PAGE, filteredRows.length)} of {filteredRows.length} products
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <span className="min-w-16 text-center font-medium text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
