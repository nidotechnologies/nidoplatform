import { useNavigate } from 'react-router-dom';
import { Plus, Archive, FileDown, MoreVertical, Edit, X, RotateCcw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { archiveQuote, getActiveQuotes, getArchivedQuotes, restoreQuote, type StoredQuote } from '@/lib/quoteStore';
import { downloadReferenceQuotePdf } from '@/lib/referenceQuotePdf';

function statusBadge(status: StoredQuote['status']) {
  const map: Record<string, string> = {
    'Draft': 'bg-gray-100 text-gray-600',
    'Sent to Client': 'bg-blue-100 text-blue-700',
    'Accepted': 'bg-green-100 text-green-700',
    'Rejected': 'bg-red-100 text-red-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

export default function SalesQuotesPage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [rowMenuOpen, setRowMenuOpen] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<StoredQuote[]>([]);
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [archivedQuotes, setArchivedQuotes] = useState<StoredQuote[]>([]);

  useEffect(() => {
    setQuotes(getActiveQuotes());
    setArchivedQuotes(getArchivedQuotes());
    const refresh = () => {
      setQuotes(getActiveQuotes());
      setArchivedQuotes(getArchivedQuotes());
    };
    window.addEventListener('nidoQuotesUpdated', refresh);
    return () => window.removeEventListener('nidoQuotesUpdated', refresh);
  }, []);

  const handleArchive = (id: string) => {
    if (confirm('Move this quote to Archived Quotes?')) {
      archiveQuote(id);
      setRowMenuOpen(null);
    }
  };

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const exportCsv = () => {
    const headers = ['Date', 'Quote #', 'Customer', 'Status', 'Valid Till', 'Total'];
    const escapeCsv = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const rows = quotes.map(quote => [
      quote.quoteDate,
      quote.quoteNumber,
      quote.clientName,
      quote.status,
      quote.validTill,
      quote.grandTotal.toFixed(2),
    ]);
    const csv = [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = 'quotes.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-6" onClick={() => { setMenuOpen(false); setRowMenuOpen(null); }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Create and manage client quotations</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quotes</h1>
        </div>

         <div className="flex items-center gap-2">
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <MoreVertical size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2 z-50">
                 <button
                   onClick={() => { setMenuOpen(false); navigate('/sales/quotes/create'); }}
                   className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                 >
                   <Plus size={16} />
                   New Quote
                 </button>
                <button
                  onClick={() => { setMenuOpen(false); exportCsv(); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                >
                  <FileDown size={16} />
                  Export CSV
                </button>
                <button
                  onClick={() => { setMenuOpen(false); setShowArchivedModal(true); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                >
                  <Archive size={16} />
                  Archived Quotes
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quotes Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        {quotes.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 dark:text-gray-500 mb-4">No quotes yet</p>
            <button
              onClick={() => navigate('/sales/quotes/create')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm"
            >
              <Plus size={16} /> Create First Quote
            </button>
          </div>
        ) : (
          <div>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  {['DATE', 'QUOTE #', 'CUSTOMER', 'STATUS', 'VALID TILL', 'TOTAL', 'ACTIONS'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quotes.map(quote => (
                  <tr key={quote.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{quote.quoteDate}</td>
                    <td className="px-4 py-3 text-sm font-medium">
                      <button
                        onClick={() => navigate(`/sales/quotes/${quote.id}`)}
                        className="text-blue-600 hover:underline font-semibold bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded transition-colors"
                      >
                        {quote.quoteNumber}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{quote.clientName}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadge(quote.status)}`}>
                        {quote.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{quote.validTill}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{fmt(quote.grandTotal)}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <div className="relative">
                          <button
                            onClick={() => setRowMenuOpen(rowMenuOpen === quote.id ? null : quote.id)}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          >
                            <MoreVertical size={16} className="text-gray-600 dark:text-gray-400" />
                          </button>
                          {rowMenuOpen === quote.id && (
                            <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2 z-50">
                              <button
                                onClick={() => { navigate(`/sales/quotes/${quote.id}/edit`); setRowMenuOpen(null); }}
                                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                              >
                                <Edit size={15} /> Edit
                              </button>
                              <button
                                onClick={() => { void downloadReferenceQuotePdf(quote); setRowMenuOpen(null); }}
                                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                              >
                                Download PDF
                              </button>
                              <button
                                onClick={() => handleArchive(quote.id)}
                                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                              >
                                <Archive size={15} /> Archive
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Archived Quotes Modal */}
      {showArchivedModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowArchivedModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col mx-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Archive size={20} className="text-gray-500 dark:text-gray-400" />
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Archived Quotes</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Quotes moved out of the active list</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">{archivedQuotes.length} archived</span>
                <button
                  onClick={() => setShowArchivedModal(false)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X size={18} className="text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="overflow-auto flex-1">
              {archivedQuotes.length === 0 ? (
                <div className="py-16 text-center text-gray-500 dark:text-gray-400">
                  No archived quotes
                </div>
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0">
                    <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                      {['DATE', 'QUOTE #', 'CUSTOMER', 'STATUS', 'VALID TILL', 'TOTAL', 'ACTIONS'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {archivedQuotes.map(quote => (
                      <tr key={quote.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{quote.quoteDate}</td>
                        <td className="px-4 py-3 text-sm font-medium">
                          <button
                            onClick={() => { setShowArchivedModal(false); navigate(`/sales/quotes/${quote.id}`); }}
                            className="text-blue-600 hover:underline font-semibold px-2 py-1 rounded transition-colors"
                          >
                            {quote.quoteNumber}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{quote.clientName}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadge(quote.status)}`}>
                            {quote.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{quote.validTill}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{fmt(quote.grandTotal)}</td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => restoreQuote(quote.id)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          >
                            <RotateCcw size={15} /> Restore
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
