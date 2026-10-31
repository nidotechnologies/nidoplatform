import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, ArrowLeft, Trash2, Save, Send } from 'lucide-react';
import { getClients, type StoredClient } from '@/lib/clientStore';
import { getCatalogProducts, type CatalogProduct } from '@/lib/catalogStore';
import { getProductCategoryTaxMap } from '@/lib/taxEngine';
import {
  saveOrder, getOrderById, generateOrderNumber,
  type StoredSalesOrder, type OrderLineItem, type OrderGstSlab,
} from '@/lib/salesOrderStore';
import { getProductCommercialTerms, getAvailabilityLabel } from '@/lib/productCommercialTerms';
import { resolveAutoAssignment } from '@/lib/autoAssignmentStore';

function todayISO(): string { return new Date().toISOString().split('T')[0]; }
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function taxableAmount(item: OrderLineItem): number {
  return Math.max(0, item.qty * item.rate - item.discount);
}
function gstAmount(item: OrderLineItem): number {
  return taxableAmount(item) * (item.taxPercent / 100);
}
function lineAmount(item: OrderLineItem): number {
  return taxableAmount(item) + gstAmount(item);
}
function makeBlankItem(): OrderLineItem {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    productId: '', name: '', description: '', hsnSac: '',
    qty: 1, rate: 0, discount: 0, taxPercent: 18,
  };
}
function fmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const tdInputCls = 'w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500';

export default function SalesOrderFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const clients = useMemo(() => getClients().filter(c => !c.status || c.status === 'active'), []);
  const products = useMemo(() => getCatalogProducts(), []);
  const taxMap = useMemo(() => getProductCategoryTaxMap(), []);

  // ── Order Information ──────────────────────────────────────────────────────
  const [orderNumber] = useState<string>(() => {
    if (isEdit && id) {
      const existing = getOrderById(id);
      return existing?.orderNumber || id;
    }
    return generateOrderNumber();
  });
  const [orderDate, setOrderDate] = useState<string>(todayISO());
  const [deliveryDate, setDeliveryDate] = useState<string>(() => addDays(todayISO(), 7));
  const prevOrderDate = useRef(orderDate);
  useEffect(() => {
    if (orderDate !== prevOrderDate.current) {
      setDeliveryDate(addDays(orderDate, 7));
      prevOrderDate.current = orderDate;
    }
  }, [orderDate]);

  // ── Customer Details ───────────────────────────────────────────────────────
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clientRect, setClientRect] = useState<DOMRect | null>(null);
  const [selectedClient, setSelectedClient] = useState<StoredClient | null>(null);
  const [contactPerson, setContactPerson] = useState('');
  const clientInputRef = useRef<HTMLInputElement>(null);
  const clientRef = useRef<HTMLDivElement>(null);

  // ── Addresses ─────────────────────────────────────────────────────────────
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [sameAsBilling, setSameAsBilling] = useState(true);
  useEffect(() => { if (sameAsBilling) setShippingAddress(billingAddress); }, [sameAsBilling, billingAddress]);

  // ── Email Recipients ───────────────────────────────────────────────────────
  const [emailInput, setEmailInput] = useState('');
  const [emails, setEmails] = useState<string[]>([]);

  // ── Line Items ─────────────────────────────────────────────────────────────
  const [lineItems, setLineItems] = useState<OrderLineItem[]>([makeBlankItem()]);
  const [productSearch, setProductSearch] = useState<Record<string, string>>({});
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  const [productRect, setProductRect] = useState<DOMRect | null>(null);
  const productInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const getDropdownPosition = (rect: DOMRect, width: number, maxHeight = 320): React.CSSProperties => {
    const gap = 4;
    const viewportPadding = 8;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openUpward = spaceBelow < 180 && spaceAbove > spaceBelow;
    const availableHeight = Math.max(120, Math.min(maxHeight, openUpward ? spaceAbove : spaceBelow));
    return {
      position: 'fixed',
      top: openUpward ? undefined : rect.bottom + gap,
      bottom: openUpward ? window.innerHeight - rect.top + gap : undefined,
      left: Math.min(rect.left, Math.max(viewportPadding, window.innerWidth - width - viewportPadding)),
      width,
      maxHeight: availableHeight,
      zIndex: 100000,
    };
  };

  // ── Summary ────────────────────────────────────────────────────────────────
  const [adjustment, setAdjustment] = useState<number>(0);
  const [shippingCharges, setShippingCharges] = useState<number>(0);
  const [termsConditions, setTermsConditions] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  // ── Load existing order on edit ────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit || !id) return;
    const o = getOrderById(id);
    if (!o) return;
    setOrderDate(o.orderDate);
    setDeliveryDate(o.deliveryDate);
    setClientSearch(o.clientName);
    setContactPerson(o.contactPerson);
    setBillingAddress(o.billingAddress);
    setShippingAddress(o.shippingAddress);
    setSameAsBilling(o.billingAddress === o.shippingAddress);
    setEmails(o.emails);
    setLineItems(o.lineItems.length ? o.lineItems : [makeBlankItem()]);
    const ps: Record<string, string> = {};
    o.lineItems.forEach(item => { ps[item.id] = item.name; });
    setProductSearch(ps);
    setAdjustment(o.adjustment);
    setShippingCharges(o.shippingCharges);
    setTermsConditions(o.termsConditions);
    setCustomerNotes(o.customerNotes);
  }, [isEdit, id]);

  // ── Close dropdowns on outside click / scroll ─────────────────────────────
  const closeAllDropdowns = useCallback(() => {
    setShowClientDropdown(false);
    setOpenProductId(null);
    setProductRect(null);
    setClientRect(null);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false);
        setClientRect(null);
      }
      // Close product dropdown if click is outside the input
      const target = e.target as Node;
      if (openProductId) {
        const inputEl = productInputRefs.current[openProductId];
        if (inputEl && !inputEl.contains(target)) {
          setOpenProductId(null);
          setProductRect(null);
        }
      }
    };
    document.addEventListener('mousedown', handler);
    window.addEventListener('scroll', closeAllDropdowns, true);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('scroll', closeAllDropdowns, true);
    };
  }, [openProductId, closeAllDropdowns]);

  // ── Handlers ──────────────────────────────────────────────────────────────
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
         ? {
             ...item,
             productId: product.id,
             name: product.productName,
             description: product.description || '',
             hsnSac,
             rate: product.price || 0,
             taxPercent,
             productType: product.physicalType || product.productType,
             commercialTerms: getProductCommercialTerms(product.physicalType || product.productType, {
               moq: product.moq,
               leadTime: product.leadTime,
             }),
           }
        : item
    ));
    setProductSearch(prev => ({ ...prev, [itemId]: product.productName }));
    setOpenProductId(null);
    setProductRect(null);
  };

  const updateLineItem = <K extends keyof OrderLineItem>(id: string, field: K, value: OrderLineItem[K]) => {
    setLineItems(prev => prev.map(item => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const addLineItem = () => {
    const item = makeBlankItem();
    setLineItems(prev => [...prev, item]);
    setProductSearch(prev => ({ ...prev, [item.id]: '' }));
  };

  const removeLineItem = (id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  const addEmail = () => {
    const e = emailInput.trim();
    if (e && !emails.includes(e)) { setEmails(prev => [...prev, e]); setEmailInput(''); }
  };

  // ── Totals ─────────────────────────────────────────────────────────────────
  const grossSubtotal = lineItems.reduce((s, item) => s + item.qty * item.rate, 0);
  const totalDiscount = lineItems.reduce((s, item) => s + item.discount, 0);
  const totalTaxableValue = lineItems.reduce((s, item) => s + taxableAmount(item), 0);
  const gstSlabs = useMemo((): OrderGstSlab[] => {
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
  const shippingGstRate = 18;
  const shippingGst = shippingCharges * shippingGstRate / 100;
  const grandTotal = totalTaxableValue + totalGst + shippingCharges + shippingGst + adjustment;

  // ── Build order object ─────────────────────────────────────────────────────
  const buildOrder = (status: StoredSalesOrder['status']): StoredSalesOrder => {
    const client = selectedClient;
    const placeOfSupply = client?.billingState || '';
    const now = new Date().toISOString();
    const existingId = isEdit && id ? id : (Date.now().toString() + Math.random().toString(36).slice(2));
    const autoAssignment = !isEdit
      ? resolveAutoAssignment({ clientId: client?.id })
      : null;
    const assignedUser = autoAssignment?.users[0];
    return {
      id: existingId,
      orderNumber,
      orderDate,
      deliveryDate,
      clientName: clientSearch,
      contactPerson,
      billingAddress,
      shippingAddress,
      emails,
      lineItems,
      subtotal: totalTaxableValue,
      gstSlabs,
      totalTax: totalGst,
      adjustment,
      shippingCharges,
      grandTotal,
      termsConditions,
      customerNotes,
      status,
      clientGstin: (client as any)?.gstin || (client as any)?.gstNumber || '',
      placeOfSupply,
      createdAt: now,
      updatedAt: now,
      assignedTo: assignedUser?.name || assignedUser?.email || undefined,
      assignedRole: assignedUser?.role || autoAssignment?.rule.role || undefined,
      assignedDepartment: autoAssignment?.rule.department,
    };
  };

  // ── Action state ───────────────────────────────────────────────────────────
  const [saving, setSaving] = useState<'draft' | 'confirm' | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'warn' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'warn' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSaveAsDraft = () => {
    if (!clientSearch.trim()) { showToast('Please select a client.', 'error'); return; }
    setSaving('draft');
    try {
      saveOrder(buildOrder('Draft'));
      showToast('Order saved as draft.');
      setTimeout(() => navigate('/sales/orders'), 800);
    } catch {
      showToast('Failed to save draft.', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleConfirmOrder = () => {
    if (!clientSearch.trim()) { showToast('Please select a client.', 'error'); return; }
    setSaving('confirm');
    try {
      saveOrder(buildOrder('Confirmed'));
      showToast('Order confirmed.');
      setTimeout(() => navigate('/sales/orders'), 800);
    } catch {
      showToast('Failed to confirm order.', 'error');
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
        <button onClick={() => navigate('/sales/orders')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          {isEdit ? 'Edit Order' : 'Create New Order'}
        </h1>
      </div>

      <div className="space-y-6">
        {/* ── Order Information ─────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Order Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div>
              <label className={labelCls}>Order Number</label>
              <input type="text" value={orderNumber} readOnly className={`${inputCls} bg-gray-50 dark:bg-gray-600 cursor-not-allowed`} />
            </div>
            <div>
              <label className={labelCls}>Order Date</label>
              <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Delivery Date</label>
              <input type="date" value={deliveryDate} min={orderDate} onChange={e => setDeliveryDate(e.target.value)} className={inputCls} />
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
                  ref={clientInputRef}
                  type="text" placeholder="Select customer" value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setShowClientDropdown(true); if (clientInputRef.current) setClientRect(clientInputRef.current.getBoundingClientRect()); }}
                  onFocus={() => { setShowClientDropdown(true); if (clientInputRef.current) setClientRect(clientInputRef.current.getBoundingClientRect()); }}
                  className={`${inputCls} pr-8`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs">▾</span>
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
          <div className="overflow-x-auto">
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
                  const amt = lineAmount(item);
                  const filteredProds = getFilteredProducts(item.id);
                  const displayName = productSearch[item.id] !== undefined ? productSearch[item.id] : item.name;
                  return (
                    <tr key={item.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                      <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <div className="relative">
                          <input
                            ref={el => { productInputRefs.current[item.id] = el; }}
                            type="text" placeholder="Select item" value={displayName}
                            onChange={e => {
                              setProductSearch(prev => ({ ...prev, [item.id]: e.target.value }));
                              const el = productInputRefs.current[item.id];
                              if (el) setProductRect(el.getBoundingClientRect());
                              setOpenProductId(item.id);
                            }}
                            onFocus={() => {
                              const el = productInputRefs.current[item.id];
                              if (el) setProductRect(el.getBoundingClientRect());
                              setOpenProductId(item.id);
                            }}
                            className={`${tdInputCls} pr-6`} />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs">▾</span>
                        </div>
                        <input type="text" placeholder="Description" value={item.description}
                          onChange={e => updateLineItem(item.id, 'description', e.target.value)}
                          className={`${tdInputCls} mt-1`} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" placeholder="HSN/SAC" value={item.hsnSac}
                          onChange={e => updateLineItem(item.id, 'hsnSac', e.target.value)} className={tdInputCls} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={item.qty} min={1}
                          onChange={e => updateLineItem(item.id, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                          className={`${tdInputCls} w-14 text-center`} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={item.rate} min={0} step="0.01"
                          onChange={e => updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                          className={`${tdInputCls} text-right`} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={item.discount} min={0} step="0.01"
                          onChange={e => updateLineItem(item.id, 'discount', parseFloat(e.target.value) || 0)}
                          className={`${tdInputCls} text-right`} />
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 text-right whitespace-nowrap">{fmt(taxable)}</td>
                      <td className="px-3 py-2">
                        <select value={item.taxPercent}
                          onChange={e => updateLineItem(item.id, 'taxPercent', parseFloat(e.target.value))}
                          className={`${tdInputCls} w-20`}>
                          {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 text-right whitespace-nowrap">{fmt(gst)}</td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-white text-right whitespace-nowrap">{fmt(amt)}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => removeLineItem(item.id)} className="p-1 text-red-400 hover:text-red-600 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Summary Panel ────────────────────────────────────────────── */}
        <div className="flex justify-end">
          <div className="w-full sm:w-96 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">Gross Subtotal</td>
                  <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white">₹{fmt(grossSubtotal)}</td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">Item Discounts (-)</td>
                  <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white">₹ - {fmt(totalDiscount)}</td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">Total Taxable Value</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-white">₹{fmt(totalTaxableValue)}</td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">Total GST</td>
                  <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white">₹{fmt(totalGst)}</td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                    <label className="flex items-center gap-2">Shipping Charges
                      <input type="number" value={shippingCharges} min={0} step="0.01"
                        onChange={e => setShippingCharges(parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-right" />
                    </label>
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white">₹{fmt(shippingCharges)}</td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">GST on Shipping (18%)</td>
                  <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white">₹{fmt(shippingGst)}</td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                    <label className="flex items-center gap-2">Adjustment
                      <input type="number" value={adjustment} step="0.01"
                        onChange={e => setAdjustment(parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-right" />
                    </label>
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white">
                    {adjustment >= 0 ? '' : '-'}₹{fmt(Math.abs(adjustment))}
                  </td>
                </tr>
                <tr className="border-t-2 border-gray-300 dark:border-gray-500">
                  <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">Total Payable</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">₹{fmt(grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Terms & Notes ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
            <label className={labelCls}>Terms & Conditions</label>
            <textarea rows={4} value={termsConditions} onChange={e => setTermsConditions(e.target.value)}
              placeholder="Payment terms, delivery conditions…"
              className={`${inputCls} resize-none`} />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
            <label className={labelCls}>Customer Notes</label>
            <textarea rows={4} value={customerNotes} onChange={e => setCustomerNotes(e.target.value)}
              placeholder="Notes visible to the customer…"
              className={`${inputCls} resize-none`} />
          </div>
        </div>

        {/* ── Action Buttons ────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 pb-6">
          <button
            onClick={() => navigate('/sales/orders')}
            className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveAsDraft}
            disabled={saving !== null}
            className="flex items-center gap-2 px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm disabled:opacity-60"
          >
            <Save size={16} />
            {saving === 'draft' ? 'Saving…' : 'Save as Draft'}
          </button>
          <button
            onClick={handleConfirmOrder}
            disabled={saving !== null}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm disabled:opacity-60"
          >
            <Send size={16} />
            {saving === 'confirm' ? 'Confirming…' : 'Confirm Order'}
          </button>
        </div>
      </div>

      {/* ── Portal: Client dropdown ──────────────────────────────────────── */}
      {showClientDropdown && clientRect && createPortal(
        <div
           style={getDropdownPosition(clientRect, clientRect.width, 260)}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-52 overflow-y-auto"
          onMouseDown={e => e.stopPropagation()}
        >
          {filteredClients.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">No clients found</div>
          ) : filteredClients.map(c => (
            <button key={c.id} onMouseDown={e => { e.preventDefault(); handleSelectClient(c); }}
              className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0">
              {c.name}{c.category && <span className="ml-2 text-xs text-gray-400">{c.category}</span>}
            </button>
          ))}
        </div>,
        document.body
      )}

      {/* ── Portal: Product dropdown ─────────────────────────────────────── */}
      {openProductId && productRect && createPortal(
        (() => {
          const filteredProds = getFilteredProducts(openProductId);
          return (
            <div
               style={getDropdownPosition(productRect, 288, 300)}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto"
              onMouseDown={e => e.stopPropagation()}
            >
              {filteredProds.length === 0 ? (
                <div className="px-3 py-3 text-xs text-gray-500 text-center">
                  {products.length === 0 ? 'No products in catalogue' : 'No matches found'}
                </div>
              ) : filteredProds.map(p => (
                <button key={p.id} onMouseDown={e => { e.preventDefault(); handleSelectProduct(openProductId, p); }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <div className="text-xs font-medium text-gray-900 dark:text-white">{p.productName}</div>
                  {p.description && <div className="text-xs text-gray-400 mt-0.5 truncate">{p.description}</div>}
                  {p.category && <div className="text-xs text-gray-400 mt-0.5">{p.category}</div>}
                </button>
              ))}
            </div>
          );
        })(),
        document.body
      )}
    </div>
  );
}
