function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function isActive(row = {}) {
  return row.active !== false && row.isActive !== false;
}

function normalizeLookup(value = "") {
  return toText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
}

export function isInventoryOperationalMenuOption(groupName = "", optionName = "") {
  const group = normalizeLookup(groupName);
  const option = normalizeLookup(optionName);
  return group.includes("cach che bien")
    || ["muc do cay", "do cay"].includes(group)
    || ["tron deu topping", "de rieng tu tron", "khong cay", "hoi cay", "cay vua", "cay sap mat"]
      .some((keyword) => option.includes(keyword));
}

export function buildInventoryMenuEntities({
  products = [],
  toppings = [],
  optionGroupPresets = []
} = {}) {
  const entities = [];
  const usedKeys = new Set();

  const append = (entity) => {
    const id = toText(entity.id);
    const type = entity.type === "topping" ? "topping" : "product";
    const key = `${type}:${id}`;
    if (!id || usedKeys.has(key)) return;
    usedKeys.add(key);
    entities.push({ ...entity, id, type });
  };

  products.filter((row) => row && row.id && isActive(row)).forEach((row) => append({
    id: row.id,
    name: toText(row.name) || "Món chưa đặt tên",
    price: Number(row.price || 0),
    type: "product",
    entityKind: "product",
    category: toText(row.category || row.badge) || "Món khác"
  }));

  toppings.filter((row) => row && row.id && isActive(row)).forEach((row) => append({
    id: row.id,
    name: toText(row.name) || "Topping chưa đặt tên",
    price: Number(row.price || 0),
    type: "topping",
    entityKind: "topping",
    category: "Topping bán thêm"
  }));

  optionGroupPresets.filter((group) => group && group.id && isActive(group)).forEach((group) => {
    const groupName = toText(group.name) || "Nhóm lựa chọn";
    const options = Array.isArray(group.options) ? group.options : [];
    options.filter((option) => option
      && option.id
      && isActive(option)
      && !isInventoryOperationalMenuOption(groupName, option.name)).forEach((option) => append({
      id: option.id,
      name: toText(option.name) || "Lựa chọn chưa đặt tên",
      price: Number(option.price || 0),
      type: "topping",
      entityKind: "option",
      groupId: toText(group.id),
      groupName,
      category: `Lựa chọn · ${groupName}`
    }));
  });

  return entities;
}

export function getInventoryMenuEntityKindLabel(entity = {}) {
  if (entity.entityKind === "option") return entity.groupName ? `Lựa chọn · ${entity.groupName}` : "Lựa chọn trong nhóm";
  if (entity.entityKind === "topping" || entity.type === "topping") return "Topping bán thêm";
  return "Món Menu";
}

export default {
  buildInventoryMenuEntities,
  getInventoryMenuEntityKindLabel,
  isInventoryOperationalMenuOption
};
