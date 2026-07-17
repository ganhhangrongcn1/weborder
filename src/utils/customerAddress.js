function toComparisonKey(value = "") {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("vi-VN")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ");
}

export function formatCustomerAddressLabel(value = "") {
  const label = String(value || "").trim();
  const key = toComparisonKey(label);

  if (!key || key === "dia chi moi") return "Địa chỉ mới";
  if (key === "giao gan nhat") return "Giao gần nhất";
  return label;
}

export function formatCustomerReceiverName(value = "", fallbackName = "") {
  const receiverName = String(value || "").trim();
  const key = toComparisonKey(receiverName);
  const fallback = String(fallbackName || "").trim();

  if (!key || key === "khach" || key === "khach hang") {
    return fallback || "Khách hàng";
  }
  return receiverName;
}

export function normalizeCustomerAddressForEditing(address = {}, fallbackName = "") {
  return {
    ...address,
    label: formatCustomerAddressLabel(address.label),
    receiverName: formatCustomerReceiverName(address.receiverName, fallbackName)
  };
}
