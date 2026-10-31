import { downloadReferenceQuotePdf as downloadGeneratedQuotePdf } from './referenceQuotePdfGenerator';
import type { StoredQuote } from './quoteStore';

export function downloadReferenceQuotePdf(quote: StoredQuote): Promise<void> {
  return downloadGeneratedQuotePdf(quote);
}