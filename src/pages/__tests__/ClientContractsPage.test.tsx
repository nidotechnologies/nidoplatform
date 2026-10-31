import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ContractDetailView } from "@/pages/ClientContractsPage";
import { getClientContract, saveClientContract } from "@/lib/clientDataStore";

const emptyListEditors = [
  ["3. Services Covered", "Enter service name"],
  ["4. SLA Commitments", "Enter SLA commitment"],
  ["5. Data Security & Compliance", "Enter security feature"],
  ["8. Renewal & Termination", "Enter renewal or termination detail"],
  ["Reminders", "Enter reminder details"],
] as const;

const sectionSaveCases = [
  {
    title: "4. SLA Commitments",
    fields: [
      { kind: "text", placeholder: "Enter SLA commitment", value: "Business-hours response" },
      { kind: "text", placeholder: "Enter target", value: "4 hours" },
    ],
    expectedText: "Business-hours response",
  },
  {
    title: "5. Data Security & Compliance",
    fields: [
      { kind: "select", index: 0, value: "ssl" },
      { kind: "text", placeholder: "Enter security feature", value: "Encryption enabled" },
      { kind: "select", index: 1, value: "Active" },
    ],
    expectedText: "Encryption enabled",
  },
  {
    title: "8. Renewal & Termination",
    fields: [
      { kind: "select", index: 0, value: "notice" },
      { kind: "text", placeholder: "Enter renewal or termination detail", value: "60-day notice period" },
    ],
    expectedText: "60-day notice period",
  },
  {
    title: "Reminders",
    fields: [
      { kind: "text", placeholder: "Enter reminder details", value: "Renewal reminder" },
      { kind: "text", placeholder: "Enter reminder date", value: "2027-01-15" },
    ],
    expectedText: "Renewal reminder",
  },
] as const;

function renderEmptyContract(options: { readOnly?: boolean; editOnOpen?: boolean } = {}) {
  return render(
    <ContractDetailView
      contractId="CONTRACT-EDIT-TEST"
      contractTitle="Contract Editor Test"
      clientId="client-contract-editor-test"
      clientName="Editor Test Client"
      readOnly={options.readOnly}
      editOnOpen={options.editOnOpen}
      onBack={() => undefined}
    />,
  );
}

describe("Client contract section editors", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it.each(emptyListEditors)(
    "provides editable fields and an add-row action for %s when it has no saved entries",
    (sectionTitle, placeholder) => {
      renderEmptyContract();
      fireEvent.click(screen.getByRole("button", { name: `Edit ${sectionTitle}` }));

      expect(screen.getByPlaceholderText(placeholder)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Add another row" }));
      expect(screen.getAllByPlaceholderText(placeholder)).toHaveLength(2);
    },
  );

  it("saves a newly entered service row", () => {
    renderEmptyContract();
    fireEvent.click(screen.getByRole("button", { name: "Edit 3. Services Covered" }));
    fireEvent.change(screen.getByPlaceholderText("Enter service name"), {
      target: { value: "Managed Support" },
    });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Included" } });
    fireEvent.click(screen.getByTestId("save-contract-changes"));

    expect(screen.getByText("Managed Support")).toBeTruthy();
    expect(screen.getByText("Included")).toBeTruthy();
  });

  it("saves a contract name and its own start and end dates from the overview editor", () => {
    renderEmptyContract();
    fireEvent.click(screen.getByRole("button", { name: "Edit Contract Overview" }));
    fireEvent.change(screen.getByLabelText("Contract Name"), {
      target: { value: "Managed Support Agreement" },
    });
    fireEvent.change(screen.getByLabelText("Contract Start Date"), {
      target: { value: "2026-11-01" },
    });
    fireEvent.change(screen.getByLabelText("Contract End Date"), {
      target: { value: "2027-10-31" },
    });
    fireEvent.click(screen.getByTestId("save-contract-changes"));

    expect(getClientContract("client-contract-editor-test", "CONTRACT-EDIT-TEST")).toMatchObject({
      contractTitle: "Managed Support Agreement",
      startDate: "2026-11-01",
      endDate: "2027-10-31",
    });
  });

  it("opens the overview editor when Edit is selected from the contract list", async () => {
    renderEmptyContract({ editOnOpen: true });

    expect(await screen.findByRole("heading", { name: "Edit Contract Overview" })).toBeTruthy();
  });

  it("shows archived contract details without edit controls or automatic saves", () => {
    saveClientContract({
      clientId: "client-contract-editor-test",
      contractId: "CONTRACT-EDIT-TEST",
      contractTitle: "Archived Agreement",
      archivedAt: "2026-10-20T00:00:00.000Z",
      data: { overview: { purpose: "Archived purpose" } },
      updatedAt: "2026-10-20T00:00:00.000Z",
    });

    renderEmptyContract({ readOnly: true });

    expect(screen.getByText("Archived · Read only")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit Contract Overview" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit 1. Commercial Terms" })).toBeNull();
    expect(screen.getByText("Archived purpose")).toBeTruthy();
    expect(getClientContract("client-contract-editor-test", "CONTRACT-EDIT-TEST")?.updatedAt)
      .toBe("2026-10-20T00:00:00.000Z");
  });

  it.each(sectionSaveCases)(
    "saves a new row for %s",
    ({ title, fields, expectedText }) => {
      renderEmptyContract();
      fireEvent.click(screen.getByRole("button", { name: `Edit ${title}` }));

      fields.forEach((field) => {
        if (field.kind === "text") {
          fireEvent.change(screen.getByPlaceholderText(field.placeholder), {
            target: { value: field.value },
          });
        } else {
          fireEvent.change(screen.getAllByRole("combobox")[field.index], {
            target: { value: field.value },
          });
        }
      });
      fireEvent.click(screen.getByTestId("save-contract-changes"));

      expect(screen.getAllByText(expectedText).length).toBeGreaterThan(0);
    },
  );
});
