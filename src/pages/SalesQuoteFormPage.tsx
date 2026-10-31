import { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, ArrowLeft, Trash2, Save, Send, Paperclip, X, Loader2 } from 'lucide-react';
import { getClients, type StoredClient } from '@/lib/clientStore';
import { getCatalogProducts, type CatalogProduct } from '@/lib/catalogStore';
import { getProductCategoryTaxMap } from '@/lib/taxEngine';
import { saveQuote, getQuoteById, generateQuoteNumber, type StoredQuote, type QuoteLineItem, type SupportingDoc } from '@/lib/quoteStore';
import { generateQuotePdfBase64 } from '@/lib/quotePdfGenerator';
import { loadConfig } from '@/lib/configService';

// ── Date helpers ──────────────────────────────────────────────────────────────
function todayISO(): string { return new Date().toISOString().split('T')[0]; }
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ── Line item helpers ─────────────────────────────────────────────────────────
function taxableAmount(item: QuoteLineItem): number {
  return Math.max(0, item.qty * item.rate - item.discount);
}
function gstAmount(item: QuoteLineItem): number {
  return taxableAmount(item) * (item.taxPercent / 100);
}
function lineAmount(item: QuoteLineItem): number {
  return taxableAmount(item) + gstAmount(item);
}

function makeBlankItem(): QuoteLineItem {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    productId: '', name: '', description: '', hsnSac: '',
    qty: 1, rate: 0, discount: 0, taxPercent: 18,
  };
}

function fmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Styles ────────────────────────────────────────────────────────────────────
const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const tdInputCls = 'w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500';

export default function SalesQuoteFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const clients = useMemo(() => getClients().filter(c => !c.status || c.status === 'active'), []);
  const products = useMemo(() => getCatalogProducts(), []);
  const taxMap = useMemo(() => getProductCategoryTaxMap(), []);

  // ── Quote Information ────────────────────────────────────────────────────────
  const [quoteNumber] = useState<string>(() => {
    if (isEdit && id) {
      const existing = getQuoteById(id);
      return existing?.quoteNumber || id;
    }
    return generateQuoteNumber();
  });
  const [quoteDate, setQuoteDate] = useState<string>(todayISO());
  const [validTill, setValidTill] = useState<string>(() => addDays(todayISO(), 7));
  const prevQuoteDate = useRef(quoteDate);
  useEffect(() => {
    if (quoteDate !== prevQuoteDate.current) {
      setValidTill(addDays(quoteDate, 7));
      prevQuoteDate.current = quoteDate;
    }
  }, [quoteDate]);

  // ── Customer Details ─────────────────────────────────────────────────────────
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState<StoredClient | null>(null);
  const [contactPerson, setContactPerson] = useState('');
  const clientRef = useRef<HTMLDivElement>(null);

  // ── Addresses ────────────────────────────────────────────────────────────────
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [sameAsBilling, setSameAsBilling] = useState(true);
  useEffect(() => { if (sameAsBilling) setShippingAddress(billingAddress); }, [sameAsBilling, billingAddress]);

  // ── Email Recipients ─────────────────────────────────────────────────────────
  const [emailInput, setEmailInput] = useState('');
  const [emails, setEmails] = useState<string[]>([]);

  // ── Line Items ───────────────────────────────────────────────────────────────
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([makeBlankItem()]);
  const [productSearch, setProductSearch] = useState<Record<string, string>>({});
  const [showProductDd, setShowProductDd] = useState<Record<string, boolean>>({});
  const productRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ── Notes & Summary ──────────────────────────────────────────────────────────
  const [adjustment, setAdjustment] = useState<number>(0);
  const [shippingCharges, setShippingCharges] = useState<number>(0);
  const [termsConditions, setTermsConditions] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  // ── Supporting Documents ──────────────────────────────────────────────────────
  const [supportingDocs, setSupportingDocs] = useState<SupportingDoc[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load existing quote on edit ───────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit || !id) return;
    const q = getQuoteById(id);
    if (!q) return;
    setQuoteDate(q.quoteDate);
    setValidTill(q.validTill);
    setClientSearch(q.clientName);
    setContactPerson(q.contactPerson);
    setBillingAddress(q.billingAddress);
    setShippingAddress(q.shippingAddress);
    setSameAsBilling(q.billingAddress === q.shippingAddress);
    setEmails(q.emails);
    setLineItems(q.lineItems.length ? q.lineItems : [makeBlankItem()]);
    const ps: Record<string, string> = {};
    q.lineItems.forEach(item => { ps[item.id] = item.name; });
    setProductSearch(ps);
    setAdjustment(q.adjustment);
    setShippingCharges(q.shippingCharges ?? 0);
    setTermsConditions(q.termsConditions);
    setCustomerNotes(q.customerNotes);
    setSupportingDocs(q.supportingDocs || []);
  }, [isEdit, id]);

  // ── Close dropdowns on outside click ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) setShowClientDropdown(false);
      setShowProductDd(prev => {
        const next = { ...prev };
        let changed = false;
        for (const itemId of Object.keys(prev)) {
          if (prev[itemId] && productRefs.current[itemId] && !productRefs.current[itemId]!.contains(e.target as Node)) {
            next[itemId] = false; changed = true;
          }
        }
        return changed ? next : prev;
      });
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleSelectClient = (client: StoredClient) => {
    setSelectedClient(client);
    setClientSearch(client.name);
    setShowClientDropdown(false);
    setContactPerson(client.rep || '');
    const parts = [client.billingAddress, client.billingCity, client.billingState, client.billingPincode].filter(Boolean);
    const addr = parts.join(', ');
    setBillingAddress(addr);
    if (sameAsBilling) setShippingAddress(addr);
    if (client.email && !emails.includes(client.email)) setEmails(prev => [...prev, client.email!]);
  };

  const handleSelectProduct = (itemId: string, product: CatalogProduct) => {
    const taxEntry = taxMap.find(t => t.productCategory === product.category);
    const taxPercent = taxEntry?.gstRate ?? 18;
    const hsnSac = taxEntry?.defaultHsnCode ?? '';
    setLineItems(prev => prev.map(item =>
      item.id === itemId
        ? { ...item, productId: product.id, name: product.productName, description: product.description || '', hsnSac, rate: product.price || 0, taxPercent }
        : item
    ));
    setProductSearch(prev => ({ ...prev, [itemId]: product.productName }));
    setShowProductDd(prev => ({ ...prev, [itemId]: false }));
  };

  const updateLineItem = <K extends keyof QuoteLineItem>(id: string, field: K, value: QuoteLineItem[K]) => {
    setLineItems(prev => prev.map(item => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const addLineItem = () => {
    const item = makeBlankItem();
    setLineItems(prev => [...prev, item]);
    setProductSearch(prev => ({ ...prev, [item.id]: '' }));
  };

  const addEmail = () => {
    const e = emailInput.trim();
    if (e && !emails.includes(e)) { setEmails(prev => [...prev, e]); setEmailInput(''); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setSupportingDocs(prev => [...prev, {
          name: file.name,
          type: file.type,
          size: file.size,
          data: reader.result as string,
        }]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeDoc = (idx: number) => setSupportingDocs(prev => prev.filter((_, i) => i !== idx));

  // ── Totals ────────────────────────────────────────────────────────────────────
  const grossSubtotal = lineItems.reduce((s, item) => s + item.qty * item.rate, 0);
  const totalDiscount = lineItems.reduce((s, item) => s + item.discount, 0);
  const totalTaxableValue = lineItems.reduce((s, item) => s + taxableAmount(item), 0);
  const gstSlabs = useMemo(() => {
    const map: Record<number, { taxable: number; cgst: number; sgst: number }> = {};
    for (const item of lineItems) {
      const taxable = taxableAmount(item);
      const rate = item.taxPercent;
      if (!map[rate]) map[rate] = { taxable: 0, cgst: 0, sgst: 0 };
      map[rate].taxable += taxable;
      map[rate].cgst += taxable * (rate / 2) / 100;
      map[rate].sgst += taxable * (rate / 2) / 100;
    }
    return Object.entries(map).filter(([, v]) => v.taxable > 0)
      .map(([rate, v]) => ({ rate: Number(rate), ...v }))
      .sort((a, b) => a.rate - b.rate);
  }, [lineItems]);
  const totalGst = gstSlabs.reduce((s, sl) => s + sl.cgst + sl.sgst, 0);
  const roundOff = adjustment;
  const grandTotal = totalTaxableValue + totalGst + shippingCharges + roundOff;
  const subtotal = totalTaxableValue;

  // ── Build quote object ────────────────────────────────────────────────────────
  const buildQuote = (status: StoredQuote['status']): StoredQuote => {
    const client = selectedClient;
    const placeOfSupply = client?.billingState || '';
    const now = new Date().toISOString();
    const existingId = isEdit && id ? id : (Date.now().toString() + Math.random().toString(36).slice(2));
    return {
      id: existingId,
      quoteNumber,
      quoteDate,
      validTill,
      clientName: clientSearch,
      contactPerson,
      billingAddress,
      shippingAddress,
      emails,
      lineItems,
      subtotal,
      gstSlabs,
      totalTax: totalGst,
      adjustment,
      shippingCharges,
      shippingGstIncluded: false,
      grandTotal,
      termsConditions,
      customerNotes,
      supportingDocs,
      status,
      clientGstin: (client as any)?.gstin || (client as any)?.gstNumber || '',
      placeOfSupply,
      createdAt: now,
      updatedAt: now,
    };
  };

  // ── Action button state ───────────────────────────────────────────────────────
  const [saving, setSaving] = useState<'draft' | 'send' | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'warn' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'warn' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSaveAsDraft = async () => {
    if (!clientSearch.trim()) { showToast('Please select a client.', 'error'); return; }
    setSaving('draft');
    try {
      const q = buildQuote('Draft');
      saveQuote(q);
      showToast('Quote saved as draft.');
      setTimeout(() => navigate('/sales/quotes'), 800);
    } catch (err) {
      showToast('Failed to save draft.', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveAndSend = async () => {
    if (!clientSearch.trim()) { showToast('Please select a client.', 'error'); return; }
    if (emails.length === 0) { showToast('Add at least one email recipient.', 'error'); return; }
    setSaving('send');
    try {
      const q = buildQuote('Sent to Client');
      // Generate PDF
      let pdfBase64 = '';
      try { pdfBase64 = await generateQuotePdfBase64(q); } catch { /* pdf failure is non-fatal */ }

      // Save quote first
      saveQuote(q);

      // Try sending email
      const cfg = loadConfig();
      try {
        const res = await fetch('/api/quotes/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: emails,
            quoteNumber: q.quoteNumber,
            clientName: q.clientName,
            grandTotal: q.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            pdfBase64,
            companyName: cfg.organization.companyName,
            senderEmail: cfg.organization.email,
          }),
        });
        const data = await res.json();
        if (data.success) {
          showToast(`Quote sent to ${emails.join(', ')}`);
        } else {
          showToast(`Quote saved. Email not sent: ${data.error}`, 'warn');
        }
      } catch {
        showToast('Quote saved as "Sent to Client". Could not reach email server.', 'warn');
      }

      setTimeout(() => navigate('/sales/quotes'), 1200);
    } catch {
      showToast('Failed to save quote.', 'error');
    } finally {
      setSaving(null);
    }
  };

  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()));
  const getFilteredProducts = (itemId: string) => {
    const q = (productSearch[itemId] ?? '').toLowerCase();
    return products.filter(p => p.productName.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)).slice(0, 25);
  };

  return (
    <div className="space-y-6" onClick={() => setShowClientDropdown(false)}>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-green-600 text-white' :
          toast.type === 'warn' ? 'bg-yellow-500 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/sales/quotes')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          {isEdit ? 'Edit Quote' : 'Create New Quote'}
        </h1>
      </div>

      <div className="space-y-6">
        {/* ── Quote Information ─────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quote Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div>
              <label className={labelCls}>Quote Number</label>
              <input type="text" value={quoteNumber} readOnly className={`${inputCls} bg-gray-50 dark:bg-gray-600 cursor-not-allowed`} />
            </div>
            <div>
              <label className={labelCls}>Quote Date</label>
              <input type="date" value={quoteDate} onChange={e => setQuoteDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Valid Till Date</label>
              <input type="date" value={validTill} min={quoteDate} onChange={e => setValidTill(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>

        {/* ── Customer Details ──────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Customer Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div>
              <label className={labelCls}>Client Name *</label>
              <div className="relative" ref={clientRef} onClick={e => e.stopPropagation()}>
                <input
                  type="text" placeholder="Select customer" value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                  onFocus={() => setShowClientDropdown(true)}
                  className={`${inputCls} pr-8`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs">▾</span>
                {showClientDropdown && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {filteredClients.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500">No clients found</div>
                    ) : filteredClients.map(c => (
                      <button key={c.id} onMouseDown={e => { e.preventDefault(); handleSelectClient(c); }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0">
                        {c.name}{c.category && <span className="ml-2 text-xs text-gray-400">{c.category}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className={labelCls}>Contact Person</label>
              <input type="text" placeholder="Contact person" value={contactPerson} onChange={e => setContactPerson(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>

        {/* ── Addresses ─────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Addresses</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div>
              <label className={labelCls}>Billing Address</label>
              <textarea rows={4} value={billingAddress} onChange={e => setBillingAddress(e.target.value)} className={`${inputCls} resize-none`} />
            </div>
            <div>
              <label className={labelCls}>Shipping Address</label>
              <textarea rows={4} value={shippingAddress} readOnly={sameAsBilling}
                onChange={e => { if (!sameAsBilling) setShippingAddress(e.target.value); }}
                className={`${inputCls} resize-none ${sameAsBilling ? 'bg-gray-50 dark:bg-gray-600' : ''}`} />
              <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                <input type="checkbox" checked={sameAsBilling} onChange={e => setSameAsBilling(e.target.checked)} className="w-4 h-4 accent-blue-600 rounded" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Same as billing address</span>
              </label>
            </div>
          </div>
        </div>

        {/* ── Email Recipients ──────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Email Recipients</h2>
          <div className="flex gap-2">
            <input type="email" placeholder="Enter email address" value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
              className={inputCls} />
            <button onClick={addEmail} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors whitespace-nowrap text-sm">Add</button>
          </div>
          {emails.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {emails.map((email, i) => (
                <span key={i} className="flex items-center gap-1 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm border border-blue-200 dark:border-blue-700">
                  {email}
                  <button onClick={() => setEmails(prev => prev.filter((_, j) => j !== i))} className="ml-1 text-blue-400 hover:text-blue-700 leading-none">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Line Items ────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Line Items</h2>
            <button onClick={addLineItem} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm">
              <Plus size={16} /> Add Item
            </button>
          </div>
          <div>
            <table className="w-full">
              <colgroup>
                <col style={{ width: '3%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '4%' }} />
              </colgroup>
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  {['Sl.No', 'ITEM / DESCRIPTION', 'HSN/SAC', 'QTY', 'RATE (₹)', 'DISC (₹)', 'TAXABLE (₹)', 'GST RATE', 'GST (₹)', 'AMOUNT (₹)', ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, idx) => {
                  const taxable = taxableAmount(item);
                  const gst = gstAmount(item);
                  const amt = taxable + gst;
                  const filteredProds = getFilteredProducts(item.id);
                  const displayName = productSearch[item.id] !== undefined ? productSearch[item.id] : item.name;
                  return (
                    <tr key={item.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                      {/* Sl.No */}
                      <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">{idx + 1}</td>
                      {/* Item / Description — combined */}
                      <td className="px-3 py-2">
                        <div className="relative" ref={el => { productRefs.current[item.id] = el; }} onClick={e => e.stopPropagation()}>
                          <input
                            type="text" placeholder="Select item" value={displayName}
                            onChange={e => { setProductSearch(prev => ({ ...prev, [item.id]: e.target.value })); setShowProductDd(prev => ({ ...prev, [item.id]: true })); }}
                            onFocus={() => setShowProductDd(prev => ({ ...prev, [item.id]: true }))}
                            className={`${tdInputCls} pr-6`} />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs">▾</span>
                          {showProductDd[item.id] && (
                            <div className="absolute top-full left-0 z-50 mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                              {filteredProds.length === 0 ? (
                                <div className="px-3 py-3 text-xs text-gray-500 text-center">{products.length === 0 ? 'No products in catalogue' : 'No matches found'}</div>
                              ) : filteredProds.map(p => (
                                <button key={p.id} onMouseDown={e => { e.preventDefault(); handleSelectProduct(item.id, p); }}
                                  className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0">
                                  <div className="text-xs font-medium text-gray-900 dark:text-white">{p.productName}</div>
                                  {p.description && <div className="text-xs text-gray-400 mt-0.5 truncate">{p.description}</div>}
                                  {p.category && <div className="text-xs text-gray-400 mt-0.5">{p.category}</div>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <input type="text" placeholder="Description" value={item.description}
                          onChange={e => updateLineItem(item.id, 'description', e.target.value)}
                          className={`${tdInputCls} mt-1`} />
                      </td>
                      {/* HSN/SAC */}
                      <td className="px-3 py-2">
                        <input type="text" placeholder="HSN/SAC" value={item.hsnSac}
                          onChange={e => updateLineItem(item.id, 'hsnSac', e.target.value)} className={tdInputCls} />
                      </td>
                      {/* Qty */}
                      <td className="px-3 py-2">
                        <input type="number" value={item.qty} min={1}
                          onChange={e => updateLineItem(item.id, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                          className={`${tdInputCls} w-14 text-center`} />
                      </td>
                      {/* Rate (₹) */}
                      <td className="px-3 py-2">
                        <input type="number" value={item.rate} min={0}
                          onChange={e => updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                          className={`${tdInputCls} w-20 text-center`} />
                      </td>
                      {/* Disc (₹) */}
                      <td className="px-3 py-2">
                        <input type="number" value={item.discount} min={0}
                          onChange={e => updateLineItem(item.id, 'discount', parseFloat(e.target.value) || 0)}
                          className={`${tdInputCls} w-16 text-center`} />
                      </td>
                      {/* Taxable (₹) — computed */}
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 text-right whitespace-nowrap">{fmt(taxable)}</td>
                      {/* GST Rate */}
                      <td className="px-3 py-2">
                        <input type="number" value={item.taxPercent} min={0}
                          onChange={e => updateLineItem(item.id, 'taxPercent', parseFloat(e.target.value) || 0)}
                          className={`${tdInputCls} w-14 text-center`} />
                      </td>
                      {/* GST (₹) — computed */}
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 text-right whitespace-nowrap">{fmt(gst)}</td>
                      {/* Amount (₹) */}
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-white text-right whitespace-nowrap">{fmt(amt)}</td>
                      {/* Delete */}
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => setLineItems(prev => prev.filter(li => li.id !== item.id))}
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Notes + Summary ───────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <textarea rows={4} placeholder="Additional notes..." className={`${inputCls} resize-none`} />
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {/* Gross Subtotal */}
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">Gross Subtotal</td>
                    <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white">₹{fmt(grossSubtotal)}</td>
                  </tr>
                  {/* Item Level Discounts */}
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">Item Level Discounts (-)</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-white">₹ - {fmt(totalDiscount)}</td>
                  </tr>
                  {/* Total Taxable Value */}
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">Total Taxable Value</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-white">₹{fmt(totalTaxableValue)}</td>
                  </tr>
                  {/* Total GST */}
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                      Total GST{gstSlabs.length > 0 ? ` (${gstSlabs.map(s => `${s.rate}%`).join(', ')})` : ''}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white">₹{fmt(totalGst)}</td>
                  </tr>
                  {/* Shipping & Handling */}
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">Shipping &amp; Handling Charges</td>
                    <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white">₹{fmt(shippingCharges)}</td>
                  </tr>
                  {/* Round Off */}
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">Round Off Adjustment</td>
                    <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white">{roundOff >= 0 ? '' : '-'}₹{fmt(Math.abs(roundOff))}</td>
                  </tr>
                  {/* Total Payable */}
                  <tr className="border-t-2 border-gray-300 dark:border-gray-500">
                    <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">Total Payable</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">₹{fmt(grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          {/* Inputs below the grid */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <div>
              <label className={labelCls}>Shipping &amp; Handling Charges (₹)</label>
              <input type="number" min={0} value={shippingCharges}
                onChange={e => setShippingCharges(parseFloat(e.target.value) || 0)}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Round Off Adjustment (₹)</label>
              <input type="number" value={adjustment}
                onChange={e => setAdjustment(parseFloat(e.target.value) || 0)}
                className={inputCls} />
            </div>
          </div>
        </div>

        {/* ── Additional Information ────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Additional Information</h2>
          <div>
            <label className={labelCls}>Terms & Conditions</label>
            <textarea rows={3} placeholder="Validity: 7 days" value={termsConditions}
              onChange={e => setTermsConditions(e.target.value)} className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className={labelCls}>Customer Notes</label>
            <textarea rows={3} value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} className={`${inputCls} resize-none`} />
          </div>

          {/* ── Supporting Documents ─────────────────────────────────── */}
          <div>
            <label className={labelCls}>Supporting Documents</label>
            <div
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip size={22} className="mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Click to upload files</p>
              <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, Images — max 10 MB each</p>
            </div>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
            {supportingDocs.length > 0 && (
              <div className="mt-3 space-y-2">
                {supportingDocs.map((doc, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{doc.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">({(doc.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button onClick={() => removeDoc(i)} className="ml-2 p-1 text-red-400 hover:text-red-600 flex-shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Action Buttons ────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pb-6">
          <button
            onClick={handleSaveAsDraft}
            disabled={saving !== null}
            className="flex items-center gap-2 px-5 py-2 border border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-sm disabled:opacity-60"
          >
            {saving === 'draft' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save as Draft
          </button>
          <button
            onClick={handleSaveAndSend}
            disabled={saving !== null}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm disabled:opacity-60"
          >
            {saving === 'send' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Save & Send
          </button>
          <button onClick={() => navigate('/sales/quotes')} className="px-5 py-2 text-gray-600 dark:text-gray-400 font-medium hover:text-gray-900 dark:hover:text-white transition-colors text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
