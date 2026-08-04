import { IPOS_UNITS } from "./iposUnits.js";

export const PREVIEW_DATA = {
  warehouses: [
    { id: "central", code: "KHO-TONG", name: "Kho tổng", warehouse_type: "central", is_active: true },
    { id: "branch-1", code: "CN-01", name: "Chi nhánh 01", warehouse_type: "branch", is_active: true },
    { id: "branch-2", code: "CN-02", name: "Chi nhánh 02", warehouse_type: "branch", is_active: true },
    { id: "branch-3", code: "CN-03", name: "Chi nhánh 03", warehouse_type: "branch", is_active: true },
    { id: "mobile-1", code: "XE-DAY-01", name: "Xe đẩy mini", warehouse_type: "mobile", is_active: true }
  ],
  units: IPOS_UNITS,
  groups: [
    { id: "group-bt", code: "NVL-BT", name: "Nguyên liệu bánh tráng" },
    { id: "group-pack", code: "BAO-BI", name: "Bao bì" },
    { id: "group-finished", code: "THANH-PHAM", name: "Thành phẩm" }
  ],
  items: [],
  suppliers: [
    { id: "supplier-1", code: "NCC-001", name: "Nhà cung cấp nguyên liệu chính", contact_name: "Chị Lan", phone: "09•• ••• •••", is_active: true },
    { id: "supplier-2", code: "NCC-002", name: "Nhà cung cấp bao bì", contact_name: "Anh Minh", phone: "09•• ••• •••", is_active: true }
  ],
  balances: [],
  itemWarehouseNorms: [],
  documents: [
    { id: "doc-1", document_no: "DC-260725-001", document_type: "transfer", status: "in_transit", created_at: new Date().toISOString() },
    { id: "doc-2", document_no: "NK-260725-001", document_type: "purchase_receipt", status: "completed", created_at: new Date(Date.now() - 86400000).toISOString() }
  ],
  staff: [
    { id: "access-1", auth_user_id: "preview-owner", role: "owner", is_active: true, inventory_warehouses: null }
  ]
};

const previewItems = [
  { id: "item-1", code: "BT-SOI", name: "Bánh tráng trộn sợi", item_type: "ingredient", minimum_stock: 10, inventory_units: PREVIEW_DATA.units.find((unit) => unit.code === "KG"), inventory_item_groups: PREVIEW_DATA.groups[0] },
  { id: "item-2", code: "KHO-BO-DO", name: "Khô bò đỏ", item_type: "ingredient", minimum_stock: 5, inventory_units: PREVIEW_DATA.units.find((unit) => unit.code === "KG"), inventory_item_groups: PREVIEW_DATA.groups[0] },
  { id: "item-3", code: "BT-TRON-NEN", name: "Bánh tráng trộn đóng gói", item_type: "finished_good", minimum_stock: 50, inventory_units: PREVIEW_DATA.units.find((unit) => unit.code === "BICH"), inventory_item_groups: PREVIEW_DATA.groups[2] },
  { id: "item-4", code: "BICH-BT", name: "Bịch đóng gói bánh tráng", item_type: "other", minimum_stock: 200, tracks_inventory: true, inventory_units: PREVIEW_DATA.units.find((unit) => unit.code === "BICH"), inventory_item_groups: PREVIEW_DATA.groups[1] }
];

PREVIEW_DATA.items = previewItems;
PREVIEW_DATA.balances = [
  { warehouse_id: "central", item_id: "item-1", quantity: 42.5, inventory_items: previewItems[0] },
  { warehouse_id: "central", item_id: "item-2", quantity: 18.2, inventory_items: previewItems[1] },
  { warehouse_id: "central", item_id: "item-3", quantity: 184, inventory_items: previewItems[2] },
  { warehouse_id: "central", item_id: "item-4", quantity: 650, inventory_items: previewItems[3] }
];
PREVIEW_DATA.itemWarehouseNorms = previewItems.map((item) => ({ item_id: item.id, warehouse_id: "central", minimum_stock: item.minimum_stock }));
