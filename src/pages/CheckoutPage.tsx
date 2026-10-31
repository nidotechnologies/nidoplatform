                      import { useState, useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
                      import {
                        ChevronRight, MapPin, Building2, Home, Pencil, Plus,
                        ChevronDown, X, Check,
                      } from "lucide-react";
                      import CheckoutStepper from "./CheckoutStepper";
                      import OrderSummaryPanel from "./OrderSummaryPanel";
import { getClientForPortal } from "@/lib/clientStore";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
                      import { sanitizePhoneNumber, isValidPhoneNumber } from "@/lib/phoneValidation";
import {
  CHECKOUT_NOTE_MAX_LENGTH,
  DELIVERY_INSTRUCTIONS_KEY,
  ORDER_NOTES_KEY,
  limitCheckoutNote,
} from "@/lib/checkoutNotes";
import { isDigitalOnlyProduct } from "@/lib/productTypeRules";

                      // ── Types ──────────────────────────────────────────────────────────────────────

                      interface DeliveryAddress {
                        id: number;
                        label: string;
                        attentionName?: string;
                        line1: string;
                        line2: string;
                        city: string;
                        state: string;
                        zip: string;
                        phone: string;
                        isDefault: boolean;
                      }

                      type AddressForm = Omit<DeliveryAddress, "id" | "isDefault">;
                      const EMPTY_FORM: AddressForm = { label: "", attentionName: "", line1: "", line2: "", city: "", state: "", zip: "", phone: "" };

                      function isValidPhone(raw: string): boolean {
                        return isValidPhoneNumber(raw);
                      }

                      // ── Persistence ────────────────────────────────────────────────────────────────

                      function storageKey(clientId: string) {
                        return `nido_delivery_addresses_${clientId}`;
                      }

                      function selectedAddressKey(clientId: string) {
                        return `nido_selected_delivery_address_${clientId}`;
                      }

                      function loadAddresses(clientId: string): DeliveryAddress[] {
                        try {
                          const raw = localStorage.getItem(storageKey(clientId));
                          if (raw) return JSON.parse(raw);
                        } catch { /* ignore */ }
                        return [];
                      }

                      function persistAddresses(clientId: string, addresses: DeliveryAddress[]) {
                        localStorage.setItem(storageKey(clientId), JSON.stringify(addresses));
                      }

                      /** Build a first address from the client's stored profile data. */
                       function buildDefaultAddress(clientId: string): DeliveryAddress | null {
                         const client = getClientForPortal(clientId);
                        if (!client) return null;
                         const shippingAddress = client.shippingAddress || client.shipping_address;
                         const billingAddress = client.billingAddress || client.billing_address;
                         const shippingAddressLine2 = client.shippingAddressLine2 || client.shipping_address_line2;
                         const billingAddressLine2 = client.billingAddressLine2 || client.billing_address_line2;
                         const shippingCity = client.shippingCity || client.shipping_city;
                         const billingCity = client.billingCity || client.billing_city;
                         const shippingState = client.shippingState || client.shipping_state;
                         const billingState = client.billingState || client.billing_state;
                         const shippingPincode = client.shippingPincode || client.shipping_pincode;
                         const billingPincode = client.billingPincode || client.billing_pincode;
                         const shippingPhone = client.shippingPhone || client.shipping_phone;
                         const billingPhone = client.billingPhone || client.billing_phone;
                        return {
                          id: 1,
                          label: "Office",
                           attentionName: client.shippingAttention || client.shipping_attention || client.billingAttention || client.billing_attention || "",
                           line1: shippingAddress || billingAddress || "",
                           line2: shippingAddressLine2 || billingAddressLine2 || "",
                           city: shippingCity || billingCity || "",
                           state: shippingState || billingState || "",
                           zip: shippingPincode || billingPincode || "",
                           phone: shippingPhone || billingPhone || client.phone || client.mobile || "",
                          isDefault: true,
                        };
                      }

                      // ── Helpers ────────────────────────────────────────────────────────────────────

                      function AddressIcon({ label }: { label: string }) {
                        const cls = "text-blue-500";
                        const l = label.toLowerCase();
                        if (l.includes("warehouse") || l.includes("office")) return <Building2 size={20} className={cls} />;
                        if (l.includes("home")) return <Home size={20} className={cls} />;
                        return <MapPin size={20} className={cls} />;
                      }

                      // ── Inline address form ────────────────────────────────────────────────────────

                      function AddressFormBlock({
                        initial,
                        onSave,
                        onCancel,
                      }: {
                        initial: AddressForm;
                        onSave: (f: AddressForm) => void;
                        onCancel: () => void;
                      }) {
                        const [form, setForm] = useState<AddressForm>({ ...EMPTY_FORM, ...initial });
                        const [phoneTouched, setPhoneTouched] = useState(false);

                        const set = (k: keyof AddressForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
                          setForm((prev) => ({ ...prev, [k]: e.target.value }));

                        const phoneValid = isValidPhone(form.phone);
                        const phoneError = phoneTouched && form.phone.trim() && !phoneValid;

                        const valid =
                          form.label.trim() &&
                          form.line1.trim() &&
                          form.city.trim() &&
                          form.state.trim() &&
                          form.zip.trim() &&
                          form.phone.trim() &&
                          phoneValid;

                        return (
                          <div className="border border-blue-300 bg-blue-50 rounded-xl p-2 space-y-3">
                            {/* Row 1: Label + Phone */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Label <span className="text-red-500">*</span></label>
                                <input
                                  value={form.label}
                                  onChange={set("label")}
                                  placeholder="e.g. Office, Warehouse"
                                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-blue-400 bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Phone <span className="text-red-500">*</span></label>
                                <input
                                  value={form.phone}
                                  onChange={(e) => setForm((prev) => ({ ...prev, phone: sanitizePhoneNumber(e.target.value) }))}
                                  onBlur={() => setPhoneTouched(true)}
                                  placeholder="10-digit phone number"
                                  type="tel"
                                  inputMode="numeric"
                                  maxLength={10}
                                  className={`w-full border rounded-lg px-2 py-2 text-sm outline-none transition-colors bg-white ${
                                    phoneError ? "border-red-400 focus:border-red-400" : "border-gray-200 focus:border-blue-400"
                                  }`}
                                />
                                {phoneError && (
                                  <p className="text-xs text-red-500 mt-1">Enter a valid 10-digit mobile number</p>
                                )}
                              </div>
                            </div>

                            {/* Row 2: Attention name */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Attention Name <span className="text-gray-400 font-normal">(optional)</span></label>
                              <input
                                value={form.attentionName}
                                onChange={set("attentionName")}
                                placeholder="Person receiving the delivery"
                                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-blue-400 bg-white"
                              />
                            </div>

                            {/* Row 3: Address Line 1 */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Address Line 1 <span className="text-red-500">*</span></label>
                              <input
                                value={form.line1}
                                onChange={set("line1")}
                                placeholder="Street, building, floor..."
                                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-blue-400 bg-white"
                              />
                            </div>

                            {/* Row 3: Address Line 2 */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Address Line 2 <span className="text-gray-400 font-normal">(optional)</span></label>
                              <input
                                value={form.line2}
                                onChange={set("line2")}
                                placeholder="Apartment, suite, floor..."
                                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-blue-400 bg-white"
                              />
                            </div>

                            {/* Row 4: City + State + Zip */}
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">City <span className="text-red-500">*</span></label>
                                <input
                                  value={form.city}
                                  onChange={set("city")}
                                  placeholder="e.g. Chennai"
                                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-blue-400 bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">State <span className="text-red-500">*</span></label>
                                <input
                                  value={form.state}
                                  onChange={set("state")}
                                  placeholder="e.g. Tamil Nadu"
                                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-blue-400 bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">ZIP / Pincode <span className="text-red-500">*</span></label>
                                <input
                                  value={form.zip}
                                  onChange={(e) => setForm((p) => ({ ...p, zip: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                                  placeholder="600001"
                                  maxLength={6}
                                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-blue-400 bg-white"
                                />
                              </div>
                            </div>

                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={onCancel}
                                className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                              >
                                <X size={12} /> Cancel
                              </button>
                              <button
                                disabled={!valid}
                                onClick={() => valid && onSave(form)}
                                className="flex items-center gap-1 px-2 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Check size={12} /> Save Address
                              </button>
                            </div>
                          </div>
                        );
                      }

                      // ── Page ───────────────────────────────────────────────────────────────────────

                      export default function CheckoutPage() {
                         const navigate = useNavigate();
                         const location = useLocation();
                         const { user, isClientPortalUser } = useAuth();
                         const { items: cart } = useCart();
                          const requiresDeliveryDetails = cart.some((item) => !isDigitalOnlyProduct(item));
                         const isPortalFlow = location.pathname.startsWith("/portal/");
                         const catalogPath = isPortalFlow ? "/portal/catalog" : "/shop";
                         const cartPath = isPortalFlow ? "/portal/shop/cart" : "/shop/cart";
                         const paymentPath = isPortalFlow ? "/portal/shop/checkout/payment" : "/shop/checkout/payment";
                        const [notesOpen, setNotesOpen] = useState(false);
                        const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
                        const [deliveryInstructions, setDeliveryInstructions] = useState(() =>
                          limitCheckoutNote(localStorage.getItem(DELIVERY_INSTRUCTIONS_KEY) || "")
                        );
                        const [orderNotes, setOrderNotes] = useState(() =>
                          limitCheckoutNote(localStorage.getItem(ORDER_NOTES_KEY) || "")
                        );
                        const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
                        const [editingId, setEditingId] = useState<number | null>(null);
                        const [addingNew, setAddingNew] = useState(false);

                        // Load client ID and resolve addresses on mount
                         const clientId = isClientPortalUser
                           ? (user?.clientId || "")
                           : (localStorage.getItem("nido_shop_selected_client") || "");

                        useEffect(() => {
                           const resolveAddresses = () => {
                             let stored = loadAddresses(clientId);
                             if (stored.length === 0 && clientId) {
                               const def = buildDefaultAddress(clientId);
                               stored = def ? [def] : [];
                               if (stored.length) persistAddresses(clientId, stored);
                             }
                             setAddresses(stored);
                             if (stored.length) {
                               const savedId = Number(localStorage.getItem(selectedAddressKey(clientId)));
                               const savedAddress = Number.isFinite(savedId) ? stored.find((a) => a.id === savedId) : undefined;
                               const nextAddressId = savedAddress?.id ?? stored.find((a) => a.isDefault)?.id ?? stored[0].id;
                               setSelectedAddressId(nextAddressId);
                               localStorage.setItem(selectedAddressKey(clientId), String(nextAddressId));
                             } else {
                               setSelectedAddressId(null);
                               localStorage.removeItem(selectedAddressKey(clientId));
                             }
                           };

                           resolveAddresses();
                           const refreshAddresses = () => resolveAddresses();
                           window.addEventListener('nidoDeliveryAddressesUpdated', refreshAddresses);
                           window.addEventListener('storage', refreshAddresses);
                           return () => {
                             window.removeEventListener('nidoDeliveryAddressesUpdated', refreshAddresses);
                             window.removeEventListener('storage', refreshAddresses);
                           };
                         }, [clientId]);

                        // ── Handlers ──

                        const saveEdit = (id: number, form: AddressForm) => {
                          const updated = addresses.map((a) =>
                            a.id === id ? { ...a, ...form } : a
                          );
                          setAddresses(updated);
                          persistAddresses(clientId, updated);
                          setEditingId(null);
                        };

                        const saveNew = (form: AddressForm) => {
                          const newId = Math.max(0, ...addresses.map((a) => a.id)) + 1;
                          const newAddr: DeliveryAddress = { id: newId, isDefault: false, ...form };
                          const updated = [...addresses, newAddr];
                          setAddresses(updated);
                          persistAddresses(clientId, updated);
                          if (selectedAddressId === null) {
                            setSelectedAddressId(newId);
                            localStorage.setItem(selectedAddressKey(clientId), String(newId));
                          }
                          setAddingNew(false);
                        };

                        const canAddMore = addresses.length < 2;

                        if (cart.length === 0) {
                          return <Navigate to={cartPath} replace />;
                        }

                        return (
                          <div className="min-h-screen bg-white px-2 py-6">
                            <div className="max-w-6xl mx-auto">
                              {/* Breadcrumb */}
                              <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
                                <button onClick={() => navigate(catalogPath)} className="hover:text-blue-600">Home</button>
                                <ChevronRight size={14} />
                                <span>Shopping</span>
                                <ChevronRight size={14} />
                                <button onClick={() => navigate(cartPath)} className="hover:text-blue-600">My Cart</button>
                                <ChevronRight size={14} />
                                <span className="text-gray-900 font-medium">Checkout</span>
                              </div>

                              <h1 className="text-2xl font-bold text-gray-900 mb-1">Checkout</h1>
                              <p className="text-sm text-gray-500 mb-6">
                                {requiresDeliveryDetails
                                  ? "Review your order, provide delivery details & choose payment method"
                                  : "Review your digital order and choose a payment method"}
                              </p>

                              <CheckoutStepper current={1} />

                              <div className="flex gap-2 items-start">
                                {/* Left */}
                                <div className="flex-1 min-w-0 space-y-4">
                                  {requiresDeliveryDetails ? (
                                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                                    <h2 className="font-semibold text-gray-900 text-base mb-4">Delivery Details</h2>

                                    {/* Delivery Address header */}
                                    <div className="flex items-center justify-between mb-3">
                                      <p className="text-sm font-medium text-gray-800">Delivery Address</p>
                                      {canAddMore && !addingNew && (
                                        <button
                                          onClick={() => setAddingNew(true)}
                                          className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                                        >
                                          <Plus size={14} />
                                          Add New Address
                                        </button>
                                      )}
                                      {!canAddMore && (
                                        <span className="text-xs text-gray-400">Max 2 addresses</span>
                                      )}
                                    </div>

                                    {/* Address list */}
                                    <div className="space-y-3 mb-5">
                                      {addresses.map((addr) =>
                                        editingId === addr.id ? (
                                          <AddressFormBlock
                                            key={addr.id}
                                            initial={{ label: addr.label, attentionName: addr.attentionName ?? "", line1: addr.line1, line2: addr.line2 ?? "", city: addr.city ?? "", state: addr.state ?? "", zip: addr.zip ?? "", phone: addr.phone }}
                                            onSave={(f) => saveEdit(addr.id, f)}
                                            onCancel={() => setEditingId(null)}
                                          />
                                        ) : (
                                          <label
                                            key={addr.id}
                                            className={`flex items-start gap-3 p-2 border rounded-xl cursor-pointer transition-colors ${
                                              selectedAddressId === addr.id
                                                ? "border-blue-500 bg-blue-50"
                                                : "border-gray-200 hover:border-gray-300"
                                            }`}
                                          >
                                            <input
                                              type="radio"
                                              name="address"
                                              className="mt-1 accent-blue-600"
                                              checked={selectedAddressId === addr.id}
                                              onChange={() => {
                                                setSelectedAddressId(addr.id);
                                                localStorage.setItem(selectedAddressKey(clientId), String(addr.id));
                                              }}
                                            />
                                            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                              <AddressIcon label={addr.label} />
                                            </div>
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-sm text-gray-900">{addr.label}</span>
                                                {addr.isDefault && (
                                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                                                    Default
                                                  </span>
                                                )}
                                              </div>
                                              <p className="text-xs text-gray-500 leading-relaxed">
                                                {addr.attentionName && (
                                                  <><span className="font-medium text-gray-700">Attention:</span> {addr.attentionName}<br /></>
                                                )}
                                                {addr.line1}
                                                {addr.line2 && <><br />{addr.line2}</>}
                                                {(addr.city || addr.state || addr.zip) && (
                                                  <><br />{[addr.city, addr.state, addr.zip].filter(Boolean).join(", ")}</>
                                                )}
                                                <br />{addr.phone}
                                              </p>
                                            </div>
                                            <button
                                              onClick={(e) => { e.preventDefault(); setEditingId(addr.id); setAddingNew(false); }}
                                              className="flex items-center gap-1 text-xs text-blue-600 hover:underline shrink-0"
                                            >
                                              <Pencil size={11} />
                                              Edit
                                            </button>
                                          </label>
                                        )
                                      )}

                                      {/* Add new address form */}
                                      {addingNew && (
                                        <AddressFormBlock
                                          initial={EMPTY_FORM}
                                          onSave={saveNew}
                                          onCancel={() => setAddingNew(false)}
                                        />
                                      )}

                                      {addresses.length === 0 && !addingNew && (
                                        <p className="text-sm text-gray-400 text-center py-4">
                                          No address found. Add one to continue.
                                        </p>
                                      )}
                                    </div>

                                    {/* Delivery Instructions */}
                                    <div>
                                      <p className="text-sm font-medium text-gray-800 mb-2">Delivery Instructions (Optional)</p>
                                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                                        <textarea
                                          rows={3}
                                          maxLength={CHECKOUT_NOTE_MAX_LENGTH}
                                          placeholder="Add delivery instructions, gate entry details, timing preferences, etc."
                                          value={deliveryInstructions}
                                          onChange={(e) => {
                                            const value = limitCheckoutNote(e.target.value);
                                            setDeliveryInstructions(value);
                                            localStorage.setItem(DELIVERY_INSTRUCTIONS_KEY, value);
                                          }}
                                          className="w-full px-2 py-2 text-sm text-gray-700 placeholder-gray-400 resize-none outline-none"
                                        />
                                        <div className="px-4 pb-2 text-right text-xs text-gray-400">{deliveryInstructions.length}/{CHECKOUT_NOTE_MAX_LENGTH}</div>
                                      </div>
                                    </div>
                                  </div>
                                  ) : (
                                    <div className="flex items-start gap-3 rounded-xl border border-violet-100 bg-violet-50 p-4">
                                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100">
                                        <Check size={16} className="text-violet-700" />
                                      </div>
                                      <div>
                                        <p className="text-sm font-semibold text-violet-900">Digital delivery</p>
                                        <p className="mt-1 text-xs text-violet-800">
                                          No physical delivery address or delivery instructions are required for this order.
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Order Notes */}
                                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                    <button
                                      onClick={() => setNotesOpen((o) => !o)}
                                      className="w-full flex items-center justify-between px-2 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition-colors"
                                    >
                                      Order Notes (Optional)
                                      <ChevronDown
                                        size={16}
                                        className={`text-gray-400 transition-transform ${notesOpen ? "rotate-180" : ""}`}
                                      />
                                    </button>
                                    {notesOpen && (
                                      <div className="px-6 pb-4">
                                        <textarea
                                          rows={3}
                                          maxLength={CHECKOUT_NOTE_MAX_LENGTH}
                                          placeholder="Add any special notes for this order..."
                                          value={orderNotes}
                                          onChange={(e) => {
                                            const value = limitCheckoutNote(e.target.value);
                                            setOrderNotes(value);
                                            localStorage.setItem(ORDER_NOTES_KEY, value);
                                          }}
                                          className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm text-gray-700 placeholder-gray-400 resize-none outline-none"
                                        />
                                        <div className="mt-1 text-right text-xs text-gray-400">{orderNotes.length}/{CHECKOUT_NOTE_MAX_LENGTH}</div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Actions */}
                                  <div className="flex justify-center pt-2">
                                    <button
                                      onClick={() => navigate(paymentPath)}
                                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-2 py-2 text-sm transition-colors"
                                    >
                                      Continue to Payment
                                      <ChevronRight size={16} />
                                    </button>
                                  </div>
                                </div>

                                {/* Right */}
                                <OrderSummaryPanel showItemList />
                              </div>
                            </div>
                          </div>
                        );
                      }
