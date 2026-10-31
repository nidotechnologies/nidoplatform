import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getClientGeneralSettings,
  saveClientGeneralSettings,
} from "../clientConfigurationStore";

describe("client configuration store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns default notification settings for a client without saved settings", () => {
    expect(getClientGeneralSettings("client-a")).toEqual({
      emailOrders: true,
      emailServices: true,
      sms: false,
    });
  });

  it("saves notification settings separately for each client", () => {
    saveClientGeneralSettings("client-a", {
      emailOrders: false,
      emailServices: true,
      sms: true,
    });

    expect(getClientGeneralSettings("client-a")).toEqual({
      emailOrders: false,
      emailServices: true,
      sms: true,
    });
    expect(getClientGeneralSettings("client-b")).toEqual({
      emailOrders: true,
      emailServices: true,
      sms: false,
    });
  });
});
