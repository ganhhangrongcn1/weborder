import { customerRepository } from "./repositories/customerRepository.js";

export const addressStorage = {
  getAll(phone = "") {
    return customerRepository.getAddressesByPhone(phone);
  },
  async getAllAsync(phone = "") {
    return customerRepository.getAddressesByPhoneAsync(phone);
  },
  getByPhone(phone = "") {
    return this.getAll(phone);
  },
  async getByPhoneAsync(phone = "") {
    return this.getAllAsync(phone);
  },
  saveAll(addresses, phone = "") {
    return customerRepository.saveAddressesByPhone(phone, addresses);
  },
  async saveAllAsync(addresses, phone = "") {
    return customerRepository.saveAddressesByPhoneAsync(phone, addresses);
  },
  saveByPhone(phone = "", addresses = []) {
    return this.saveAll(addresses, phone);
  },
  async saveByPhoneAsync(phone = "", addresses = []) {
    return this.saveAllAsync(addresses, phone);
  },
  subscribeRealtime(onChange) {
    if (!customerRepository?.subscribeAddressesRealtime) return () => {};
    return customerRepository.subscribeAddressesRealtime(onChange);
  }
};

export function addAddress(addresses, address) {
  const now = new Date().toISOString();
  const nextAddress = {
    id: address.id || `addr_${Date.now()}`,
    label: address.label || "Dia chi moi",
    receiverName: address.receiverName || "Khach",
    phone: address.phone || "",
    address: address.address || "",
    lat: address.lat ?? null,
    lng: address.lng ?? null,
    distanceKm: address.distanceKm ?? null,
    deliveryFee: address.deliveryFee ?? null,
    note: address.note || "",
    isDefault: Boolean(address.isDefault),
    createdAt: address.createdAt || now,
    updatedAt: now
  };
  const current = nextAddress.isDefault ? addresses.map((item) => ({ ...item, isDefault: false })) : addresses;
  return [nextAddress, ...current];
}

export function updateAddress(addresses, addressId, patch) {
  return addresses.map((address) => address.id === addressId ? { ...address, ...patch, updatedAt: new Date().toISOString() } : address);
}

export function deleteAddress(addresses, addressId) {
  if (addresses.length <= 1) return addresses;
  const next = addresses.filter((address) => address.id !== addressId);
  return next.some((address) => address.isDefault) ? next : next.map((address, index) => ({ ...address, isDefault: index === 0 }));
}

export function setDefaultAddress(addresses, addressId) {
  return addresses.map((address) => ({ ...address, isDefault: address.id === addressId, updatedAt: new Date().toISOString() }));
}
