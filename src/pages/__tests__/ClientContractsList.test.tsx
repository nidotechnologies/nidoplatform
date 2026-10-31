import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ClientContractsList from "@/pages/ClientContractsList";
import { getClientContract, getClientContracts, saveClientContract } from "@/lib/clientDataStore";

describe("ClientContractsList", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("creates a contract with its ID, name, and contract dates", () => {
    const onCreated = vi.fn();
    render(
      <ClientContractsList
        clientId="client-contract-list-test"
        clientName="Acme"
        contracts={[]}
        onOpenContract={vi.fn()}
        onEditContract={vi.fn()}
        onCreated={onCreated}
        onShowArchived={vi.fn()}
        onShowActive={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Contract list actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Add Contract" }));
    fireEvent.change(screen.getByLabelText("Contract ID"), { target: { value: "ACME-2026" } });
    fireEvent.change(screen.getByLabelText("Contract name"), { target: { value: "Managed Services" } });
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-11-01" } });
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2027-10-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Contract" }));

    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({
      clientId: "client-contract-list-test",
      contractId: "ACME-2026",
      contractTitle: "Managed Services",
      startDate: "2026-11-01",
      endDate: "2027-10-31",
    }));
    expect(getClientContracts("client-contract-list-test")).toHaveLength(1);
  });

  it("opens the existing overview when a contract ID is selected", () => {
    const onOpenContract = vi.fn();
    render(
      <ClientContractsList
        clientId="client-contract-list-test"
        clientName="Acme"
        contracts={[{
          clientId: "client-contract-list-test",
          contractId: "ACME-2026",
          contractTitle: "Managed Services",
          startDate: "2026-11-01",
          endDate: "2027-10-31",
          data: {},
          updatedAt: "2026-10-20T00:00:00.000Z",
        }]}
        onOpenContract={onOpenContract}
        onEditContract={vi.fn()}
        onCreated={vi.fn()}
        onShowArchived={vi.fn()}
        onShowActive={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "ACME-2026" }));

    expect(onOpenContract).toHaveBeenCalledWith("ACME-2026");
  });

  it("opens edit from the active list and archives without deleting contract details", () => {
    const contract = {
      clientId: "client-contract-list-test",
      contractId: "ACME-2026",
      contractTitle: "Managed Services",
      startDate: "2026-11-01",
      endDate: "2027-10-31",
      data: { overview: { purpose: "Support" } },
      updatedAt: "2026-10-20T00:00:00.000Z",
    };
    saveClientContract(contract);
    const onEditContract = vi.fn();
    const onShowArchived = vi.fn();
    render(
      <ClientContractsList
        clientId={contract.clientId}
        clientName="Acme"
        contracts={[contract]}
        onOpenContract={vi.fn()}
        onEditContract={onEditContract}
        onCreated={vi.fn()}
        onShowArchived={onShowArchived}
        onShowActive={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit ACME-2026" }));
    expect(onEditContract).toHaveBeenCalledWith("ACME-2026");

    fireEvent.click(screen.getByRole("button", { name: "Archive ACME-2026" }));
    expect(getClientContract(contract.clientId, contract.contractId)).toMatchObject({
      contractTitle: "Managed Services",
      data: { overview: { purpose: "Support" } },
      archivedAt: expect.any(String),
    });
    expect(screen.queryByRole("button", { name: "ACME-2026" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Contract list actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Archived Contracts (1)" }));
    expect(onShowArchived).toHaveBeenCalledOnce();
  });

  it("shows archived contracts without edit or archive actions", () => {
    const archivedContract = {
      clientId: "client-contract-list-test",
      contractId: "ACME-ARCHIVED",
      contractTitle: "Old Agreement",
      archivedAt: "2026-10-20T00:00:00.000Z",
      data: {},
      updatedAt: "2026-10-20T00:00:00.000Z",
    };
    const onOpenContract = vi.fn();
    const onShowActive = vi.fn();
    render(
      <ClientContractsList
        clientId={archivedContract.clientId}
        clientName="Acme"
        contracts={[archivedContract]}
        showArchived
        onOpenContract={onOpenContract}
        onEditContract={vi.fn()}
        onCreated={vi.fn()}
        onShowArchived={vi.fn()}
        onShowActive={onShowActive}
      />,
    );

    expect(screen.getByRole("heading", { name: "Archived Contracts" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ACME-ARCHIVED" }));
    expect(onOpenContract).toHaveBeenCalledWith("ACME-ARCHIVED");
    expect(screen.queryByRole("button", { name: "Edit ACME-ARCHIVED" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Archive ACME-ARCHIVED" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Contract list actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Active Contracts (0)" }));
    expect(onShowActive).toHaveBeenCalledOnce();
  });
});
