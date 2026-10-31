---
name: Vendor Selection at Shop (Pre-Cart) Flow
description: Architecture of the refactored procurement workflow — client selects vendor on Shop page before adding to cart; Draft POs auto-created at order placement.
---

## Rule
Vendor selection is required before add-to-cart and is snapshotted onto the CartItem. The master order may change that selection while its PO is Draft. A confirmed PO locks the selection; it must first be cancelled from Vendor Order Details, after which an active sub-order can be assigned a replacement vendor or cancelled.

**Why:** The pre-cart snapshot keeps pricing, stock, and lead time deterministic, while the Draft window supports correction before procurement commits the vendor. Cancelling the supplier PO must not silently cancel the customer’s order item.

**How to apply:** Keep PO lifecycle status in the shared store. When a PO is cancelled, reopen only active covered sub-orders, clear their old vendor allocation, and offer vendor reselection or explicit sub-order cancellation in Order Details.

## Key Data Flow

1. **CartItem** (`CartContext.tsx`) now carries:
   - `selectedVendorId`, `selectedVendorName`, `vendorPrice`, `landedCost`, `gstSnapshot`, `hsnSnapshot`
   - Cart lines are keyed by `productCode + vendorId` so the same product from different vendors is a separate line.
   - `vendorAllocations` is now a single-entry record kept only for stock-release on cancellation.

2. **OrderCartItem** (`MyOrdersContext.tsx`) mirrors CartItem's vendor snapshot fields.

3. **autoCreateDraftPOs()** in `MyOrdersContext.tsx`:
   - Called immediately inside `addOrder()` after saving the master order.
   - Groups cart items by `selectedVendorId` → one Draft PO per vendor.
   - Uses `savePO()` from purchaseOrderStore; PO status = `"Draft"`.

4. **ShopPage ProductCard** — inline vendor selection:
   - Loads `computeVendorComparisons()` on mount.
   - Shows recommended vendor (index 0) as a quick-pick chip.
   - Expandable panel for all vendors with Recommended / Fastest / Top Rated badges.
   - Add to Cart disabled until a vendor is selected.

5. **ProductDetailPage** — full vendor selection panel in price column:
   - Same logic as ProductCard but more spacious.
   - Related Products "Cart" button replaced with "View & Select Vendor →" navigation.

6. **CartPage**:
   - Cart item rows show `selectedVendorName` + landed cost in the Product Details column.
   - SuggestedCard button changed to "View & Select Vendor →" (navigates to product detail page).

7. **OrderDetailsPage**:
   - "Vendor Selected Summary" tab renamed to "Draft Purchase Orders".
   - `cartItemsToSubOrders()` now passes `selectedVendorId` / `selectedVendorName` from cart items.
    - Vendor column in Sub Orders table shows the selected vendor and offers Change Vendor while the related PO is still Draft.
   - "Draft Purchase Orders" tab: lists auto-created Draft POs per vendor with Confirm → `/vendor-orders/:po` and Reject buttons.
   - VendorSelectionModal JSX removed from this page.

## How to Apply
- Never auto-assign a vendor after order placement — vendor must come from the CartItem snapshot or an explicit Draft-PO change in the master order.
- Confirm button in Draft POs tab calls `updatePO(po.poNumber, { status: "Confirmed" })` then navigates to the PO detail page for PDF/email.
- The old `handleCreatePurchaseOrders` and `VendorSelectionModal`/`VendorSelectionTab`/`VendorSelectedSummaryTab` components remain in OrderDetailsPage but are unreachable UI (no tab or button references them) — safe to fully remove in a later cleanup.

## Pricing boundary
Customer-facing cart and order totals use the selected vendor's snapshotted client selling price before GST plus its GST snapshot. Supplier POs retain the raw vendor price and landed cost; the catalog price is a legacy fallback.

**Why:** The vendor selector is the user's commercial choice. Keeping raw procurement values separate from the client selling-price snapshot prevents a vendor's cost from being shown as the amount charged to the client.

**How to apply:** Any new cart, checkout, confirmation, invoice, or order-summary surface must resolve its client unit price and tax rate from the cart snapshot before reading `priceNum`; supplier PO calculations must continue using landed cost.

## Shared product-type presentation
The vendor product table and Shop vendor selectors use one shared rule set for pricing model, quantity label, availability, and lead-time units. Digital-only products show unlimited/instant provisioning; hybrid products retain stock-based availability with day lead time and instant service.

**Why:** These fields previously diverged between the admin catalog and client shopping flow, making the same product appear to have different commercial terms depending on the page.

**How to apply:** Reuse the shared product-type rule helpers whenever adding another product comparison, catalog card, or vendor-selection surface.

## Physical MOQ eligibility
A physical vendor offer is selectable and recommendable only when its available stock meets that vendor's own MOQ. Keep below-MOQ offers visible for comparison, but hide their price, mark them unavailable, and block selection/cart addition. Digital-only offers are exempt from physical stock and MOQ checks.

**Why:** Showing an offer as purchasable when it cannot fulfill its minimum order quantity misleads clients; applying a physical MOQ to digital licenses would incorrectly block valid subscriptions.

**How to apply:** Use vendor-specific comparison data for availability, price visibility, recommendation, and selected quantity. Keep the digital-only exception consistent between Shop and Product Detail.

## Digital variation pricing
Digital product variation fields and option price adjustments are owned by each `VendorProduct`, then carried through vendor comparisons to Shop after the client selects a vendor. Shop adds the selected total to the vendor base price before landed-cost and client-price calculations. Master-catalog variation data is legacy-only and must not drive digital configuration.

**Why:** The same digital service can expose different options and prices from different vendors, so a master-level variation list cannot represent the commercial offer accurately.

**How to apply:** Keep variation editing in the vendor-product add/edit flow; preserve physical-product behavior and resolve Shop configuration fields from the selected vendor snapshot.
