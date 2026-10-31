import type { AddressDetails } from "@/lib/addressTypes";
import { sanitizePhoneNumber } from "@/lib/phoneValidation";

const DEFAULT_COUNTRIES = [
  "India",
  "United States",
  "United Kingdom",
  "United Arab Emirates",
  "Singapore",
  "Australia",
  "China",
  "Japan",
  "Germany",
  "France",
  "Others",
];

const DEFAULT_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Others",
];

const PHONE_CODES = ["+91", "+1", "+44", "+971", "+65", "+61", "+86", "+81", "+49", "+33"];

const controlClass =
  "h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function AddressColumn({
  title,
  address,
  onChange,
  countries,
  states,
  stateListId,
}: {
  title: string;
  address: AddressDetails;
  onChange: (patch: Partial<AddressDetails>) => void;
  countries: string[];
  states: string[];
  stateListId: string;
}) {
  const set = (field: keyof AddressDetails, value: string) => onChange({ [field]: value });

  return (
    <div className="min-w-0">
      <h3 className="mb-5 text-base font-semibold text-gray-900">{title}</h3>
      <div className="grid grid-cols-[minmax(110px,145px)_minmax(0,1fr)] items-center gap-x-4 gap-y-4">
        <label htmlFor={`${stateListId}-attention`} className="text-sm font-medium text-gray-700">
          Attention
        </label>
        <input
          id={`${stateListId}-attention`}
          value={address.attention}
          onChange={(event) => set("attention", event.target.value)}
          className={controlClass}
        />

        <label htmlFor={`${stateListId}-country`} className="text-sm font-medium text-gray-700">
          Country/Region
        </label>
        <select
          id={`${stateListId}-country`}
          value={address.country}
          onChange={(event) => set("country", event.target.value)}
          className={`${controlClass} cursor-pointer`}
        >
          <option value="">Select</option>
          {countries.map((country) => <option key={country} value={country}>{country}</option>)}
        </select>

        <label htmlFor={`${stateListId}-address-line-1`} className="text-sm font-medium text-gray-700">
          Address line 1
        </label>
        <textarea
          id={`${stateListId}-address-line-1`}
          rows={2}
          value={address.addressLine1}
          onChange={(event) => set("addressLine1", event.target.value)}
          placeholder="Street 1"
          className={`${controlClass} h-auto resize-y py-2`}
        />

        <label htmlFor={`${stateListId}-address-line-2`} className="text-sm font-medium text-gray-700">
          Address line 2
        </label>
        <textarea
          id={`${stateListId}-address-line-2`}
          rows={2}
          value={address.addressLine2}
          onChange={(event) => set("addressLine2", event.target.value)}
          placeholder="Street 2"
          className={`${controlClass} h-auto resize-y py-2`}
        />

        <label htmlFor={`${stateListId}-city`} className="text-sm font-medium text-gray-700">
          City
        </label>
        <input
          id={`${stateListId}-city`}
          value={address.city}
          onChange={(event) => set("city", event.target.value)}
          className={controlClass}
        />

        <label htmlFor={`${stateListId}-state`} className="text-sm font-medium text-gray-700">
          State
        </label>
        <div>
          <input
            id={`${stateListId}-state`}
            list={`${stateListId}-states`}
            value={address.state}
            onChange={(event) => set("state", event.target.value)}
            placeholder="Select or type to add"
            className={controlClass}
          />
          <datalist id={`${stateListId}-states`}>
            {states.map((state) => <option key={state} value={state} />)}
          </datalist>
        </div>

        <label htmlFor={`${stateListId}-pin-code`} className="text-sm font-medium text-gray-700">
          Pin Code
        </label>
        <input
          id={`${stateListId}-pin-code`}
          inputMode="numeric"
          maxLength={10}
          value={address.pinCode}
          onChange={(event) => set("pinCode", event.target.value.replace(/\D/g, "").slice(0, 10))}
          className={controlClass}
        />

        <label htmlFor={`${stateListId}-phone`} className="text-sm font-medium text-gray-700">
          Phone
        </label>
        <div className="flex min-w-0">
          <select
            value={address.phoneCountryCode}
            onChange={(event) => set("phoneCountryCode", event.target.value)}
            aria-label={`${title} phone country code`}
            className={`${controlClass} w-20 shrink-0 rounded-r-none cursor-pointer`}
          >
            {PHONE_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
          <input
            id={`${stateListId}-phone`}
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={address.phone}
            onChange={(event) => set("phone", sanitizePhoneNumber(event.target.value))}
            className={`${controlClass} min-w-0 rounded-l-none border-l-0`}
          />
        </div>

        <label htmlFor={`${stateListId}-fax`} className="text-sm font-medium text-gray-700">
          Fax Number
        </label>
        <input
          id={`${stateListId}-fax`}
          value={address.faxNumber}
          onChange={(event) => set("faxNumber", event.target.value)}
          className={controlClass}
        />
      </div>
    </div>
  );
}

export default function AddressPairFields({
  billing,
  shipping,
  onBillingChange,
  onShippingChange,
  onCopyBilling,
  countries = DEFAULT_COUNTRIES,
  states = DEFAULT_STATES,
}: {
  billing: AddressDetails;
  shipping: AddressDetails;
  onBillingChange: (patch: Partial<AddressDetails>) => void;
  onShippingChange: (patch: Partial<AddressDetails>) => void;
  onCopyBilling?: () => void;
  countries?: string[];
  states?: string[];
}) {
  const copyBillingToShipping = () => {
    onShippingChange({ ...billing });
    onCopyBilling?.();
  };

  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-x-14">
      <AddressColumn
        title="Billing Address"
        address={billing}
        onChange={onBillingChange}
        countries={countries}
        states={states}
        stateListId="billing-address"
      />
      <div className="min-w-0">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-gray-900">Shipping Address</h3>
          <button
            type="button"
            onClick={copyBillingToShipping}
            className="shrink-0 text-sm font-medium text-blue-600 transition-colors hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-200 rounded"
          >
            ↓ Copy billing address
          </button>
        </div>
        <AddressColumn
          title=""
          address={shipping}
          onChange={onShippingChange}
          countries={countries}
          states={states}
          stateListId="shipping-address"
        />
      </div>
    </div>
  );
}