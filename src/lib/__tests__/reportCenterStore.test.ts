import { beforeEach, describe, expect, it } from "vitest";
import { getReportCenterHistory, getReportCenterSchedules } from "@/lib/reportCenterStore";

const HISTORY_KEY = "nido_reports_center_history_v1";
const SCHEDULES_KEY = "nido_reports_center_schedules_v1";
const PURGE_MARKER_KEY = "nido_reports_legacy_data_purged_v1";

describe("report center legacy data cleanup", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("clears saved report history and schedules while preserving unrelated records", () => {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify([
      { id: "history-1", name: "Old report", generatedAtIso: "2026-01-01T00:00:00.000Z" },
    ]));
    window.localStorage.setItem(SCHEDULES_KEY, JSON.stringify([
      { id: "schedule-1", name: "Old schedule", module: "Sales Reports" },
    ]));
    window.localStorage.setItem("unrelated_live_business_data", "preserve");

    expect(getReportCenterSchedules()).toEqual([]);
    expect(getReportCenterHistory()).toEqual([]);
    expect(window.localStorage.getItem(HISTORY_KEY)).toBeNull();
    expect(window.localStorage.getItem(SCHEDULES_KEY)).toBeNull();
    expect(window.localStorage.getItem("unrelated_live_business_data")).toBe("preserve");
    expect(window.localStorage.getItem(PURGE_MARKER_KEY)).toBe("1");
  });

  it("preserves reports created after the one-time cleanup", () => {
    window.localStorage.setItem(PURGE_MARKER_KEY, "1");
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify([
      { id: "new-history", name: "New report", generatedAtIso: "2026-10-09T00:00:00.000Z" },
    ]));

    expect(getReportCenterHistory()).toHaveLength(1);
    expect(window.localStorage.getItem(HISTORY_KEY)).not.toBeNull();
  });
});
