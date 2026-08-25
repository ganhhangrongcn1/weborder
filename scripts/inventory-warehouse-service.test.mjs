import assert from "node:assert/strict";
import test from "node:test";
import {
  getInventoryWarehouseReadError,
  normalizeInventoryWarehouse
} from "../src/services/inventoryWarehouseService.js";
import {
  createInventoryWarehouseDraft,
  listInventoryWarehouseDrafts,
  normalizeWarehouseDraftInput,
  removeInventoryWarehouseDrafts,
  reconcileInventoryWarehouseDrafts
} from "../src/services/inventoryWarehouseDraftService.js";

test("chuẩn hoá dữ liệu kho từ Supabase", () => {
  assert.deepEqual(normalizeInventoryWarehouse({
    id: "warehouse-1",
    code: " KHO-CN1 ",
    name: " Kho Chi Nhánh ",
    warehouse_type: "BRANCH",
    branch_uuid: "branch-uuid",
    is_active: true,
    is_default_for_branch: true
  }), {
    id: "warehouse-1",
    code: "KHO-CN1",
    name: "Kho Chi Nhánh",
    warehouseType: "branch",
    branchId: null,
    branchUuid: "branch-uuid",
    departmentCode: "",
    departmentName: "",
    address: "",
    managerName: "",
    managerPhone: "",
    supplyWarehouseId: "",
    allowsDirectReceipt: false,
    allowNegativeStock: false,
    isDefaultForBranch: true,
    isActive: true,
    updatedAt: ""
  });
});

test("phân biệt schema chưa triển khai với lỗi quyền", () => {
  assert.equal(getInventoryWarehouseReadError({ code: "PGRST205" }).status, "setup");
  assert.equal(getInventoryWarehouseReadError({ code: "42501" }).code, "inventory_access_denied");
});

test("bản nháp kho chi nhánh bắt buộc có chi nhánh", () => {
  assert.throws(
    () => normalizeWarehouseDraftInput({ name: "Kho Chi Nhánh", warehouseType: "branch" }),
    /chọn chi nhánh/i
  );
  assert.equal(normalizeWarehouseDraftInput({
    name: " Kho Chi Nhánh 1 ",
    warehouseType: "branch",
    branchUuid: "branch-1",
    isDefaultForBranch: true
  }).name, "Kho Chi Nhánh 1");
});

test("tạo kho bản nháp mà không cần ghi Supabase", () => {
  const memory = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => memory.get(key) || null,
      setItem: (key, value) => memory.set(key, value)
    }
  };

  try {
    const created = createInventoryWarehouseDraft({
      name: "Kho Trung Tâm",
      warehouseType: "central",
      address: "Kho kiểm thử local"
    });
    assert.equal(created.warehouseType, "central");
    assert.match(created.code, /^WH-CTR-/);
    assert.equal(listInventoryWarehouseDrafts().length, 1);
  } finally {
    delete globalThis.window;
  }
});

test("kho bộ phận chuẩn hoá mã khu để BOM định tuyến", () => {
  const normalized = normalizeWarehouseDraftInput({
    name: "Kho Bếp",
    warehouseType: "department",
    branchUuid: "branch-1",
    departmentCode: "bep nong"
  });
  assert.equal(normalized.departmentCode, "BEP_NONG");
  assert.equal(normalized.isDefaultForBranch, false);
});

test("kho chi nhánh có thể không đặt làm kho mặc định", () => {
  const normalized = normalizeWarehouseDraftInput({
    name: "Kho Chi Nhánh Phụ",
    warehouseType: "branch",
    branchUuid: "branch-1",
    isDefaultForBranch: false
  });
  assert.equal(normalized.isDefaultForBranch, false);
});

test("giữ kho cấp hàng khi chuẩn hoá dữ liệu chuyển bản nháp", () => {
  const normalized = normalizeWarehouseDraftInput({
    name: "Kho Chi Nhánh",
    warehouseType: "branch",
    branchUuid: "branch-1",
    supplyWarehouseId: "warehouse-central"
  });
  assert.equal(normalized.supplyWarehouseId, "warehouse-central");
});

test("chỉ xoá những bản nháp đã chuyển thành công", () => {
  const memory = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => memory.get(key) || null,
      setItem: (key, value) => memory.set(key, value)
    }
  };

  try {
    const central = createInventoryWarehouseDraft({ name: "Kho Tổng", warehouseType: "central" });
    const branch = createInventoryWarehouseDraft({ name: "Kho CN", warehouseType: "branch", branchUuid: "branch-1" });
    removeInventoryWarehouseDrafts([central.id]);
    assert.deepEqual(listInventoryWarehouseDrafts().map((row) => row.id), [branch.id]);
  } finally {
    delete globalThis.window;
  }
});

test("tự dọn bản nháp đã có kho thật trùng khớp trên Supabase", () => {
  const memory = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => memory.get(key) || null,
      setItem: (key, value) => memory.set(key, value)
    }
  };

  try {
    const draft = createInventoryWarehouseDraft({
      name: "Kho CN 30/4",
      warehouseType: "branch",
      branchUuid: "branch-30-4"
    });
    const result = reconcileInventoryWarehouseDrafts([{
      id: "remote-warehouse",
      name: "Kho CN 30/4",
      warehouseType: "branch",
      branchUuid: "branch-30-4",
      isActive: true
    }]);
    assert.deepEqual(result.publishedDraftIds, [draft.id]);
    assert.equal(result.drafts.length, 0);
  } finally {
    delete globalThis.window;
  }
});
