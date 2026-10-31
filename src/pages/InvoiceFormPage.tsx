import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ClipboardList, Plus, Save, Trash2, X } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  generateInvoiceNumber,
  generateProformaInvoiceNumber,
  getInvoiceById,
  saveInvoice,
  type InvoiceLineItem,
  type InvoiceStatus,
  type StoredInvoice,
} from '@/lib/invoiceStore';
import { getActiveQuotes } from '@/lib/quoteStore';
import { getActiveOrders } from '@/lib/salesOrderStore';
import { useMyOrders } from '@/contexts/MyOrdersContext';
import { getClients } from '@/lib/clientStore';
import { getEffectiveTaxPctForCategory, getHsnCodes, getProductCategoryTaxMap, getSacCodes } from '@/lib/taxEngine';
import { useI18n } from '@/i18n/I18nProvider';
import { formatCurrency } from '@/lib/formatters';
import { getAvailabilityLabel } from '@/lib/productCommercialTerms';
import { generateInvoicePdfBase64 } from '@/lib/invoicePdf';
import { sendInvoiceEmail } from '@/lib/invoiceEmailService';
import { isPhysicalOrHybridProduct } from '@/lib/productTypeRules';
import { getOrderProductTypeMetadata } from '@/lib/orderProductType';
import { DIGITAL_PRODUCT_HEADERS, getDocumentProductPresentation, isDigitalDocumentProduct } from '@/lib/productDocumentRules';
import { toast } from 'sonner';

const today = () => new Date().toISOString().split('T')[0];

const blankItem = (): InvoiceLineItem => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  description: '',
  itemDetails: '',
  hsnSac: '',
  quantity: 1,
  rate: 0,
  discount: 0,
  taxPercent: 18,
  taxType: 'IGST',
});

function fmt(value: number) {
  return formatCurrency(value);
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {text}
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500';
const textareaCls = `${inputCls} resize-none`;

type ImportSource = 'order' | 'quotation' | 'salesorder' | 'shippedproduct';

const RETURNED_ORDER_ITEM_STATUSES = new Set([
  'return request raised',
  'pickup scheduled',
  'pickup done',
  'returned',
]);

const STATE_CODES: Record<string, string> = {
  andhra: '37', 'andhra pradesh': '37', arunachal: '12', 'arunachal pradesh': '12',
  assam: '18', bihar: '10', chhattisgarh: '22', goa: '30', gujarat: '24',
  haryana: '06', himachal: '02', 'himachal pradesh': '02', jharkhand: '20',
  karnataka: '29', kerala: '32', madhya: '23', 'madhya pradesh': '23',
  maharashtra: '27', manipur: '14', meghalaya: '17', mizoram: '15',
  nagaland: '13', odisha: '21', punjab: '03', rajasthan: '08',
  sikkim: '11', tamilnadu: '33', 'tamil nadu': '33', telangana: '36',
  tripura: '16', uttarpradesh: '09', 'uttar pradesh': '09', uttarakhand: '05',
  westbengal: '19', 'west bengal': '19', delhi: '07',
};

function normalizeText(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function getCategoryCode(category: string, productType?: string): string {
  const normalizedCategory = normalizeText(category);
  const isService = normalizeText(productType).includes('service');
  const serviceCode = getSacCodes().find((entry) =>
    entry.status === 'Active' && normalizeText(entry.serviceCategory) === normalizedCategory,
  )?.code;
  if (isService && serviceCode) return serviceCode;

  const hsnCode = getHsnCodes().find((entry) =>
    entry.status === 'Active' && normalizeText(entry.productCategory) === normalizedCategory,
  )?.code;
  return hsnCode
    || getProductCategoryTaxMap().find((entry) =>
      normalizeText(entry.productCategory) === normalizedCategory,
    )?.defaultHsnCode
    || '';
}

function getStateCode(state: string, gstin: string): string {
  const gstStateCode = gstin.trim().slice(0, 2);
  return /^\d{2}$/.test(gstStateCode)
    ? gstStateCode
    : STATE_CODES[normalizeText(state).replace(/\s+/g, ' ')] || '';
}

function getOrderSubItemStatus(orderId: string, subOrderId: string | undefined, index: number): string {
  try {
    const saved = JSON.parse(localStorage.getItem(`nido_subitems_${orderId}`) || '{}');
    const derivedId = subOrderId || `SO-${orderId}-${String(index + 1).padStart(3, '0')}`;
    return normalizeText(saved?.[derivedId]?.itemStatus);
  } catch {
    return '';
  }
}

function getOrderSubOrderId(orderId: string, subOrderId: string | undefined, index: number): string {
  return subOrderId || `SO-${orderId}-${String(index + 1).padStart(3, '0')}`;
}

const SOURCE_TABS: { key: ImportSource; label: string }[] = [
  { key: 'order',      label: 'Order'        },
  { key: 'quotation',  label: 'Quotation'    },
  { key: 'salesorder', label: 'Sales Order'  },
  { key: 'shippedproduct', label: 'Shipped Products' },
];

export default function InvoiceFormPage() {
  const { currencySymbol } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const existing = useMemo(() => (id ? getInvoiceById(id) : undefined), [id]);
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const restrictedOrderId = queryParams.get('orderId') || '';
  const restrictedSubOrderId = queryParams.get('subOrderId') || '';
  const isOrderProformaFlow = !existing
    && queryParams.get('proforma') === '1'
    && Boolean(restrictedOrderId);

  // ── Data sources ─────────────────────────────────────────────────────────
  const { orders: myOrders } = useMyOrders();
  const quotations  = useMemo(() => getActiveQuotes(),  []);
  const salesOrders = useMemo(() => getActiveOrders(),  []);

  // ── Import-panel state ───────────────────────────────────────────────────
  const [importSource,    setImportSource]    = useState<ImportSource>('order');
  const [selectedRef,     setSelectedRef]     = useState('');
  const [selectedShippedRefs, setSelectedShippedRefs] = useState<string[]>([]);
  const [importedRefLabel, setImportedRefLabel] = useState('');
  const didAutoImport = useRef(false);

  // ── Header fields ────────────────────────────────────────────────────────
  const [invoiceNumber, setInvoiceNumber] = useState(
    existing?.invoiceNumber || (isOrderProformaFlow ? generateProformaInvoiceNumber() : generateInvoiceNumber()),
  );
  const [invoiceDate,   setInvoiceDate]   = useState(existing?.invoiceDate   || today());
  const [dueDate,       setDueDate]       = useState(existing?.dueDate       || today());
  const [poReference,   setPoReference]   = useState(existing?.poReference   || '');
  const [placeOfSupply, setPlaceOfSupply] = useState(existing?.placeOfSupply || '');
  const [status,        setStatus]        = useState<InvoiceStatus>(
    existing?.status || (isOrderProformaFlow ? 'Proforma Invoice' : 'Draft'),
  );

  useEffect(() => {
    // Existing documents retain their original number. New documents switch
    // number formats when the user changes between invoice and proforma.
    if (existing) return;
    setInvoiceNumber(
      status === 'Proforma Invoice'
        ? generateProformaInvoiceNumber()
        : generateInvoiceNumber(),
    );
  }, [existing, status]);

  // ── Client fields ────────────────────────────────────────────────────────
  const [clientName,       setClientName]       = useState(existing?.clientName       || '');
  const [contactPerson,    setContactPerson]    = useState(existing?.contactPerson    || '');
  const [clientGstin,      setClientGstin]      = useState(existing?.clientGstin      || '');
  const [clientContact,    setClientContact]    = useState(existing?.clientContact    || '');
  const [clientContacts,   setClientContacts]  = useState<string[]>(() => {
    const stored = existing?.clientContacts?.filter(Boolean);
    if (stored?.length) return stored;
    return existing?.clientContact
      ? existing.clientContact.split(',').map((email) => email.trim()).filter(Boolean)
      : [];
  });
  const [additionalEmail,  setAdditionalEmail] = useState('');
  const [returnedItemCount, setReturnedItemCount] = useState(0);
  const [billingAddress,   setBillingAddress]   = useState(existing?.billingAddress   || '');
  const [shippingAddress,  setShippingAddress]  = useState(existing?.shippingAddress  || '');
  const [shippingStateCode,setShippingStateCode]= useState(existing?.shippingStateCode|| '');
  const [shippingAttn,     setShippingAttn]     = useState(existing?.shippingAttn     || '');

  // ── Line items ───────────────────────────────────────────────────────────
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(existing?.lineItems || [blankItem()]);
  const isDigitalInvoice = lineItems.length > 0 && lineItems.every((item) => isDigitalDocumentProduct(item));
  const hasDigitalInvoiceItems = lineItems.some((item) => isDigitalDocumentProduct(item));
  const hasPhysicalInvoiceItems = lineItems.some((item) => !isDigitalDocumentProduct(item));

  // ── Totals & charges ─────────────────────────────────────────────────────
  const [shippingCharges, setShippingCharges] = useState(existing?.shippingCharges ?? 0);
  const [adjustment,      setAdjustment]      = useState(existing?.adjustment      ?? 0);

  // ── Text sections ────────────────────────────────────────────────────────
  const [notes,           setNotes]           = useState(existing?.notes           || '');
  const [termsConditions, setTermsConditions] = useState(existing?.termsConditions || '');

  // ── Bank details ─────────────────────────────────────────────────────────
  const [bankName,        setBankName]        = useState(existing?.bankName        || '');
  const [bankAccountName, setBankAccountName] = useState(existing?.bankAccountName || '');
  const [bankAccountNo,   setBankAccountNo]   = useState(existing?.bankAccountNo   || '');
  const [bankIfsc,        setBankIfsc]        = useState(existing?.bankIfsc        || '');
  const [bankBranch,      setBankBranch]      = useState(existing?.bankBranch      || '');

  const populatedLineItems = lineItems.filter((item) => item.description.trim());
  const canCreateProforma = populatedLineItems.length > 0
    && populatedLineItems.every((item) =>
      isPhysicalOrHybridProduct(getOrderProductTypeMetadata(item)),
    );
  const isProformaMode = status === 'Proforma Invoice' || isOrderProformaFlow;

  const restrictedOrder = isOrderProformaFlow
    ? myOrders.find((order) => order.id === restrictedOrderId)
    : undefined;
  const restrictedProformaItem = restrictedOrder?.cartItems?.find((item, index) =>
    getOrderSubOrderId(restrictedOrder.id, item.subOrderId, index) === restrictedSubOrderId,
  );
  useEffect(() => {
    if (!isOrderProformaFlow || !restrictedOrder) return;
    if (
      !restrictedProformaItem
      || !isPhysicalOrHybridProduct(getOrderProductTypeMetadata(restrictedProformaItem))
    ) {
      toast.error('Proforma invoices are available only for physical and hybrid products.');
      navigate('/sales/invoices');
    }
  }, [
    isOrderProformaFlow,
    restrictedOrder,
    restrictedProformaItem,
    navigate,
  ]);

  useEffect(() => {
    if (!existing || existing.status !== 'Proforma Invoice' || canCreateProforma) return;
    toast.error('Proforma invoices are available only for physical and hybrid products.');
    navigate('/sales/invoices');
  }, [existing, canCreateProforma, navigate]);

  // If an order is selected before the user switches the document type to
  // Proforma Invoice, apply the same product filter as the proforma import
  // flow. Empty rows remain available for manual editing, while every
  // populated non-physical row is removed.
  useEffect(() => {
    if (!isProformaMode || importSource !== 'order' || !selectedRef) return;
    const eligibleItems = lineItems.filter((item) =>
      !item.description.trim()
      || isPhysicalOrHybridProduct(getOrderProductTypeMetadata(item)),
    );
    if (eligibleItems.length === lineItems.length) return;
    setLineItems(eligibleItems);
    toast.warning(
      'Proforma invoices can include only physical and hybrid products. Other products were excluded.',
    );
  }, [isProformaMode, importSource, selectedRef, lineItems]);

  useEffect(() => {
    if (isProformaMode || importSource !== 'shippedproduct') return;
    setImportSource('order');
    clearImport();
  }, [isProformaMode, importSource]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function applyLineItems(
    items: Array<{
      name: string;
      description?: string;
      hsnSac?: string;
      qty: number;
      rate: number;
      discount?: number;
      taxPercent?: number;
      productType?: string;
      physicalType?: string;
      fulfillmentType?: string;
      category?: string;
      commercialTerms?: InvoiceLineItem['commercialTerms'];
    }>
  ) {
    if (!items || items.length === 0) return;
    setLineItems(
      items.map((li) => ({
        id:          `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        description: li.name         || '',
        itemDetails: li.description  || '',
        hsnSac:      li.hsnSac       || '',
        quantity:    li.qty          || 1,
        rate:        li.rate         || 0,
        discount:    li.discount     || 0,
        taxPercent:  li.taxPercent   ?? 18,
        taxType:     'IGST' as const,
        productType: li.productType,
         physicalType: li.physicalType,
         fulfillmentType: li.fulfillmentType,
         category: li.category,
        commercialTerms: li.commercialTerms,
      }))
    );
  }

  function clearImport() {
    setSelectedRef('');
    setSelectedShippedRefs([]);
    setImportedRefLabel('');
    setReturnedItemCount(0);
  }

  // ── Switch source tab (also resets selection) ────────────────────────────
  function handleSourceChange(src: ImportSource) {
    setImportSource(src);
    clearImport();
  }

  // ── Import from Order ────────────────────────────────────────────────────
  function importFromOrder(refId: string, shippedSubOrderIds?: string[]) {
    const order = myOrders.find((o) => o.id === refId);
    if (!order) return;

    const client = getClients().find((candidate) =>
      candidate.id === order.clientId || normalizeText(candidate.name) === normalizeText(order.client),
    );
    const gstin = String(client?.gstin || client?.gstNumber || (order as any).clientGstin || '');
    const clientState = String(
      client?.billingState || client?.billing_state || order.deliveryDetails?.state
        || (order as any).placeOfSupply || '',
    );
    const clientEmails = [
      ...(Array.isArray((client as any)?.emails) ? (client as any).emails : []),
      client?.email,
      ...((order as any).emails || []),
      (order as any).clientContactEmail,
    ].map(String).map((email) => email.trim()).filter(Boolean);
    const uniqueEmails = Array.from(new Set(clientEmails));
    const contact = client?.rep || client?.contact_person || client?.representative
      || order.orderedFor || order.requester || (order as any).contactPerson || '';
    const billingAttention = client?.billingAttention || client?.billing_attention || '';
    const shippingAttention = client?.shippingAttention || client?.shipping_attention
      || order.deliveryDetails?.attentionName || billingAttention;
    const stateCode = getStateCode(clientState, gstin);
    const placeOfSupply = String(
      client?.source_of_supply || client?.sourceOfSupply || (order as any).placeOfSupply || clientState,
    );

    setClientName(order.client || client?.name || '');
    setContactPerson(contact);
    setClientGstin(gstin);
    setClientContact(uniqueEmails[0] || '');
    setClientContacts(uniqueEmails);
    setPlaceOfSupply(placeOfSupply ? (stateCode && !placeOfSupply.includes(stateCode) ? `${placeOfSupply} (${stateCode})` : placeOfSupply) : '');
    setShippingStateCode(stateCode);
    setShippingAttn(shippingAttention);
    setPoReference(order.id);          // use the Order ID (ORD-000001) as reference
    const clientAddress = [
      client?.billingAddress || client?.billing_address,
      client?.billingCity || client?.billing_city,
      client?.billingState || client?.billing_state,
      client?.billingPincode || client?.billing_pincode,
    ].filter(Boolean).join(', ');
    const orderAddress = order.deliveryAddress || clientAddress;
    if (orderAddress) {
      setBillingAddress(orderAddress);
      setShippingAddress(orderAddress);
    }

    if (order.cartItems && order.cartItems.length > 0) {
      const selectedSubOrderIds = isOrderProformaFlow
        ? (restrictedSubOrderId ? [restrictedSubOrderId] : [])
        : (shippedSubOrderIds || []);
      const scopedItems = selectedSubOrderIds.length > 0
        ? order.cartItems.filter((ci, index) =>
            selectedSubOrderIds.includes(getOrderSubOrderId(order.id, ci.subOrderId, index)),
          )
        : order.cartItems;
      const invoiceableItems = scopedItems.filter((ci, index) => {
        const itemStatus = String(getOrderSubItemStatus(
          order.id,
          ci.subOrderId,
          order.cartItems?.indexOf(ci) ?? index,
        )).toLowerCase();
        return itemStatus !== 'cancelled' && !RETURNED_ORDER_ITEM_STATUSES.has(itemStatus);
      });
      const eligibleItems = isProformaMode
        ? invoiceableItems.filter((ci) =>
            isPhysicalOrHybridProduct(getOrderProductTypeMetadata(ci)),
          )
        : invoiceableItems;
      if (isProformaMode && eligibleItems.length < invoiceableItems.length) {
        toast.warning(
          'Proforma invoices can include only physical and hybrid products. Other products were excluded.',
        );
      }
      setReturnedItemCount(scopedItems.length - invoiceableItems.length);
      setLineItems(
        eligibleItems.map((ci) => {
          const productMetadata = getOrderProductTypeMetadata(ci);
          // Selected vendor tax is snapshotted on the order. Legacy orders
          // continue to resolve their rate from the current tax settings.
          const gstRate    = typeof ci.checkoutGstRate === 'number'
            ? ci.checkoutGstRate
            : typeof ci.gstSnapshot === 'number'
              ? ci.gstSnapshot
            : getEffectiveTaxPctForCategory(ci.category || '');
          // Cart prices are GST-inclusive for display, but vendor-selected
          // orders also carry the exact client selling price before GST.
          // Use that pre-tax snapshot so the invoice adds GST exactly once.
          // Legacy orders without the snapshot still recover their pre-tax
          // rate from the stored GST-inclusive price.
          const hasCheckoutSellingPrice = typeof ci.checkoutUnitPriceExclGst === 'number'
            && Number.isFinite(ci.checkoutUnitPriceExclGst);
          const hasClientSellingPrice = typeof ci.clientSellingPriceExclGst === 'number'
            && Number.isFinite(ci.clientSellingPriceExclGst);
          const preTaxRate = hasCheckoutSellingPrice
            ? Math.max(0, ci.checkoutUnitPriceExclGst as number)
            : hasClientSellingPrice
            ? Math.max(0, ci.clientSellingPriceExclGst as number)
            : typeof ci.checkoutUnitPriceInclusive === 'number' && gstRate > 0
              ? Math.round((ci.checkoutUnitPriceInclusive * 100 / (100 + gstRate)) * 100) / 100
              : gstRate > 0
              ? Math.round((ci.priceNum * 100 / (100 + gstRate)) * 100) / 100
              : (ci.priceNum || 0);
          return {
            id:          `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            description: ci.name         || '',
            itemDetails: ci.specs?.join(', ') || '',
            subOrderId:  getOrderSubOrderId(order.id, ci.subOrderId, order.cartItems?.indexOf(ci) ?? 0),
            hsnSac:      ci.hsnSnapshot || getCategoryCode(ci.category, ci.productType || ci.physicalType),
            quantity:    ci.quantity     || 1,
            rate:        preTaxRate,
            discount:    0,
            taxPercent:  gstRate,
            taxType:     'IGST' as const,
            productType: productMetadata.productType || productMetadata.physicalType,
            physicalType: productMetadata.physicalType,
            fulfillmentType: productMetadata.fulfillmentType,
            category: productMetadata.category,
            commercialTerms: ci.commercialTerms,
          };
        })
      );
      const isFullOrderInvoice = !isOrderProformaFlow && !(shippedSubOrderIds?.length);
      if (isFullOrderInvoice && order.checkoutPricingSnapshot) {
        const invoiceSubtotal = eligibleItems.reduce((sum, ci) => {
          const gstRate = typeof ci.checkoutGstRate === 'number'
            ? ci.checkoutGstRate
            : typeof ci.gstSnapshot === 'number'
              ? ci.gstSnapshot
              : getEffectiveTaxPctForCategory(ci.category || '');
          const unitPrice = typeof ci.checkoutUnitPriceExclGst === 'number'
            ? ci.checkoutUnitPriceExclGst
            : typeof ci.checkoutUnitPriceInclusive === 'number' && gstRate > 0
              ? ci.checkoutUnitPriceInclusive * 100 / (100 + gstRate)
              : ci.clientSellingPriceExclGst || 0;
          return sum + unitPrice * (Number(ci.quantity) || 0);
        }, 0);
        setShippingCharges(Math.max(0, Number(order.checkoutPricingSnapshot.shippingDeliveryFee) || 0));
        setAdjustment(
          invoiceSubtotal * Math.max(0, Number(order.checkoutPricingSnapshot.platformFeePct) || 0) / 100,
        );
      } else if (isFullOrderInvoice) {
        setShippingCharges(Number((order as any).shippingCharges) || 0);
        setAdjustment(Number((order as any).adjustment) || 0);
      } else {
        // A proforma or shipped-line invoice is scoped to part of the order;
        // do not apply the full-order shipping or platform charge repeatedly.
        setShippingCharges(0);
        setAdjustment(0);
      }
    } else {
      setReturnedItemCount(0);
      setLineItems([]);
      setShippingCharges(0);
      setAdjustment(0);
    }

    setImportedRefLabel(
      shippedSubOrderIds && shippedSubOrderIds.length > 0
        ? `${order.id} (${shippedSubOrderIds.length} shipped product${shippedSubOrderIds.length === 1 ? '' : 's'})`
        : order.id,
    );
  }

  // ── Import from Quotation ────────────────────────────────────────────────
  function importFromQuotation(refId: string) {
    const quote = quotations.find((q) => q.id === refId);
    if (!quote) return;

    setClientName(quote.clientName       || '');
    setContactPerson(quote.contactPerson || '');
      setClientGstin(quote.clientGstin     || '');
      setClientContact((quote as any).emails?.[0] || '');
      setClientContacts(Array.from(new Set(((quote as any).emails || []).filter(Boolean))));
    setBillingAddress(quote.billingAddress  || '');
    setShippingAddress(quote.shippingAddress || quote.billingAddress || '');
    setPlaceOfSupply(quote.placeOfSupply   || '');
    setPoReference(quote.quoteNumber);
    if (quote.shippingCharges) setShippingCharges(quote.shippingCharges);
    if (quote.adjustment)      setAdjustment(quote.adjustment);
    if (quote.customerNotes)   setNotes(quote.customerNotes);
    if (quote.termsConditions) setTermsConditions(quote.termsConditions);

    applyLineItems(
      (quote.lineItems || []).map((li) => ({
        name:        li.name,
        description: li.description,
        hsnSac:      li.hsnSac,
        qty:         li.qty,
        rate:        li.rate,
        discount:    li.discount,
        taxPercent:  li.taxPercent,
        productType: li.productType,
        commercialTerms: li.commercialTerms,
      }))
    );

    setImportedRefLabel(quote.quoteNumber);
  }

  // ── Import from Sales Order ──────────────────────────────────────────────
  function importFromSalesOrder(refId: string) {
    const order = salesOrders.find((o) => o.id === refId);
    if (!order) return;

    setClientName(order.clientName       || '');
    setContactPerson(order.contactPerson || '');
      setClientGstin(order.clientGstin     || '');
      setClientContact(order.emails?.[0] || '');
      setClientContacts(Array.from(new Set((order.emails || []).filter(Boolean))));
    setBillingAddress(order.billingAddress  || '');
    setShippingAddress(order.shippingAddress || order.billingAddress || '');
    setPlaceOfSupply(order.placeOfSupply   || '');
    setPoReference(order.orderNumber);
    if (order.shippingCharges) setShippingCharges(order.shippingCharges);
    if (order.adjustment)      setAdjustment(order.adjustment);
    if (order.customerNotes)   setNotes(order.customerNotes);
    if (order.termsConditions) setTermsConditions(order.termsConditions);

    applyLineItems(
      (order.lineItems || []).map((li) => ({
        name:        li.name,
        description: li.description,
        hsnSac:      li.hsnSac,
        qty:         li.qty,
        rate:        li.rate,
        discount:    li.discount,
        taxPercent:  li.taxPercent,
        productType: li.productType,
        commercialTerms: li.commercialTerms,
      }))
    );

    setImportedRefLabel(order.orderNumber);
  }

  // ── Unified reference select handler ─────────────────────────────────────
  function handleRefSelect(refId: string) {
    setSelectedRef(refId);
    if (!refId) { setImportedRefLabel(''); return; }
    if (importSource === 'order')      importFromOrder(refId);
    if (importSource === 'quotation')  importFromQuotation(refId);
    if (importSource === 'salesorder') importFromSalesOrder(refId);
  }

  function handleShippedProductSelect(refIds: string[]) {
    const selected = refIds.flatMap((refId) => {
      try {
        const parsed = JSON.parse(refId);
        return Array.isArray(parsed) && parsed.length === 2
          ? [{ refId, orderId: String(parsed[0]), subOrderId: String(parsed[1]) }]
          : [];
      } catch {
        return [];
      }
    });
    const orderIds = new Set(selected.map((item) => item.orderId));

    if (orderIds.size > 1) {
      toast.error('Select shipped products from one main order at a time. Create a separate proforma invoice for another order.');
      return;
    }

    setSelectedShippedRefs(refIds);
    setSelectedRef(refIds[0] || '');
    if (selected.length === 0) {
      setImportedRefLabel('');
      return;
    }

    importFromOrder(
      selected[0].orderId,
      selected.map((item) => item.subOrderId),
    );
  }

  function handleShippedProductToggle(refId: string) {
    const nextRefs = selectedShippedRefs.includes(refId)
      ? selectedShippedRefs.filter((selectedRefId) => selectedRefId !== refId)
      : [...selectedShippedRefs, refId];
    handleShippedProductSelect(nextRefs);
  }

  useEffect(() => {
    if (!isOrderProformaFlow || didAutoImport.current || !restrictedOrderId) return;
    if (!myOrders.some((order) => order.id === restrictedOrderId)) return;
    didAutoImport.current = true;
    setImportSource('order');
    setSelectedRef(restrictedOrderId);
    importFromOrder(restrictedOrderId);
  }, [isOrderProformaFlow, myOrders, restrictedOrderId]);

  // ── Dropdown options per source ──────────────────────────────────────────
  const refOptions = useMemo(() => {
    if (importSource === 'order') {
      return myOrders
        .filter((o) => isOrderProformaFlow
          ? o.id === restrictedOrderId
          : o.status === 'Delivered')
        .map((o) => ({
          id:    o.id,
          label: `${o.id} — ${o.client} (${o.totalAmount})`,
        }));
    }
    if (importSource === 'quotation') {
      return quotations.map((q) => ({
        id:    q.id,
        label: `${q.quoteNumber} — ${q.clientName} (${fmt(q.grandTotal)})`,
      }));
    }
    if (importSource === 'shippedproduct') {
      return myOrders.flatMap((order) =>
        (order.cartItems || []).flatMap((item, index) => {
          const subOrderId = getOrderSubOrderId(order.id, item.subOrderId, index);
          const itemStatus = getOrderSubItemStatus(order.id, item.subOrderId, index);
          if (
            itemStatus !== 'shipped'
            || !isPhysicalOrHybridProduct(getOrderProductTypeMetadata(item))
          ) {
            return [];
          }
          return [{
            id: JSON.stringify([order.id, subOrderId]),
            label: `${order.id} — ${item.name || item.itemName || 'Product'} (${order.client})`,
          }];
        }),
      );
    }
    // salesorder
    return salesOrders.map((o) => ({
      id:    o.id,
      label: `${o.orderNumber} — ${o.clientName} (${fmt(o.grandTotal)})`,
    }));
  }, [importSource, myOrders, quotations, salesOrders, isOrderProformaFlow, restrictedOrderId]);

  // ── Computed totals ───────────────────────────────────────────────────────
  const grossSubtotal     = lineItems.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const totalDiscount     = lineItems.reduce((sum, item) => sum + (item.discount ?? 0), 0);
  const totalTaxableValue = grossSubtotal - totalDiscount;

  // GST slab breakdown (grouped by tax rate, same as quotes page)
  const gstSlabs = useMemo(() => {
    const map: Record<number, { taxable: number; cgst: number; sgst: number }> = {};
    for (const item of lineItems) {
      const taxable = Math.max(0, item.quantity * item.rate - (item.discount ?? 0));
      const rate    = item.taxPercent;
      if (!map[rate]) map[rate] = { taxable: 0, cgst: 0, sgst: 0 };
      map[rate].taxable += taxable;
      map[rate].cgst    += taxable * (rate / 2) / 100;
      map[rate].sgst    += taxable * (rate / 2) / 100;
    }
    return Object.entries(map)
      .filter(([, v]) => v.taxable > 0)
      .map(([rate, v]) => ({ rate: Number(rate), ...v }))
      .sort((a, b) => a.rate - b.rate);
  }, [lineItems]);

  const totalGst   = gstSlabs.reduce((s, sl) => s + sl.cgst + sl.sgst, 0);
  const grandTotal = totalTaxableValue + totalGst + shippingCharges + adjustment;

  const updateItem = <K extends keyof InvoiceLineItem>(
    itemId: string, field: K, value: InvoiceLineItem[K]
  ) => {
    setLineItems((items) =>
      items.map((item) => (item.id === itemId ? { ...item, [field]: value } : item))
    );
  };

  const handleSave = async () => {
    if (!clientName.trim() || lineItems.every((item) => !item.description.trim())) return;
    if (status === 'Proforma Invoice' && !canCreateProforma) {
      toast.error('Proforma invoices are available only for physical and hybrid products.');
      return;
    }
    const now = new Date().toISOString();
    const shippedOrderId = selectedShippedRefs
      .map((reference) => {
        try {
          const parsed: unknown = JSON.parse(reference);
          return Array.isArray(parsed) && parsed.length === 2 ? String(parsed[0]) : "";
        } catch {
          return "";
        }
      })
      .find(Boolean);
    const originatingOrderId = isOrderProformaFlow
      ? restrictedOrderId
      : importSource === "order"
        ? selectedRef
        : importSource === "shippedproduct"
          ? shippedOrderId || ""
          : existing?.originatingOrderId || "";
    const matchingClient = getClients().find(
      (client) => client.name.trim().toLowerCase() === clientName.trim().toLowerCase(),
    );
    let invoice: StoredInvoice = {
      id: existing?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      invoiceNumber,
      clientId: matchingClient?.id || (existing?.clientName === clientName.trim() ? existing.clientId : undefined),
      clientName: clientName.trim(),
      contactPerson,
      clientGstin:      clientGstin      || undefined,
      clientContact:    (clientContacts.join(', ') || clientContact).trim() || undefined,
      clientContacts:   clientContacts.filter(Boolean).length ? clientContacts.filter(Boolean) : undefined,
      billingAddress,
      shippingAddress:  shippingAddress   || billingAddress,
      shippingStateCode:shippingStateCode || undefined,
      shippingAttn:     shippingAttn      || undefined,
      invoiceDate,
      dueDate,
      poReference:    poReference    || undefined,
      originatingOrderId: originatingOrderId || existing?.originatingOrderId || undefined,
      placeOfSupply:  placeOfSupply  || undefined,
      status,
      lineItems,
      grossSubtotal,
      totalDiscount,
      subtotal:   totalTaxableValue,
      totalTax:   totalGst,
      shippingCharges,
      adjustment,
      grandTotal,
      notes,
      termsConditions: termsConditions || undefined,
      bankName:        bankName        || undefined,
      bankAccountName: bankAccountName || undefined,
      bankAccountNo:   bankAccountNo   || undefined,
      bankIfsc:        bankIfsc        || undefined,
      bankBranch:      bankBranch      || undefined,
      payments: existing?.payments || [],
      activity: [
        ...(existing?.activity || []),
        {
          id: `${Date.now()}-activity`,
          date: today(),
          title:       existing ? 'Invoice updated' : 'Invoice created',
          description: existing ? 'Invoice details were updated.' : 'Invoice was created as a draft.',
        },
      ],
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    if (!saveInvoice(invoice)) {
      toast.error('Proforma invoices can be created only for physical and hybrid products.');
      return;
    }

    if (isOrderProformaFlow) {
      try {
        const dataUrl = await generateInvoicePdfBase64(invoice);
        const docsKey = `nido_docs_${restrictedOrderId}`;
        let existingDocs: any[] = [];
        try {
          const stored = JSON.parse(localStorage.getItem(docsKey) || '[]');
          existingDocs = Array.isArray(stored) ? stored : [];
        } catch {
          existingDocs = [];
        }
        const base64 = dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : '';
        const proformaDocument = {
          id: `doc-${invoice.id}-proforma`,
          name: `${invoice.invoiceNumber}.pdf`,
          ext: 'pdf',
          size: `${Math.max(1, Math.round((base64.length * 0.75) / 1024))} KB`,
          type: 'Proforma Invoice',
          uploadedBy: 'System',
          uploadedOn: new Date().toLocaleDateString('en-IN'),
          description: `Generated from order ${restrictedOrderId}.`,
          dataUrl,
        };
        localStorage.setItem(docsKey, JSON.stringify([
          ...existingDocs.filter((doc) => doc.id !== proformaDocument.id),
          proformaDocument,
        ]));
      } catch {
        // The invoice remains saved even if browser document storage is unavailable.
      }

      const mailResult = await sendInvoiceEmail(invoice, 'invoice');
      if (mailResult.sentCount > 0) {
        invoice = {
          ...invoice,
          sentAt: new Date().toISOString(),
          activity: [
            ...invoice.activity,
            {
              id: `${Date.now()}-activity`,
              date: today(),
              title: 'Proforma invoice sent',
              description: `Proforma invoice emailed to ${mailResult.recipients.join(', ')}.`,
            },
          ],
          updatedAt: new Date().toISOString(),
        };
        saveInvoice(invoice);
      }
    }

    navigate(`/sales/invoices/${invoice.id}`);
  };

  const sectionHead = (title: string) => (
    <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide pb-2 border-b border-gray-100">
      {title}
    </h2>
  );

  return (
    <div className="space-y-5 pb-8">
      {/* Page title */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/sales/invoices')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <p className="text-sm text-gray-500 mb-0.5">Create and manage client invoices</p>
          <h1 className="text-2xl font-bold text-gray-900">
            {existing ? 'Edit Invoice' : 'Create New Invoice'}
          </h1>
        </div>
      </div>

      {/* ── Import from ── */}
      {!existing && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <ClipboardList size={20} className="text-blue-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-900 mb-0.5">Import from</p>
              <p className="text-xs text-blue-700 mb-4">
                Pick a source type, then select the reference number — all details will auto-fill below.
              </p>

              {/* ── Source type tabs ── */}
              <div className="flex gap-2 mb-4 flex-wrap">
                {(isOrderProformaFlow
                  ? SOURCE_TABS.filter(({ key }) => key === 'order')
                  : SOURCE_TABS.filter(({ key }) => key !== 'shippedproduct' || isProformaMode)
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSourceChange(key)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      importSource === key
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-blue-300 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* ── Reference number dropdown ── */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[260px]">
                   {importSource === 'shippedproduct' ? (
                     <div
                       role="group"
                       aria-label="Shipped products"
                       className="max-h-52 w-full overflow-y-auto rounded-lg border border-blue-300 bg-white p-1"
                     >
                       {refOptions.length === 0 ? (
                         <p className="px-3 py-2 text-sm text-gray-500">No shipped products found</p>
                       ) : (
                         refOptions.map((opt) => (
                           <label
                             key={opt.id}
                             className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-900 hover:bg-blue-50"
                           >
                             <input
                               type="checkbox"
                               checked={selectedShippedRefs.includes(opt.id)}
                               onChange={() => handleShippedProductToggle(opt.id)}
                               className="h-4 w-4 accent-blue-600"
                             />
                             <span>{opt.label}</span>
                           </label>
                         ))
                       )}
                     </div>
                   ) : (
                     <select
                       value={selectedRef}
                       onChange={(e) => handleRefSelect(e.target.value)}
                       className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                     >
                       <option value="">
                         {importSource === 'order'
                           ? '— Select an Order —'
                           : importSource === 'quotation'
                           ? '— Select a Quotation —'
                           : '— Select a Sales Order —'}
                       </option>
                       {refOptions.length === 0 ? (
                         <option disabled>No records found</option>
                       ) : (
                         refOptions.map((opt) => (
                           <option key={opt.id} value={opt.id}>
                             {opt.label}
                           </option>
                         ))
                       )}
                     </select>
                   )}
                   {importSource === 'shippedproduct' && (
                     <p className="mt-1 text-xs text-blue-700">
                       Select multiple shipped products from the same main order.
                     </p>
                   )}
                </div>
                 {(selectedRef || selectedShippedRefs.length > 0) && (
                  <button
                    type="button"
                    onClick={() => { clearImport(); }}
                    className="text-xs text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* ── Status messages ── */}
              {importedRefLabel && (
                <p className="mt-3 text-xs text-blue-700 font-medium">
                  ✓ Data from <span className="font-bold">{importedRefLabel}</span> imported — review and edit below before saving.
                </p>
              )}
              {refOptions.length === 0 && (
                <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 inline-block">
                  {importSource === 'order'
                    ? 'No orders found. Create orders from the Shop or Procure section.'
                    : importSource === 'quotation'
                    ? 'No quotations found. Create one under Transactions → Sales → Quotes.'
                    : 'No sales orders found. Create one under Transactions → Sales → Orders.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5 md:p-6 space-y-7">

        {/* ── Invoice Details ── */}
        <section className="space-y-4">
          {sectionHead('Invoice Details')}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Label text="Invoice Number">
              <input
                value={invoiceNumber}
                readOnly
                tabIndex={-1}
                className={`${inputCls} bg-gray-50 text-gray-500 cursor-not-allowed select-none`}
              />
            </Label>
            <Label text="Invoice Date">
              <input
                type="date" value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className={inputCls}
              />
            </Label>
            <Label text="Due Date">
              <input
                type="date" value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputCls}
              />
            </Label>
            <Label text="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
                    disabled={isOrderProformaFlow}
                className={inputCls}
              >
                    {isOrderProformaFlow ? (
                      <option>Proforma Invoice</option>
                    ) : (
                      <>
                        <option>Draft</option>
                        <option>Proforma Invoice</option>
                        <option>Paid</option><option>Overdue</option><option>Cancelled</option>
                      </>
                    )}
              </select>
            </Label>
            {populatedLineItems.length > 0 && !canCreateProforma && (
              <p className="col-span-2 md:col-span-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                Proforma invoice cannot be generated because this document contains
                a non-physical product. Proforma invoices are available only for
                physical and hybrid products.
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Label text="Order / Quote Reference">
              <input
                value={poReference}
                onChange={(e) => setPoReference(e.target.value)}
                placeholder="e.g. SO-000001 or EST-000001"
                className={inputCls}
              />
            </Label>
            <Label text="Place of Supply">
              <input
                value={placeOfSupply}
                onChange={(e) => setPlaceOfSupply(e.target.value)}
                placeholder="e.g. Telangana (36)"
                className={inputCls}
              />
            </Label>
          </div>
        </section>

        {/* ── Client Info ── */}
        <section className="space-y-4">
          {sectionHead('Client Information')}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Label text="Client Name *">
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Client name"
                className={inputCls}
              />
            </Label>
            <Label text="Contact Person">
              <input
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Contact person"
                className={inputCls}
              />
            </Label>
            <Label text="Client GSTIN">
              <input
                value={clientGstin}
                onChange={(e) => setClientGstin(e.target.value)}
                placeholder="e.g. 36AAACE9876B1ZS"
                className={inputCls}
              />
            </Label>
            <Label text="Client Contact Email">
              <input
                value={clientContact}
                onChange={(e) => {
                  const value = e.target.value;
                  setClientContact(value);
                  setClientContacts((current) => {
                    const next = current.length ? [value, ...current.slice(1)] : value ? [value] : [];
                    return next.filter(Boolean);
                  });
                }}
                placeholder="e.g. accounts@client.com"
                className={inputCls}
              />
              <div className="mt-2 flex gap-2">
                <input
                  type="email"
                  value={additionalEmail}
                  onChange={(e) => setAdditionalEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    const email = additionalEmail.trim();
                    if (email && !clientContacts.includes(email)) {
                      setClientContacts((current) => [...current, email]);
                      setAdditionalEmail('');
                    }
                  }}
                  placeholder="Add another email address"
                  className={`${inputCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => {
                    const email = additionalEmail.trim();
                    if (email && !clientContacts.includes(email)) {
                      setClientContacts((current) => [...current, email]);
                      setAdditionalEmail('');
                    }
                  }}
                  className="shrink-0 rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                >
                  Add
                </button>
              </div>
              {clientContacts.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {clientContacts.slice(1).map((email) => (
                    <span key={email} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
                      {email}
                      <button
                        type="button"
                        aria-label={`Remove ${email}`}
                        onClick={() => setClientContacts((current) => current.filter((value) => value !== email))}
                        className="text-blue-400 hover:text-blue-700"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </Label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Label text="Billing Address">
              <textarea
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                rows={3}
                placeholder="Full billing address"
                className={textareaCls}
              />
            </Label>
            <div className="space-y-3">
              <Label text="Shipping Address">
                <textarea
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  rows={3}
                  placeholder="Full shipping address (leave blank to use billing)"
                  className={textareaCls}
                />
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <Label text="State Code">
                  <input
                    value={shippingStateCode}
                    onChange={(e) => setShippingStateCode(e.target.value)}
                    placeholder="e.g. 36 (Telangana)"
                    className={inputCls}
                  />
                </Label>
                <Label text="Attn">
                  <input
                    value={shippingAttn}
                    onChange={(e) => setShippingAttn(e.target.value)}
                    placeholder="e.g. Operations Team"
                    className={inputCls}
                  />
                </Label>
              </div>
            </div>
          </div>
        </section>

        {/* ── Line Items ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            {sectionHead('Line Items')}
            <button
              onClick={() => setLineItems((items) => [...items, blankItem()])}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              <Plus size={14} /> Add Item
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm min-w-[1040px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {[
                    'Sl.No',
                    'ITEM / DESCRIPTION',
                    'HSN/SAC',
                    isDigitalInvoice ? DIGITAL_PRODUCT_HEADERS.quantity : hasDigitalInvoiceItems ? `QTY / ${DIGITAL_PRODUCT_HEADERS.quantity}` : 'QTY',
                    ...(hasPhysicalInvoiceItems ? [`RATE (${currencySymbol})`, `DISC (${currencySymbol})`] : []),
                    ...(hasDigitalInvoiceItems ? [DIGITAL_PRODUCT_HEADERS.tenure, DIGITAL_PRODUCT_HEADERS.provisioning] : []),
                    `TAXABLE (${currencySymbol})`,
                    'GST RATE',
                    `GST (${currencySymbol})`,
                    `AMOUNT (${currencySymbol})`,
                    '',
                  ].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, idx) => {
                  const itemIsDigital = isDigitalDocumentProduct(item);
                  const disc    = item.discount ?? 0;
                  const taxable = Math.max(0, item.quantity * item.rate - disc);
                  const gst     = taxable * (item.taxPercent / 100);
                  const amt     = taxable + gst;
                  return (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50/50 align-top">
                      {/* Sl.No */}
                      <td className="px-3 py-2 text-sm text-gray-500 text-center pt-3">{idx + 1}</td>
                      {/* Item / Description */}
                      <td className="px-3 py-2 min-w-[200px]">
                        <input
                          value={item.description}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          placeholder="Item name"
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm mb-1"
                        />
                        <input
                          value={item.itemDetails || ''}
                          onChange={(e) => updateItem(item.id, 'itemDetails', e.target.value)}
                          placeholder="Description (optional)"
                          className="w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-500"
                        />
                        {item.subOrderId && (
                          <p className="mt-1 text-[11px] font-medium text-blue-700">
                            Sub Order ID: {item.subOrderId}
                          </p>
                        )}
                        {item.commercialTerms && (
                          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-gray-500 leading-tight">
                            <span>Pricing Model: <strong className="text-gray-700">{item.commercialTerms.pricingModel}</strong></span>
                            <span>{itemIsDigital ? `${DIGITAL_PRODUCT_HEADERS.tenure}:` : "MOQ / Min Qty:"} <strong className="text-gray-700">{itemIsDigital ? getDocumentProductPresentation(item, { quantity: item.quantity }).tenureBilling : item.commercialTerms.moqLabel}</strong></span>
                            <span>{itemIsDigital ? `${DIGITAL_PRODUCT_HEADERS.provisioning}:` : "Lead Time / SLA:"} <strong className="text-gray-700">{itemIsDigital ? getDocumentProductPresentation(item, { quantity: item.quantity }).provisioningTime : `${item.commercialTerms.leadTimePrimary}${item.commercialTerms.leadTimeSecondary ? ` · ${item.commercialTerms.leadTimeSecondary}` : ""}`}</strong></span>
                            <span>Availability: <strong className={item.commercialTerms.availabilityStatus === "Out of Stock" ? "text-red-600" : "text-emerald-600"}>{getAvailabilityLabel(item.commercialTerms)}</strong></span>
                          </div>
                        )}
                      </td>
                      {/* HSN/SAC */}
                      <td className="px-3 py-2">
                        <input
                          value={item.hsnSac || ''}
                          onChange={(e) => updateItem(item.id, 'hsnSac', e.target.value)}
                          placeholder="HSN/SAC"
                          className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </td>
                      {/* Qty */}
                      <td className="px-3 py-2">
                        <input
                          type="number" min={1} value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', Math.max(1, Number(e.target.value) || 1))}
                          className="w-14 rounded border border-gray-300 px-2 py-1.5 text-sm text-center"
                        />
                      </td>
                      {hasPhysicalInvoiceItems && (
                        itemIsDigital ? (
                          <>
                            <td className="px-3 py-2 text-center text-sm text-gray-400">—</td>
                            <td className="px-3 py-2 text-center text-sm text-gray-400">—</td>
                          </>
                        ) : (
                          <>
                            {/* Rate (₹) */}
                            <td className="px-3 py-2">
                              <input
                                type="number" min={0} value={item.rate}
                                onChange={(e) => updateItem(item.id, 'rate', Number(e.target.value) || 0)}
                                className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm text-center"
                              />
                            </td>
                            {/* Disc (₹) */}
                            <td className="px-3 py-2">
                              <input
                                type="number" min={0} value={item.discount ?? 0}
                                onChange={(e) => updateItem(item.id, 'discount', Number(e.target.value) || 0)}
                                className="w-20 rounded border border-gray-300 px-2 py-1.5 text-sm text-center"
                              />
                            </td>
                          </>
                        )
                      )}
                      {hasDigitalInvoiceItems && (
                        <>
                          <td className="px-3 py-2 text-center text-sm text-gray-600">
                            {itemIsDigital ? getDocumentProductPresentation(item, { quantity: item.quantity }).tenureBilling : '—'}
                          </td>
                          <td className="px-3 py-2 text-center text-sm text-gray-600">
                            {itemIsDigital ? getDocumentProductPresentation(item, { quantity: item.quantity }).provisioningTime : '—'}
                          </td>
                        </>
                      )}
                      {/* Taxable (₹) — computed */}
                      <td className="px-3 py-2 text-sm text-gray-700 text-right whitespace-nowrap pt-3">{fmt(taxable)}</td>
                      {/* GST Rate */}
                      <td className="px-3 py-2">
                        <input
                          type="number" min={0} max={100} value={item.taxPercent}
                          onChange={(e) => updateItem(item.id, 'taxPercent', Number(e.target.value) || 0)}
                          className="w-14 rounded border border-gray-300 px-2 py-1.5 text-sm text-center"
                        />
                      </td>
                      {/* GST (₹) — computed */}
                      <td className="px-3 py-2 text-sm text-gray-700 text-right whitespace-nowrap pt-3">{fmt(gst)}</td>
                      {/* Amount (₹) */}
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right whitespace-nowrap pt-3">{fmt(amt)}</td>
                      {/* Delete */}
                      <td className="px-3 py-2 text-center pt-2.5">
                        <button
                          onClick={() =>
                            setLineItems((items) =>
                              items.length === 1 ? items : items.filter((l) => l.id !== item.id)
                            )
                          }
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {returnedItemCount > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {returnedItemCount} returned sub-order item{returnedItemCount === 1 ? '' : 's'} excluded from this invoice.
            </p>
          )}
        </section>

        {/* ── Summary ── */}
        <section className="space-y-4">
          {/* Summary table — right-aligned, matches quotes page */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Left: additional notes placeholder (editable inline) */}
            <div />
            {/* Right: summary table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden text-sm">
              <table className="w-full">
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-2.5 text-gray-600">Gross Subtotal</td>
                    <td className="px-4 py-2.5 text-right text-gray-900">{fmt(grossSubtotal)}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-2.5 font-semibold text-gray-900">Item Level Discounts (-)</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900">− {fmt(totalDiscount)}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-2.5 font-semibold text-gray-900">Total Taxable Value</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{fmt(totalTaxableValue)}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-2.5 text-gray-600">
                      Total GST{gstSlabs.length > 0 ? ` (${gstSlabs.map(s => `${s.rate}%`).join(', ')})` : ''}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-900">{fmt(totalGst)}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-2.5 text-gray-600">Shipping &amp; Handling Charges</td>
                    <td className="px-4 py-2.5 text-right text-gray-900">{fmt(shippingCharges)}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-2.5 text-gray-600">Round Off Adjustment</td>
                    <td className="px-4 py-2.5 text-right text-gray-900">
                      {adjustment < 0 ? '−' : ''}{fmt(Math.abs(adjustment))}
                    </td>
                  </tr>
                  <tr className="border-t-2 border-gray-300">
                    <td className="px-4 py-3 font-bold text-gray-900">Total Payable</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Shipping + Round Off inputs below the table */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <Label text={`Shipping & Handling Charges (${currencySymbol})`}>
              <input
                type="number" min={0} value={shippingCharges}
                onChange={(e) => setShippingCharges(Number(e.target.value) || 0)}
                className={inputCls}
              />
            </Label>
            <Label text={`Round Off Adjustment (${currencySymbol})`}>
              <input
                type="number" value={adjustment}
                onChange={(e) => setAdjustment(Number(e.target.value) || 0)}
                placeholder="e.g. -0.50 or 0.50"
                className={inputCls}
              />
            </Label>
          </div>
        </section>

        {/* ── Terms & Notes ── */}
        <section className="space-y-4">
          {sectionHead('Terms & Notes')}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Label text="Terms & Conditions">
              <textarea
                value={termsConditions}
                onChange={(e) => setTermsConditions(e.target.value)}
                rows={5}
                placeholder={"1. Payment due within 15 days.\n2. Late payments attract 1.5% monthly interest."}
                className={textareaCls}
              />
            </Label>
            <Label text="Notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                placeholder="Additional notes visible on the invoice..."
                className={textareaCls}
              />
            </Label>
          </div>
        </section>

        {/* ── Bank Remittance ── */}
        <section className="space-y-4">
          {sectionHead('Bank Remittance Details')}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Label text="Bank Name">
              <input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. HDFC Bank Ltd"
                className={inputCls}
              />
            </Label>
            <Label text="Account Name">
              <input
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
                placeholder="Account holder name"
                className={inputCls}
              />
            </Label>
            <Label text="Account Number">
              <input
                value={bankAccountNo}
                onChange={(e) => setBankAccountNo(e.target.value)}
                placeholder="e.g. 50200012345678"
                className={inputCls}
              />
            </Label>
            <Label text="IFSC Code">
              <input
                value={bankIfsc}
                onChange={(e) => setBankIfsc(e.target.value)}
                placeholder="e.g. HDFC0001234"
                className={inputCls}
              />
            </Label>
            <Label text="Branch">
              <input
                value={bankBranch}
                onChange={(e) => setBankBranch(e.target.value)}
                placeholder="e.g. Guindy Branch, Chennai"
                className={inputCls}
              />
            </Label>
          </div>
        </section>

        {/* ── Actions ── */}
        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-5">
          <div className="flex-1" />
          <button
            onClick={() => navigate('/sales/invoices')}
            className="px-5 py-2 text-gray-600 font-medium hover:text-gray-900 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!clientName.trim() || lineItems.every((item) => !item.description.trim())}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={16} /> {status === 'Proforma Invoice' ? 'Save Proforma Invoice' : 'Save Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}
