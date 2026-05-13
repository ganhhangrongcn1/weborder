import { getSupabaseClient } from "./supabaseClient.js";
import { normalizeSupabaseException, normalizeSupabaseResponse } from "./supabaseResponse.js";

function getClientOrThrow() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase chưa được cấu hình trong file .env");
  }
  return client;
}

export function createSupabaseCrudService(tableName) {
  return {
    async getList({ filters = {}, orderBy = "created_at", ascending = false, limit } = {}) {
      try {
        const client = getClientOrThrow();
        let query = client.from(tableName).select("*").order(orderBy, { ascending });

        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            query = query.eq(key, value);
          }
        });

        if (limit) query = query.limit(limit);

        const { data, error, count } = await query;
        return normalizeSupabaseResponse({ data: data || [], error, count });
      } catch (exception) {
        return normalizeSupabaseException(exception);
      }
    },

    async getById(id, idKey = "id") {
      try {
        const client = getClientOrThrow();
        const { data, error } = await client.from(tableName).select("*").eq(idKey, id).single();
        return normalizeSupabaseResponse({ data, error });
      } catch (exception) {
        return normalizeSupabaseException(exception);
      }
    },

    async create(payload) {
      try {
        const client = getClientOrThrow();
        const { data, error } = await client.from(tableName).insert(payload).select().single();
        return normalizeSupabaseResponse({ data, error });
      } catch (exception) {
        return normalizeSupabaseException(exception);
      }
    },

    async update(id, patch, idKey = "id") {
      try {
        const client = getClientOrThrow();
        const { data, error } = await client.from(tableName).update(patch).eq(idKey, id).select().single();
        return normalizeSupabaseResponse({ data, error });
      } catch (exception) {
        return normalizeSupabaseException(exception);
      }
    },

    async remove(id, idKey = "id") {
      try {
        const client = getClientOrThrow();
        const { error } = await client.from(tableName).delete().eq(idKey, id);
        return normalizeSupabaseResponse({ data: !error, error });
      } catch (exception) {
        return normalizeSupabaseException(exception);
      }
    }
  };
}

export default createSupabaseCrudService;
