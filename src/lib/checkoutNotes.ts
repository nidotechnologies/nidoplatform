export const CHECKOUT_NOTE_MAX_LENGTH = 100;
export const DELIVERY_INSTRUCTIONS_KEY = "nido_delivery_instructions";
export const ORDER_NOTES_KEY = "nido_order_notes";

export function limitCheckoutNote(value: string): string {
  return value.slice(0, CHECKOUT_NOTE_MAX_LENGTH);
}