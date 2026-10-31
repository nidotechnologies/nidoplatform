import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Timer, Wifi, FileText, Shield, Cpu, HardDrive, Monitor, Settings2, Package } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface PreviewData {
  masterProductCode: string;
  skuCode: string;
  productName: string;
  productType: string;
  physicalType: string;
  category: string;
  subcategory: string;
  brand: string;
  tags: string[];
  description: string;
  specifications: { id: string; specification: string; value: string; unit: string }[];
  generalSpecs: { id: string; category: string; attributeValue: string }[];
  productNotes: string;
  videoUrl: string;
  images: string[];
  createdAt: string;
}

function getSpecIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes('print') || n.includes('scan') || n.includes('copy') || n.includes('function')) return <Printer size={20} className="text-blue-500" />;
  if (n.includes('speed') || n.includes('rate') || n.includes('time')) return <Timer size={20} className="text-blue-500" />;
  if (n.includes('connect') || n.includes('wifi') || n.includes('network') || n.includes('wireless')) return <Wifi size={20} className="text-blue-500" />;
  if (n.includes('paper') || n.includes('size') || n.includes('format')) return <FileText size={20} className="text-blue-500" />;
  if (n.includes('warrant') || n.includes('guarantee')) return <Shield size={20} className="text-blue-500" />;
  if (n.includes('processor') || n.includes('cpu') || n.includes('memory') || n.includes('ram')) return <Cpu size={20} className="text-blue-500" />;
  if (n.includes('storage') || n.includes('ssd') || n.includes('hdd')) return <HardDrive size={20} className="text-blue-500" />;
  if (n.includes('display') || n.includes('screen') || n.includes('resolution') || n.includes('monitor')) return <Monitor size={20} className="text-blue-500" />;
  return <Settings2 size={20} className="text-blue-500" />;
}

export default function ProductPreviewPage() {
  const navigate = useNavigate();
  const { fmtDate, locale } = useI18n();
  const [data, setData] = useState<PreviewData | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    const raw = sessionStorage.getItem('nido_preview_draft');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setData(parsed);
      } catch {}
    }
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Package size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No preview data found.</p>
          <p className="text-sm text-gray-400 mt-1">Go back and click "Preview Product" from the Add New Item page.</p>
          <button onClick={() => navigate(-1)} className="mt-4 px-2 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const addedAt = new Date(data.createdAt);
  const hasValidAddedAt = Boolean(data.createdAt) && !Number.isNaN(addedAt.getTime());
  const addedDate = hasValidAddedAt ? fmtDate(addedAt) : data.createdAt || '—';
  const addedTime = hasValidAddedAt
    ? addedAt.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', hour12: true })
    : null;

  return (
    <div className="h-screen overflow-y-auto bg-white">
      <div className="max-w-5xlpx-2 py-2 space-y-0">
        <button
          type="button"
          onClick={() => navigate('/configuration/master-catalogue')}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
          aria-label="Go back to Master Catalogue"
        >
          <ArrowLeft size={17} />
          Go back to Master Catalogue
        </button>

        {/* Section 1: Product Header */}
        <div className="border border-gray-200 rounded-xl p-2 mb-0">
          <div className="flex gap-6">
            {/* Left: Product Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">{data.productName || 'Untitled Product'}</h1>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-2">
                {data.category && (
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">{data.category}</span>
                )}
                <span className="inline-flex flex-wrap items-center gap-x-2.5 text-sm font-medium text-gray-700">
                  <span className="text-xs font-semibold text-gray-500">Added on:</span>
                  <time dateTime={hasValidAddedAt ? addedAt.toISOString() : undefined} className="inline-flex flex-wrap items-center gap-x-2.5">
                    <span>{addedDate}</span>
                    {addedTime && <span>{addedTime}</span>}
                  </time>
                </span>
              </div>

              {data.description && (
                <p className="mt-3 text-sm text-gray-600 leading-relaxed line-clamp-2">{data.description}</p>
              )}

              {/* Details grid */}
              <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">SKU</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{data.skuCode || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">MPI (Auto Generated)</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{data.masterProductCode}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Category</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{data.category || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Subcategory</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{data.subcategory || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Brand</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{data.brand || '—'}</p>
                </div>
                {data.productType && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Product Type</p>
                    <p className="text-sm font-medium text-gray-800 mt-0.5">{data.productType}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Image */}
            <div className="w-52 shrink-0">
              <div className="w-full aspect-square rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                {data.images[0] ? (
                  <img src={data.images[selectedImage] || data.images[0]} alt={data.productName} className="w-full h-full object-contain" />
                ) : (
                  <Package size={56} className="text-gray-300" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Key Specifications (Icon Grid) */}
        {data.specifications.length > 0 && (
          <div className="border-x border-b border-gray-200 px-2 py-5">
            <h2 className="text-base font-bold text-gray-900 mb-4">Key Specifications</h2>
            <div className="grid grid-cols-3 gap-x-12 gap-y-4">
              {data.specifications.slice(0, 6).map(spec => (
                <div key={spec.id} className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">{getSpecIcon(spec.specification)}</div>
                  <div>
                    <p className="text-xs text-gray-500">{spec.specification}</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {spec.value}{spec.unit && spec.unit !== '-' ? ` ${spec.unit}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 3: Description */}
        {data.description && (
          <div className="border-x border-b border-gray-200 px-2 py-5">
            <h2 className="text-base font-bold text-gray-900 mb-2">Description</h2>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{data.description}</p>
          </div>
        )}

        {/* Section 4: Key Specifications Table */}
        {data.specifications.length > 0 && (
          <div className="border-x border-b border-gray-200 px-2 py-5">
            <h2 className="text-base font-bold text-gray-900 mb-3">Key Specifications</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-1/3">Specification</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-1/3">Value</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-1/3">Unit</th>
                </tr>
              </thead>
              <tbody>
                {data.specifications.map(spec => (
                  <tr key={spec.id} className="border-b border-gray-100">
                    <td className="py-2.5 text-sm text-gray-600">{spec.specification}</td>
                    <td className="py-2.5 text-sm text-gray-800">{spec.value}</td>
                    <td className="py-2.5 text-sm text-gray-500">{spec.unit === '-' ? '-' : spec.unit || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Section 5: Product Notes & Alerts */}
        {data.productNotes && (
          <div className="border-x border-b border-gray-200 px-2 py-5">
            <h2 className="text-base font-bold text-gray-900 mb-2">Product Notes & Alerts</h2>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{data.productNotes}</p>
          </div>
        )}

        {/* Section 6: General Specifications */}
        {data.generalSpecs.filter(g => g.category || g.attributeValue).length > 0 && (
          <div className="border-x border-b border-gray-200 px-2 py-5">
            <h2 className="text-base font-bold text-gray-900 mb-3">General Specifications</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-1/3">Category</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Attribute Value</th>
                </tr>
              </thead>
              <tbody>
                {data.generalSpecs.filter(g => g.category || g.attributeValue).map(g => (
                  <tr key={g.id} className="border-b border-gray-100">
                    <td className="py-2.5 text-sm text-gray-600">{g.category}</td>
                    <td className="py-2.5 text-sm font-medium text-gray-800">{g.attributeValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Section 7: Product Images & Media */}
        {data.images.length > 0 && (
          <div className="border-x border-b border-gray-200 px-2 py-5">
            <h2 className="text-base font-bold text-gray-900 mb-4">Product Images & Media</h2>
            <div className="flex gap-3 flex-wrap">
              {data.images.map((img, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`w-24 h-24 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${selectedImage === i ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <img src={img} alt={`product-${i}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            {data.videoUrl && (
              <div className="mt-3">
                <p className="text-xs text-gray-500">Video URL:</p>
                <a href={data.videoUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">{data.videoUrl}</a>
              </div>
            )}
          </div>
        )}

        {/* closing bottom border */}
        <div className="border-x border-b border-gray-200 rounded-b-xl h-4" />

        {/* Bottom actions */}
        <div className="pt-6 flex justify-end gap-3">
          <button onClick={() => navigate(-1)} className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
