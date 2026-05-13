const DEFAULT_ERROR_MESSAGE = "Có lỗi xảy ra, vui lòng thử lại.";

export function normalizeSupabaseResponse({ data = null, error = null, count = null } = {}) {
  if (error) {
    return {
      data: null,
      error: {
        message: error.message || DEFAULT_ERROR_MESSAGE,
        code: error.code || "unknown_error",
        details: error.details || ""
      },
      count
    };
  }

  return {
    data,
    error: null,
    count
  };
}

export function normalizeSupabaseException(exception) {
  return normalizeSupabaseResponse({
    error: {
      message: exception?.message || DEFAULT_ERROR_MESSAGE,
      code: exception?.code || "exception",
      details: exception?.stack || ""
    }
  });
}

export default normalizeSupabaseResponse;
