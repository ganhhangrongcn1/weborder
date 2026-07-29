import { useCallback, useEffect, useState } from "react";
import { listEmployees, saveEmployee } from "../repositories/employeeRepository.js";

export function useEmployees() {
  const [state, setState] = useState({ data: [], loading: true, saving: false, error: "", message: "" });

  const reload = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const data = await listEmployees();
      setState((current) => ({ ...current, data, loading: false }));
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message || "Không tải được nhân sự." }));
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const submit = useCallback(async (employee) => {
    setState((current) => ({ ...current, saving: true, error: "", message: "" }));
    try {
      await saveEmployee(employee);
      const data = await listEmployees();
      setState((current) => ({ ...current, data, saving: false, message: "Đã lưu thông tin nhân viên." }));
      return true;
    } catch (error) {
      setState((current) => ({ ...current, saving: false, error: error.message || "Không thể lưu nhân viên." }));
      return false;
    }
  }, []);

  return { ...state, reload, submit };
}
