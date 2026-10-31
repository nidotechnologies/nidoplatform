import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import VendorContractsPage from "@/pages/VendorContractsPage";

function renderVendorContractsPage(scope: { vendorId?: string; vendorName?: string } = {}) {
  return render(
    <MemoryRouter>
      <VendorContractsPage {...scope} />
    </MemoryRouter>,
  );
}

describe("Vendor contract detail page", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("edits contract sections in a dialog and updates the detail view", () => {
    renderVendorContractsPage();

    fireEvent.click(screen.getByRole("button", { name: "Edit Contract Overview" }));
    fireEvent.change(screen.getByLabelText("Contract Name"), {
      target: { value: "Updated Vendor Supply Agreement" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(screen.getByRole("heading", { name: "Updated Vendor Supply Agreement" })).toBeTruthy();
  });

  it("offers contract download from the matching three-dot actions menu", () => {
    renderVendorContractsPage();

    fireEvent.click(screen.getByRole("button", { name: "Contract actions" }));

    expect(screen.getByRole("button", { name: "Download Contract" })).toBeTruthy();
  });

  it("shows the contract-detail sections from the reference layout", () => {
    renderVendorContractsPage();

    for (const heading of [
      "Contract Overview",
      "2. Response & Resolution Targets",
      "1. Commercial Terms",
      "3. Services Covered",
      "5. Data Security & Compliance",
      "6. Confidentiality Clause",
      "7. Support & Escalation Matrix",
      "8. Renewal & Termination",
      "2. Subscription & Licensing",
      "4. SLA Commitments",
      "Renewal Information",
      "Support Information",
      "Key Contacts",
      "Reminders",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    }

    expect(screen.getByRole("button", { name: "Create Support Ticket" })).toBeTruthy();
  });

  it("shows saved values in the contract overview and persists section changes", () => {
    const storageKey = "nido_vendor_contracts_V-TEST";
    const savedContract = {
      id: "CONTRACT-SECRET",
      name: "Secret Contract Title",
      type: "Supply Agreement",
      startDate: "Jan 1, 2025",
      endDate: "Jan 1, 2026",
      value: "₹20,000",
      paymentTerms: "Net 30",
      status: "Active",
      autoRenewal: true,
      renewalReminder: "30 Days",
      expiryIn: null,
      contacts: {
        owner: "Hidden Owner",
        vendor: "Hidden Vendor Contact",
        vendorPhone: "1111111111",
        procurement: "Hidden Procurement",
        procurementPhone: "2222222222",
      },
      terms: {
        priceValidity: "Hidden price term",
        deliveryTerm: "FOB",
        warrantyPeriod: "Hidden warranty",
        slaUptime: "99%",
        penaltyClause: "Hidden penalty",
        governingLaw: "Hidden governing law",
      },
      details: {
        purpose: "Hidden contract purpose",
        billingModel: "Hidden billing model",
      },
    };
    const serialized = JSON.stringify([savedContract]);
    localStorage.setItem(storageKey, serialized);

    renderVendorContractsPage({ vendorId: "V-TEST", vendorName: "Test Vendor" });

    expect(screen.getByRole("button", { name: "CONTRACT-SECRET" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "CONTRACT-SECRET" }));
    expect(screen.getByRole("heading", { name: "Contract Overview" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Secret Contract Title" })).toBeTruthy();
    expect(screen.getByText("Hidden contract purpose")).toBeTruthy();
    expect(screen.getAllByText("Hidden Vendor Contact").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Contract actions" })).toBeTruthy();
    for (const section of [
      "Contract Overview",
      "2. Response & Resolution Targets",
      "1. Commercial Terms",
      "3. Services Covered",
      "5. Data Security & Compliance",
      "6. Confidentiality Clause",
      "7. Support & Escalation Matrix",
      "8. Renewal & Termination",
      "2. Subscription & Licensing",
      "4. SLA Commitments",
      "Renewal Information",
      "Support Information",
      "Key Contacts",
      "Reminders",
    ]) {
      expect(screen.getByRole("button", { name: `Edit ${section}` })).toBeTruthy();
    }
    expect(localStorage.getItem(storageKey)).toBe(serialized);

    fireEvent.click(screen.getByRole("button", { name: "Edit Contract Overview" }));
    expect(screen.getByLabelText("Contract Name")).toHaveProperty("value", "Secret Contract Title");
    fireEvent.change(screen.getByLabelText("Contract Purpose"), {
      target: { value: "Updated purpose" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(screen.getByText("Updated purpose")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Secret Contract Title" })).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    expect(saved[0].details.billingModel).toBe("Hidden billing model");
    expect(saved[0].details.purpose).toBe("Updated purpose");
  });

  it("adds a vendor contract from the list and opens its overview", () => {
    const storageKey = "nido_vendor_contracts_V-EMPTY";
    renderVendorContractsPage({ vendorId: "V-EMPTY", vendorName: "Empty Vendor" });

    expect(screen.getByRole("heading", { name: "Contracts" })).toBeTruthy();
    expect(screen.getByText("No contracts yet")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "All Contracts" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Vendor contract list actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Add Contract" }));
    fireEvent.change(screen.getByLabelText("Contract name"), {
      target: { value: "New Vendor Agreement" },
    });
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-11-01" },
    });
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2027-10-31" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Contract" }));

    expect(screen.getByRole("heading", { name: "New Vendor Agreement" })).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toMatch(/^CT-\d{4}-\d{3}$/);
    expect(saved[0]).toMatchObject({ startDate: "2026-11-01", endDate: "2027-10-31" });
  });

  it("archives a vendor contract and opens its archived details read-only", () => {
    const storageKey = "nido_vendor_contracts_V-ARCHIVE";
    localStorage.setItem(storageKey, JSON.stringify([{
      id: "CT-2026-ARCH",
      name: "Archived Vendor Agreement",
      type: "Supply Agreement",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      value: "₹20,000",
      paymentTerms: "Net 30",
      status: "Active",
      autoRenewal: false,
      renewalReminder: "30 Days Before Expiry",
      expiryIn: null,
      contacts: {
        owner: "Owner",
        vendor: "Vendor Contact",
        vendorPhone: "1111111111",
        procurement: "Procurement",
        procurementPhone: "2222222222",
      },
      terms: {
        priceValidity: "Till Dec 31, 2026",
        deliveryTerm: "FOB",
        warrantyPeriod: "1 Year",
        slaUptime: "99%",
        penaltyClause: "Applicable",
        governingLaw: "India",
      },
      details: { purpose: "Archived details remain available" },
    }]));

    renderVendorContractsPage({ vendorId: "V-ARCHIVE", vendorName: "Archive Vendor" });

    fireEvent.click(screen.getByRole("button", { name: "Archive CT-2026-ARCH" }));
    expect(JSON.parse(localStorage.getItem(storageKey) || "[]")[0].status).toBe("Archived");
    expect(screen.queryByRole("button", { name: "CT-2026-ARCH" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Vendor contract list actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Archived Contracts (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "CT-2026-ARCH" }));

    expect(screen.getByText("Archived · Read only")).toBeTruthy();
    expect(screen.getByText("Archived details remain available")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit Contract Overview" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit 1. Commercial Terms" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Create Support Ticket" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Back to Contracts" }));
    expect(screen.getByRole("heading", { name: "Archived Contracts" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "CT-2026-ARCH" })).toBeTruthy();
  });

  it("opens the detail overview editor from the vendor list Edit action", () => {
    const storageKey = "nido_vendor_contracts_V-EDIT";
    localStorage.setItem(storageKey, JSON.stringify([{
      id: "CT-2026-EDIT",
      name: "Editable Agreement",
      type: "Supply Agreement",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      value: "₹20,000",
      paymentTerms: "Net 30",
      status: "Active",
      autoRenewal: false,
      renewalReminder: "30 Days Before Expiry",
      expiryIn: null,
      contacts: { owner: "Owner", vendor: "Vendor", vendorPhone: "", procurement: "Procurement", procurementPhone: "" },
      terms: { priceValidity: "", deliveryTerm: "", warrantyPeriod: "", slaUptime: "", penaltyClause: "", governingLaw: "" },
      details: {},
    }]));

    renderVendorContractsPage({ vendorId: "V-EDIT", vendorName: "Edit Vendor" });
    fireEvent.click(screen.getByRole("button", { name: "Edit CT-2026-EDIT" }));

    expect(screen.getByRole("heading", { name: "Edit Contract Overview" })).toBeTruthy();
  });
});
