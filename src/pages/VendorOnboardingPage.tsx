'use client';

import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Trash2, Star, Upload, X, FileText, Paperclip } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { CATEGORY_LIST, CATEGORY_SUBCATEGORIES } from '@/lib/categories';
import { addVendor, getVendors } from '@/lib/vendorDataStore';
import { getPrefix } from '@/lib/configService';
import { getVendorCreationAuditFields } from '@/lib/vendorAudit';
import { sanitizePhoneNumber, isValidPhoneNumber } from '@/lib/phoneValidation';
import AddressPairFields from '@/components/shared/AddressPairFields';
import {
  createEmptyAddress,
  formatAddressDetails,
  isValidGst,
  isValidPan,
  normalizeGstInput,
  normalizePanInput,
  type AddressDetails,
} from '@/lib/addressTypes';

// ─── Reusable AddableSelect ──────────────────────────────────────────────────
// Renders a <select> with an inline "add new" flow. When the user picks the
// sentinel "add new" option an input + confirm/cancel row replaces the select.

interface AddableSelectProps {
  name: string;
  value: string;
  onChange: (e: { target: { name: string; value: string } }) => void;
  baseOptions: string[];           // options WITHOUT the "+ Add New …" entry
  addLabel?: string;               // label for the sentinel option
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

function AddableSelect({
  name,
  value,
  onChange,
  baseOptions,
  addLabel = '+ Add New',
  placeholder = 'Select…',
  className = '',
  disabled = false,
}: AddableSelectProps) {
  const [extraOptions, setExtraOptions] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const allOptions = [...baseOptions, ...extraOptions];

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === '__add_new__') {
      setIsAdding(true);
    } else {
      onChange({ target: { name, value: e.target.value } });
    }
  };

  const confirm = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setExtraOptions(prev => [...prev, trimmed]);
    onChange({ target: { name, value: trimmed } });
    setDraft('');
    setIsAdding(false);
  };

  const cancel = () => {
    setDraft('');
    setIsAdding(false);
  };

  if (isAdding) {
    return (
      <div className="flex gap-2 items-center">
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); confirm(); }
            if (e.key === 'Escape') cancel();
          }}
          placeholder={`Type new ${addLabel.replace(/^\+\s*Add New\s*/i, '').toLowerCase() || 'option'}…`}
          className={`flex-1 px-2 py-2 border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
        />
        <button
          type="button"
          onClick={confirm}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 whitespace-nowrap"
        >
          Add
        </button>
        <button
          type="button"
          onClick={cancel}
          className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 whitespace-nowrap"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <select
      name={name}
      value={value}
      onChange={handleSelectChange}
      disabled={disabled}
      className={className}
    >
      <option value="">{placeholder}</option>
      {allOptions.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
      <option value="__add_new__">{addLabel}</option>
    </select>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AddVendorPage() {
  const navigate = useNavigate();
  const { currentAuthenticatedUser } = useAuth();

  // Base option arrays (without the inline "+ Add New" entries – those are
  // handled by AddableSelect itself)
  const categoryBase = [...CATEGORY_LIST];

  const subCategoriesBase: Record<string, string[]> = Object.fromEntries(
    Object.entries(CATEGORY_SUBCATEGORIES).map(([k, v]) => [k, [...(v as string[])]])
  );

  const designationsBase = ['CEO / Director', 'Managing Director', 'Vice President', 'General Manager', 'Manager', 'Assistant Manager', 'Executive', 'Specialist', 'Others'];
  const vendorTypesBase = ['Supplier', 'Manufacturer', 'Distributor', 'Reseller', 'Service Provider', 'Consultant', 'Contractor', 'OEM', 'Others'];
  const phoneCodesBase = ['+91 (India)', '+1 (USA)', '+44 (UK)', '+971 (UAE)', '+65 (Singapore)', '+61 (Australia)', '+86 (China)', '+81 (Japan)', '+49 (Germany)', '+33 (France)'];
  const countriesBase = ['India', 'United States', 'United Kingdom', 'United Arab Emirates', 'Singapore', 'Australia', 'China', 'Japan', 'Germany', 'France', 'Others'];
  const statesBase = ['Karnataka', 'Maharashtra', 'Delhi', 'Tamil Nadu', 'Gujarat', 'Uttar Pradesh', 'West Bengal', 'Telangana', 'Rajasthan', 'Others'];
  const citiesBase = ['Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad', 'Noida', 'Others'];
  const paymentTermsBase = ['7 Days', '15 Days', '30 Days', '45 Days', '60 Days', '90 Days', '120 Days', 'Net 15', 'Net 30', 'Net 60'];
  const currenciesBase = ['INR - Indian Rupee', 'USD - US Dollar', 'EUR - Euro', 'GBP - British Pound', 'AED - UAE Dirham', 'SGD - Singapore Dollar'];
  const accountTypesBase = ['Current Account', 'Saving Account', 'Overdraft Account', 'Cash Credit Account', 'Others'];
  const paymentModesBase = ['NEFT / RTGS', 'IMPS', 'Cheque', 'Demand Draft', 'Cash', 'UPI', 'Wire Transfer', 'Others'];
  const msmeStatusesBase = ['Micro', 'Small', 'Medium', 'Not MSME'];
  const isoCertificationsBase = ['ISO 9001', 'ISO 14001', 'ISO 27001', 'ISO 45001', 'ISO 50001', 'Others'];
  const qualityCertificationsBase = ['CE Certified', 'RoHS Compliant', 'BIS Certified', 'UL Certified', 'FCC Certified', 'Others'];
  const environmentalCertificationsBase = ['ISO 14001', 'ISO 50001', 'Green Building', 'LEED Certified', 'Others'];
  const blacklistedBase = ['No', 'Under Review', 'Yes'];
  const contractStatusesBase = ['Active', 'Inactive', 'Expired', 'Terminated', 'Under Review'];
  const preferredBase = ['Yes', 'No'];
  const visibilityOptionsBase = ['Internal Only', 'Procurement Team', 'Finance Team', 'Management', 'All Users'];

  const ratingLabels: Record<number, string> = { 5: 'Excellent', 4: 'Very Good', 3: 'Good', 2: 'Average', 1: 'Poor' };

  // ── Tags state ──────────────────────────────────────────────────────────────
  const tagOptionsBase = ['IT Hardware', 'Office Supplies', 'Services', 'Preferred Vendor', 'New Vendor', 'Critical Vendor'];
  const [tagOptions, setTagOptions] = useState<string[]>(tagOptionsBase);
  const [newTagInput, setNewTagInput] = useState('');

  // ── Additional-docs state ───────────────────────────────────────────────────
  const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
  type DocFile = { id: string; name: string; size: string; sizeBytes: number; type: string };
  const [additionalDocs, setAdditionalDocs] = useState<DocFile[]>([]);
  const [isDraggingAdditional, setIsDraggingAdditional] = useState(false);
  const additionalFileRef = useRef<HTMLInputElement>(null);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const handleAdditionalFiles = (files: FileList | null) => {
    if (!files) return;
    const oversized: string[] = [];
    const newDocs: DocFile[] = [];
    Array.from(files).forEach(f => {
      if (f.size > MAX_FILE_BYTES) {
        oversized.push(f.name);
      } else {
        newDocs.push({
          id: Math.random().toString(36).slice(2),
          name: f.name,
          size: formatBytes(f.size),
          sizeBytes: f.size,
          type: f.type || 'application/octet-stream',
        });
      }
    });
    if (oversized.length > 0) {
      alert(`The following file(s) exceed the 10 MB limit and were not added:\n${oversized.join('\n')}`);
    }
    if (newDocs.length > 0) {
      setAdditionalDocs(prev => [...prev, ...newDocs]);
    }
  };

  const removeAdditionalDoc = (id: string) => {
    setAdditionalDocs(prev => prev.filter(d => d.id !== id));
  };

  // ── Form state ──────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    vendorName: '',
    vendorCode: 'Auto-generated',
    category: '',
    subCategory: '',
    vendorType: '',
    pan: '',
    gstNumber: '',
    registrationNo: '',
    legalEntityName: '',
    yearOfEstablishment: '',
    employees: '',
    annualRevenue: '',
    website: '',
    contactPerson: '',
    designation: '',
    email: '',
    phone: '+91 (India)',
    phoneNumber: '',
    mobile: '+91 (India)',
    mobileNumber: '',
    alternateEmail: '',
    // Registered address
    registeredAddress: '',
    country: '',
    state: '',
    city: '',
    pincode: '',
    // Billing address (structured)
    sameAsRegistered: false,
    billingAddressLine1: '',
    billingAddressLine2: '',
    billingCountry: '',
    billingState: '',
    billingCity: '',
    billingPincode: '',
    // Financial
    paymentTerms: '',
    paymentMode: '',
    currency: 'INR - Indian Rupee',
    creditLimit: '',
    bankName: '',
    bankBranch: '',
    accountNumber: '',
    ifscCode: '',
    accountType: '',
    // Classification
    msmeStatus: '',
    isoStatus: '',
    qualityCertification: '',
    environmentalCertification: '',
    // Performance
    qualityRating: 0,
    deliveryRating: 0,
    serviceRating: 0,
    blacklisted: '',
    contractStatus: '',
    onboardingDate: '',
    preferredVendor: '',
    // Additional info
    tags: [] as string[],
    internalNotes: '',
    visibility: '',
  });

  const [addressDetails, setAddressDetails] = useState<{
    billing: AddressDetails;
    shipping: AddressDetails;
  }>({
    billing: createEmptyAddress(),
    shipping: createEmptyAddress(),
  });

  const [subCategoryOptions, setSubCategoryOptions] = useState<string[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | { target: { name: string; value: string | boolean } }) => {
    const target = e.target as { name: string; value: string; type?: string; checked?: boolean };
    const { name, value } = target;
    const isCheckbox = (target as HTMLInputElement).type === 'checkbox';
    const finalValue = isCheckbox
      ? (target as HTMLInputElement).checked
      : (name === 'phoneNumber' || name === 'mobileNumber' ? sanitizePhoneNumber(value) : value);

    setFormData(prev => {
      const updated = { ...prev, [name]: finalValue };

      // When category changes, reset sub-category
      if (name === 'category') {
        setSubCategoryOptions(subCategoriesBase[value as string] || []);
        updated.subCategory = '';
      }

      // When "same as registered" is checked, copy registered → billing
      if (name === 'sameAsRegistered' && finalValue === true) {
        updated.billingAddressLine1 = prev.registeredAddress;
        updated.billingAddressLine2 = '';
        updated.billingCountry = prev.country;
        updated.billingState = prev.state;
        updated.billingCity = prev.city;
        updated.billingPincode = prev.pincode;
      }

      // While "same as registered" stays checked, keep billing in sync with
      // any changes to the registered-address fields
      const registeredFields: Record<string, keyof typeof updated> = {
        registeredAddress: 'billingAddressLine1',
        country: 'billingCountry',
        state: 'billingState',
        city: 'billingCity',
        pincode: 'billingPincode',
      };
      if (prev.sameAsRegistered && name in registeredFields) {
        (updated as Record<string, unknown>)[registeredFields[name]] = finalValue;
      }

      return updated;
    });
  };

  const handleRatingChange = (fieldName: string, value: number) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleAddTag = (tag: string) => {
    if (!tag.trim()) return;
    const trimmed = tag.trim();
    if (!tagOptions.includes(trimmed)) setTagOptions(prev => [...prev, trimmed]);
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(trimmed) ? prev.tags : [...prev.tags, trimmed],
    }));
    setNewTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const handleSave = () => {
    if (!formData.vendorName.trim()) {
      alert('Vendor Name is required.');
      return;
    }
    if (!isValidPhoneNumber(formData.phoneNumber)) {
      toast.error('Phone number must contain exactly 10 digits.');
      return;
    }
    if (formData.mobileNumber && !isValidPhoneNumber(formData.mobileNumber)) {
      toast.error('Mobile number must contain exactly 10 digits.');
      return;
    }
    if (formData.pan && formData.pan.length !== 10) {
      alert('PAN must be exactly 10 alphanumeric characters.');
      return;
    }
    if (formData.pan && !isValidPan(formData.pan)) {
      alert('PAN must follow the format AAAAA9999A.');
      return;
    }
    if (formData.gstNumber && !isValidGst(formData.gstNumber)) {
      alert('GST Number must be exactly 15 alphanumeric characters.');
      return;
    }

    const existing = getVendors();
    const maxId = existing.reduce((max, v) => {
      const num = parseInt(v.id.replace(/\D/g, ''), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 1000);
    const newId = `${getPrefix('vendor') || 'VND-'}${maxId + 1}`;

    const avgRating = [formData.qualityRating, formData.deliveryRating, formData.serviceRating].filter(r => r > 0);
    const rating = avgRating.length > 0
      ? parseFloat((avgRating.reduce((a, b) => a + b, 0) / avgRating.length).toFixed(1))
      : 0;

    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const onboardedDate = formData.onboardingDate
      ? new Date(`${formData.onboardingDate}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : today;
    addVendor({
      id: newId,
      ...getVendorCreationAuditFields(currentAuthenticatedUser),
      onboardingFormData: { ...formData },
      onboardingAddressDetails: {
        billing: { ...addressDetails.billing },
        shipping: { ...addressDetails.shipping },
      },
      name: formData.vendorName,
      vendorCode: formData.vendorCode,
      category: formData.category || 'Uncategorized',
      subCategory: formData.subCategory,
      vendorType: formData.vendorType,
      legalEntityName: formData.legalEntityName,
      primaryContact: formData.contactPerson,
      designation: formData.designation,
      email: formData.email,
      phone: formData.phoneNumber ? `${formData.phone} ${formData.phoneNumber}` : '',
      mobile: formData.mobileNumber ? `${formData.mobile} ${formData.mobileNumber}` : '',
      alternateEmail: formData.alternateEmail,
      rating,
       region: addressDetails.billing.state || addressDetails.billing.country || '',
      status: 'Pending',
      onboardedDate,
      monthSpend: 0,
      score: rating,
       address: formatAddressDetails(addressDetails.billing),
      totalSpend: 0,
      complianceIssues: 0,
      archived: false,
      website: formData.website,
      pan: formData.pan,
      gstNumber: formData.gstNumber,
      taxId: formData.gstNumber,
      registrationNo: formData.registrationNo,
      founded: formData.yearOfEstablishment,
      employees: formData.employees,
      annualRevenue: formData.annualRevenue,
      currency: formData.currency,
      creditLimit: formData.creditLimit,
      paymentTerms: formData.paymentTerms,
      paymentMode: formData.paymentMode,
      bankName: formData.bankName,
      bankBranch: formData.bankBranch,
      bankAccount: formData.accountNumber,
      ifscCode: formData.ifscCode,
      accountType: formData.accountType,
      // Vendor classification and compliance
      msmeStatus: formData.msmeStatus,
      isoStatus: formData.isoStatus,
      qualityCertification: formData.qualityCertification,
      environmentalCertification: formData.environmentalCertification,
      blacklisted: formData.blacklisted,
      contractStatus: formData.contractStatus,
      preferredVendor: formData.preferredVendor,
      onboardingDate: formData.onboardingDate,
      tags: formData.tags,
      internalNotes: formData.internalNotes,
      visibility: formData.visibility,
      // Registered address
       city: addressDetails.billing.city || formData.city,
       state: addressDetails.billing.state || formData.state,
       country: addressDetails.billing.country || formData.country,
       zipCode: addressDetails.billing.pinCode || formData.pincode,
       addressLine1: addressDetails.billing.addressLine1 || formData.registeredAddress,
       addressLine2: addressDetails.billing.addressLine2,
       billingAttention: addressDetails.billing.attention,
       billingAddressLine1: addressDetails.billing.addressLine1,
       billingAddressLine2: addressDetails.billing.addressLine2,
       billingCity: addressDetails.billing.city,
       billingState: addressDetails.billing.state,
       billingZip: addressDetails.billing.pinCode,
       billingCountry: addressDetails.billing.country,
       billingPhoneCountryCode: addressDetails.billing.phoneCountryCode,
       billingPhone: addressDetails.billing.phone,
       billingFaxNumber: addressDetails.billing.faxNumber,
       shippingAttention: addressDetails.shipping.attention,
       shippingAddressLine1: addressDetails.shipping.addressLine1,
       shippingAddressLine2: addressDetails.shipping.addressLine2,
       shippingCity: addressDetails.shipping.city,
       shippingState: addressDetails.shipping.state,
       shippingZip: addressDetails.shipping.pinCode,
       shippingCountry: addressDetails.shipping.country,
       shippingPhoneCountryCode: addressDetails.shipping.phoneCountryCode,
       shippingPhone: addressDetails.shipping.phone,
       shippingFaxNumber: addressDetails.shipping.faxNumber,
      // Related document metadata (file binaries are not stored in localStorage)
      relatedDocuments: additionalDocs.map(d => ({ name: d.name, size: d.size, sizeBytes: d.sizeBytes, type: d.type })),
      performanceQuality: formData.qualityRating * 20,
      performanceDelivery: formData.deliveryRating * 20,
      performanceResponsiveness: formData.serviceRating * 20,
      performanceCompliance: 0,
    });

    navigate('/vendors');
  };

  const selectClass = 'w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
  const inputClass = 'w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

  // ── Star Rating sub-component ───────────────────────────────────────────────
  const StarRating = ({ value, onChange, name }: { value: number; onChange: (name: string, val: number) => void; name: string }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button key={star} type="button" onClick={() => onChange(name, star)} className="p-1 hover:bg-gray-100 rounded transition">
          <Star size={20} className={star <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
        </button>
      ))}
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 sticky top-0 z-10 bg-white">
        <div className="px-8 py-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Add New Vendor</h1>
            <p className="text-sm text-gray-600 mt-1">
              Create a new vendor profile. All fields marked with <span className="text-red-600">*</span> are required.
            </p>
          </div>
        </div>
      </div>

      <div className="px-8 py-2 space-y-12">

        {/* ── Section 1: Vendor Information ───────────────────────────────── */}
        <FormSection number={1} title="Vendor Information">
          <div className="grid grid-cols-2 gap-6">
            <FormField label="Vendor Name" required input={
              <input type="text" placeholder="Enter vendor name" name="vendorName" value={formData.vendorName} onChange={handleChange} className={inputClass} />
            } />
            <FormField label="Vendor Code" input={
              <input type="text" placeholder="Auto-generated" disabled value={formData.vendorCode} className="w-full px-2 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600" />
            } />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <FormField label="Category" required input={
              <AddableSelect name="category" value={formData.category} onChange={handleChange}
                baseOptions={categoryBase} addLabel="+ Add New Category" placeholder="Select category" className={selectClass} />
            } />
            <FormField label="Sub Category" input={
              <AddableSelect name="subCategory" value={formData.subCategory} onChange={handleChange}
                baseOptions={subCategoryOptions} addLabel="+ Add New Sub Category" placeholder="Select sub category"
                className={selectClass} disabled={!formData.category} />
            } />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <FormField label="Vendor Type" required input={
              <AddableSelect name="vendorType" value={formData.vendorType} onChange={handleChange}
                baseOptions={vendorTypesBase} addLabel="+ Add New Vendor Type" placeholder="Select vendor type" className={selectClass} />
            } />
            <FormField label="PAN" input={
              <div>
                <input
                  type="text"
                  placeholder="e.g. ABCDE1234F"
                  name="pan"
                  value={formData.pan}
                  onChange={e => {
                    const v = normalizePanInput(e.target.value);
                    handleChange({ target: { name: 'pan', value: v } });
                  }}
                  maxLength={10}
                  className={inputClass + (formData.pan && !isValidPan(formData.pan) ? ' border-red-400 focus:ring-red-400' : '')}
                />
                <p className={`text-xs mt-1 text-right ${formData.pan.length === 10 && isValidPan(formData.pan) ? 'text-green-600' : 'text-gray-400'}`}>
                  {formData.pan.length}/10 · 5 letters, 4 numbers, 1 letter
                </p>
              </div>
            } />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <FormField label="Legal Entity Name" input={
              <input type="text" placeholder="Enter legal entity name" name="legalEntityName" value={formData.legalEntityName} onChange={handleChange} className={inputClass} />
            } />
            <FormField label="Registration Number" input={
              <input type="text" placeholder="e.g. U12345MH2010PTC123456" name="registrationNo" value={formData.registrationNo} onChange={handleChange} className={inputClass} />
            } />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <FormField label="Tax ID / GST Number" input={
              <div>
                <input
                  type="text"
                  placeholder="e.g. 22AAAAA0000A1Z5"
                  name="gstNumber"
                  value={formData.gstNumber}
                  onChange={e => {
                    const v = normalizeGstInput(e.target.value);
                    handleChange({ target: { name: 'gstNumber', value: v } });
                  }}
                  maxLength={15}
                  pattern="[A-Za-z0-9]{15}"
                  className={inputClass + (formData.gstNumber && !isValidGst(formData.gstNumber) ? ' border-red-400 focus:ring-red-400' : '')}
                />
                <p className={`text-xs mt-1 text-right ${formData.gstNumber.length === 15 ? 'text-green-600' : 'text-gray-400'}`}>
                  {formData.gstNumber.length}/15 characters
                </p>
              </div>
            } />
            {/* Year of Establishment – free text input instead of dropdown */}
            <FormField label="Year of Establishment" input={
              <input
                type="text"
                placeholder="e.g. 2010"
                name="yearOfEstablishment"
                value={formData.yearOfEstablishment}
                onChange={handleChange}
                maxLength={4}
                pattern="\d{4}"
                className={inputClass}
              />
            } />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <FormField label="Number of Employees" input={
              <input type="text" placeholder="e.g. 50–200" name="employees" value={formData.employees} onChange={handleChange} className={inputClass} />
            } />
            <FormField label="Annual Revenue" input={
              <input type="text" placeholder="e.g. ₹5 Cr+" name="annualRevenue" value={formData.annualRevenue} onChange={handleChange} className={inputClass} />
            } />
          </div>

          <FormField label="Website" input={
            <input type="text" placeholder="Enter website URL" name="website" value={formData.website} onChange={handleChange} className={inputClass} />
          } />
        </FormSection>

        {/* ── Section 2: Primary Contact ───────────────────────────────────── */}
        <FormSection number={2} title="Primary Contact">
          <div className="grid grid-cols-2 gap-6">
            <FormField label="Contact Person" required input={
              <input
                type="text"
                placeholder="Enter contact person"
                name="contactPerson"
                value={formData.contactPerson}
                onChange={handleChange}
                className={inputClass}
              />
            } />
            <FormField label="Designation" input={
              <AddableSelect name="designation" value={formData.designation} onChange={handleChange}
                baseOptions={designationsBase} addLabel="+ Add New Designation" placeholder="Select designation" className={selectClass} />
            } />
          </div>

          <FormField label="Email" required input={
            <input type="email" placeholder="name@company.com" name="email" value={formData.email} onChange={handleChange} className={inputClass} />
          } />

          <div className="grid grid-cols-2 gap-6">
            <FormField label="Phone" required input={
              <div className="flex gap-2">
                <AddableSelect name="phone" value={formData.phone} onChange={handleChange}
                  baseOptions={phoneCodesBase} addLabel="+ Add New Code" placeholder="+code"
                  className="px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit phone number" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange}
                  className="flex-1 px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            } />
            <FormField label="Mobile" input={
              <div className="flex gap-2">
                <AddableSelect name="mobile" value={formData.mobile} onChange={handleChange}
                  baseOptions={phoneCodesBase} addLabel="+ Add New Code" placeholder="+code"
                  className="px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile number" name="mobileNumber" value={formData.mobileNumber} onChange={handleChange}
                  className="flex-1 px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            } />
          </div>

          <FormField label="Alternate Email" input={
            <input type="email" placeholder="Enter alternate email" name="alternateEmail" value={formData.alternateEmail} onChange={handleChange} className={inputClass} />
          } />
        </FormSection>

        {/* ── Section 3: Business & Address Details ────────────────────────── */}
        <FormSection number={3} title="Business & Address Details">

          <AddressPairFields
            billing={addressDetails.billing}
            shipping={addressDetails.shipping}
            countries={countriesBase}
            states={statesBase}
            onBillingChange={(patch) => setAddressDetails((prev) => ({
              ...prev,
              billing: { ...prev.billing, ...patch },
            }))}
            onShippingChange={(patch) => setAddressDetails((prev) => ({
              ...prev,
              shipping: { ...prev.shipping, ...patch },
            }))}
          />
        </FormSection>

        {/* ── Section 4: Financial Details ─────────────────────────────────── */}
        <FormSection number={4} title="Financial Details">
          <div className="grid grid-cols-2 gap-6">
            <FormField label="Payment Terms" input={
              <AddableSelect name="paymentTerms" value={formData.paymentTerms} onChange={handleChange}
                baseOptions={paymentTermsBase} addLabel="+ Add New Term" placeholder="Select payment terms" className={selectClass} />
            } />
            <FormField label="Currency" required input={
              <AddableSelect name="currency" value={formData.currency} onChange={handleChange}
                baseOptions={currenciesBase} addLabel="+ Add New Currency" placeholder="Select currency" className={selectClass} />
            } />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <FormField label="Payment Mode" input={
              <AddableSelect name="paymentMode" value={formData.paymentMode} onChange={handleChange}
                baseOptions={paymentModesBase} addLabel="+ Add New Payment Mode" placeholder="Select payment mode" className={selectClass} />
            } />
            <FormField label="Credit Limit (INR)" input={
              <input type="text" placeholder="Enter amount" name="creditLimit" value={formData.creditLimit} onChange={handleChange} className={inputClass} />
            } />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <FormField label="Bank Name" input={
              <input type="text" placeholder="Enter bank name" name="bankName" value={formData.bankName} onChange={handleChange} className={inputClass} />
            } />
            <FormField label="Account Number" input={
              <input type="text" placeholder="Enter account number" name="accountNumber" value={formData.accountNumber} onChange={handleChange} className={inputClass} />
            } />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <FormField label="IFSC Code" input={
              <input type="text" placeholder="Enter IFSC code" name="ifscCode" value={formData.ifscCode} onChange={handleChange} className={inputClass} />
            } />
            <FormField label="Account Type" input={
              <AddableSelect name="accountType" value={formData.accountType} onChange={handleChange}
                baseOptions={accountTypesBase} addLabel="+ Add New Account Type" placeholder="Select account type" className={selectClass} />
            } />
          </div>

          <FormField label="Branch" input={
            <input type="text" placeholder="Enter branch name" name="bankBranch" value={formData.bankBranch} onChange={handleChange} className={inputClass} />
          } />
        </FormSection>

        {/* ── Section 5: Vendor Classification ────────────────────────────── */}
        <FormSection number={5} title="Vendor Classification">
          <div className="grid grid-cols-2 gap-6">
            <FormField label="MSME Status" input={
              <AddableSelect name="msmeStatus" value={formData.msmeStatus} onChange={handleChange}
                baseOptions={msmeStatusesBase} addLabel="+ Add New Status" placeholder="Select status" className={selectClass} />
            } />
            <FormField label="ISO Certification" input={
              <AddableSelect name="isoStatus" value={formData.isoStatus} onChange={handleChange}
                baseOptions={isoCertificationsBase} addLabel="+ Add New Certification" placeholder="Select certification" className={selectClass} />
            } />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <FormField label="Quality Certification" input={
              <AddableSelect name="qualityCertification" value={formData.qualityCertification} onChange={handleChange}
                baseOptions={qualityCertificationsBase} addLabel="+ Add New Certification" placeholder="Select certification" className={selectClass} />
            } />
            <FormField label="Environmental Certification" input={
              <AddableSelect name="environmentalCertification" value={formData.environmentalCertification} onChange={handleChange}
                baseOptions={environmentalCertificationsBase} addLabel="+ Add New Certification" placeholder="Select certification" className={selectClass} />
            } />
          </div>
        </FormSection>

        {/* ── Section 6: Performance & Compliance ──────────────────────────── */}
        <FormSection number={6} title="Performance & Compliance">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Quality Rating</label>
              <StarRating value={formData.qualityRating} onChange={handleRatingChange} name="qualityRating" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Blacklisted</label>
              <AddableSelect name="blacklisted" value={formData.blacklisted} onChange={handleChange}
                baseOptions={blacklistedBase} addLabel="+ Add New Status" placeholder="Select status" className={selectClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Delivery Rating</label>
              <StarRating value={formData.deliveryRating} onChange={handleRatingChange} name="deliveryRating" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contract Status</label>
              <AddableSelect name="contractStatus" value={formData.contractStatus} onChange={handleChange}
                baseOptions={contractStatusesBase} addLabel="+ Add New Status" placeholder="Select status" className={selectClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Service Rating</label>
              <StarRating value={formData.serviceRating} onChange={handleRatingChange} name="serviceRating" />
            </div>
            <FormField label="Onboarding Date" input={
              <input type="date" name="onboardingDate" value={formData.onboardingDate} onChange={handleChange} className={inputClass} />
            } />
          </div>

          <FormField label="Preferred Vendor" input={
            <AddableSelect name="preferredVendor" value={formData.preferredVendor} onChange={handleChange}
              baseOptions={preferredBase} addLabel="+ Add New Option" placeholder="Select status" className={selectClass} />
          } />
        </FormSection>

        {/* ── Section 7: Additional Information ───────────────────────────── */}
        <FormSection number={7} title="Additional Information">

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
            {/* Selected tag chips */}
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    {tag}
                    <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-blue-900">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* Available tags to click */}
            <div className="flex flex-wrap gap-2 mb-3">
              {tagOptions.filter(t => !formData.tags.includes(t)).map(tag => (
                <button key={tag} type="button" onClick={() => handleAddTag(tag)}
                  className="px-2 py-1 border border-gray-300 text-gray-600 rounded-full text-xs hover:border-blue-400 hover:text-blue-600 transition">
                  + {tag}
                </button>
              ))}
            </div>
            {/* Add custom tag */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newTagInput}
                onChange={e => setNewTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(newTagInput); } }}
                placeholder="Type a new tag and press Enter or click Add"
                className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={() => handleAddTag(newTagInput)}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                Add
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <FormField label="Visibility" input={
              <AddableSelect name="visibility" value={formData.visibility} onChange={handleChange}
                baseOptions={visibilityOptionsBase} addLabel="+ Add New Visibility" placeholder="Select visibility" className={selectClass} />
            } />
          </div>

          <FormField label="Internal Notes" input={
            <textarea placeholder="Add any internal notes" name="internalNotes" value={formData.internalNotes}
              onChange={handleChange} rows={4} className={inputClass} maxLength={1000} />
          } />
          <p className="text-xs text-gray-500 text-right">{formData.internalNotes.length}/1000 characters</p>

          {/* Related Documents Upload */}
          <div className="pt-2">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <Paperclip size={14} className="inline mr-1" />
              Related Documents
            </label>

            {/* Drop zone */}
            <div
              onClick={() => additionalFileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDraggingAdditional(true); }}
              onDragLeave={() => setIsDraggingAdditional(false)}
              onDrop={e => {
                e.preventDefault();
                setIsDraggingAdditional(false);
                handleAdditionalFiles(e.dataTransfer.files);
              }}
              className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors
                ${isDraggingAdditional ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
            >
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 font-medium">Drag & drop documents here, or <span className="text-blue-600">browse</span></p>
              <p className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG — max 10 MB each</p>
              <input
                ref={additionalFileRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                className="hidden"
                onChange={e => handleAdditionalFiles(e.target.files)}
              />
            </div>

            {/* Uploaded file list */}
            {additionalDocs.length > 0 && (
              <ul className="mt-3 space-y-2">
                {additionalDocs.map(doc => (
                  <li key={doc.id} className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={16} className="text-blue-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate">{doc.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{doc.size}</span>
                    </div>
                    <button type="button" onClick={() => removeAdditionalDoc(doc.id)} className="text-gray-400 hover:text-red-500 transition flex-shrink-0">
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </FormSection>

        {/* ── Bottom Actions ────────────────────────────────────────────────── */}
        <div className="flex gap-3 py-2 border-t border-gray-200">
          <button type="button" onClick={() => navigate('/vendors')} className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            Save Vendor
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function FormSection({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="border-l-4 border-blue-600 pl-6 py-2">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
          {number}
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function FormField({ label, required, input }: { label?: string; required?: boolean; input: React.ReactNode }) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-600 ml-1">*</span>}
        </label>
      )}
      {input}
    </div>
  );
}
