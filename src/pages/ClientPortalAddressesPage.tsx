import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MapPin, Plus, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { sanitizePhoneNumber, isValidPhoneNumber } from '@/lib/phoneValidation';
import { getClientForPortal } from '@/lib/clientStore';

interface Address {
  id: number;
  label: string;
  line1: string;
  line2: string;
  phone: string;
  attentionName?: string;
  city?: string;
  state?: string;
  zip?: string;
  isDefault?: boolean;
}

const BLANK_ADDR: Omit<Address, 'id'> = { label: '', line1: '', line2: '', phone: '' };

export default function ClientPortalAddressesPage() {
  const { user } = useAuth();
  const clientId = user?.clientId ?? '';
  const storageKey = `nido_delivery_addresses_${clientId}`;

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingAddr, setEditingAddr] = useState<Address | null>(null);
  const [form, setForm] = useState(BLANK_ADDR);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const saved = raw ? JSON.parse(raw) as Address[] : [];
      if (saved.length > 0) {
        setAddresses(saved);
        return;
      }

      const client = getClientForPortal(clientId);
      if (!client) {
        setAddresses([]);
        return;
      }

      const defaultAddress: Address = {
        id: 1,
        label: 'Office',
        line1: client.shippingAddress || client.shipping_address || client.billingAddress || client.billing_address || '',
        line2: client.shippingAddressLine2 || client.shipping_address_line2 || client.billingAddressLine2 || client.billing_address_line2 || '',
        phone: client.shippingPhone || client.shipping_phone || client.billingPhone || client.billing_phone || client.phone || client.mobile || '',
        attentionName: client.shippingAttention || client.shipping_attention || client.billingAttention || client.billing_attention || '',
        city: client.shippingCity || client.shipping_city || client.billingCity || client.billing_city || '',
        state: client.shippingState || client.shipping_state || client.billingState || client.billing_state || '',
        zip: client.shippingPincode || client.shipping_pincode || client.billingPincode || client.billing_pincode || '',
        isDefault: true,
      };
      if (defaultAddress.line1) {
        setAddresses([defaultAddress]);
        localStorage.setItem(storageKey, JSON.stringify([defaultAddress]));
      } else {
        setAddresses([]);
      }
    } catch { /* ignore */ }
  }, [clientId, storageKey]);

  const persist = (addrs: Address[]) => {
    setAddresses(addrs);
    localStorage.setItem(storageKey, JSON.stringify(addrs));
    window.dispatchEvent(new Event('nidoDeliveryAddressesUpdated'));
  };

  const openAdd = () => {
    setForm(BLANK_ADDR);
    setEditingAddr(null);
    setShowForm(true);
  };

  const openEdit = (a: Address) => {
    setForm({ label: a.label, line1: a.line1, line2: a.line2, phone: a.phone });
    setEditingAddr(a);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.label.trim() || !form.line1.trim()) return;
    if (form.phone && !isValidPhoneNumber(form.phone)) {
      toast.error('Phone number must contain exactly 10 digits.');
      return;
    }
    if (editingAddr) {
      persist(addresses.map(a => a.id === editingAddr.id ? { ...editingAddr, ...form } : a));
    } else {
      const newId = Date.now();
      persist([...addresses, { id: newId, ...form }]);
    }
    setShowForm(false);
  };

  const handleDelete = (id: number) => {
    persist(addresses.filter(a => a.id !== id));
  };

  return (
    <div className="min-h-screen bg-white p-6">
      {/* Header */}
      <div className="bg-transparent border-b border-gray-200/70 mb-8">
        <div className="max-w-7xlpx-2 py-2 flex justify-between items-start">
          <div>
            <p className="text-xs text-gray-500">Portal / Addresses</p>
            <h1 className="text-2xl font-bold">Delivery Addresses</h1>
            <p className="text-sm text-gray-500">{user?.clientName}</p>
          </div>
          <Button onClick={openAdd} className="flex items-center gap-2" disabled={addresses.length >= 5}>
            <Plus size={16} /> Add Address
          </Button>
        </div>
      </div>

      <div className="max-w-7xlpx-6">
        {addresses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <MapPin size={24} className="text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-600">No addresses saved</p>
            <p className="text-xs text-gray-400 mt-1">Add a delivery address to use during checkout.</p>
            <Button onClick={openAdd} className="mt-4">Add Address</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {addresses.map(a => (
              <Card key={a.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                        <MapPin size={15} className="text-blue-600" />
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{a.label}</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEdit(a)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700">{a.line1}</p>
                  {a.line2 && <p className="text-sm text-gray-500">{a.line2}</p>}
                   {(a.city || a.state || a.zip) && (
                     <p className="text-sm text-gray-500">{[a.city, a.state, a.zip].filter(Boolean).join(', ')}</p>
                   )}
                  {a.phone && <p className="text-xs text-gray-400 mt-2">{a.phone}</p>}
                </CardContent>
              </Card>
            ))}
            {/* Add new card */}
            {addresses.length < 5 && (
              <button
                onClick={openAdd}
                className="border-2 border-dashed border-gray-200 rounded-xl p-2 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors min-h-[120px]"
              >
                <Plus size={20} />
                <span className="text-sm">Add Address</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold">{editingAddr ? 'Edit Address' : 'Add Address'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.label}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Head Office, Warehouse A"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.line1}
                  onChange={e => setForm(f => ({ ...f, line1: e.target.value }))}
                  placeholder="Street, building"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.line2}
                  onChange={e => setForm(f => ({ ...f, line2: e.target.value }))}
                  placeholder="City, state, pincode"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                   type="tel"
                   inputMode="numeric"
                   maxLength={10}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.phone}
                   onChange={e => setForm(f => ({ ...f, phone: sanitizePhoneNumber(e.target.value) }))}
                   placeholder="10-digit phone number"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSave}>
                {editingAddr ? 'Save Changes' : 'Add Address'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
