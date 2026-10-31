export interface AddressDetails {
  attention: string;
  country: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pinCode: string;
  phoneCountryCode: string;
  phone: string;
  faxNumber: string;
}

export function createEmptyAddress(): AddressDetails {
  return {
    attention: "",
    country: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pinCode: "",
    phoneCountryCode: "+91",
    phone: "",
    faxNumber: "",
  };
}

export function formatAddressDetails(address: AddressDetails): string {
  return [
    address.attention,
    address.addressLine1,
    address.addressLine2,
    address.city,
    address.state,
    address.country,
    address.pinCode,
  ].filter(Boolean).join(", ");
}

export function normalizePanInput(value: string): string {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  let result = "";

  for (const character of raw) {
    const position = result.length;
    const isLetter = /[A-Z]/.test(character);
    const isDigit = /[0-9]/.test(character);
    const validForPosition =
      (position < 5 && isLetter) ||
      (position >= 5 && position < 9 && isDigit) ||
      (position === 9 && isLetter);

    if (validForPosition) result += character;
    if (result.length === 10) break;
  }

  return result;
}

export function normalizeGstInput(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
}

export function isValidPan(value: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value);
}

export function isValidGst(value: string): boolean {
  return /^[A-Z0-9]{15}$/.test(value);
}