const STORAGE_KEY = "nido_amc_equipment_options_v1";

export interface CustomAMCEquipmentOptions {
  categories: string[];
  brandsByCategory: Record<string, string[]>;
  modelsByCategory: Record<string, Record<string, string[]>>;
}

type OptionKind = "category" | "brand" | "model";

const EMPTY_OPTIONS: CustomAMCEquipmentOptions = {
  categories: [],
  brandsByCategory: {},
  modelsByCategory: {},
};

export function getCustomAMCEquipmentOptions(): CustomAMCEquipmentOptions {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<CustomAMCEquipmentOptions>;
    return {
      categories: Array.isArray(saved.categories) ? saved.categories.filter((value): value is string => typeof value === "string") : [],
      brandsByCategory: saved.brandsByCategory && typeof saved.brandsByCategory === "object" ? saved.brandsByCategory : {},
      modelsByCategory: saved.modelsByCategory && typeof saved.modelsByCategory === "object" ? saved.modelsByCategory : {},
    };
  } catch {
    return { ...EMPTY_OPTIONS };
  }
}

export function addCustomAMCEquipmentOption(
  kind: OptionKind,
  value: string,
  category?: string,
  brand?: string,
): { value: string; added: boolean } {
  const normalizedValue = value.trim().replace(/\s+/g, " ");
  if (!normalizedValue) throw new Error("Enter a value before saving.");

  const options = getCustomAMCEquipmentOptions();
  let values: string[];

  if (kind === "category") {
    values = options.categories;
  } else if (kind === "brand") {
    if (!category) throw new Error("Select a category before adding a brand.");
    values = options.brandsByCategory[category] ?? [];
    options.brandsByCategory[category] = values;
  } else {
    if (!category || !brand) throw new Error("Select a category and brand before adding a model.");
    options.modelsByCategory[category] ??= {};
    values = options.modelsByCategory[category][brand] ?? [];
    options.modelsByCategory[category][brand] = values;
  }

  const existing = values.find((item) => item.toLocaleLowerCase() === normalizedValue.toLocaleLowerCase());
  if (existing) return { value: existing, added: false };

  values.push(normalizedValue);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  window.dispatchEvent(new Event("amcEquipmentOptionsUpdated"));
  return { value: normalizedValue, added: true };
}
