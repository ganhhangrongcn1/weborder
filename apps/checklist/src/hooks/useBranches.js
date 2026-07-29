import { useEffect, useState } from "react";
import { listActiveBranches } from "../repositories/branchRepository.js";

export function useBranches() {
  const [state, setState] = useState({ data: [], loading: true, error: "" });

  useEffect(() => {
    let active = true;
    listActiveBranches()
      .then((data) => {
        if (active) setState({ data, loading: false, error: "" });
      })
      .catch(() => {
        if (active) setState({ data: [], loading: false, error: "Không tải được danh sách chi nhánh." });
      });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
