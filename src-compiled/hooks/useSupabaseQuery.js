import { useCallback, useEffect, useState } from "react";

export function useSupabaseQuery(fetcher, options = {}) {
  const { immediate = true, deps = [] } = options;

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const run = useCallback(async (...args) => {
    setLoading(true);
    setError(null);

    const result = await fetcher(...args);

    if (result?.error) {
      setError(result.error);
      setData([]);
      setLoading(false);
      return result;
    }

    setData(result?.data ?? []);
    setLoading(false);
    return result;
  }, [fetcher]);

  useEffect(() => {
    if (!immediate) return;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate, run, ...deps]);

  return {
    data,
    loading,
    error,
    run,
    setData
  };
}

export default useSupabaseQuery;
