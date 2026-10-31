import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MyOrdersProvider } from "@/contexts/MyOrdersContext";
import MyRenewalsPage from "@/pages/MyRenewalsPage";

function renderRenewalsPage() {
  return render(
    <MyOrdersProvider>
      <MyRenewalsPage />
    </MyOrdersProvider>,
  );
}

function openCreateRenewal() {
  fireEvent.click(screen.getByRole("button", { name: "New Renewal" }));
}

describe("Create New Renewal live data", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("shows an empty state instead of sample clients and orders when no live records exist", () => {
    renderRenewalsPage();
    openCreateRenewal();

    expect(screen.getByText(/No saved client records are available/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Next/ })).toHaveProperty("disabled", true);
    expect(screen.queryByRole("option", { name: "Raj Manufacturing" })).toBeNull();
  });

  it("explains when a live client has no eligible delivered orders", () => {
    localStorage.setItem("nido_clients_v3:anonymous", JSON.stringify([
      { id: "client-live", name: "Live Customer", status: "active", email: "buyer@example.com" },
    ]));

    renderRenewalsPage();
    openCreateRenewal();

    expect(screen.getByText(/No delivered, renewal-eligible order items/)).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Raj Manufacturing" })).toBeNull();
  });

  it("shows only digital sub-orders and creates renewals only for the selected sub-orders", () => {
    localStorage.setItem("nido_clients_v3:anonymous", JSON.stringify([
      { id: "client-live", name: "Live Customer", status: "active", email: "buyer@example.com" },
    ]));
    localStorage.setItem("nido_my_orders", JSON.stringify([
      {
        id: "ORD-LIVE-1",
        clientId: "client-live",
        client: "Live Customer",
        status: "Delivered",
        orderDate: "2026-10-10",
        deliveryDate: "2026-10-11",
        cartItems: [
          {
            id: 1,
            name: "Live SaaS License",
            image: "",
            priceNum: 125,
            quantity: 7,
            category: "Software",
            specs: [],
            moq: 1,
            clientId: "client-live",
            productType: "Subscription",
            fulfillmentType: "digital",
            renewalStartDate: "2026-11-01",
            renewalTerm: "1 Year",
            reminders: ["30"],
            subOrderId: "SO-LIVE-1",
          },
          {
            id: 2,
            name: "Live Cloud License",
            image: "",
            priceNum: 80,
            quantity: 3,
            category: "Software",
            specs: [],
            moq: 1,
            clientId: "client-live",
            productType: "Cloud Subscription",
            fulfillmentType: "digital",
            renewalStartDate: "2026-11-01",
            renewalTerm: "1 Year",
            reminders: ["30"],
            subOrderId: "SO-LIVE-2",
          },
          {
            id: 3,
            name: "Unselected Digital License",
            image: "",
            priceNum: 55,
            quantity: 2,
            category: "Software",
            specs: [],
            moq: 1,
            clientId: "client-live",
            productType: "Digital Product",
            fulfillmentType: "digital",
            renewalStartDate: "2026-11-01",
            renewalTerm: "1 Year",
            reminders: ["30"],
            subOrderId: "SO-LIVE-3",
          },
          {
            id: 4,
            name: "Physical Item",
            image: "",
            priceNum: 50,
            quantity: 1,
            category: "Hardware",
            specs: [],
            moq: 1,
            clientId: "client-live",
            productType: "Physical Product",
            fulfillmentType: "physical",
            subOrderId: "SO-PHYSICAL",
          },
          {
            id: 5,
            name: "Hybrid Bundle",
            image: "",
            priceNum: 90,
            quantity: 1,
            category: "Software",
            specs: [],
            moq: 1,
            clientId: "client-live",
            productType: "Hybrid Product",
            fulfillmentType: "hybrid",
            subOrderId: "SO-HYBRID",
          },
        ],
      },
    ]));

    renderRenewalsPage();
    openCreateRenewal();

    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    expect(selects[0].value).toBe("");
    expect(Array.from(selects[0].options).map(option => option.text)).toContain("Live Customer");
    expect(Array.from(selects[0].options).map(option => option.text)).not.toContain("Raj Manufacturing");

    fireEvent.change(selects[0], { target: { value: "Live Customer" } });
    fireEvent.change(selects[1], { target: { value: "ORD-LIVE-1" } });
    fireEvent.click(screen.getByText("Select sub-orders"));
    const digitalSubOrderCheckboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(digitalSubOrderCheckboxes).toHaveLength(3);
    fireEvent.click(digitalSubOrderCheckboxes[0]);
    fireEvent.click(digitalSubOrderCheckboxes[1]);
    expect(screen.getAllByText("Live SaaS License").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Live Cloud License").length).toBeGreaterThan(0);
    expect(screen.getByText(/Qty: 7/)).toBeTruthy();
    expect(screen.getAllByText(/₹125\.00/).length).toBeGreaterThan(0);

    fireEvent.change(selects[3], { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    fireEvent.click(screen.getByLabelText(/buyer@example\.com/));
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create Renewal" }));

    expect(screen.getByText("2 Renewals Created Successfully!")).toBeTruthy();
    expect(screen.getByText("Live SaaS License")).toBeTruthy();
    expect(screen.getByText("Live Cloud License")).toBeTruthy();
    expect(screen.queryByText("Unselected Digital License")).toBeNull();
    expect(screen.queryByText("Physical Item")).toBeNull();
    expect(screen.queryByText("Hybrid Bundle")).toBeNull();
    expect(Array.from(selects[1].options).map(option => option.text)).toContain("ORD-LIVE-1");
  });
});
