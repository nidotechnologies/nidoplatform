import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import {
  getAllProductPricing,
  type ProductPricing,
} from '@/lib/priceEngineStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNos = (n: number) => n.toLocaleString('en-IN');
const PRODUCTS_PER_PAGE = 10;

function Stars({ r }: { r: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={`text-sm ${i <= Math.round(r) ? 'text-amber-400' : 'text-gray-300'}`}>★</span>
      ))}
      <span className="text-xs ml-1 text-gray-600">{r.toFixed(1)} / 5</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VendorPriceEngine() {
  const [products, setProducts] = useState<ProductPricing[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const refresh = () => setProducts(getAllProductPricing());

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matchingProducts = q
      ? products.filter(p => {
          const haystack = [
            p.productName,
            p.masterProductCode,
            p.category,
            p.winningVendor?.vendorName,
            p.winningVendor?.vendorProductCode,
            ...p.vendorComparisons.map(v => v.vendorName),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(q);
        })
      : [...products];

    return matchingProducts.sort(
      (a, b) => Number(Boolean(b.winningVendor)) - Number(Boolean(a.winningVendor)),
    );
  }, [products, search]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * PRODUCTS_PER_PAGE,
    currentPage * PRODUCTS_PER_PAGE,
  );

  useEffect(() => {
    refresh();
    const events = ['catalogUpdated', 'vendorProductsUpdated', 'nidoVendorsUpdated', 'priceEngineSettingsUpdated'];
    events.forEach(ev => window.addEventListener(ev, refresh));
    return () => events.forEach(ev => window.removeEventListener(ev, refresh));
  }, []);

  const toggle = (code: string) => setExpanded(e => ({ ...e, [code]: !e[code] }));

  return (
    <div className="max-w-full space-y-5 pb-10">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 uppercase tracking-wide">VENDOR PRICE ENGINE</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Automatically compares real vendor listings for every catalog product and picks the recommended vendor.
            Logistics, handling, tax and extra charges are configured individually per vendor from that vendor's
            <span className="font-semibold"> Configuration </span> tab on their profile page.
          </p>
        </div>
      </div>

      {/* ── Automatic Vendor Comparison for every product ── */}
      <div className="border border-gray-300 rounded-lg p-4">
        <h2 className="text-xs font-bold text-blue-700 uppercase mb-3">
          Recommended Vendor by Product ({filteredProducts.length} of {products.length} product{products.length !== 1 ? 's' : ''} in Master Catalog)
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
            placeholder="Search by product, code, category or vendor..."
            className="w-full text-xs pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {products.length === 0 ? (
          <p className="text-xs text-gray-500 py-2 text-center">
            No products found in the Master Catalog yet. Add products there and to vendors' listings to see
            automatic vendor comparisons here.
          </p>
        ) : filteredProducts.length === 0 ? (
          <p className="text-xs text-gray-500 py-2 text-center">
            No products match "{search}".
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse min-w-full">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="py-2 px-2 text-left font-semibold">Vendors</th>
                  <th className="py-2 px-2 text-left font-semibold">Product</th>
                  <th className="py-2 px-2 text-left font-semibold">Category</th>
                  <th className="py-2 px-2 text-left font-semibold">Recommended Vendor</th>
                  <th className="py-2 px-2 text-left font-semibold">Vendor Product Code</th>
                  <th className="py-2 px-2 text-right font-semibold">Base Price</th>
                  <th className="py-2 px-2 text-right font-semibold">MOQ</th>
                  <th className="py-2 px-2 text-right font-semibold">Lead Time</th>
                  <th className="py-2 px-2 text-right font-semibold">Stock</th>
                  <th className="py-2 px-2 text-center font-semibold">Rating</th>
                  <th className="py-2 px-2 text-right font-semibold">Landed Cost / Unit</th>
                  <th className="py-2 px-2 text-right font-semibold">Landed Cost (Total)</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map(p => (
                  <React.Fragment key={p.masterProductCode}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-2 align-top">
                        {p.vendorComparisons.length > 1 && (
                          <button
                            type="button"
                            onClick={() => toggle(p.masterProductCode)}
                            aria-expanded={Boolean(expanded[p.masterProductCode])}
                            aria-label={`${expanded[p.masterProductCode] ? 'Hide' : 'View'} all ${p.vendorComparisons.length} vendors for ${p.productName}`}
                            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100 whitespace-nowrap"
                          >
                            {expanded[p.masterProductCode] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            {expanded[p.masterProductCode] ? 'Hide vendors' : `View ${p.vendorComparisons.length} vendors`}
                          </button>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-semibold text-gray-800">{p.productName}</div>
                        <div className="text-gray-400 text-xs">{p.masterProductCode}</div>
                      </td>
                      <td className="py-2 px-2 text-gray-600">{p.category || '—'}</td>
                      {p.winningVendor ? (
                        <>
                          <td className="py-2 px-3">
                            <span className="text-green-700 font-semibold bg-green-100 px-2 py-0.5 rounded">⭐ {p.winningVendor.vendorName}</span>
                          </td>
                          <td className="py-2 px-2 text-gray-700">{p.winningVendor.vendorProductCode}</td>
                          <td className="py-2 px-2 text-right">{fmt(p.winningVendor.basePrice)}</td>
                          <td className="py-2 px-2 text-right">{fmtNos(p.winningVendor.moq)}</td>
                          <td className="py-2 px-2 text-right">{p.winningVendor.leadTime}d</td>
                          <td className="py-2 px-2 text-right">{fmtNos(p.winningVendor.stock)}</td>
                          <td className="py-2 px-2 text-center"><Stars r={p.winningVendor.rating} /></td>
                          <td className="py-2 px-2 text-right font-bold text-blue-800">{fmt(p.landedCostPerUnit)}</td>
                          <td className="py-2 px-2 text-right font-bold text-blue-800">{fmt(p.landedCostPerUnit * p.moq)}</td>
                        </>
                      ) : (
                        <td colSpan={10} className="py-2 px-2 text-amber-600">No active vendor carries this product yet</td>
                      )}
                    </tr>
                    {expanded[p.masterProductCode] && p.vendorComparisons.map(v => (
                      <tr key={v.vendorId} className={`border-b border-gray-50 bg-gray-50/50 ${v.vendorId === p.winningVendor?.vendorId ? 'bg-green-50/60' : ''}`}>
                        <td></td>
                        <td className="py-1.5 px-2 pl-8 text-gray-500">↳ {v.vendorId === p.winningVendor?.vendorId ? 'Recommended' : 'Compared'}</td>
                        <td></td>
                        <td className="py-1.5 px-2 text-gray-700">{v.vendorName}</td>
                        <td className="py-1.5 px-2 text-gray-700">{v.vendorProductCode}</td>
                        <td className="py-1.5 px-2 text-right text-gray-700">{fmt(v.basePrice)}</td>
                        <td className="py-1.5 px-2 text-right text-gray-700">{fmtNos(v.moq)}</td>
                        <td className="py-1.5 px-2 text-right text-gray-700">{v.leadTime}d</td>
                        <td className="py-1.5 px-2 text-right text-gray-700">{fmtNos(v.stock)}</td>
                        <td className="py-1.5 px-2 text-center"><Stars r={v.rating} /></td>
                        <td className="py-1.5 px-2 text-right text-gray-700">{fmt(v.landedCostPerUnit)}</td>
                        <td className="py-1.5 px-2 text-right text-gray-700">{fmt(v.landedCostPerUnit * v.moq)}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-3 mt-3 text-xs text-gray-600">
              <span>
                Showing {(currentPage - 1) * PRODUCTS_PER_PAGE + 1}–{Math.min(currentPage * PRODUCTS_PER_PAGE, filteredProducts.length)} of {filteredProducts.length} products
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
