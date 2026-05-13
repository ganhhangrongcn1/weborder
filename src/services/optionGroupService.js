import { adminConfigRepository } from "./repositories/adminConfigRepository.js";
import {
  legacyOptionGroupPresetsFromMenuSchema,
  loadMenuSchema,
  saveMenuSchemaFromLegacy,
  saveMenuSchemaFromLegacyAsync
} from "./menuSchemaService.js";

const OPTION_GROUP_PRESET_KEY = "ghr_option_group_presets";

const defaultPresets = [
  {
    id: "preset-spice",
    name: "M\u1EE9c \u0110\u1ED9 Cay",
    required: true,
    maxSelect: 1,
    options: [
      { id: "spice-none", name: "Kh\u00F4ng cay", price: 0, active: true },
      { id: "spice-medium", name: "H\u01A1i cay", price: 0, active: true },
      { id: "spice-hot", name: "Cay nhi\u1EC1u", price: 0, active: true }
    ]
  },
  {
    id: "preset-topping",
    name: "Ngon h\u01A1n khi \u0103n c\u00F9ng",
    required: false,
    maxSelect: 5,
    options: [
      { id: "top-egg", name: "Tr\u1EE9ng c\u00FAt", price: 10000, active: true },
      { id: "top-beef", name: "Kh\u00F4 b\u00F2", price: 15000, active: true },
      { id: "top-onion", name: "H\u00E0nh phi", price: 5000, active: true }
    ]
  }
];

export function loadOptionGroupPresets() {
  const schemaPresets = legacyOptionGroupPresetsFromMenuSchema(loadMenuSchema());
  if (schemaPresets.length) return schemaPresets;
  const saved = adminConfigRepository.get(OPTION_GROUP_PRESET_KEY, defaultPresets);
  return Array.isArray(saved) ? saved : defaultPresets;
}

export function saveOptionGroupPresets(presets) {
  const normalized = Array.isArray(presets) ? presets : [];
  adminConfigRepository.set(OPTION_GROUP_PRESET_KEY, normalized);
  saveMenuSchemaFromLegacy({ optionGroupPresets: normalized });
  return normalized;
}

export async function loadOptionGroupPresetsAsync() {
  const schemaPresets = legacyOptionGroupPresetsFromMenuSchema(loadMenuSchema());
  if (schemaPresets.length) return schemaPresets;
  const saved = await adminConfigRepository.getAsync(OPTION_GROUP_PRESET_KEY, defaultPresets);
  return Array.isArray(saved) ? saved : defaultPresets;
}

export async function saveOptionGroupPresetsAsync(presets) {
  const normalized = Array.isArray(presets) ? presets : [];
  await adminConfigRepository.setAsync(OPTION_GROUP_PRESET_KEY, normalized);
  await saveMenuSchemaFromLegacyAsync({ optionGroupPresets: normalized });
  return normalized;
}
