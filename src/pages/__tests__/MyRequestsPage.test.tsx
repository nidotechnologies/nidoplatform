import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import MyRequestsPage from "@/pages/MyRequestsPage";
import MyRequestDetailPage from "@/pages/MyRequestDetailPage";
import EditServiceRequestPage from "@/pages/EditServiceRequestPage";
import {
  addServiceRequest,
  getServiceRequests,
} from "@/lib/serviceRequestsStore";

function LocationProbe() {
  const { pathname } = useLocation();
  return <output data-testid="current-path">{pathname}</output>;
}

function renderPage() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/my-services"]}>
        <LocationProbe />
        <Routes>
          <Route path="/my-services" element={<MyRequestsPage />} />
          <Route path="/my-services/requests/:requestId/edit" element={<EditServiceRequestPage />} />
          <Route path="/my-services/requests/:requestId" element={<MyRequestDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

function addRepairRequest() {
  return addServiceRequest({
    requestType: "Repair Service",
    itemAsset: "Latitude Workstation",
    assetTag: "ASSET-42",
    location: "Pune Office",
    requestDate: "",
    status: "Scheduled",
    priority: "Medium",
    nextAppointment: "14 Oct 2026\n10:00 AM",
    requestedBy: "Service Desk",
    payload: {
      requestType: "Repair Service",
      location: "Pune Office",
      category: "Computers & Laptops",
      brand: "Dell",
      model: "Latitude 5420",
      serialNumber: "SER-42",
      issueSubject: "Screen flickers",
      issueDesc: "Intermittent flicker.",
    },
  }, "REP");
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

beforeEach(() => {
  localStorage.clear();
});

describe("My Requests", () => {
  it("shows no hard-coded sample requests when the store is empty", () => {
    renderPage();

    expect(screen.getByText("No entries")).toBeTruthy();
    expect(screen.queryByText("REP-2026-00187")).toBeNull();
    expect(screen.queryByText("Bangalore - Main Office")).toBeNull();
  });

  it("opens the details route for a newly submitted request", () => {
    const request = addRepairRequest();
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Request actions" }));
    fireEvent.click(screen.getByRole("button", { name: "View Details" }));

    expect(screen.getByTestId("current-path").textContent)
      .toBe(`/my-services/requests/${request.id}`);
  });

  it("shows the row actions menu outside the table wrapper", () => {
    addRepairRequest();
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Request actions" }));
    const editAction = screen.getByRole("button", { name: "Edit Request" });

    expect(editAction.parentElement?.parentElement).toBe(document.body);
    expect(editAction.parentElement?.classList.contains("fixed")).toBe(true);
    expect(screen.getByRole("button", { name: "View Details" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel Request" })).toBeTruthy();
  });

  it("shows no more than ten services per page", () => {
    for (let i = 0; i < 11; i += 1) addRepairRequest();
    renderPage();

    expect(screen.getAllByRole("button", { name: "Request actions" })).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getAllByRole("button", { name: "Request actions" })).toHaveLength(1);
  });

  it("resolves a shared-prefix ID to its saved service type", () => {
    const id = "SVC-2026-12345";
    localStorage.setItem("nido_service_requests", JSON.stringify([{
      id,
      requestType: "Repair Service",
      itemAsset: "Latitude Workstation",
      assetTag: "ASSET-42",
      location: "Pune Office",
      requestDate: "06 Oct 2026",
      requestDateTs: Date.now(),
      status: "Scheduled",
      priority: "Medium",
      nextAppointment: "14 Oct 2026",
      requestedBy: "Service Desk",
      payload: { category: "Computers", brand: "Dell", model: "Latitude" },
    }]));

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={[`/my-services/requests/${id}`]}>
          <Routes>
            <Route path="/my-services/requests/:requestId" element={<MyRequestDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(screen.getByRole("heading", { name: id })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Raise Follow-up/ })).toBeTruthy();
  });

  it("opens a full-page edit form, saves changes, and cancels from the row menu", () => {
    const request = addRepairRequest();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Request actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Request" }));
    expect(screen.getByRole("heading", { name: "Edit Request" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.change(screen.getByLabelText("Asset Tag"), { target: { value: "ASSET-99" } });
    fireEvent.change(screen.getByLabelText("Issue Subject"), { target: { value: "Power issue" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(getServiceRequests().find(item => item.id === request.id)?.assetTag).toBe("ASSET-99");
    expect(getServiceRequests().find(item => item.id === request.id)?.payload?.issueSubject).toBe("Power issue");

    fireEvent.click(screen.getByRole("button", { name: "Request actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel Request" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(getServiceRequests().find(item => item.id === request.id)?.status).toBe("Cancelled");
  });
});
