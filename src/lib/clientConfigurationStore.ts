export interface ClientGeneralSettings {
  emailOrders: boolean;
  emailServices: boolean;
  sms: boolean;
}

const STORAGE_KEY = "nido_client_general_settings";

const DEFAULT_SETTINGS: ClientGeneralSettings = {
  emailOrders: true,
  emailServices: true,
  sms: false,
};

function getAllSettings(): Record<string, ClientGeneralSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as Record<string, ClientGeneralSettings> : {};
  } catch {
    return {};
  }
}

export function getClientGeneralSettings(clientId: string): ClientGeneralSettings {
  return { ...DEFAULT_SETTINGS, ...(getAllSettings()[clientId] || {}) };
}

export function saveClientGeneralSettings(
  clientId: string,
  settings: ClientGeneralSettings,
): void {
  const all = getAllSettings();
  all[clientId] = settings;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event("clientConfigurationUpdated"));
}
