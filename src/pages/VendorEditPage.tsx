'use client';

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Cloud, Star, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { getVendorById, updateVendor } from '@/lib/vendorDataStore';
import type { StoredVendor, VendorStatus } from '@/lib/vendorDataStore';
import { useAuth } from '@/contexts/AuthContext';
import { getVendorUpdateAuditFields } from '@/lib/vendorAudit';
import { sanitizePhoneNumber, isValidPhoneNumber } from '@/lib/phoneValidation';

// Helper: ensure a current value (from stored data) appears in the options list.
// If it's already there, return the list unchanged. Otherwise prepend it.
function withCurrentValue(options: string[], current: string | undefined): string[] {
  if (!current || !current.trim()) return options;
  if (options.includes(current)) return options;
  return [current, ...options];
}

// Convert 0-100 performance score to 1-5 stars
function scoreToStars(score: number | undefined): number {
  if (!score) return 0;
  return Math.min(5, Math.max(0, Math.round(score / 20)));
}

// Convert 1-5 stars back to 0-100 performance score
function starsToScore(stars: number): number {
  return stars * 20;
}

const PHONE_CODE_OPTIONS = [
  { prefix: '+91', value: '+91 (India)' },
  { prefix: '+1', value: '+1 (USA)' },
  { prefix: '+44', value: '+44 (UK)' },
  { prefix: '+971', value: '+971 (UAE)' },
  { prefix: '+65', value: '+65 (Singapore)' },
  { prefix: '+61', value: '+61 (Australia)' },
  { prefix: '+86', value: '+86 (China)' },
  { prefix: '+81', value: '+81 (Japan)' },
  { prefix: '+49', value: '+49 (Germany)' },
  { prefix: '+33', value: '+33 (France)' },
];

function getPhoneParts(value: string | undefined) {
  const raw = value?.trim() ?? '';
  const option = PHONE_CODE_OPTIONS.find(({ prefix }) => raw.startsWith(prefix));
  return {
    countryCode: option?.value ?? '+91 (India)',
    number: sanitizePhoneNumber(raw),
  };
}

function toDateInputValue(value: string | undefined): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function toDisplayDate(value: string): string {
  if (!value) return '';
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function createEditFormData(vendor?: StoredVendor) {
  const phone = getPhoneParts(vendor?.phone);
  const mobile = getPhoneParts(vendor?.mobile);
  const registeredAddress = vendor?.addressLine1
    ? [vendor.addressLine1, vendor.addressLine2].filter(Boolean).join(', ')
    : vendor?.address ?? '';
  const billingAddress = vendor?.billingAddressLine1
    ? [vendor.billingAddressLine1, vendor.billingAddressLine2].filter(Boolean).join(', ')
    : '';

  return {
    vendorName: vendor?.name ?? '',
    vendorCode: vendor?.vendorCode ?? vendor?.id ?? 'Auto-generated',
    category: vendor?.category ?? '',
    subCategory: vendor?.subCategory ?? '',
    vendorType: vendor?.vendorType ?? '',
    pan: vendor?.pan ?? '',
    legalEntityName: vendor?.legalEntityName ?? '',
    yearOfEstablishment: vendor?.founded ?? '',
    website: vendor?.website ?? '',
    contactPerson: vendor?.primaryContact ?? '',
    designation: vendor?.designation ?? '',
    email: vendor?.email ?? '',
    phone: phone.countryCode,
    phoneNumber: phone.number,
    mobile: mobile.countryCode,
    mobileNumber: mobile.number,
    alternateEmail: vendor?.alternateEmail ?? '',
    registeredAddress,
    billingAddress,
    country: vendor?.country ?? '',
    state: vendor?.state ?? '',
    city: vendor?.city ?? '',
    pincode: vendor?.zipCode ?? '',
    sameAsRegistered: false,
    paymentTerms: vendor?.paymentTerms ?? '',
    currency: vendor?.currency ?? 'INR - Indian Rupee',
    creditLimit: vendor?.creditLimit ?? '',
    bankName: vendor?.bankName ?? '',
    accountNumber: vendor?.bankAccount ?? '',
    ifscCode: vendor?.ifscCode ?? '',
    accountType: vendor?.accountType ?? '',
    msmeStatus: vendor?.msmeStatus ?? '',
    isoStatus: vendor?.isoStatus ?? '',
    qualityCertification: vendor?.qualityCertification ?? '',
    environmentalCertification: vendor?.environmentalCertification ?? '',
    qualityRating: scoreToStars(vendor?.performanceQuality),
    deliveryRating: scoreToStars(vendor?.performanceDelivery),
    serviceRating: scoreToStars(vendor?.performanceResponsiveness),
    blacklisted: vendor?.blacklisted ?? '',
    contractStatus: (vendor?.contractStatus ?? vendor?.status ?? '') as string,
    onboardingDate: toDateInputValue(vendor?.onboardingDate ?? vendor?.onboardedDate),
    preferredVendor: vendor?.preferredVendor ?? '',
    tags: Array.isArray(vendor?.tags) ? [...vendor.tags] : [],
    internalNotes: vendor?.internalNotes ?? '',
    visibility: vendor?.visibility ?? '',
    gstCertificate: Boolean(vendor?.gstCertificate),
    panCard: Boolean(vendor?.panCard),
    businessRegistration: Boolean(vendor?.businessRegistration),
    bankDetails: Boolean(vendor?.bankDetails),
    isoCertificate: Boolean(vendor?.isoCertificate),
    otherDocuments: Boolean(vendor?.otherDocuments),
  };
}

export default function VendorEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentAuthenticatedUser } = useAuth();
  const vendor = getVendorById(id!);

  // ── Dropdown option lists ───────────────────────────────────────────────────
  // Categories includes all stored categories + standard onboarding categories
  const baseCategories = [
    'Computers', 'Networking', 'Office Supplies', 'Furniture', 'Electrical',
    'Cloud Software', 'Stationery', 'Pantry', 'Cleaning Supplies',
    'Medical Supplies', 'Services', 'Other',
  ];
  const categories = withCurrentValue(baseCategories, vendor?.category);

  const subCategoriesMap: Record<string, string[]> = {
    'IT Hardware': ['Servers', 'Laptops', 'Desktops', 'Storage', 'Printers', 'Networking Devices', 'Peripherals', 'Accessories', 'Consumables', 'Others'],
    'IT Services': ['Managed Services', 'Cloud Services', 'Consulting', 'Support', 'Others'],
    'Software': ['Operating System', 'Productivity', 'Development', 'Security', 'Others'],
    'Office Supplies': ['Stationery', 'Furniture', 'Cleaning', 'Others'],
  };

  const contacts = [
    { name: 'Rahul Sharma', title: 'Manager - Sales' },
    { name: 'Amit Verma', title: 'Regional Manager' },
    { name: 'Neha Kapoor', title: 'Senior Director' },
    { name: 'Pooja Nair', title: 'Partner Manager' },
    { name: 'Rohit Mehta', title: 'Sales Lead' },
  ];

  const designations = ['CEO / Director', 'Managing Director', 'Vice President', 'General Manager', 'Manager', 'Assistant Manager', 'Executive', 'Specialist', 'Others'];
  const vendorTypes = ['Supplier', 'Manufacturer', 'Distributor', 'Reseller', 'Service Provider', 'Consultant', 'Contractor', 'OEM', 'Others'];

  const phoneCodes = ['+91 (India)', '+1 (USA)', '+44 (UK)', '+971 (UAE)', '+65 (Singapore)', '+61 (Australia)', '+86 (China)', '+81 (Japan)', '+49 (Germany)', '+33 (France)'];
  const countries = ['India', 'United States', 'United Kingdom', 'United Arab Emirates', 'Singapore', 'Australia', 'China', 'Japan', 'Germany', 'France', 'Others'];

  const baseStates = ['Karnataka', 'Maharashtra', 'Delhi', 'Tamil Nadu', 'Gujarat', 'Uttar Pradesh', 'West Bengal', 'Telangana', 'Rajasthan', 'Others'];
  const states = withCurrentValue(baseStates, vendor?.state);

  const baseCities = ['Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad', 'Noida', 'Others'];
  const cities = withCurrentValue(baseCities, vendor?.city);

  // Payment terms: includes stored NET XX format and display format
  const basePaymentTerms = ['NET 7', 'NET 15', 'NET 30', 'NET 45', 'NET 60', 'NET 90', 'NET 120', '7 Days', '15 Days', '30 Days', '45 Days', '60 Days', '90 Days', '120 Days'];
  const paymentTerms = withCurrentValue(basePaymentTerms, vendor?.paymentTerms);

  const currencies = ['INR - Indian Rupee', 'USD - US Dollar', 'EUR - Euro', 'GBP - British Pound', 'AED - UAE Dirham', 'SGD - Singapore Dollar'];
  const accountTypes = ['Current Account', 'Saving Account', 'Overdraft Account', 'Cash Credit Account', 'Others'];
  const msmeStatuses = ['Micro', 'Small', 'Medium', 'Not MSME'];
  const isoCertifications = ['ISO 9001', 'ISO 14001', 'ISO 27001', 'ISO 45001', 'ISO 50001', 'Others'];
  const qualityCertifications = ['CE Certified', 'RoHS Compliant', 'BIS Certified', 'UL Certified', 'FCC Certified', 'Others'];
  const environmentalCertifications = ['ISO 14001', 'ISO 50001', 'Green Building', 'LEED Certified', 'Others'];
  const blacklistedOptions = ['No', 'Under Review', 'Yes'];
  const contractStatuses: VendorStatus[] = ['Active', 'On Hold', 'Pending', 'Inactive'];
  const preferredOptions = ['Yes', 'No'];
  const tagOptions = ['IT Hardware', 'Office Supplies', 'Services', 'Preferred Vendor', 'New Vendor', 'Critical Vendor'];
  const visibilityOptions = ['Internal Only', 'Procurement Team', 'Finance Team', 'Management', 'All Users'];

  // ── Form state (pre-populated from StoredVendor) ───────────────────────────
  const [formData, setFormData] = useState(() => createEditFormData(vendor));

  const [subCategoryOptions, setSubCategoryOptions] = useState<string[]>(
    formData.category
      ? withCurrentValue(subCategoriesMap[formData.category] ?? [], formData.subCategory)
      : []
  );

  useEffect(() => {
    const currentVendor = getVendorById(id!);
    const nextFormData = createEditFormData(currentVendor);
    setFormData(nextFormData);
    setSubCategoryOptions(
      nextFormData.category
        ? withCurrentValue(subCategoriesMap[nextFormData.category] ?? [], nextFormData.subCategory)
        : []
    );
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    const newValue = type === 'checkbox'
      ? checked
      : (name === 'phoneNumber' || name === 'mobileNumber' ? sanitizePhoneNumber(value) : value);

    setFormData(prev => {
      const updated = { ...prev, [name]: newValue };
      // Auto-fill billing when "same as registered" is toggled on
      if (name === 'sameAsRegistered' && checked) {
        updated.billingAddress = prev.registeredAddress;
      }
      return updated;
    });

    if (name === 'category') {
      setSubCategoryOptions(subCategoriesMap[value] ?? []);
      setFormData(prev => ({ ...prev, category: value, subCategory: '' }));
    }
  };

  const handleRatingChange = (fieldName: string, value: number) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleSave = () => {
    if (!vendor) return;
    if (!isValidPhoneNumber(formData.phoneNumber)) {
      toast.error('Phone number must contain exactly 10 digits.');
      return;
    }
    if (formData.mobileNumber && !isValidPhoneNumber(formData.mobileNumber)) {
      toast.error('Mobile number must contain exactly 10 digits.');
      return;
    }
    const phone = formData.phoneNumber ? `${formData.phone} ${formData.phoneNumber}` : '';
    const mobile = formData.mobileNumber ? `${formData.mobile} ${formData.mobileNumber}` : '';
    updateVendor(vendor.id, {
      ...getVendorUpdateAuditFields(currentAuthenticatedUser),
      lastUpdatedFormData: { ...formData },
      vendorCode: formData.vendorCode,
      name: formData.vendorName,
      category: formData.category,
      subCategory: formData.subCategory,
      vendorType: formData.vendorType,
      legalEntityName: formData.legalEntityName,
      primaryContact: formData.contactPerson,
      designation: formData.designation,
      email: formData.email,
      phone,
      mobile,
      alternateEmail: formData.alternateEmail,
      pan: formData.pan,
      website: formData.website,
      address: formData.registeredAddress,
      addressLine1: formData.registeredAddress,
      addressLine2: '',
      country: formData.country,
      state: formData.state,
      city: formData.city,
      zipCode: formData.pincode,
      billingAddressLine1: formData.billingAddress,
      billingAddressLine2: '',
      paymentTerms: formData.paymentTerms,
      currency: formData.currency,
      creditLimit: formData.creditLimit,
      bankName: formData.bankName,
      bankAccount: formData.accountNumber,
      ifscCode: formData.ifscCode,
      accountType: formData.accountType,
      msmeStatus: formData.msmeStatus,
      isoStatus: formData.isoStatus,
      qualityCertification: formData.qualityCertification,
      environmentalCertification: formData.environmentalCertification,
      // Convert 1-5 stars back to 0-100 scale
      performanceQuality: starsToScore(formData.qualityRating),
      performanceDelivery: starsToScore(formData.deliveryRating),
      performanceResponsiveness: starsToScore(formData.serviceRating),
      onboardedDate: formData.onboardingDate,
      onboardingDate: formData.onboardingDate,
      founded: formData.yearOfEstablishment,
      blacklisted: formData.blacklisted,
      preferredVendor: formData.preferredVendor,
      tags: formData.tags,
      internalNotes: formData.internalNotes,
      visibility: formData.visibility,
      gstCertificate: formData.gstCertificate,
      panCard: formData.panCard,
      businessRegistration: formData.businessRegistration,
      bankDetails: formData.bankDetails,
      isoCertificate: formData.isoCertificate,
      otherDocuments: formData.otherDocuments,
      // Map contract status → vendor status
      ...(formData.contractStatus && {
        status: formData.contractStatus as VendorStatus,
      }),
    });
    navigate('/vendors');
  };

  const StarRatingInput = ({
    value,
    onChange,
    name,
  }: {
    value: number;
    onChange: (name: string, val: number) => void;
    name: string;
  }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(name, star)}
          className="p-1 hover:bg-gray-100 rounded transition"
        >
          <Star
            size={20}
            className={star <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
          />
        </button>
      ))}
    </div>
  );

  if (!vendor) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Vendor not found.</p>
          <button onClick={() => navigate('/vendors')} className="mt-4 text-blue-600 hover:underline text-sm">
            Back to Vendor List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 sticky top-0 z-10 bg-white">
        <div className="px-8 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/vendors')}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit Vendor</h1>
              <p className="text-sm text-gray-600 mt-1">
                Editing <span className="font-medium text-gray-800">{vendor.name}</span>
                <span className="ml-2 text-gray-400">({vendor.id})</span>
                {' '}— Fields marked <span className="text-red-600">*</span> are required.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="px-8 py-2 space-y-12">

        {/* Section 1: Vendor Information */}
        <FormSection number={1} title="Vendor Information">
          <div className="grid grid-cols-2 gap-6">
            <FormField label="Vendor Name" required input={
              <input type="text" placeholder="Enter vendor name" name="vendorName" value={formData.vendorName} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            } />
            <FormField label="Vendor Code" input={
              <input type="text" disabled value={formData.vendorCode}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600" />
            } />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <FormField label="Category" required input={
              <select name="category" value={formData.category} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select category</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            } />
            <FormField label="Sub Category" input={
              <select name="subCategory" value={formData.subCategory} onChange={handleChange}
                disabled={!formData.category || subCategoryOptions.length === 0}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50">
                <option value="">Select sub category</option>
                {subCategoryOptions.map(sub => <option key={sub} value={sub}>{sub}</option>)}
              </select>
            } />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <FormField label="Vendor Type" required input={
              <select name="vendorType" value={formData.vendorType} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select vendor type</option>
                {vendorTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            } />
            <FormField label="PAN" input={
              <input type="text" placeholder="Enter PAN" name="pan" value={formData.pan} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            } />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <FormField label="Legal Entity Name" input={
              <input type="text" placeholder="Enter legal entity name" name="legalEntityName" value={formData.legalEntityName} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            } />
            <FormField label="Year of Establishment" input={
              <input
                type="text"
                placeholder="e.g. 2010"
                name="yearOfEstablishment"
                value={formData.yearOfEstablishment}
                onChange={handleChange}
                maxLength={4}
                pattern="\d{4}"
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            } />
          </div>

          <FormField label="Website" input={
            <input type="text" placeholder="Enter website URL" name="website" value={formData.website} onChange={handleChange}
              className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          } />
        </FormSection>

        {/* Section 2: Primary Contact */}
        <FormSection number={2} title="Primary Contact">
          <div className="grid grid-cols-2 gap-6">
            <FormField label="Contact Person" required input={
              <select name="contactPerson" value={formData.contactPerson} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select contact person</option>
                {/* Show stored contact as first option if not in default list */}
                {formData.contactPerson && !contacts.find(c => c.name === formData.contactPerson) && (
                  <option value={formData.contactPerson}>{formData.contactPerson}</option>
                )}
                {contacts.map(c => (
                  <option key={c.name} value={c.name}>{c.name} ({c.title})</option>
                ))}
              </select>
            } />
            <FormField label="Designation" input={
              <select name="designation" value={formData.designation} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select designation</option>
                {designations.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            } />
          </div>

          <FormField label="Email" required input={
            <input type="email" placeholder="name@company.com" name="email" value={formData.email} onChange={handleChange}
              className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          } />

          <div className="grid grid-cols-2 gap-6">
            <FormField label="Phone" required input={
              <div className="flex gap-2">
                <select name="phone" value={formData.phone} onChange={handleChange}
                  className="px-3 py-2 border border-gray-300 rounded-lg">
                  {phoneCodes.map(code => <option key={code} value={code}>{code}</option>)}
                </select>
                <input type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit phone number" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange}
                  className="flex-1 px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            } />
            <FormField label="Mobile" input={
              <div className="flex gap-2">
                <select name="mobile" value={formData.mobile} onChange={handleChange}
                  className="px-3 py-2 border border-gray-300 rounded-lg">
                  {phoneCodes.map(code => <option key={code} value={code}>{code}</option>)}
                </select>
                <input type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile number" name="mobileNumber" value={formData.mobileNumber} onChange={handleChange}
                  className="flex-1 px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            } />
          </div>

          <FormField label="Alternate Email" input={
            <input type="email" placeholder="Enter alternate email" name="alternateEmail" value={formData.alternateEmail} onChange={handleChange}
              className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          } />
        </FormSection>

        {/* Section 3: Business & Address Details */}
        <FormSection number={3} title="Business & Address Details">
          <FormField label="Registered Address" required input={
            <textarea placeholder="Enter registered address" name="registeredAddress" value={formData.registeredAddress} onChange={handleChange}
              rows={2} className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          } />

          <div className="grid grid-cols-2 gap-6">
            <FormField label="Country" required input={
              <select name="country" value={formData.country} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select country</option>
                {countries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            } />
            <FormField label="State" required input={
              <select name="state" value={formData.state} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select state</option>
                {states.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            } />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <FormField label="City" required input={
              <select name="city" value={formData.city} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select city</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            } />
            <FormField label="Pincode" required input={
              <input type="text" placeholder="Enter pincode" name="pincode" value={formData.pincode} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            } />
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" name="sameAsRegistered" checked={formData.sameAsRegistered} onChange={handleChange}
              className="w-4 h-4 rounded border-gray-300" />
            <label className="text-sm text-gray-700">Same as Registered Address</label>
          </div>

          <FormField label="Billing Address" input={
            <textarea placeholder="Enter billing address" name="billingAddress" value={formData.billingAddress} onChange={handleChange}
              rows={2} className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          } />
        </FormSection>

        {/* Section 4: Financial Details */}
        <FormSection number={4} title="Financial Details">
          <div className="grid grid-cols-2 gap-6">
            <FormField label="Payment Terms" input={
              <select name="paymentTerms" value={formData.paymentTerms} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select payment terms</option>
                {paymentTerms.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            } />
            <FormField label="Currency" required input={
              <select name="currency" value={formData.currency} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                {currencies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            } />
          </div>

          <FormField label="Credit Limit (INR)" input={
            <input type="text" placeholder="Enter amount" name="creditLimit" value={formData.creditLimit} onChange={handleChange}
              className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          } />

          <div className="grid grid-cols-2 gap-6">
            <FormField label="Bank Name" input={
              <input type="text" placeholder="Enter bank name" name="bankName" value={formData.bankName} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            } />
            <FormField label="Account Number" input={
              <input type="text" placeholder="Enter account number" name="accountNumber" value={formData.accountNumber} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            } />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <FormField label="IFSC Code" input={
              <input type="text" placeholder="Enter IFSC code" name="ifscCode" value={formData.ifscCode} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            } />
            <FormField label="Account Type" input={
              <select name="accountType" value={formData.accountType} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select account type</option>
                {accountTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            } />
          </div>
        </FormSection>

        {/* Section 5: Vendor Classification */}
        <FormSection number={5} title="Vendor Classification">
          <div className="grid grid-cols-2 gap-6">
            <FormField label="MSME Status" input={
              <select name="msmeStatus" value={formData.msmeStatus} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select status</option>
                {msmeStatuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            } />
            <FormField label="ISO Certification" input={
              <select name="isoStatus" value={formData.isoStatus} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select certification</option>
                {isoCertifications.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            } />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <FormField label="Quality Certification" input={
              <select name="qualityCertification" value={formData.qualityCertification} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select certification</option>
                {qualityCertifications.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            } />
            <FormField label="Environmental Certification" input={
              <select name="environmentalCertification" value={formData.environmentalCertification} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select certification</option>
                {environmentalCertifications.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            } />
          </div>
        </FormSection>

        {/* Section 6: Performance & Compliance */}
        <FormSection number={6} title="Performance & Compliance">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Quality Rating</label>
              <StarRatingInput value={formData.qualityRating} onChange={handleRatingChange} name="qualityRating" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Blacklisted</label>
              <select name="blacklisted" value={formData.blacklisted} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select status</option>
                {blacklistedOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Delivery Rating</label>
              <StarRatingInput value={formData.deliveryRating} onChange={handleRatingChange} name="deliveryRating" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contract Status</label>
              <select name="contractStatus" value={formData.contractStatus} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select status</option>
                {contractStatuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Service Rating</label>
              <StarRatingInput value={formData.serviceRating} onChange={handleRatingChange} name="serviceRating" />
            </div>
            <FormField label="Onboarding Date" input={
              <input type="date" name="onboardingDate" value={formData.onboardingDate} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            } />
          </div>

          <FormField label="Preferred Vendor" input={
            <select name="preferredVendor" value={formData.preferredVendor} onChange={handleChange}
              className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select status</option>
              {preferredOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          } />
        </FormSection>

        {/* Section 7: Documents */}
        <FormSection number={7} title="Documents">
          <div className="border-2 border-dashed border-blue-300 rounded-lg p-2 text-center mb-6">
            <Cloud className="w-12 h-12 text-blue-400mb-3" />
            <p className="text-gray-700 font-medium mb-2">Drag and drop files here</p>
            <p className="text-gray-500 text-sm mb-4">or click to upload</p>
            <p className="text-gray-500 text-xs mb-2">Supported files: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG</p>
            <p className="text-gray-500 text-xs">Max file size: 10MB</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-4">Document Checklist</label>
            <div className="grid grid-cols-2 gap-4">
              {[
                { name: 'gstCertificate', label: 'GST Certificate' },
                { name: 'bankDetails', label: 'Bank Details' },
                { name: 'panCard', label: 'PAN Card' },
                { name: 'isoCertificate', label: 'ISO Certificate' },
                { name: 'businessRegistration', label: 'Business Registration' },
                { name: 'otherDocuments', label: 'Other Documents' },
              ].map(doc => (
                <div key={doc.name} className="flex items-center gap-2">
                  <input type="checkbox" name={doc.name} checked={(formData as Record<string, unknown>)[doc.name] as boolean}
                    onChange={handleChange} className="w-4 h-4 rounded border-gray-300" />
                  <label className="text-sm text-gray-700">{doc.label}</label>
                </div>
              ))}
            </div>
          </div>
        </FormSection>

        {/* Section 8: Additional Information */}
        <FormSection number={8} title="Additional Information">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Tags</label>
              <select multiple name="tags" value={formData.tags}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, o => o.value);
                  setFormData(prev => ({ ...prev, tags: selected }));
                }}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                size={6}>
                {tagOptions.map(tag => <option key={tag} value={tag}>{tag}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-2">+ Create New Tag</p>
            </div>

            <FormField label="Visibility" input={
              <select name="visibility" value={formData.visibility} onChange={handleChange}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select visibility</option>
                {visibilityOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            } />
          </div>

          <FormField label="Internal Notes" input={
            <textarea placeholder="Add any internal notes" name="internalNotes" value={formData.internalNotes} onChange={handleChange}
              rows={4} maxLength={1000}
              className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          } />
          <p className="text-xs text-gray-500 text-right">{formData.internalNotes.length}/1000 characters</p>
        </FormSection>

        {/* Bottom Actions */}
        <div className="flex gap-3 py-2 border-t border-gray-200">
          <button type="button" onClick={() => navigate('/vendors')}
            className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">
            Cancel
          </button>
          <button type="button" onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function FormSection({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="border-l-4 border-blue-600 pl-6 py-2">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
          {number}
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="space-y-4">
        {children}
      </div>
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
