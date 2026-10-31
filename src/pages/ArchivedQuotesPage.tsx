import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Archive, MoreVertical, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getArchivedQuotes, restoreQuote, type StoredQuote } from '@/lib/quoteStore';

function statusBadge(status: StoredQuote['status']) {
  const map: Record<string, string> = {
    Draft: 'bg-gray-100 text-gray-600',
    'Sent to Client': 'bg-blue-100 text-blue-700',
    Accepted: 'bg-green-100 text-green-700',
    Rejected: 'bg-red-100 text-red-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

export default function ArchivedQuotesPage() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<StoredQuote[]>([]);

  useEffect(() => {
    const refresh = () => setQuotes(getArchivedQuotes());
    refresh();
    window.addEventListener('nidoQuotesUpdated', refresh);
    return () => window.removeEventListener('nidoQuotesUpdated', refresh);
  }, []);

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/sales/quotes')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors mt-1"
            aria-label="Back to quotes"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Quotes moved out of the active list</p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Archived Quotes</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Archive size={18} />
          {quotes.length} archived
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        {quotes.length === 0 ? (
          <div className="py-16 text-center text-gray-500 dark:text-gray-400">
            No archived quotes
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  {['DATE', 'QUOTE #', 'CUSTOMER', 'STATUS', 'VALID TILL', 'TOTAL', 'ACTIONS'].map(header => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      {header}
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
                      <MoreVertical size={16} className="hidden" aria-hidden="true" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}