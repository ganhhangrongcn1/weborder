import { SUPABASE_TABLES } from "../constants/supabaseTables.js";
import { createSupabaseCrudService } from "./supabase/createSupabaseCrudService.js";

const productCrud = createSupabaseCrudService(SUPABASE_TABLES.products);

export async function getProducts(filters = {}) {
  return productCrud.getList({ filters, orderBy: "updated_at", ascending: false });
}

export async function getProductById(id) {
  return productCrud.getById(id);
}

export async function createProduct(payload) {
  return productCrud.create(payload);
}

export async function updateProduct(id, patch) {
  return productCrud.update(id, patch);
}

export async function deleteProduct(id) {
  return productCrud.remove(id);
}

const productService = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};

export default productService;
