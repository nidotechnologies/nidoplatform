import { useState } from 'react';
import VendorPriceEngine from './VendorPriceEngine';
import ClientPriceEngine from './ClientPriceEngine';

export default function PricingDiscountsPage() {
  const [activeTab, setActiveTab] = useState<'vendor' | 'client'>('vendor');

  return (
    <div className="w-full min-h-screen bg-white px-2 py-4">
      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`px-6 py-2 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'vendor' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          onClick={() => setActiveTab('vendor')}
        >
          Vendor Price Engine
        </button>
        <button
          className={`px-6 py-2 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'client' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          onClick={() => setActiveTab('client')}
        >
          Client Price Engine
        </button>
      </div>

      {activeTab === 'vendor' ? <VendorPriceEngine /> : <ClientPriceEngine />}
    </div>
  );
}
