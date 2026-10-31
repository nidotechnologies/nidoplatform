import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CATEGORY_LIST, CATEGORY_SUBCATEGORIES } from '@/lib/categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Plus, X, Bold, Italic, Underline, List, AlignLeft, AlignCenter, AlignRight,
  Link2, Image, Upload, GripVertical, ChevronLeft, ChevronUp, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import {
  generateMasterProductCode, saveCatalogProduct, getCatalogProducts, findCatalogProductByName,
  type CatalogSpec, type GeneralSpec, type CatalogVariation, type CatalogVariationOption
} from '@/lib/catalogStore';

export default function AddMasterCatalogueItemWrapper() {
  const navigate = useNavigate();
  const { itemId } = useParams<{ itemId: string }>();
  const isEditMode = Boolean(itemId);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [editProductId, setEditProductId] = useState<string>('');
  const [editMasterCode, setEditMasterCode] = useState<string>('');
  const [masterProductCode] = useState(() => generateMasterProductCode());
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);

  // In add-mode, seed state from the preview draft (if returning from preview)
  // so the user's in-progress work is never lost.
  // sessionStorage is used intentionally: it is scoped to the current browser
  // tab and cleared when the tab closes, preventing old drafts from silently
  // pre-filling a brand-new Add Item form in a future session.
  const draft = !isEditMode ? (() => { try { const r = sessionStorage.getItem('nido_preview_draft'); return r ? JSON.parse(r) : null; } catch { return null; } })() : null;

  const [skuCode, setSkuCode] = useState(draft?.skuCode ?? '');
  const [productName, setProductName] = useState(draft?.productName ?? '');
  const [physicalType, setPhysicalType] = useState(draft?.physicalType ?? 'Physical Product');
  const [category, setCategory] = useState(draft?.category ?? '');
  const [subcategory, setSubcategory] = useState(draft?.subcategory ?? '');
  const [brand, setBrand] = useState(draft?.brand ?? '');
  const [tags, setTags] = useState<string[]>(draft?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [description, setDescription] = useState(draft?.description ?? '');
  const [specifications, setSpecifications] = useState<CatalogSpec[]>(draft?.specifications ?? []);
  const [generalSpecs, setGeneralSpecs] = useState<GeneralSpec[]>(draft?.generalSpecs ?? []);
  const [variations, setVariations] = useState<CatalogVariation[]>(draft?.variations ?? []);
  const [productNotes, setProductNotes] = useState(draft?.productNotes ?? '');
  const [videoUrl, setVideoUrl] = useState(draft?.videoUrl ?? '');
  const [images, setImages] = useState<string[]>(draft?.images ?? []);
  const [imageUrlInputs, setImageUrlInputs] = useState<string[]>(['', '', '', '', '']);

  // Load product data when in edit mode
  useEffect(() => {
    if (!isEditMode || !itemId) return;
    const product = getCatalogProducts().find(p => String(p.id) === String(itemId));
    if (!product) { toast.error('Product not found'); navigate('/configuration/master-catalogue'); return; }
    setEditProductId(product.id);
    setEditMasterCode(product.masterProductCode);
    setSkuCode(product.skuCode || '');
    setProductName(product.productName || '');
    setPhysicalType(product.physicalType || 'Physical Product');
    setCategory(product.category || '');
    setSubcategory(product.subcategory || '');
    setBrand(product.brand || '');
    setTags(product.tags || []);
    setDescription(product.description || '');
    setSpecifications(product.specifications || []);
    setGeneralSpecs(product.generalSpecs || []);
    setVariations(product.variations || []);
    setProductNotes(product.productNotes || '');
    setVideoUrl(product.videoUrl || '');
    setImages(product.images || []);
  }, [itemId]);

  const currentMasterProductCode = isEditMode ? editMasterCode : masterProductCode;
  const currentEditProductId = itemId || editProductId;
  // Digital variations belong to each vendor product now, because option
  // prices can differ by vendor. Keep legacy variation data readable but do
  // not expose or persist it from the master-catalogue form.
  const supportsVariations = false;

  const [newSpecName, setNewSpecName] = useState('');
  const [newSpecValue, setNewSpecValue] = useState('');
  const [newSpecUnit, setNewSpecUnit] = useState('-');

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDialogType, setAddDialogType] = useState('');
  const [newOptionValue, setNewOptionValue] = useState('');

  const [physicalTypesList, setPhysicalTypesList] = useState([
    'Physical Product',
    'Digital Licence',
    'Subscription',
    'Hybrid Product',
    'Cloud Service',
  ]);
  const [categoriesList, setCategoriesList] = useState<string[]>(CATEGORY_LIST);
  const [subcategoriesList, setSubcategoriesList] = useState<string[]>(
    category ? (CATEGORY_SUBCATEGORIES[category] ?? []) : []
  );
  const [brandsList, setBrandsList] = useState(['Apple', 'Dell', 'HP', 'Lenovo', 'Samsung', 'Sony']);
  const [unitsList, setUnitsList] = useState(['-', 'ppm', 'dpi', 'pages', 'GB', 'TB', 'Hz', 'mm', 'cm', 'kg', 'inch', 'W', 'V']);

  const openAddDialog = (type: string) => {
    setAddDialogType(type);
    setNewOptionValue('');
    setShowAddDialog(true);
  };

  const handleAddNewOption = () => {
    const val = newOptionValue.trim();
    if (!val) { toast.error('Please enter a value'); return; }
    const map: Record<string, () => void> = {
      physicalType: () => { if (!physicalTypesList.includes(val)) { setPhysicalTypesList(p => [...p, val]); setPhysicalType(val); toast.success('Added'); } else toast.error('Already exists'); },
      category: () => { if (!categoriesList.includes(val)) { setCategoriesList(p => [...p, val]); setCategory(val); toast.success('Added'); } else toast.error('Already exists'); },
      subcategory: () => { if (!subcategoriesList.includes(val)) { setSubcategoriesList(p => [...p, val]); setSubcategory(val); toast.success('Added'); } else toast.error('Already exists'); },
      brand: () => { if (!brandsList.includes(val)) { setBrandsList(p => [...p, val]); setBrand(val); toast.success('Added'); } else toast.error('Already exists'); },
      unit: () => { if (!unitsList.includes(val)) { setUnitsList(p => [...p, val]); toast.success('Added'); } else toast.error('Already exists'); },
    };
    map[addDialogType]?.();
    setNewOptionValue('');
    setShowAddDialog(false);
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      if (!tags.includes(tagInput.trim())) setTags(t => [...t, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleAddSpecRow = () => {
    if (!newSpecName.trim()) { toast.error('Enter a specification name'); return; }
    setSpecifications(s => [...s, { id: Date.now().toString(), specification: newSpecName.trim(), value: newSpecValue, unit: newSpecUnit }]);
    setNewSpecName(''); setNewSpecValue(''); setNewSpecUnit('-');
    toast.success('Specification added');
  };

  const updateSpec = (id: string, field: keyof CatalogSpec, val: string) =>
    setSpecifications(s => s.map(x => x.id === id ? { ...x, [field]: val } : x));

  const addGeneralSpecRow = () =>
    setGeneralSpecs(s => [...s, { id: Date.now().toString(), category: '', attributeValue: '' }]);

  const updateGeneralSpec = (id: string, field: keyof GeneralSpec, val: string) =>
    setGeneralSpecs(s => s.map(x => x.id === id ? { ...x, [field]: val } : x));

  const removeGeneralSpec = (id: string) =>
    setGeneralSpecs(s => s.filter(x => x.id !== id));

  const addVariation = () => {
    setVariations(current => [
      ...current,
      {
        id: `variation-${Date.now()}`,
        name: '',
        options: [{ id: `variation-option-${Date.now()}`, label: '', priceAdjustment: 0 }],
      },
    ]);
  };

  const updateVariation = (id: string, field: 'name', value: string) => {
    setVariations(current => current.map(variation =>
      variation.id === id ? { ...variation, [field]: value } : variation,
    ));
  };

  const removeVariation = (id: string) => {
    setVariations(current => current.filter(variation => variation.id !== id));
  };

  const addVariationOption = (variationId: string) => {
    setVariations(current => current.map(variation =>
      variation.id === variationId
        ? {
            ...variation,
            options: [
              ...variation.options,
              { id: `variation-option-${Date.now()}-${variation.options.length}`, label: '', priceAdjustment: 0 },
            ],
          }
        : variation,
    ));
  };

  const updateVariationOption = (
    variationId: string,
    optionId: string,
    field: keyof CatalogVariationOption,
    value: string,
  ) => {
    setVariations(current => current.map(variation =>
      variation.id !== variationId
        ? variation
        : {
            ...variation,
            options: variation.options.map(option => {
              if (option.id !== optionId) return option;
              return {
                ...option,
                [field]: field === 'priceAdjustment' ? (Number(value) || 0) : value,
              };
            }),
          },
    ));
  };

  const removeVariationOption = (variationId: string, optionId: string) => {
    setVariations(current => current.map(variation =>
      variation.id === variationId
        ? { ...variation, options: variation.options.filter(option => option.id !== optionId) }
        : variation,
    ));
  };

  const moveVariationOption = (variationId: string, optionId: string, direction: -1 | 1) => {
    setVariations(current => current.map(variation => {
      if (variation.id !== variationId) return variation;
      const currentIndex = variation.options.findIndex(option => option.id === optionId);
      const targetIndex = currentIndex + direction;
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= variation.options.length) return variation;

      const options = [...variation.options];
      [options[currentIndex], options[targetIndex]] = [options[targetIndex], options[currentIndex]];
      return { ...variation, options };
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => { if (ev.target?.result) setImages(p => [...p, ev.target!.result as string]); };
      reader.readAsDataURL(file);
    });
  };

  const updateImageUrlInput = (idx: number, val: string) =>
    setImageUrlInputs(rows => rows.map((r, i) => i === idx ? val : r));

  const addImageUrlInputRow = () => setImageUrlInputs(rows => [...rows, '']);

  const removeImageUrlInputRow = (idx: number) =>
    setImageUrlInputs(rows => rows.length > 1 ? rows.filter((_, i) => i !== idx) : rows);

  const normalizeImageUrl = (raw: string): string | null => {
    const value = raw.trim();
    if (!value) return null;
    if (value.startsWith('/') || value.startsWith('./') || value.startsWith('../')) return value;
    if (value.startsWith('//')) return `https:${value}`;

    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
    } catch {
      return null;
    }
  };

  const handleAddImageUrls = () => {
    const enteredValues = imageUrlInputs.map(u => u.trim()).filter(Boolean);
    if (enteredValues.length === 0) { toast.error('Enter at least one image URL'); return; }

    const validUrls = enteredValues
      .map(normalizeImageUrl)
      .filter((url): url is string => Boolean(url));
    const existing = new Set(images);
    const newUrls = validUrls.filter(url => !existing.has(url));
    const invalidCount = enteredValues.length - validUrls.length;
    const duplicateCount = validUrls.length - newUrls.length;

    if (newUrls.length === 0) {
      if (invalidCount > 0) {
        toast.error('Enter a valid image URL starting with http:// or https://');
      } else {
        toast.info('Those image URLs are already added');
      }
      return;
    }

    setImages(p => [...p, ...newUrls]);
    setImageUrlInputs(['', '', '', '', '']);
    const details = [
      `${newUrls.length} image URL${newUrls.length === 1 ? '' : 's'} added`,
      duplicateCount > 0 ? `${duplicateCount} duplicate skipped` : '',
      invalidCount > 0 ? `${invalidCount} invalid skipped` : '',
    ].filter(Boolean).join(' · ');
    toast.success(details);
  };

  const handleImageUrlKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddImageUrls();
    }
  };

  const buildProduct = (
    status: 'draft' | 'published',
    existingProduct = isEditMode
      ? getCatalogProducts().find(p => String(p.id) === String(currentEditProductId))
      : undefined,
  ) => {
    const savedVariations: CatalogVariation[] = [];

    return {
    ...(isEditMode ? existingProduct : undefined),
    // In edit mode, preserve the exact ID from storage. The route ID is only
    // used to locate the record and must never turn an update into an insert.
    id: isEditMode ? (existingProduct?.id ?? currentEditProductId) : Date.now().toString(),
    masterProductCode: currentMasterProductCode,
    skuCode,
    productName: productName || 'Untitled Product',
    // Retained for compatibility with existing catalog records and downstream consumers.
    productType: 'Product',
    physicalType,
    category,
    subcategory,
    brand,
    tags,
    description,
    specifications,
    generalSpecs,
    variations: savedVariations,
    productNotes,
    videoUrl,
    images,
    publishStatus: status,
    price: 0,
    moq: 0,
    leadTime: '',
    warranty: '',
    };
  };

  const handlePreview = () => {
    if (!productName.trim()) { toast.error('Enter a product name first'); return; }
    const previewData = {
      masterProductCode: currentMasterProductCode,
      skuCode,
      productName: productName || 'Untitled Product',
      physicalType, category, subcategory, brand, tags,
      description, specifications, generalSpecs, variations: [], productNotes, videoUrl, images,
      createdAt: new Date().toISOString(),
    };
    sessionStorage.setItem('nido_preview_draft', JSON.stringify(previewData));
    navigate('/preview-product');
  };

  const clearDraft = () => sessionStorage.removeItem('nido_preview_draft');

  const saveProduct = (status: 'draft' | 'published') => {
    const existingProduct = isEditMode
      ? getCatalogProducts().find(p => String(p.id) === String(currentEditProductId))
      : undefined;

    if (isEditMode && !existingProduct) {
      toast.error('Product could not be found. Please return to the master catalogue and try again.');
      return false;
    }

    if (!isEditMode) {
      const duplicate = findCatalogProductByName(productName);
      if (duplicate) {
        toast.error(`Product duplication found: "${duplicate.productName}" already exists in the master catalog.`);
        return false;
      }
    }
    const saved = saveCatalogProduct(buildProduct(status, existingProduct), {
      skipDuplicateCheck: isEditMode,
    });
    if (!saved) {
      toast.error(
        isEditMode
          ? 'Unable to save changes because the product could not be found.'
          : 'Product duplication found: a product with this name already exists in the master catalog.',
      );
      return false;
    }
    return true;
  };

  const handleSaveDraft = () => {
    if (!productName.trim()) { toast.error('Product name is required'); return; }
    if (!saveProduct('draft')) return;
    clearDraft();
    toast.success('Saved as draft');
    navigate('/configuration/master-catalogue');
  };

  const handlePublish = () => {
    if (!productName.trim()) { toast.error('Product name is required'); return; }
    setPublishConfirmOpen(true);
  };

  const confirmPublish = () => {
    if (!saveProduct('published')) return;
    setPublishConfirmOpen(false);
    clearDraft();
    toast.success('Product published successfully!');
    navigate('/configuration/master-catalogue');
  };

  const handleSaveChanges = () => {
    if (!productName.trim()) { toast.error('Product name is required'); return; }
    const existing = getCatalogProducts().find(p => String(p.id) === String(currentEditProductId));
    if (!existing) {
      toast.error('Product could not be found. Please return to the master catalogue and try again.');
      return;
    }
    if (!saveProduct(existing?.publishStatus || 'draft')) return;
    clearDraft();
    toast.success('Changes saved successfully');
    navigate('/configuration/master-catalogue');
  };

  const SelectWithAdd = ({
    value, onValueChange, options, placeholder, dialogType
  }: {
    value: string; onValueChange: (v: string) => void; options: string[];
    placeholder: string; dialogType: string;
  }) => (
    <div className="flex gap-2 mt-1">
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="text-sm flex-1">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent position="popper" className="z-50">
          {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" className="px-2 shrink-0" onClick={() => openAddDialog(dialogType)} title={`Add new ${dialogType}`}>
        <Plus size={16} />
      </Button>
    </div>
  );

  return (
    <div className="w-full min-h-screen bg-white px-2 sm:px-6 md:px-10 xl:px-16 py-2 sm:py-6">
      <div className="w-full space-y-6">

        {/* Back button */}
        <button onClick={() => navigate('/configuration/master-catalogue')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ChevronLeft size={16} />
          {isEditMode ? 'Back to Master Catalogue' : 'Back to Master Catalogue'}
        </button>
        {isEditMode && (
          <h1 className="text-xl font-bold text-gray-900">Edit Product</h1>
        )}

        {/* Section 1: Product Information */}
        <div className="border border-gray-300 rounded-lg p-2 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-gray-900">1. Product Information</h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">Capture core catalog identity for enterprise procurement mapping.</p>

          <div className="mt-4 space-y-4">
            {/* Row 0: MPC + SKU */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-xs sm:text-sm font-medium text-gray-700">Master Product Code</Label>
                <Input value={currentMasterProductCode} readOnly className="mt-1 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
                <p className="text-xs text-gray-400 mt-1">Auto-generated · Read only</p>
              </div>
              <div>
                <Label className="text-xs sm:text-sm font-medium text-gray-700">SKU Code</Label>
                <Input placeholder="e.g., SKU-XXXX-YYYY" value={skuCode} onChange={e => setSkuCode(e.target.value)} className="mt-1 text-sm" />
              </div>
            </div>

            {/* Row 1: Product Name, Product */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-xs sm:text-sm font-medium text-gray-700">Product Name</Label>
                <Input placeholder="e.g., Apple MacBook Air M3" value={productName} onChange={e => setProductName(e.target.value)} className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs sm:text-sm font-medium text-gray-700">Product Type</Label>
                <SelectWithAdd value={physicalType} onValueChange={setPhysicalType} options={physicalTypesList} placeholder="Select type..." dialogType="physicalType" />
              </div>
            </div>

            {/* Row 2: Category, Subcategory, Brand */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <Label className="text-xs sm:text-sm font-medium text-gray-700">Category</Label>
                <SelectWithAdd value={category} onValueChange={(v) => { setCategory(v); setSubcategory(''); setSubcategoriesList(CATEGORY_SUBCATEGORIES[v] ?? []); }} options={categoriesList} placeholder="Select category..." dialogType="category" />
              </div>
              <div>
                <Label className="text-xs sm:text-sm font-medium text-gray-700">Subcategory</Label>
                <SelectWithAdd value={subcategory} onValueChange={setSubcategory} options={subcategoriesList} placeholder="Select subcategory..." dialogType="subcategory" />
              </div>
              <div>
                <Label className="text-xs sm:text-sm font-medium text-gray-700">Brand</Label>
                <SelectWithAdd value={brand} onValueChange={setBrand} options={brandsList} placeholder="Select brand..." dialogType="brand" />
              </div>
            </div>

            {/* Row 3: Tags */}
            <div>
              <Label className="text-xs sm:text-sm font-medium text-gray-700">Tags</Label>
              <Input placeholder="Add tag and press Enter" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleAddTag} className="mt-1 text-sm" />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag, idx) => (
                    <Badge key={idx} variant="secondary" className="flex items-center gap-1 text-xs">
                      {tag}
                      <X size={12} className="cursor-pointer" onClick={() => setTags(t => t.filter((_, i) => i !== idx))} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <Label className="text-xs sm:text-sm font-medium text-gray-700">Description</Label>
              <div className="mt-1 border border-gray-300 rounded-lg overflow-hidden">
                <div className="flex items-center gap-1 p-2 bg-gray-50 border-b border-gray-300 flex-wrap">
                  {[Bold, Italic, Underline].map((Icon, i) => (
                    <button key={i} className="p-1 hover:bg-gray-200 rounded"><Icon size={16} className="text-gray-600" /></button>
                  ))}
                  <div className="w-px h-4 bg-gray-300 mx-1" />
                  {[List, AlignLeft, AlignCenter, AlignRight].map((Icon, i) => (
                    <button key={i} className="p-1 hover:bg-gray-200 rounded"><Icon size={16} className="text-gray-600" /></button>
                  ))}
                  <div className="w-px h-4 bg-gray-300 mx-1" />
                  {[Image, Link2].map((Icon, i) => (
                    <button key={i} className="p-1 hover:bg-gray-200 rounded"><Icon size={16} className="text-gray-600" /></button>
                  ))}
                </div>
                <Textarea placeholder="Enter professional product description..." value={description} onChange={e => setDescription(e.target.value)} className="border-0 rounded-none min-h-28 text-sm resize-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Key Specifications */}
        <div className="border border-gray-300 rounded-lg p-2 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-gray-900">2. Key Specifications</h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">Reusable specification engine with dynamic categories and unit support.</p>

          <div className="mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left p-2 font-semibold text-gray-700 text-xs">SPECIFICATION</th>
                  <th className="text-left p-2 font-semibold text-gray-700 text-xs">VALUE</th>
                  <th className="text-left p-2 font-semibold text-gray-700 text-xs">UNIT</th>
                  <th className="text-left p-2 font-semibold text-gray-700 text-xs">DELETE</th>
                </tr>
              </thead>
              <tbody>
                {specifications.length === 0 ? (
                  <tr><td colSpan={4} className="p-4 text-center text-xs text-gray-400">No specifications yet. Use the panel below to add one.</td></tr>
                ) : (
                  specifications.map(spec => (
                    <tr key={spec.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <GripVertical size={16} className="text-gray-400 cursor-grab" />
                          <span className="text-gray-700 font-medium">{spec.specification}</span>
                        </div>
                      </td>
                      <td className="p-2">
                        <Input value={spec.value} onChange={e => updateSpec(spec.id, 'value', e.target.value)} className="text-xs h-8" placeholder="Enter value" />
                      </td>
                      <td className="p-2 min-w-[160px]">
                        <Select value={spec.unit} onValueChange={val => val === '__add__' ? openAddDialog('unit') : updateSpec(spec.id, 'unit', val)}>
                          <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                          <SelectContent position="popper" className="z-50">
                            {unitsList.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                            <SelectItem value="__add__" className="text-blue-600 font-medium">+ Add New Unit</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <button onClick={() => setSpecifications(s => s.filter(x => x.id !== spec.id))} className="text-red-400 hover:text-red-600">
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="mt-4 p-2 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-medium text-gray-700">Specification Name</Label>
                  <Input placeholder="e.g., Connectivity" className="text-sm mt-1" value={newSpecName} onChange={e => setNewSpecName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddSpecRow()} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-700">Value</Label>
                  <Input placeholder="e.g., Wi-Fi, USB" className="text-sm mt-1" value={newSpecValue} onChange={e => setNewSpecValue(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-700">Unit</Label>
                  <div className="flex gap-2 mt-1">
                    <Select value={newSpecUnit} onValueChange={val => val === '__add__' ? openAddDialog('unit') : setNewSpecUnit(val)}>
                      <SelectTrigger className="text-sm flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent position="popper" className="z-50">
                        {unitsList.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        <SelectItem value="__add__" className="text-blue-600 font-medium">+ Add New Unit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={handleAddSpecRow}>
                <Plus size={16} className="mr-2" /> Add Specification Row
              </Button>
            </div>
          </div>
        </div>

        {/* Section 3: Product Notes & Alerts */}
        <div className="border border-gray-300 rounded-lg p-2 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-gray-900">3. Product Notes & Alerts</h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">Enter manual note points, warnings, explanations, stock notices, or product-specific remarks.</p>
          <div className="mt-4">
            <Label className="text-xs sm:text-sm font-medium text-gray-700">Product Notes (optional)</Label>
            <Textarea placeholder="Enter product notes, issue explanations, stock notices, warnings or remarks..." value={productNotes} onChange={e => setProductNotes(e.target.value)} className="mt-2 text-sm min-h-24" />
            <p className="text-xs text-gray-500 mt-1">Multiline supported. Leave empty to hide banners on Shop cards.</p>
          </div>
        </div>

        {/* Section 4: General Specifications */}
        <div className="border border-gray-300 rounded-lg p-2 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-gray-900">4. General Specifications</h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">Categorized product attributes for structured catalog metadata.</p>

          <div className="mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left p-2 font-semibold text-gray-700 text-xs">CATEGORY</th>
                  <th className="text-left p-2 font-semibold text-gray-700 text-xs">ATTRIBUTE VALUE</th>
                  <th className="text-right p-2 font-semibold text-gray-700 text-xs">DELETE</th>
                </tr>
              </thead>
              <tbody>
                {generalSpecs.length === 0 ? (
                  <tr className="border-b border-gray-200">
                    <td colSpan={3} className="p-4 text-center text-xs text-gray-400">No general specifications yet. Click "Add Row" to begin.</td>
                  </tr>
                ) : (
                  generalSpecs.map(row => (
                    <tr key={row.id} className="border-b border-gray-200">
                      <td className="p-2">
                        <Input value={row.category} onChange={e => updateGeneralSpec(row.id, 'category', e.target.value)} placeholder="e.g., Manufacturer, Color, Weight" className="text-xs h-9 border-gray-200" />
                      </td>
                      <td className="p-2">
                        <Input value={row.attributeValue} onChange={e => updateGeneralSpec(row.id, 'attributeValue', e.target.value)} placeholder="e.g., Samsung, Black, 2.5kg" className="text-xs h-9 border-gray-200" />
                      </td>
                      <td className="p-2 text-right">
                        <button onClick={() => removeGeneralSpec(row.id)} className="text-red-400 hover:text-red-600 transition-colors">
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <Button variant="outline" className="mt-3 gap-2 text-gray-700 border-gray-300 hover:bg-gray-50" onClick={addGeneralSpecRow}>
              <Plus size={16} />
              Add Row
            </Button>
          </div>
        </div>

        {supportsVariations && (
          <div className="border border-blue-200 rounded-lg bg-blue-50/40 p-2 sm:p-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900">5. {physicalType} Variations</h2>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  Add the dropdown fields that clients can configure in Shop. Enter a positive or negative price adjustment for each option.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-blue-700">Used by Shop → Configure</span>
            </div>

            {variations.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-blue-200 bg-white p-4 text-center text-xs text-gray-500">
                No variations yet. Add fields such as License Edition, Plan, Users, Storage, Support, or Billing Cycle.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {variations.map((variation, variationIndex) => (
                  <div key={variation.id} className="rounded-lg border border-blue-100 bg-white p-3 sm:p-4">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <Label className="text-xs font-semibold text-gray-700">Variation field {variationIndex + 1}</Label>
                        <Input
                          value={variation.name}
                          onChange={event => updateVariation(variation.id, 'name', event.target.value)}
                          placeholder="e.g., Region, Instance Type, Storage, Plan"
                          className="mt-1 h-9 text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeVariation(variation.id)}
                        className="mt-5 rounded-md p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Remove variation ${variation.name || variationIndex + 1}`}
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="grid grid-cols-[minmax(0,1fr)_120px_74px] gap-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        <span>Dropdown option</span>
                        <span>Price adjustment</span>
                        <span />
                      </div>
                      {variation.options.map((option, optionIndex) => (
                        <div key={option.id} className="grid grid-cols-[minmax(0,1fr)_120px_74px] items-center gap-2">
                          <Input
                            value={option.label}
                            onChange={event => updateVariationOption(variation.id, option.id, 'label', event.target.value)}
                            placeholder="e.g., Mumbai"
                            className="h-8 text-xs"
                          />
                          <Input
                            type="number"
                            value={option.priceAdjustment}
                            onChange={event => updateVariationOption(variation.id, option.id, 'priceAdjustment', event.target.value)}
                            placeholder="0"
                            className="h-8 text-xs"
                          />
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              type="button"
                              onClick={() => moveVariationOption(variation.id, option.id, -1)}
                              disabled={optionIndex === 0}
                              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
                              aria-label={`Move option ${option.label || "option"} up`}
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveVariationOption(variation.id, option.id, 1)}
                              disabled={optionIndex === variation.options.length - 1}
                              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
                              aria-label={`Move option ${option.label || "option"} down`}
                            >
                              <ChevronDown size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeVariationOption(variation.id, option.id)}
                              className="rounded-md p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                              aria-label={`Remove option ${option.label || "option"}`}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-1 h-8 gap-1.5 text-xs"
                        onClick={() => addVariationOption(variation.id)}
                      >
                        <Plus size={13} /> Add option
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              className="mt-4 gap-2 border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
              onClick={addVariation}
            >
              <Plus size={16} /> Add variation field
            </Button>
            <p className="mt-2 text-[11px] text-gray-500">
              Example: Region → Mumbai ₹0, Singapore ₹2,500. The base product/vendor price is used first, then the selected adjustments are added together.
            </p>
          </div>
        )}

        {/* Section 5: Product Images & Media */}
        <div className="border border-gray-300 rounded-lg p-2 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-gray-900">{supportsVariations ? '6' : '5'}. Product Images & Media</h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">Upload product images for display in the catalog and shop.</p>

          <div className="mt-4 space-y-4">
            <div>
              <Label className="text-xs sm:text-sm font-medium text-gray-700">Product Images</Label>
              <div
                className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-2 sm:p-8 text-center bg-gray-50 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                onClick={() => imageInputRef.current?.click()}
              >
                <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                <p className="text-sm font-medium text-gray-700">Drag & drop images here or click to upload</p>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG, WEBP supported. Multiple files allowed.</p>
              </div>
              <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />

              {images.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {images.map((img, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 group">
                      <img
                        src={img}
                        alt={`Product image ${i + 1}`}
                        className="w-full h-full object-contain bg-white p-1"
                        onError={e => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          e.currentTarget.nextElementSibling?.classList.add('flex');
                        }}
                      />
                      <div className="hidden absolute inset-0 items-center justify-center bg-red-50 px-1 text-center text-[9px] text-red-600">
                        Image unavailable
                      </div>
                      <button
                        onClick={() => setImages(p => p.filter((_, idx) => idx !== i))}
                        className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                      {i === 0 && <span className="absolute bottom-0 left-0 right-0 bg-blue-600 text-white text-[9px] text-center py-0.5">Primary</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs sm:text-sm font-medium text-gray-700">Add Images via URL</Label>
              <p className="text-xs text-gray-500 mt-0.5">Same as the Image1_URL...Image5_URL columns used in the Bulk Import template — paste one link per row.</p>
              <div className="mt-2 space-y-2">
                {imageUrlInputs.map((url, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder={`https://example.com/image${idx + 1}.jpg`}
                      value={url}
                      onChange={e => updateImageUrlInput(idx, e.target.value)}
                      onKeyDown={handleImageUrlKeyDown}
                      className="text-sm flex-1"
                    />
                    {imageUrlInputs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeImageUrlInputRow(idx)}
                        className="text-gray-400 hover:text-red-500 shrink-0"
                        title="Remove row"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addImageUrlInputRow}>
                  <Plus size={14} /> Add Another URL
                </Button>
                <Button type="button" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5" onClick={handleAddImageUrls}>
                  <Link2 size={14} /> Add URL(s) to Product
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs sm:text-sm font-medium text-gray-700">Optional Video URL</Label>
              <Input placeholder="https://..." value={videoUrl} onChange={e => setVideoUrl(e.target.value)} className="mt-1 text-sm" />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pb-8">
          <Button variant="outline" className="flex-1 text-sm h-11 border-gray-300 text-gray-700 hover:bg-gray-50" onClick={handlePreview}>
            Preview Product
          </Button>
          {isEditMode ? (
            <Button
              data-confirmation-skip
              className="flex-1 text-sm h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              onClick={handleSaveChanges}
            >
              Save Changes
            </Button>
          ) : (
            <>
              <Button variant="outline" className="flex-1 text-sm h-11 border-gray-300 text-gray-700 hover:bg-gray-50" onClick={handleSaveDraft}>
                Save as Draft
              </Button>
              <Button className="flex-1 text-sm h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold" onClick={handlePublish}>
                Publish Product
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Publish Confirmation Dialog */}
      <Dialog open={publishConfirmOpen} onOpenChange={setPublishConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Publish this product?</DialogTitle>
          </DialogHeader>
          <div className="py-1">
            <p className="text-sm text-gray-700">
              Are you sure you want to publish <span className="font-semibold">"{productName.trim() || 'Untitled Product'}"</span>?
            </p>
            <p className="mt-2 text-sm text-gray-500">
              This will set its status to Published.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishConfirmOpen(false)}>Cancel</Button>
            <Button
              data-confirmation-skip=""
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={confirmPublish}
            >
              Publish Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Option Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New {
              addDialogType === 'physicalType' ? 'Product' :
              addDialogType === 'category' ? 'Category' :
              addDialogType === 'subcategory' ? 'Subcategory' :
              addDialogType === 'brand' ? 'Brand' :
              addDialogType === 'unit' ? 'Unit' : 'Option'
            }</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label className="text-sm font-medium">Enter new value</Label>
            <Input
              placeholder={
                addDialogType === 'physicalType' ? 'e.g., Rental' :
                addDialogType === 'category' ? 'e.g., Software' :
                addDialogType === 'subcategory' ? 'e.g., Tablets' :
                addDialogType === 'brand' ? 'e.g., Canon' :
                addDialogType === 'unit' ? 'e.g., watts' : 'Enter value'
              }
              value={newOptionValue}
              onChange={e => setNewOptionValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddNewOption()}
              className="mt-2" autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddNewOption} className="bg-blue-600 hover:bg-blue-700">Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
