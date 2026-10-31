import React, { useState, useRef } from 'react';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { sanitizePhoneNumber, isValidPhoneNumber } from '@/lib/phoneValidation';
import {
  Plus, Search, Upload, FileDown, FileText, Pencil, Eye, Trash2,
  Settings, ShoppingCart, X, Star, Image as ImageIcon, Download
} from 'lucide-react';

interface CatalogItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  subCategory: string;
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
}

const defaultCategories: Record<string, string[]> = {
  'IT Hardware': ['Laptops', 'Desktops', 'Monitors', 'Peripherals', 'Storage', 'Networking'],
  'Stationery': ['Paper', 'Writing', 'Filing', 'Desk Accessories'],
  'Office Supplies': ['Furniture', 'Cleaning', 'Pantry', 'Safety'],
};

const defaultBrands = ['HP', 'Sandisk', 'Logitech', 'Apple', 'Epson', 'Dell', 'Lenovo', 'Samsung'];
const defaultVendors = ['HP Direct', 'Sandisk Global', 'Epson Hub', 'Apple Store B2B', 'Dell Enterprise'];
const leadTimeOptions = ['10 Days', '1 Month', 'On Backorder', 'TBD'];
const customsOptions = ['Exempt', 'Taxable', 'Restricted'];
const defaultTags = ['CoreEssentials', 'New Arrival', 'High-End', 'Budget', 'Eco-Friendly'];

const initialItems: CatalogItem[] = [
  { id: '1', name: 'HP Envy Laptop', sku: 'LAP-1001', category: 'IT Hardware', subCategory: 'Laptops', brand: 'HP', price: 80000, status: 'In Stock', tags: ['CoreEssentials'], initialStock: 50, minStockThreshold: 5 },
  { id: '2', name: 'Sandisk 1TB SSD', sku: 'SSD-2025', category: 'IT Hardware', subCategory: 'Storage', brand: 'Sandisk', price: 12000, status: 'Low Stock', tags: ['High-End'], initialStock: 12, minStockThreshold: 5 },
  { id: '3', name: 'Logitech Wireless Mouse', sku: 'MOU-3301', category: 'IT Hardware', subCategory: 'Peripherals', brand: 'Logitech', price: 1000, status: 'In Stock', tags: [], initialStock: 200, minStockThreshold: 20 },
  { id: '4', name: 'Apple iPad Air', sku: 'TAB-1110', category: 'IT Hardware', subCategory: 'Laptops', brand: 'Apple', price: 450, status: 'Low Stock', tags: ['New Arrival'], initialStock: 8, minStockThreshold: 3 },
  { id: '5', name: 'Epson Workforce Printer', sku: 'PRN-3215', category: 'Stationery', subCategory: 'Paper', brand: 'Epson', price: 62000, status: 'Out of Stock', tags: [], initialStock: 0, minStockThreshold: 2 },
];

const auditLogs = [
  { event: 'New Item Added', detail: 'Apple MacBook Air M3', user: 'Annit Kumar', date: '26 Mar 2024 11:55 PM', status: 'Approved' },
  { event: 'Price Changed', detail: 'Sandisk 1TB SSD', user: 'Sakelti Gupta', date: '25 Mar 2024 2:50 PM', status: 'Approved' },
  { event: 'Deleted Item', detail: 'Formation Uptop', user: 'Rehul Verma', date: '16 Mar 2023 3:35 PM', status: 'Approved' },
  { event: 'Bulk Update', detail: 'CSV Catalog Accounts', user: 'Sakelti Gupta', date: '07 Mar 2023 2:50 PM', status: 'Approved' },
];

const emptyItem: Omit<CatalogItem, 'id'> = {
  name: '', sku: '', category: '', subCategory: '', brand: '', price: 0, status: 'In Stock',
  tags: [], initialStock: 50, minStockThreshold: 5, description: '', specification: '', warranty: '',
  hsnCode: '', dimensionL: '', dimensionW: '', dimensionH: '', dimUnit: 'cm', weight: '', weightUnit: 'kg',
  customsDeclaration: 'Exempt', primaryVendor: '', vendorSku: '', leadTime: '10 Days',
  vendorContact: '', vendorEmail: '', vendorPhone: '', vendorPhone2: '',
  trackPerformance: false, performanceRating: 4,
};

export default function CatalogUpdatesTab() {
  const [items, setItems] = useState<CatalogItem[]>(initialItems);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Stock': return 'bg-success text-success-foreground';
      case 'Low Stock': return 'bg-warning text-warning-foreground';
      case 'Out of Stock': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const filtered = items.filter(i => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !i.sku.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    if (brandFilter !== 'all' && i.brand !== brandFilter) return false;
    return true;
  });

  const stats = {
    total: items.length,
    inStock: items.filter(i => i.status === 'In Stock').length,
    lowStock: items.filter(i => i.status === 'Low Stock').length,
    outOfStock: items.filter(i => i.status === 'Out of Stock').length,
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

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success('Item deleted');
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

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) { toast.error('CSV must have a header row and at least one data row'); return; }
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        let added = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim());
          const nameIdx = headers.indexOf('item name');
          const skuIdx = headers.indexOf('sku');
          const catIdx = headers.indexOf('category');
          const brandIdx = headers.indexOf('brand');
          const priceIdx = headers.indexOf('price');
          const statusIdx = headers.indexOf('status');
          if (nameIdx === -1 || skuIdx === -1) continue;
          const newItem: CatalogItem = {
            id: Date.now().toString() + i,
            name: cols[nameIdx] || '',
            sku: cols[skuIdx] || '',
            category: cols[catIdx] || 'IT Hardware',
            subCategory: '',
            brand: cols[brandIdx] || '',
            price: parseFloat(cols[priceIdx]) || 0,
            status: (cols[statusIdx] as any) || 'In Stock',
            tags: [],
            initialStock: 50,
            minStockThreshold: 5,
          };
          if (newItem.name && newItem.sku) {
            setItems(prev => [...prev, newItem]);
            added++;
          }
        }
        toast.success(`${added} item(s) imported successfully`);
        setBulkImportOpen(false);
      } catch {
        toast.error('Failed to parse CSV file');
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
    exportToCSV(items.map(i => ({
      'Item Name': i.name, SKU: i.sku, Category: i.category, Brand: i.brand,
      Price: i.price, Status: i.status, 'Initial Stock': i.initialStock,
    })), 'master-catalogue.csv');
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Master Catalogue</h2>
          <p className="text-sm text-muted-foreground">Manage and update the product and service catalog. Add new items, bulk upload or update listings, and set pricing. Keep your catalog current and accurate.</p>
        </div>
        <Button className="gap-1.5" onClick={() => setBulkImportOpen(true)}><Plus size={14} /> Bulk Import</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: `${stats.total} Items`, icon: ShoppingCart, color: 'bg-primary text-primary-foreground' },
          { label: `${stats.inStock} in Stock`, icon: ShoppingCart, color: 'bg-success/20 text-success' },
          { label: `${stats.lowStock} Low Stock`, icon: ShoppingCart, color: 'bg-warning/20 text-warning' },
          { label: `${stats.outOfStock} Out of Stock`, icon: ShoppingCart, color: 'bg-destructive/20 text-destructive' },
        ].map(stat => (
          <Card key={stat.label} className={`${stat.color} cursor-pointer`}>
            <CardContent className="pt-3 pb-3 flex items-center gap-2">
              <stat.icon size={16} />
              <span className="font-medium text-sm">{stat.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.keys(categories).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={brandFilter} onValueChange={setBrandFilter}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="All Brands" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            {brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="In Stock">In Stock</SelectItem>
            <SelectItem value="Low Stock">Low Stock</SelectItem>
            <SelectItem value="Out of Stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" size={12} />
          <Input className="pl-7 h-8 w-36 text-xs" placeholder="Search Item" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setBulkImportOpen(true)}><Upload size={12} /> Bulk Import</Button>
          <Button size="sm" className="gap-1.5" onClick={openAddDialog}><Plus size={12} /> Add New Item</Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"><Checkbox checked={selectedIds.length === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /></TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(item => (
                <TableRow key={item.id}>
                  <TableCell><Checkbox checked={selectedIds.includes(item.id)} onCheckedChange={() => toggleSelect(item.id)} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-8 h-8 object-cover rounded" />
                        ) : (
                          <ImageIcon size={14} className="text-muted-foreground" />
                        )}
                      </div>
                      <span className="font-medium">{item.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.sku}</TableCell>
                  <TableCell className="text-sm">{item.category}</TableCell>
                  <TableCell className="text-sm text-primary">{item.brand}</TableCell>
                  <TableCell>₹{item.price.toLocaleString()}</TableCell>
                  <TableCell><Badge className={`${getStatusColor(item.status)} border-none`}>{item.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(item)}><Pencil size={12} /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openViewDialog(item)}><Eye size={12} /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteItem(item.id)}><Trash2 size={12} /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <span>Showing 1 - {filtered.length} of {items.length} entries</span>
          </div>
        </CardContent>
      </Card>

      {/* Import/Export + Audit Logs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Import / Export Products</CardTitle></CardHeader>
          <CardContent>
            <Tabs defaultValue="upload">
              <TabsList className="bg-muted">
                <TabsTrigger value="upload">Bulk Upload Items</TabsTrigger>
                <TabsTrigger value="excel">Export Catalog (Excel)</TabsTrigger>
                <TabsTrigger value="pdf">Export Catalog (PDF)</TabsTrigger>
              </TabsList>
              <TabsContent value="upload" className="mt-3">
                <div className="text-center p-2 border-2 border-dashed border-border rounded-lg">
                  <Upload size={24} className="mx-auto text-primary mb-2" />
                  <p className="text-sm font-medium">Upload</p>
                  <p className="text-xs text-muted-foreground">Bulk upload new products or catalog using CSV template.</p>
                  <input ref={bulkFileRef} type="file" accept=".csv" className="hidden" onChange={handleBulkImport} />
                  <Button className="mt-2" size="sm" onClick={() => bulkFileRef.current?.click()}>Upload</Button>
                </div>
              </TabsContent>
              <TabsContent value="excel" className="mt-3">
                <div className="text-center p-2 border-2 border-dashed border-border rounded-lg">
                  <FileDown size={24} className="mx-auto text-success mb-2" />
                  <p className="text-sm font-medium">Export</p>
                  <p className="text-xs text-muted-foreground">Export the entire product catalog as Excel file.</p>
                  <Button variant="outline" className="mt-2" size="sm" onClick={exportCatalogExcel}>Export Excel</Button>
                </div>
              </TabsContent>
              <TabsContent value="pdf" className="mt-3">
                <div className="text-center p-2 border-2 border-dashed border-border rounded-lg">
                  <FileText size={24} className="mx-auto text-destructive mb-2" />
                  <p className="text-sm font-medium">Export Catalog</p>
                  <p className="text-xs text-muted-foreground">Export as PDF file.</p>
                  <Button variant="outline" className="mt-2" size="sm" onClick={exportCatalogPDF}>Export PDF</Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Approval & Audit Logs</CardTitle>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportAuditLogs}><Download size={12} /> Export</Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Event</TableHead><TableHead>User</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {auditLogs.map((log, i) => (
                  <TableRow key={i}>
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
      </div>

      {/* Bulk Import Dialog */}
      <Dialog open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Bulk Import Items</DialogTitle></DialogHeader>
          <div className="text-center p-8 border-2 border-dashed border-border rounded-lg">
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
                <div><Label className="text-muted-foreground">Status</Label><Badge className={`${getStatusColor(viewItem.status)} border-none`}>{viewItem.status}</Badge></div>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setViewDialogOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Item Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="px-6 pb-2" style={{ maxHeight: 'calc(90vh - 130px)' }}>
            <div className="space-y-6 pb-4">
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
                <h3 className="font-semibold text-sm border-b pb-1 mb-3">Pricing & Inventory</h3>
                <div className="grid grid-cols-5 gap-3">
                  <div>
                    <Label>Regular Price</Label>
                    <div className="flex items-center">
                      <span className="text-xs mr-1">₹</span>
                      <Input type="number" value={form.price} onChange={e => updateForm({ price: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <div>
                    <Label>Discount Price</Label>
                    <div className="flex items-center">
                      <span className="text-xs mr-1">₹</span>
                      <Input type="number" placeholder="(optional)" value={form.discountPrice || ''} onChange={e => updateForm({ discountPrice: parseFloat(e.target.value) || undefined })} />
                    </div>
                  </div>
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
                <div className="grid grid-cols-3 gap-3">
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
                  <div>0
                    <Label>Estimated Lead Time</Label>
                    <Select value={form.leadTime || '10 Days'} onValueChange={v => updateForm({ leadTime: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{leadTimeOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
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
          </ScrollArea>
          <DialogFooter className="px-6 pb-4">
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddItem}>{editingItem ? 'Update Item' : 'Add Item'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
