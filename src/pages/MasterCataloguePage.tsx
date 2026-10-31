import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORY_SUBCATEGORIES } from '@/lib/categories';
import { getCatalogProducts, deleteCatalogProduct, saveCatalogProduct, generateMasterProductCode, removeArchivedProductFromDownstream, findCatalogProductByName, normalizeCatalogProductName } from '@/lib/catalogStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { sanitizePhoneNumber, isValidPhoneNumber } from '@/lib/phoneValidation';
import {
  Plus, Search, Upload, FileDown, Pencil, Eye, Archive,
  Settings, ShoppingCart, X, Star, Image as ImageIcon, Download, MoreVertical,
  LayoutGrid, LayoutList, CheckCircle, Clock, FileEdit, ArchiveRestore
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CatalogItem {
  id: string;
  masterProductCode?: string;
  name: string;
  sku: string;
  publishStatus?: 'draft' | 'published' | 'pending' | 'archived';
  category: string;
  subCategory: string;
  physicalType: string;
  brand: string;
  price: number;
  discountPrice?: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  image?: string;
  description?: string;
  tags: string[];
  initialStock: number;
  minStockThreshold: number;
  specification?: string;
  warranty?: string;
  hsnCode?: string;
  dimensionL?: string;
  dimensionW?: string;
  dimensionH?: string;
  dimUnit?: string;
  weight?: string;
  weightUnit?: string;
  customsDeclaration?: string;
  primaryVendor?: string;
  vendorSku?: string;
  leadTime?: string;
  vendorContact?: string;
  vendorEmail?: string;
  vendorPhone?: string;
  vendorPhone2?: string;
  trackPerformance?: boolean;
  performanceRating?: number;
  specifications?: { id: string; specification: string; value: string; unit: string }[];
  generalSpecs?: { id: string; category: string; attributeValue: string }[];
  images?: string[];
}

const defaultCategories: Record<string, string[]> = { ...CATEGORY_SUBCATEGORIES };

const defaultBrands = ['HP', 'Sandisk', 'Logitech', 'Apple', 'Epson', 'Dell', 'Lenovo', 'Samsung'];
const defaultVendors = ['HP Direct', 'Sandisk Global', 'Epson Hub', 'Apple Store B2B', 'Dell Enterprise'];
const leadTimeOptions = ['10 Days', '1 Month', 'On Backorder', 'TBD'];
const customsOptions = ['Exempt', 'Taxable', 'Restricted'];
const defaultTags = ['CoreEssentials', 'New Arrival', 'High-End', 'Budget', 'Eco-Friendly'];

// ─── Helper Components ────────────────────────────────────────────────────────

function PublishStatusBadge({ status }: { status?: 'draft' | 'published' | 'pending' | 'archived' }) {
  if (!status) return null;
  const cfg: Record<string, string> = {
    published: 'bg-green-100 text-green-700',
    draft: 'bg-yellow-100 text-yellow-700',
    pending: 'bg-blue-100 text-blue-700',
    archived: 'bg-gray-100 text-gray-500',
  };
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <Badge className={`border-none text-xs ${cfg[status] || 'bg-gray-100 text-gray-500'}`}>{label}</Badge>;
}

function ProductActionsMenu({
  item, onEdit, onArchive, onStatusChange,
}: {
  item: CatalogItem;
  onEdit: () => void;
  onArchive: () => void;
  onStatusChange: (s: 'draft' | 'published' | 'pending') => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-gray-200">
          <MoreVertical size={16} className="text-gray-600" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
          <Pencil size={14} className="mr-2" /> Edit Product
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1 text-[10px] font-semibold uppercase text-gray-400 tracking-wider">Update Status</div>
        <DropdownMenuItem
          onClick={() => onStatusChange('published')}
          className={`cursor-pointer ${item.publishStatus === 'published' ? 'bg-green-50 text-green-700' : ''}`}
        >
          <CheckCircle size={14} className="mr-2 text-green-600" /> Published
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onStatusChange('pending')}
          className={`cursor-pointer ${item.publishStatus === 'pending' ? 'bg-blue-50 text-blue-700' : ''}`}
        >
          <Clock size={14} className="mr-2 text-blue-600" /> Pending
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onStatusChange('draft')}
          className={`cursor-pointer ${item.publishStatus === 'draft' ? 'bg-yellow-50 text-yellow-700' : ''}`}
        >
          <FileEdit size={14} className="mr-2 text-yellow-600" /> Draft
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onArchive} className="cursor-pointer text-gray-600">
          <Archive size={14} className="mr-2" /> Archive Product
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProductThumbnailCard({
  item, onView, onEdit, onArchive, onStatusChange,
}: {
  item: CatalogItem;
  onView: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onStatusChange: (s: 'draft' | 'published' | 'pending') => void;
}) {
  const specs = item.specifications || [];
  const generalSpecs = item.generalSpecs || [];

  // Build key spec bullets: first from keyspecs, fall back to generalSpecs
  const specBullets: { label: string; value: string }[] = [];
  specs.slice(0, 5).forEach(s => {
    if (s.specification) specBullets.push({ label: s.specification, value: s.unit && s.unit !== '-' ? `${s.value} ${s.unit}` : s.value });
  });
  if (specBullets.length === 0) {
    generalSpecs.slice(0, 5).forEach(g => {
      if (g.category) specBullets.push({ label: g.category, value: g.attributeValue });
    });
  }

  const firstImage = item.images?.[0] || item.image;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {/* Image area */}
      <div className="relative h-36 bg-gray-100 flex-shrink-0">
        {firstImage ? (
          <img src={firstImage} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={36} className="text-gray-300" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col flex-1">
        {/* Name + 3-dot menu row */}
        <div className="flex items-start justify-between gap-1 mb-1">
          <p className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2 flex-1">{item.name}</p>
          <div className="flex-shrink-0 -mt-1 -mr-1">
            <ProductActionsMenu item={item} onEdit={onEdit} onArchive={onArchive} onStatusChange={onStatusChange} />
          </div>
        </div>

        {/* Meta fields */}
        <div className="space-y-0.5 mb-2">
          {item.masterProductCode && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-400 w-[88px] flex-shrink-0">Master Code</span>
              <span className="text-[10px] font-mono text-gray-700 truncate">{item.masterProductCode}</span>
            </div>
          )}
          {item.sku && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-400 w-[88px] flex-shrink-0">SKU</span>
              <span className="text-[10px] text-gray-700 truncate">{item.sku}</span>
            </div>
          )}
          {item.category && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-400 w-[88px] flex-shrink-0">Category</span>
              <span className="text-[10px] text-gray-700 truncate">{item.category}{item.subCategory ? ` · ${item.subCategory}` : ''}</span>
            </div>
          )}
          {item.brand && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-400 w-[88px] flex-shrink-0">Brand</span>
              <span className="text-[10px] text-gray-700 truncate">{item.brand}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400 w-[88px] flex-shrink-0">Status</span>
            <div>
              {item.publishStatus ? (
                <PublishStatusBadge status={item.publishStatus} />
              ) : (
                <span className="text-[10px] text-gray-700">{item.status}</span>
              )}
            </div>
          </div>
        </div>

        {/* Key Specs */}
        {specBullets.length > 0 && (
          <div className="mb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Key Specifications</p>
            <ul className="space-y-0.5">
              {specBullets.map((s, i) => (
                <li key={i} className="text-[11px] text-gray-700 flex items-start gap-1">
                  <span className="mt-1 w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
                  <span><span className="font-medium">{s.label}:</span> {s.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer */}
        <button
          onClick={onView}
          className="mt-auto w-full py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold tracking-wide transition-colors"
        >
          VIEW PRODUCT
        </button>
      </div>
    </div>
  );
}

// ─── End Helper Components ────────────────────────────────────────────────────

const initialItems: CatalogItem[] = [];

const auditLogs = [
  { event: 'New Item Added', detail: 'Apple MacBook Air M3', user: 'Annit Kumar', date: '26 Mar 2024 11:55 PM', status: 'Approved' },
  { event: 'Price Changed', detail: 'Sandisk 1TB SSD', user: 'Sakelti Gupta', date: '25 Mar 2024 2:50 PM', status: 'Approved' },
  { event: 'Deleted Item', detail: 'Formation Uptop', user: 'Rehul Verma', date: '16 Mar 2023 3:35 PM', status: 'Approved' },
  { event: 'Bulk Update', detail: 'CSV Catalog Accounts', user: 'Sakelti Gupta', date: '07 Mar 2023 2:50 PM', status: 'Approved' },
];

/** Single source of truth for the CSV column order used by both
 *  exportCatalogExcel (export) and downloadTemplate (blank import template). */
const CATALOGUE_CSV_HEADERS: string[] = [
  'Master Product Code', 'Product Name', 'SKU Code', 'Product Type', 'Physical Type',
  'Category', 'Subcategory', 'Brand',
  'Tags',          // semicolon-separated e.g. CoreEssentials;New Arrival
  'Description', 'Warranty', 'Video URL', 'Product Notes',
  'Price', 'MOQ', 'Lead Time', 'Publish Status',
  'KeySpec1_Name', 'KeySpec1_Value', 'KeySpec1_Unit',
  'KeySpec2_Name', 'KeySpec2_Value', 'KeySpec2_Unit',
  'KeySpec3_Name', 'KeySpec3_Value', 'KeySpec3_Unit',
  'KeySpec4_Name', 'KeySpec4_Value', 'KeySpec4_Unit',
  'KeySpec5_Name', 'KeySpec5_Value', 'KeySpec5_Unit',
  'KeySpec6_Name', 'KeySpec6_Value', 'KeySpec6_Unit',
  'KeySpec7_Name', 'KeySpec7_Value', 'KeySpec7_Unit',
  'KeySpec8_Name', 'KeySpec8_Value', 'KeySpec8_Unit',
  'GenSpec1_Category', 'GenSpec1_AttributeValue',
  'GenSpec2_Category', 'GenSpec2_AttributeValue',
  'GenSpec3_Category', 'GenSpec3_AttributeValue',
  'GenSpec4_Category', 'GenSpec4_AttributeValue',
  'GenSpec5_Category', 'GenSpec5_AttributeValue',
  'GenSpec6_Category', 'GenSpec6_AttributeValue',
  'GenSpec7_Category', 'GenSpec7_AttributeValue',
  'GenSpec8_Category', 'GenSpec8_AttributeValue',
  'Image1_URL', 'Image2_URL', 'Image3_URL', 'Image4_URL', 'Image5_URL',
];

const emptyItem: Omit<CatalogItem, 'id'> = {
  name: '', sku: '', category: '', subCategory: '', physicalType: 'Physical Product', brand: '', price: 0, status: 'In Stock',
  tags: [], initialStock: 50, minStockThreshold: 5, description: '', specification: '', warranty: '',
  hsnCode: '', dimensionL: '', dimensionW: '', dimensionH: '', dimUnit: 'cm', weight: '', weightUnit: 'kg',
  customsDeclaration: 'Exempt', primaryVendor: '', vendorSku: '', leadTime: '10 Days',
  vendorContact: '', vendorEmail: '', vendorPhone: '', vendorPhone2: '',
  trackPerformance: false, performanceRating: 4,
};

export default function CatalogUpdatesTab() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CatalogItem[]>(() => {
    const stored = getCatalogProducts().map(p => ({
      id: p.id,
      masterProductCode: p.masterProductCode,
      name: p.productName,
      sku: p.skuCode || p.masterProductCode,
      publishStatus: p.publishStatus,
      category: p.category,
      subCategory: p.subcategory,
      physicalType: p.physicalType?.trim() || 'Physical Product',
      brand: p.brand,
      price: p.price,
      status: 'In Stock' as const,
      tags: p.tags,
      initialStock: 0,
      minStockThreshold: 0,
      description: p.description,
      specification: '',
      warranty: p.warranty,
      hsnCode: '',
      dimensionL: '', dimensionW: '', dimensionH: '', dimUnit: 'cm', weight: '', weightUnit: 'kg',
      customsDeclaration: 'Exempt',
      primaryVendor: '', vendorSku: '', leadTime: p.leadTime,
      vendorContact: '', vendorEmail: '', vendorPhone: '', vendorPhone2: '',
      trackPerformance: false, performanceRating: 4,
      specifications: p.specifications || [],
      generalSpecs: p.generalSpecs || [],
      images: p.images || [],
      image: p.images?.[0] || undefined,
    }));
    return stored;
  });
  const [viewMode, setViewMode] = useState<'list' | 'thumbnail'>('list');
  const [thumbPage, setThumbPage] = useState(1);
  const [listPage, setListPage] = useState(1);
  const PAGE_SIZE = 20;
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Dialogs
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [viewItem, setViewItem] = useState<CatalogItem | null>(null);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [publishConfirmItem, setPublishConfirmItem] = useState<CatalogItem | null>(null);
  const [bulkPublishConfirmIds, setBulkPublishConfirmIds] = useState<string[]>([]);

  // Form state
  const [form, setForm] = useState<Omit<CatalogItem, 'id'>>(emptyItem);
  const [autoSku, setAutoSku] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [categories, setCategories] = useState<Record<string, string[]>>(defaultCategories);
  const [brands, setBrands] = useState<string[]>(defaultBrands);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [newSubCategoryInput, setNewSubCategoryInput] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [addingSubCategory, setAddingSubCategory] = useState(false);
  const [productImages, setProductImages] = useState<string[]>([]);

  const bulkFileRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const loadFromStore = () => {
    const stored = getCatalogProducts().map(p => ({
      id: p.id,
      masterProductCode: p.masterProductCode,
      name: p.productName,
      sku: p.skuCode || p.masterProductCode,
      publishStatus: p.publishStatus,
      category: p.category,
      subCategory: p.subcategory,
      physicalType: p.physicalType?.trim() || 'Physical Product',
      brand: p.brand,
      price: p.price,
      status: 'In Stock' as const,
      tags: p.tags,
      initialStock: 0,
      minStockThreshold: 0,
      description: p.description,
      specification: '',
      warranty: p.warranty,
      hsnCode: '',
      dimensionL: '', dimensionW: '', dimensionH: '', dimUnit: 'cm', weight: '', weightUnit: 'kg',
      customsDeclaration: 'Exempt',
      primaryVendor: '', vendorSku: '', leadTime: p.leadTime,
      vendorContact: '', vendorEmail: '', vendorPhone: '', vendorPhone2: '',
      trackPerformance: false, performanceRating: 4,
      specifications: p.specifications || [],
      generalSpecs: p.generalSpecs || [],
      images: p.images || [],
      image: p.images?.[0] || undefined,
    }));
    setItems(stored);
  };

  const openPreview = (id: string) => {
    const product = getCatalogProducts().find(p => p.id === id);
    if (!product) return;
    const draft = {
      masterProductCode: product.masterProductCode,
      skuCode: product.skuCode || product.masterProductCode,
      productName: product.productName,
      productType: product.productType || '',
      physicalType: product.physicalType || '',
      brand: product.brand,
      category: product.category,
      subcategory: product.subcategory,
      tags: product.tags || [],
      price: product.price,
      moq: product.moq,
      description: product.description,
      warranty: product.warranty || '',
      productNotes: product.productNotes || '',
      specifications: product.specifications || [],
      generalSpecs: product.generalSpecs || [],
      images: product.images || [],
      videoUrl: product.videoUrl || '',
      publishStatus: product.publishStatus,
      createdAt: new Date().toISOString(),
    };
    sessionStorage.setItem('nido_preview_draft', JSON.stringify(draft));
    navigate('/preview-product');
  };

  useEffect(() => {
    loadFromStore();
    window.addEventListener('catalogUpdated', loadFromStore);
    return () => window.removeEventListener('catalogUpdated', loadFromStore);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Stock': return 'bg-success text-success-foreground';
      case 'Low Stock': return 'bg-warning text-warning-foreground';
      case 'Out of Stock': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const filtered = items.filter(i => {
    if (i.publishStatus === 'archived') return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !i.sku.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && (i.publishStatus || 'draft') !== statusFilter) return false;
    if (brandFilter !== 'all' && i.brand !== brandFilter) return false;
    return true;
  });

  // Paginated slices (both views share PAGE_SIZE = 20)
  const listTotalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const listSafePage = Math.min(listPage, listTotalPages);
  const listItems = filtered.slice((listSafePage - 1) * PAGE_SIZE, listSafePage * PAGE_SIZE);

  const thumbTotalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const thumbSafePage = Math.min(thumbPage, thumbTotalPages);
  const thumbItems = filtered.slice((thumbSafePage - 1) * PAGE_SIZE, thumbSafePage * PAGE_SIZE);

  const stats = {
    total: items.filter(i => i.publishStatus !== 'archived').length,
    published: items.filter(i => i.publishStatus === 'published').length,
    drafts: items.filter(i => i.publishStatus === 'draft').length,
    pending: items.filter(i => i.publishStatus === 'pending').length,
    archived: items.filter(i => i.publishStatus === 'archived').length,
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleAll = () => {
    setSelectedIds(prev => prev.length === filtered.length ? [] : filtered.map(i => i.id));
  };

  const updateForm = (patch: Partial<Omit<CatalogItem, 'id'>>) => setForm(f => ({ ...f, ...patch }));

  const generateSku = () => {
    const prefix = form.category === 'IT Hardware' ? 'ITH' : form.category === 'Stationery' ? 'STN' : 'OFS';
    return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
  };

  const openAddDialog = () => {
    setForm(emptyItem);
    setEditingItem(null);
    setProductImages([]);
    setAutoSku(false);
    setAddDialogOpen(true);
  };

  const openEditDialog = (item: CatalogItem) => {
    setForm({ ...item });
    setEditingItem(item);
    setProductImages(item.image ? [item.image] : []);
    setAddDialogOpen(true);
  };

  const openViewDialog = (item: CatalogItem) => {
    setViewItem(item);
    setViewDialogOpen(true);
  };

  const handleAddItem = () => {
    if (!form.name.trim()) { toast.error('Item Name is required'); return; }
    if ((form.vendorPhone && !isValidPhoneNumber(form.vendorPhone)) ||
        (form.vendorPhone2 && !isValidPhoneNumber(form.vendorPhone2))) {
      toast.error('Vendor phone numbers must contain exactly 10 digits'); return;
    }
    const duplicate = findCatalogProductByName(form.name, editingItem?.id)
      || items.find(item =>
        item.id !== editingItem?.id &&
        normalizeCatalogProductName(item.name) === normalizeCatalogProductName(form.name)
      );
    if (duplicate) {
      toast.error(`Product duplication found: "${'productName' in duplicate ? duplicate.productName : duplicate.name}" already exists in the master catalog.`);
      return;
    }
    const sku = autoSku ? generateSku() : form.sku;
    if (!sku.trim()) { toast.error('SKU is required'); return; }

    const newItem: CatalogItem = {
      ...form,
      id: editingItem ? editingItem.id : Date.now().toString(),
      sku,
      image: productImages[0] || undefined,
    };

    if (editingItem) {
      setItems(prev => prev.map(i => i.id === editingItem.id ? newItem : i));
      toast.success('Item updated successfully');
    } else {
      setItems(prev => [...prev, newItem]);
      toast.success('Item added successfully');
    }
    setAddDialogOpen(false);
  };

  const archiveItem = (id: string) => {
    const item = items.find(i => i.id === id);
    if (item) setArchiveConfirmItem(item);
  };

  const confirmArchiveItem = () => {
    if (!archiveConfirmItem) return;
    const products = getCatalogProducts();
    const product = products.find(p => p.id === archiveConfirmItem.id);
    if (!product) return;
    saveCatalogProduct({ ...product, publishStatus: 'archived' });
    removeArchivedProductFromDownstream(product.id, product.masterProductCode);
    setItems(prev => prev.map(i => i.id === archiveConfirmItem.id ? { ...i, publishStatus: 'archived' as const } : i));
    toast.success(`"${archiveConfirmItem.name}" archived and removed from vendor & client lists`);
    setArchiveConfirmItem(null);
  };

  const applyItemStatus = (id: string, newStatus: 'draft' | 'published' | 'pending') => {
    const products = getCatalogProducts();
    const product = products.find(p => p.id === id);
    if (!product) return;
    const updated = { ...product, publishStatus: newStatus };
    saveCatalogProduct(updated);
    setItems(prev => prev.map(i => i.id === id ? { ...i, publishStatus: newStatus } : i));
    const label = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
    toast.success(newStatus === 'published' ? `"${product.productName}" published successfully` : `Status updated to ${label}`);
  };

  const updateItemStatus = (id: string, newStatus: 'draft' | 'published' | 'pending') => {
    if (newStatus === 'published') {
      const item = items.find(i => i.id === id);
      if (!item || item.publishStatus === 'published') return;
      setPublishConfirmItem(item);
      return;
    }
    applyItemStatus(id, newStatus);
  };

  const confirmPublishItem = () => {
    if (!publishConfirmItem) return;
    applyItemStatus(publishConfirmItem.id, 'published');
    setPublishConfirmItem(null);
  };

  const bulkUpdateStatus = (newStatus: 'draft' | 'published' | 'pending', ids = selectedIds) => {
    if (ids.length === 0) return;
    const products = getCatalogProducts();
    ids.forEach(id => {
      const product = products.find(p => p.id === id);
      if (product) saveCatalogProduct({ ...product, publishStatus: newStatus });
    });
    setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, publishStatus: newStatus } : i));
    const label = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
    toast.success(`${ids.length} item${ids.length > 1 ? 's' : ''} updated to ${label}`);
    setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
  };

  const requestBulkPublish = () => {
    const idsToPublish = selectedIds.filter(id => items.some(item => item.id === id && item.publishStatus !== 'published'));
    if (idsToPublish.length === 0) return;
    setBulkPublishConfirmIds(idsToPublish);
  };

  const confirmBulkPublish = () => {
    if (bulkPublishConfirmIds.length === 0) return;
    bulkUpdateStatus('published', bulkPublishConfirmIds);
    setBulkPublishConfirmIds([]);
  };

  const [bulkArchiveConfirmOpen, setBulkArchiveConfirmOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [archiveConfirmItem, setArchiveConfirmItem] = useState<CatalogItem | null>(null);

  const bulkArchiveItems = () => {
    if (selectedIds.length === 0) return;
    const products = getCatalogProducts();
    selectedIds.forEach(id => {
      const product = products.find(p => p.id === id);
      if (product) {
        saveCatalogProduct({ ...product, publishStatus: 'archived' });
        removeArchivedProductFromDownstream(product.id, product.masterProductCode);
      }
    });
    setItems(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, publishStatus: 'archived' as const } : i));
    toast.success(`${selectedIds.length} item${selectedIds.length > 1 ? 's' : ''} archived and removed from vendor & client lists`);
    setSelectedIds([]);
    setBulkArchiveConfirmOpen(false);
  };

  const unarchiveItem = (id: string) => {
    const products = getCatalogProducts();
    const product = products.find(p => p.id === id);
    if (!product) return;
    saveCatalogProduct({ ...product, publishStatus: 'draft' });
    setItems(prev => prev.map(i => i.id === id ? { ...i, publishStatus: 'draft' as const } : i));
    toast.success('Product restored to Draft');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setProductImages(prev => [...prev, ev.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Proper CSV row parser — handles quoted fields containing commas/newlines
  const parseCSVRow = (row: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"') {
        if (inQuotes && row[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        // Split preserving quoted newlines — simple approach: split on \n then re-join quoted blocks
        const rawLines = text.split(/\r?\n/);
        const lines: string[] = [];
        let buffer = '';
        for (const line of rawLines) {
          buffer += (buffer ? '\n' : '') + line;
          const quoteCount = (buffer.match(/"/g) || []).length;
          if (quoteCount % 2 === 0) { lines.push(buffer); buffer = ''; }
        }
        if (buffer) lines.push(buffer);
        const nonEmpty = lines.filter(l => l.trim());
        if (nonEmpty.length < 2) { toast.error('CSV must have a header row and at least one data row'); return; }

        const headers = parseCSVRow(nonEmpty[0]).map(h => h.replace(/^\uFEFF/, '').toLowerCase().replace(/\s+/g, ' ').trim());
        const col = (row: string[], key: string) => {
          const idx = headers.indexOf(key);
          return idx >= 0 ? row[idx] || '' : '';
        };
        const colAny = (row: string[], keys: string[]) => {
          for (const key of keys) {
            const value = col(row, key);
            if (value.trim()) return value;
          }
          return '';
        };

        let added = 0;
        let skippedDuplicates = 0;
        let skippedInvalid = 0;
        const existingNames = new Set(
          getCatalogProducts().map(product => normalizeCatalogProductName(product.productName))
        );

        for (let i = 1; i < nonEmpty.length; i++) {
          const row = parseCSVRow(nonEmpty[i]);
          const productName = colAny(row, ['product name', 'item name', 'name']).trim();
          if (!productName) {
            skippedInvalid++;
            continue;
          }

          // Check against both the existing catalog and earlier rows in this
          // same file. This keeps a mixed import from being misclassified and
          // prevents duplicate rows inside the upload from being added.
          const normalizedName = normalizeCatalogProductName(productName);
          if (existingNames.has(normalizedName)) {
            skippedDuplicates++;
            continue;
          }

          // Key Specifications — up to 8 sets
          const specifications = [];
          for (let s = 1; s <= 8; s++) {
            const name = col(row, `keyspec${s}_name`);
            const value = col(row, `keyspec${s}_value`);
            const unit = col(row, `keyspec${s}_unit`);
            if (name.trim()) {
              specifications.push({ id: `${Date.now()}-ks${s}-${i}`, specification: name, value, unit: unit || '-' });
            }
          }

          // General Specifications — up to 8 sets
          const generalSpecs = [];
          for (let g = 1; g <= 8; g++) {
            const category = col(row, `genspec${g}_category`);
            const attributeValue = col(row, `genspec${g}_attributevalue`);
            if (category.trim()) {
              generalSpecs.push({ id: `${Date.now()}-gs${g}-${i}`, category, attributeValue });
            }
          }

          // Images — up to 5 URL columns
          const images: string[] = [];
          for (let im = 1; im <= 5; im++) {
            const url = col(row, `image${im}_url`);
            if (url.trim()) images.push(url.trim());
          }

          // Tags — semicolon-separated
          const tagsRaw = col(row, 'tags');
          const tags = tagsRaw ? tagsRaw.split(';').map(t => t.trim()).filter(Boolean) : [];

          const product = {
            id: `csv-${Date.now()}-${i}`,
            masterProductCode: generateMasterProductCode(),
            skuCode: colAny(row, ['sku code', 'sku']),
            productName,
            productType: col(row, 'product type') || 'Product ',
            physicalType: col(row, 'physical type') || 'Physical Product',
            category: col(row, 'category'),
            subcategory: col(row, 'subcategory'),
            brand: col(row, 'brand'),
            tags,
            description: col(row, 'description'),
            specifications,
            generalSpecs,
            productNotes: col(row, 'product notes'),
            videoUrl: col(row, 'video url'),
            images,
            publishStatus: 'draft' as const,
            price: 0,
            moq: 0,
            leadTime: '',
            warranty: col(row, 'warranty'),
          };

          if (saveCatalogProduct(product)) {
             added++;
            existingNames.add(normalizedName);
           } else {
            // A concurrent update or a legacy record can still be caught by
            // the store-level guard; report it as a duplicate without
            // affecting the classification of other rows.
             skippedDuplicates++;
           }
        }

        if (added > 0) {
          loadFromStore();
          toast.success(`${added} product(s) imported as Draft. Review and publish when ready.`);
          if (skippedDuplicates > 0) {
            toast.warning(`${skippedDuplicates} duplicate product${skippedDuplicates === 1 ? '' : 's'} skipped.`);
          }
          if (skippedInvalid > 0) {
            toast.warning(`${skippedInvalid} row${skippedInvalid === 1 ? '' : 's'} skipped because Product Name is missing.`);
          }
          setBulkImportOpen(false);
        } else if (skippedDuplicates > 0) {
           loadFromStore();
          if (skippedInvalid > 0) {
            toast.warning(`No products imported: ${skippedDuplicates} duplicate${skippedDuplicates === 1 ? '' : 's'} skipped and ${skippedInvalid} row${skippedInvalid === 1 ? '' : 's'} missing Product Name.`);
          } else {
            toast.error(`No products imported: ${skippedDuplicates} duplicate product${skippedDuplicates === 1 ? '' : 's'} skipped.`);
          }
        } else {
          toast.error('No valid rows found. Ensure "Product Name" or "Item Name" column has values.');
        }
        // reset file input
        if (bulkFileRef.current) bulkFileRef.current.value = '';
      } catch (err) {
        console.error(err);
        toast.error('Failed to parse CSV file. Please use the downloaded template.');
      }
    };
    reader.readAsText(file);
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (!data.length) { toast.error('No data to export'); return; }
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(row => headers.map(h => `"${row[h] ?? ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filename} downloaded`);
  };

  const exportCatalogExcel = () => {
    const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const headers = CATALOGUE_CSV_HEADERS;

    const raw = getCatalogProducts().filter(product => product.publishStatus === 'published');
    if (!raw.length) {
      toast.error('No published products to export');
      return;
    }
    const dataRows = raw.map(p => {
      const specs = p.specifications || [];
      const gens = p.generalSpecs || [];
      const imgs = p.images || [];
      const row: (string | number)[] = [
        p.masterProductCode,
        p.productName,
        p.skuCode || p.masterProductCode,
        p.productType || '',
        p.physicalType || '',
        p.category,
        p.subcategory || '',
        p.brand,
        (p.tags || []).join(';'),
        p.description || '',
        p.warranty || '',
        p.videoUrl || '',
        p.productNotes || '',
        p.price,
        p.moq ?? '',
        p.leadTime || '',
        p.publishStatus,
      ];
      // KeySpecs (up to 8)
      for (let i = 0; i < 8; i++) {
        const s = specs[i];
        row.push(s ? s.specification : '', s ? s.value : '', s ? s.unit : '');
      }
      // GenSpecs (up to 8)
      for (let i = 0; i < 8; i++) {
        const g = gens[i];
        row.push(g ? g.category : '', g ? g.attributeValue : '');
      }
      // Images (up to 5)
      for (let i = 0; i < 5; i++) {
        row.push(imgs[i] || '');
      }
      return row.map(csvCell).join(',');
    });

    const csv = [headers.map(csvCell).join(','), ...dataRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'master-catalogue.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('master-catalogue.csv downloaded');
  };

  const exportCatalogPDF = () => {
    // Generate a simple printable HTML and open in new window for PDF save
    const rows = items.map(i => `<tr><td>${i.name}</td><td>${i.sku}</td><td>${i.category}</td><td>${i.brand}</td><td>₹${i.price.toLocaleString()}</td><td>${i.status}</td></tr>`).join('');
    const html = `<html><head><title>Master Catalogue</title><style>body{font-family:Arial,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5;font-weight:bold}h1{color:#333}</style></head><body><h1>Master Catalogue</h1><p>Exported on ${new Date().toLocaleDateString()}</p><table><thead><tr><th>Item Name</th><th>SKU</th><th>Category</th><th>Brand</th><th>Price</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); win.print(); }
    toast.success('PDF export opened for printing');
  };

  const exportAuditLogs = () => {
    exportToCSV(auditLogs.map(l => ({
      Event: l.event, Detail: l.detail, User: l.user, Date: l.date, Status: l.status,
    })), 'audit-logs.csv');
  };

  const downloadTemplate = () => {
    const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const escRow = (row: string[]) => row.map(csvCell).join(',');
    const csv = escRow(CATALOGUE_CSV_HEADERS);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nido-master-catalogue-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Template downloaded — fill it and use Bulk Import to upload');
  };

  const addTag = () => {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      updateForm({ tags: [...form.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => updateForm({ tags: form.tags.filter(t => t !== tag) });

  const addNewCategory = () => {
    if (newCategoryInput.trim() && !categories[newCategoryInput.trim()]) {
      setCategories(prev => ({ ...prev, [newCategoryInput.trim()]: [] }));
      updateForm({ category: newCategoryInput.trim(), subCategory: '' });
      setNewCategoryInput('');
      setAddingCategory(false);
      toast.success('Category added');
    }
  };

  const addNewSubCategory = () => {
    if (newSubCategoryInput.trim() && form.category) {
      setCategories(prev => ({
        ...prev,
        [form.category]: [...(prev[form.category] || []), newSubCategoryInput.trim()],
      }));
      updateForm({ subCategory: newSubCategoryInput.trim() });
      setNewSubCategoryInput('');
      setAddingSubCategory(false);
      toast.success('Sub-category added');
    }
  };

  const renderStars = (rating: number, onChange?: (r: number) => void) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          size={16}
          className={`${s <= rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'} ${onChange ? 'cursor-pointer' : ''}`}
          onClick={() => onChange?.(s)}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-6 bg-white p-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Master Catalogue</h2>
        <p className="text-sm text-gray-600 mt-1">Manage and register all products/services available for client contracts and downstream client-specific mapping.</p>
        <p className="text-xs text-gray-500 mt-1">Add items via "Add New Item" — drafts and published products appear here.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="border-0 cursor-pointer">
          <CardContent className="pt-4 pb-4 flex items-center gap-2 justify-center rounded-[10px]" style={{ backgroundColor: '#1a6fac' }}>
            <ShoppingCart size={18} className="text-white" />
            <span className="font-medium text-sm text-white">{stats.total} Total</span>
          </CardContent>
        </Card>
        <Card className="border-0 cursor-pointer">
          <CardContent className="pt-4 pb-4 flex items-center gap-2 justify-center rounded-[10px] text-white" style={{ backgroundColor: 'rgba(225, 86, 99, 0.98)' }}>
            <ShoppingCart size={18} />
            <span className="font-medium text-sm">{stats.published} Published</span>
          </CardContent>
        </Card>
        <Card className="bg-yellow-100 text-yellow-700 border-0 cursor-pointer hover:bg-yellow-200">
          <CardContent className="pt-4 pb-4 flex items-center gap-2 justify-center rounded-[10px]">
            <ShoppingCart size={18} />
            <span className="font-medium text-sm">{stats.drafts} Drafts</span>
          </CardContent>
        </Card>
        <Card className="border-0 cursor-pointer">
          <CardContent className="pt-4 pb-4 flex items-center gap-2 justify-center rounded-[10px] text-blue-700" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)' }}>
            <ShoppingCart size={18} />
            <span className="font-medium text-sm">{stats.pending} Pending</span>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-end gap-2">
        {/* View Toggle */}
        <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
            title="List view"
          >
            <LayoutList size={16} />
          </button>
          <button
            onClick={() => setViewMode('thumbnail')}
            className={`p-2 transition-colors ${viewMode === 'thumbnail' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
            title="Thumbnail view"
          >
            <LayoutGrid size={16} />
          </button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9 border-gray-300 text-gray-700 hover:bg-gray-100" data-testid="button-catalog-actions">
              <MoreVertical size={18} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => { sessionStorage.removeItem('nido_preview_draft'); navigate('/configuration/master-catalogue/add'); }} className="cursor-pointer">
              <Plus size={14} className="mr-2" />
              Add New Item
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportCatalogExcel} className="cursor-pointer">
              <FileDown size={14} className="mr-2" />
              Export CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setBulkImportOpen(true)} className="cursor-pointer">
              <Upload size={14} className="mr-2" />
              Bulk Import
            </DropdownMenuItem>
            <DropdownMenuItem onClick={downloadTemplate} className="cursor-pointer">
              <Download size={14} className="mr-2" />
              Download Template
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setArchivedOpen(true)} className="cursor-pointer text-gray-600">
              <Archive size={14} className="mr-2" />
              Archived Products {stats.archived > 0 && <span className="ml-auto text-xs bg-gray-200 text-gray-600 rounded-full px-1.5">{stats.archived}</span>}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-lg px-2 py-2.5">
          <span className="text-sm font-medium text-blue-900" data-testid="text-selected-count">
            {selectedIds.length} product{selectedIds.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 bg-white border-gray-300" data-testid="button-bulk-status">
                  <CheckCircle size={14} /> Update Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={requestBulkPublish} className="cursor-pointer" data-testid="menuitem-bulk-published">
                  <CheckCircle size={14} className="mr-2 text-green-600" /> Published
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => bulkUpdateStatus('pending')} className="cursor-pointer" data-testid="menuitem-bulk-pending">
                  <Clock size={14} className="mr-2 text-blue-600" /> Pending
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => bulkUpdateStatus('draft')} className="cursor-pointer" data-testid="menuitem-bulk-draft">
                  <FileEdit size={14} className="mr-2 text-yellow-600" /> Draft
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 bg-white border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setBulkArchiveConfirmOpen(true)}
              data-testid="button-bulk-archive"
            >
              <Archive size={14} /> Archive
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-600 hover:bg-gray-100"
              onClick={() => setSelectedIds([])}
              data-testid="button-clear-selection"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Product List / Thumbnail View */}
      {viewMode === 'list' ? (
        <Card className="border-gray-200">
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 bg-gray-50">
                  <TableHead className="w-10 pl-4">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 cursor-pointer"
                      checked={filtered.length > 0 && selectedIds.length === filtered.length}
                      onChange={toggleAll}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead className="text-gray-700 font-semibold uppercase text-xs">Item Name</TableHead>
                  <TableHead className="text-gray-700 font-semibold uppercase text-xs">Master Product Code</TableHead>
                  <TableHead className="text-gray-700 font-semibold uppercase text-xs">SKU</TableHead>
                  <TableHead className="text-gray-700 font-semibold uppercase text-xs">Product Type</TableHead>
                  <TableHead className="text-gray-700 font-semibold uppercase text-xs">Category</TableHead>
                  <TableHead className="text-gray-700 font-semibold uppercase text-xs">Brand</TableHead>
                  <TableHead className="text-gray-700 font-semibold uppercase text-xs">Status</TableHead>
                  <TableHead className="text-gray-700 font-semibold uppercase text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-2 text-gray-600">
                      No items match the selected filters. Adjust search, category, or status to view catalog entries.
                    </TableCell>
                  </TableRow>
                ) : (
                  listItems.map(item => (
                    <TableRow
                      key={item.id}
                      className="border-gray-200 hover:bg-blue-50 cursor-pointer"
                      onClick={() => openPreview(item.id)}
                      data-testid={`row-product-${item.id}`}
                    >
                      <TableCell className="pl-4" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 cursor-pointer"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          data-testid={`checkbox-product-${item.id}`}
                        />
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-16 rounded-lg border border-gray-200 bg-white flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-contain p-1.5"
                              />
                            ) : (
                              <ImageIcon size={24} className="text-gray-300" />
                            )}
                          </div>
                          <span className="font-medium text-sm">{item.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-gray-600">{item.masterProductCode || '—'}</TableCell>
                      <TableCell className="text-xs text-gray-600">{item.sku}</TableCell>
                      <TableCell className="text-sm text-gray-700">{item.physicalType || 'Physical Product'}</TableCell>
                      <TableCell className="text-sm text-gray-700">{item.category}</TableCell>
                      <TableCell className="text-sm text-gray-700">{item.brand}</TableCell>
                      <TableCell>
                        {item.publishStatus ? (
                          <PublishStatusBadge status={item.publishStatus} />
                        ) : (
                          <Badge className={`${getStatusColor(item.status)} border-none text-xs`}>{item.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <ProductActionsMenu
                          item={item}
                          onEdit={() => navigate(`/configuration/master-catalogue/edit/${item.id}`)}
                          onArchive={() => archiveItem(item.id)}
                          onStatusChange={(s) => updateItemStatus(item.id, s)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between mt-4 text-xs text-gray-600">
              <span>
                {selectedIds.length > 0 ? `${selectedIds.length} selected · ` : ''}
                Showing {filtered.length === 0 ? 0 : (listSafePage - 1) * PAGE_SIZE + 1}–{Math.min(listSafePage * PAGE_SIZE, filtered.length)} of {filtered.length} entries
              </span>
              {listTotalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setListPage(p => Math.max(1, p - 1))}
                    disabled={listSafePage === 1}
                    className="px-2.5 py-1 rounded border border-gray-300 bg-white disabled:opacity-40 hover:bg-gray-100 transition-colors"
                  >
                    ‹ Prev
                  </button>
                  {Array.from({ length: listTotalPages }, (_, i) => i + 1).map(pg => (
                    <button
                      key={pg}
                      onClick={() => setListPage(pg)}
                      className={`w-7 h-7 rounded border text-xs transition-colors ${pg === listSafePage ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 bg-white hover:bg-gray-100'}`}
                    >
                      {pg}
                    </button>
                  ))}
                  <button
                    onClick={() => setListPage(p => Math.min(listTotalPages, p + 1))}
                    disabled={listSafePage === listTotalPages}
                    className="px-2.5 py-1 rounded border border-gray-300 bg-white disabled:opacity-40 hover:bg-gray-100 transition-colors"
                  >
                    Next ›
                  </button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Thumbnail Grid View */
        <div>
          {filtered.length === 0 ? (
            <Card className="border-gray-200">
              <CardContent className="py-12 text-center text-gray-600">
                No items match the selected filters. Adjust search, category, or status to view catalog entries.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {thumbItems.map(item => (
                <ProductThumbnailCard
                  key={item.id}
                  item={item}
                  onView={() => openPreview(item.id)}
                  onEdit={() => navigate(`/configuration/master-catalogue/edit/${item.id}`)}
                  onArchive={() => archiveItem(item.id)}
                  onStatusChange={(s) => updateItemStatus(item.id, s)}
                />
              ))}
            </div>
          )}

          {/* Pagination bar */}
          <div className="mt-4 flex items-center justify-between text-xs text-gray-600">
            <span>
              Showing {filtered.length === 0 ? 0 : (thumbSafePage - 1) * PAGE_SIZE + 1}–{Math.min(thumbSafePage * PAGE_SIZE, filtered.length)} of {filtered.length} products
            </span>
            {thumbTotalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setThumbPage(p => Math.max(1, p - 1))}
                  disabled={thumbSafePage === 1}
                  className="px-2.5 py-1 rounded border border-gray-300 bg-white disabled:opacity-40 hover:bg-gray-100 transition-colors"
                >
                  ‹ Prev
                </button>
                {Array.from({ length: thumbTotalPages }, (_, i) => i + 1).map(pg => (
                  <button
                    key={pg}
                    onClick={() => setThumbPage(pg)}
                    className={`w-7 h-7 rounded border text-xs transition-colors ${pg === thumbSafePage ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 bg-white hover:bg-gray-100'}`}
                  >
                    {pg}
                  </button>
                ))}
                <button
                  onClick={() => setThumbPage(p => Math.min(thumbTotalPages, p + 1))}
                  disabled={thumbSafePage === thumbTotalPages}
                  className="px-2.5 py-1 rounded border border-gray-300 bg-white disabled:opacity-40 hover:bg-gray-100 transition-colors"
                >
                  Next ›
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approval & Audit Logs */}
      <Card className="w-full min-w-0 border-gray-200">
        <CardHeader className="flex flex-col items-start gap-3 border-b border-gray-200 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-semibold">Approval &amp; Audit Logs</CardTitle>
          <Button variant="outline" size="sm" className="gap-2 border-gray-300 text-gray-700 hover:bg-gray-100" onClick={exportAuditLogs}><Download size={14} /> Export</Button>
        </CardHeader>
        <CardContent className="min-w-0 overflow-x-auto pt-6">
          <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="border-gray-200 bg-gray-50">
                  <TableHead className="text-gray-700 font-semibold uppercase text-xs">Event</TableHead>
                  <TableHead className="text-gray-700 font-semibold uppercase text-xs">User</TableHead>
                  <TableHead className="text-gray-700 font-semibold uppercase text-xs">Date</TableHead>
                  <TableHead className="text-gray-700 font-semibold uppercase text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log, i) => (
                  <TableRow key={i} className="border-gray-200 hover:bg-gray-50">
                    <TableCell>
                      <p className="text-sm font-medium">{log.event}</p>
                      <p className="text-xs text-muted-foreground">{log.detail}</p>
                    </TableCell>
                    <TableCell className="text-sm">{log.user}</TableCell>
                    <TableCell className="text-xs">{log.date}</TableCell>
                    <TableCell><Badge className="bg-success text-success-foreground border-none">{log.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Publish Confirmation Dialog */}
      <Dialog open={!!publishConfirmItem} onOpenChange={(open) => { if (!open) setPublishConfirmItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle size={18} className="text-green-600" /> Publish Product?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-700">
            Are you sure you want to publish <span className="font-semibold">"{publishConfirmItem?.name}"</span>?
          </p>
          <p className="text-sm text-gray-500">
            This will change the product status to Published.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishConfirmItem(null)}>Cancel</Button>
            <Button
              data-confirmation-skip=""
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={confirmPublishItem}
            >
              <CheckCircle size={14} className="mr-2" /> Publish Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Publish Confirmation Dialog */}
      <Dialog open={bulkPublishConfirmIds.length > 0} onOpenChange={(open) => { if (!open) setBulkPublishConfirmIds([]); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Publish {bulkPublishConfirmIds.length} selected product{bulkPublishConfirmIds.length === 1 ? '' : 's'}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Confirm that these products should change to Published:
          </p>
          <div className="max-h-40 overflow-y-auto rounded-md border bg-gray-50 px-3 py-2">
            <ul className="space-y-1 text-sm text-gray-800">
              {bulkPublishConfirmIds.map(id => {
                const item = items.find(candidate => candidate.id === id);
                return item ? <li key={id}>{item.name}</li> : null;
              })}
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkPublishConfirmIds([])}>Cancel</Button>
            <Button
              data-confirmation-skip=""
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={confirmBulkPublish}
            >
              <CheckCircle size={14} className="mr-2" /> Publish Products
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Archive Confirmation Dialog */}
      <Dialog open={!!archiveConfirmItem} onOpenChange={(open) => { if (!open) setArchiveConfirmItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive size={18} className="text-gray-500" /> Archive Product?
            </DialogTitle>
          </DialogHeader>
          <div className="py-1">
            <p className="text-sm text-gray-700">
              Are you sure you want to archive <span className="font-semibold">"{archiveConfirmItem?.name}"</span>?
            </p>
            <p className="text-sm text-gray-400 mt-2">
              This product will be hidden from the active catalogue. You can restore it anytime from <span className="font-medium text-gray-500">Archived Products</span>.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveConfirmItem(null)}>Cancel</Button>
            <Button className="bg-gray-700 hover:bg-gray-800 text-white" onClick={confirmArchiveItem}>
              <Archive size={14} className="mr-2" /> Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Archive Confirmation Dialog */}
      <Dialog open={bulkArchiveConfirmOpen} onOpenChange={setBulkArchiveConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Archive {selectedIds.length} product{selectedIds.length > 1 ? 's' : ''}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            The selected product{selectedIds.length > 1 ? 's' : ''} will be archived and hidden from the main catalogue. You can restore them from the Archived Products view.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkArchiveConfirmOpen(false)}>Cancel</Button>
            <Button className="bg-gray-700 hover:bg-gray-800 text-white" onClick={bulkArchiveItems}><Archive size={14} className="mr-2" />Archive</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archived Products — full-screen overlay */}
      {archivedOpen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                <Archive size={18} className="text-gray-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800 leading-tight">
                  Archived Products
                  <span className="ml-2 text-base font-normal text-gray-400">({stats.archived} product{stats.archived !== 1 ? 's' : ''})</span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Hidden from the active catalogue. Use "Restore" to move a product back to Draft.</p>
              </div>
            </div>
            <button
              onClick={() => setArchivedOpen(false)}
              className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto px-6 py-6">
            {stats.archived === 0 ? (
              <div className="py-32 text-center text-gray-400">
                <Archive size={56} className="mx-auto mb-4 opacity-25" />
                <p className="text-lg font-medium">No archived products yet.</p>
                <p className="text-sm mt-1">Archived products will appear here.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b border-gray-200">
                    <TableHead className="text-sm font-semibold text-gray-600 py-3 min-w-[280px]">Product</TableHead>
                    <TableHead className="text-sm font-semibold text-gray-600 py-3 min-w-[130px]">Master Code</TableHead>
                    <TableHead className="text-sm font-semibold text-gray-600 py-3 min-w-[120px]">SKU</TableHead>
                    <TableHead className="text-sm font-semibold text-gray-600 py-3 min-w-[130px]">Category</TableHead>
                    <TableHead className="text-sm font-semibold text-gray-600 py-3 min-w-[130px]">Sub-Category</TableHead>
                    <TableHead className="text-sm font-semibold text-gray-600 py-3 min-w-[120px]">Brand</TableHead>
                    <TableHead className="text-sm font-semibold text-gray-600 py-3 min-w-[100px]">Price</TableHead>
                    <TableHead className="text-sm font-semibold text-gray-600 py-3 min-w-[180px]">Tags</TableHead>
                    <TableHead className="text-sm font-semibold text-gray-600 py-3 min-w-[100px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.filter(i => i.publishStatus === 'archived').map(item => (
                    <TableRow key={item.id} className="hover:bg-gray-50 border-b border-gray-100">
                      <TableCell className="py-4">
                        <div className="flex items-start gap-4">
                          {item.images?.[0] ? (
                            <img src={item.images[0]} alt={item.name} className="w-16 h-16 rounded-xl object-cover border border-gray-200 flex-shrink-0" />
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <ImageIcon size={24} className="text-gray-300" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800 leading-snug">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-gray-400 mt-1 leading-relaxed">{item.description}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-sm font-mono text-gray-600 align-top">{item.masterProductCode || '—'}</TableCell>
                      <TableCell className="py-4 text-sm text-gray-600 align-top">{item.sku || '—'}</TableCell>
                      <TableCell className="py-4 text-sm text-gray-700 align-top">{item.category || '—'}</TableCell>
                      <TableCell className="py-4 text-sm text-gray-700 align-top">{item.subCategory || '—'}</TableCell>
                      <TableCell className="py-4 text-sm text-gray-700 align-top">{item.brand || '—'}</TableCell>
                      <TableCell className="py-4 text-sm font-semibold text-gray-800 align-top">₹{(item.price || 0).toLocaleString()}</TableCell>
                      <TableCell className="py-4 align-top">
                        {item.tags?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.tags.map(tag => (
                              <span key={tag} className="text-[11px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{tag}</span>
                            ))}
                          </div>
                        ) : <span className="text-sm text-gray-400">—</span>}
                      </TableCell>
                      <TableCell className="py-4 align-top">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs h-8 border-gray-300 text-gray-600 hover:bg-gray-50 whitespace-nowrap"
                          onClick={() => unarchiveItem(item.id)}
                        >
                          <ArchiveRestore size={13} /> Restore
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      )}

      {/* Bulk Import Dialog */}
      <Dialog open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Bulk Import Items</DialogTitle></DialogHeader>
          <div className="text-center p-2 border-2 border-dashed border-border rounded-lg">
            <Upload size={32} className="mx-auto text-primary mb-3" />
            <p className="text-sm font-medium mb-1">Upload CSV File</p>
            <p className="text-xs text-muted-foreground mb-3">CSV must have headers: Item Name, SKU, Category, Brand, Price, Status</p>
            <input ref={bulkFileRef} type="file" accept=".csv" className="hidden" onChange={handleBulkImport} />
            <Button onClick={() => bulkFileRef.current?.click()}>Select CSV File</Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkImportOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Item Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Item Details</DialogTitle></DialogHeader>
          {viewItem && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-muted-foreground">Name</Label><p className="font-medium">{viewItem.name}</p></div>
                <div><Label className="text-muted-foreground">SKU</Label><p>{viewItem.sku}</p></div>
                <div><Label className="text-muted-foreground">Category</Label><p>{viewItem.category}</p></div>
                <div><Label className="text-muted-foreground">Brand</Label><p>{viewItem.brand}</p></div>
                <div><Label className="text-muted-foreground">Price</Label><p>₹{viewItem.price.toLocaleString()}</p></div>
                <div><Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    {viewItem.publishStatus ? (
                      <PublishStatusBadge status={viewItem.publishStatus} />
                    ) : (
                      <Badge className={`${getStatusColor(viewItem.status)} border-none`}>{viewItem.status}</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setViewDialogOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Item Dialog - Full Screen */}
      {addDialogOpen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">
          <div className="sticky top-0 bg-white border-b p-2 flex items-center justify-between flex-shrink-0">
            <h2 className="text-2xl font-bold">{editingItem ? 'Edit Item' : 'Add New Item'}</h2>
            <button onClick={() => setAddDialogOpen(false)} className="text-slate-500 hover:text-slate-700 flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-6xlpx-2 py-6">
              <div className="space-y-6 pb-32">
              {/* General Details + Category */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm border-b pb-1">General Details</h3>
                  <div>
                    <Label>Item Name <span className="text-destructive">*</span></Label>
                    <Input placeholder="e.g., Apple MacBook Air M3" value={form.name} onChange={e => updateForm({ name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Brand</Label>
                    <Select value={form.brand} onValueChange={v => updateForm({ brand: v })}>
                      <SelectTrigger><SelectValue placeholder="Select Brand" /></SelectTrigger>
                      <SelectContent>
                        {brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Label>SKU <span className="text-destructive">*</span></Label>
                      <div className="flex items-center gap-1 ml-auto">
                        <Checkbox checked={autoSku} onCheckedChange={v => setAutoSku(!!v)} id="autoSku" />
                        <Label htmlFor="autoSku" className="text-xs">Auto-Generate</Label>
                      </div>
                    </div>
                    <Input placeholder="e.g., LAP-1002" value={autoSku ? '(auto)' : form.sku} disabled={autoSku} onChange={e => updateForm({ sku: e.target.value })} />
                  </div>
                  <div>
                    <Label>Short Description</Label>
                    <Textarea placeholder="Brief product description" value={form.description || ''} onChange={e => updateForm({ description: e.target.value })} className="min-h-[60px]" />
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-sm border-b pb-1">Category & Classification</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Category</Label>
                      {addingCategory ? (
                        <div className="flex gap-1">
                          <Input value={newCategoryInput} onChange={e => setNewCategoryInput(e.target.value)} placeholder="New category" className="h-9" />
                          <Button size="sm" onClick={addNewCategory}>Add</Button>
                          <Button size="sm" variant="ghost" onClick={() => setAddingCategory(false)}>✕</Button>
                        </div>
                      ) : (
                        <Select value={form.category} onValueChange={v => { if (v === '__add__') { setAddingCategory(true); } else { updateForm({ category: v, subCategory: '' }); } }}>
                          <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                          <SelectContent>
                            {Object.keys(categories).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            <SelectItem value="__add__"><span className="text-primary">+ Add Category</span></SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div>
                      <Label>Sub-category</Label>
                      {addingSubCategory ? (
                        <div className="flex gap-1">
                          <Input value={newSubCategoryInput} onChange={e => setNewSubCategoryInput(e.target.value)} placeholder="New sub-cat" className="h-9" />
                          <Button size="sm" onClick={addNewSubCategory}>Add</Button>
                          <Button size="sm" variant="ghost" onClick={() => setAddingSubCategory(false)}>✕</Button>
                        </div>
                      ) : (
                        <Select value={form.subCategory} onValueChange={v => { if (v === '__add__') { setAddingSubCategory(true); } else { updateForm({ subCategory: v }); } }}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {(categories[form.category] || []).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            <SelectItem value="__add__"><span className="text-primary">+ Add Sub-category</span></SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>Tags</Label>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {form.tags.map(t => (
                        <Badge key={t} variant="secondary" className="gap-1">{t}<X size={10} className="cursor-pointer" onClick={() => removeTag(t)} /></Badge>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <Input placeholder="Tags..." value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} className="h-8" />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {defaultTags.filter(t => !form.tags.includes(t)).map(t => (
                        <Badge key={t} variant="outline" className="cursor-pointer text-xs" onClick={() => updateForm({ tags: [...form.tags, t] })}>{t}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing & Inventory */}
              <div>
                <h3 className="font-semibold text-sm border-b pb-1 mb-3">Inventory</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Inventory Status</Label>
                    <Select value={form.status} onValueChange={v => updateForm({ status: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="In Stock">In Stock</SelectItem>
                        <SelectItem value="Low Stock">Low Stock</SelectItem>
                        <SelectItem value="Out of Stock">Out of Stock</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Initial Stock Quantity</Label>
                    <Input type="number" value={form.initialStock} onChange={e => updateForm({ initialStock: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label>Minimum Stock Threshold</Label>
                    <Input type="number" value={form.minStockThreshold} onChange={e => updateForm({ minStockThreshold: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
              </div>

              {/* Product Specifics & Media */}
              <div>
                <h3 className="font-semibold text-sm border-b pb-1 mb-3">Product Specifics & Media</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <Label>Detailed Specification</Label>
                      <Textarea placeholder="Rich Text Editor or long-text area" value={form.specification || ''} onChange={e => updateForm({ specification: e.target.value })} />
                    </div>
                    <div>
                      <Label>Warranty Information (for internal use)</Label>
                      <Textarea placeholder="Enter private notes or additional detail..." value={form.warranty || ''} onChange={e => updateForm({ warranty: e.target.value })} className="min-h-[60px]" />
                    </div>
                  </div>
                  <div>
                    <Label>Add Image</Label>
                    <div
                      className="border-2 border-dashed border-border rounded-lg p-2 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => imageInputRef.current?.click()}
                    >
                      <ImageIcon size={24} className="mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm">Click to Upload or Drag Images</p>
                    </div>
                    <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                    {productImages.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {productImages.map((img, i) => (
                          <div key={i} className="relative w-16 h-16 rounded overflow-hidden border">
                            <img src={img} alt="" className="w-full h-full object-cover" />
                            <button className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl p-0.5" onClick={() => setProductImages(prev => prev.filter((_, idx) => idx !== i))}>
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                        <div className="w-16 h-16 border-2 border-dashed border-border rounded flex items-center justify-center cursor-pointer hover:bg-muted/50" onClick={() => imageInputRef.current?.click()}>
                          <Plus size={16} className="text-muted-foreground" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Logistics & Customs */}
              <div>
                <h3 className="font-semibold text-sm border-b pb-1 mb-3">Logistics & Customs</h3>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <Label>HSN/SAC Code</Label>
                    <Input placeholder="84713010" value={form.hsnCode || ''} onChange={e => updateForm({ hsnCode: e.target.value })} />
                  </div>
                  <div>
                    <Label>Dimensions</Label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs">L</span><Input className="w-12 h-8" value={form.dimensionL || ''} onChange={e => updateForm({ dimensionL: e.target.value })} />
                      <span className="text-xs">W</span><Input className="w-12 h-8" value={form.dimensionW || ''} onChange={e => updateForm({ dimensionW: e.target.value })} />
                      <span className="text-xs">H</span><Input className="w-12 h-8" value={form.dimensionH || ''} onChange={e => updateForm({ dimensionH: e.target.value })} />
                      <Select value={form.dimUnit || 'cm'} onValueChange={v => updateForm({ dimUnit: v })}>
                        <SelectTrigger className="w-16 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="cm">cm</SelectItem><SelectItem value="in">in</SelectItem><SelectItem value="mm">mm</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Shipping Weight</Label>
                    <div className="flex items-center gap-1">
                      <Input value={form.weight || ''} onChange={e => updateForm({ weight: e.target.value })} className="h-8" />
                      <Select value={form.weightUnit || 'kg'} onValueChange={v => updateForm({ weightUnit: v })}>
                        <SelectTrigger className="w-16 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="kg">kg</SelectItem><SelectItem value="lb">lb</SelectItem><SelectItem value="g">g</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Customs Declaration</Label>
                    <Select value={form.customsDeclaration || 'Exempt'} onValueChange={v => updateForm({ customsDeclaration: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{customsOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Vendor & Sourcing */}
              <div>
                <h3 className="font-semibold text-sm border-b pb-1 mb-3">Vendor & Sourcing</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Primary Vendor</Label>
                    <Select value={form.primaryVendor || ''} onValueChange={v => updateForm({ primaryVendor: v })}>
                      <SelectTrigger><SelectValue placeholder="Select Vendor" /></SelectTrigger>
                      <SelectContent>{defaultVendors.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Vendor SKU (optional)</Label>
                    <Input placeholder="V-HP-MB-M3" value={form.vendorSku || ''} onChange={e => updateForm({ vendorSku: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Vendor Contact */}
              <div>
                <h3 className="font-semibold text-sm border-b pb-1 mb-3">Vendor Contact</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Vendor Contact Person</Label>
                    <Input placeholder="Annit Kumar" value={form.vendorContact || ''} onChange={e => updateForm({ vendorContact: e.target.value })} />
                  </div>
                  <div>
                    <Label>Vendor Email</Label>
                    <Input placeholder="a.kumar@hpd.com" value={form.vendorEmail || ''} onChange={e => updateForm({ vendorEmail: e.target.value })} />
                  </div>
                  <div>
                    <Label>Vendor Phone</Label>
                    <Input type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit phone number" value={form.vendorPhone || ''} onChange={e => updateForm({ vendorPhone: sanitizePhoneNumber(e.target.value) })} />
                  </div>
                  <div>
                    <Label>Vendor Phone</Label>
                    <Input type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit phone number" value={form.vendorPhone2 || ''} onChange={e => updateForm({ vendorPhone2: sanitizePhoneNumber(e.target.value) })} />
                  </div>
                </div>
              </div>

              {/* Track Vendor Performance */}
              <div>
                <h3 className="font-semibold text-sm border-b pb-1 mb-3">Track Vendor Performance</h3>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Label>Track Performance</Label>
                    <Switch checked={form.trackPerformance || false} onCheckedChange={v => updateForm({ trackPerformance: v })} />
                    <span className="text-xs">{form.trackPerformance ? 'ON' : 'OFF'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label>Performance Rating (1-5 stars)</Label>
                    {renderStars(form.performanceRating || 4, r => updateForm({ performanceRating: r }))}
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
          <div className="bg-white border-t p-2 flex justify-end gap-2 flex-shrink-0">
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddItem}>Save Item</Button>
          </div>
        </div>
      )}
    </div>
  );
}
