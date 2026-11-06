import { useEffect, useMemo, useRef, useState } from "react";
import { rankNearbyBranches } from "../../../services/branchProximityService.js";

export default function useNearbyBranches(branches, open) {
  const [position,setPosition] = useState(null);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const requestId = useRef(0);
  useEffect(() => {
    const id = ++requestId.current;
    if (!open) { setBusy(false);return; }
    setPosition(null);setMessage("");
    const failed = () => {
      if (id!==requestId.current) return;
      setBusy(false);setMessage("Chưa lấy được vị trí. Bạn vẫn có thể chọn quán bên dưới.");
    };
    if (!globalThis.navigator?.geolocation) { failed();return; }
    setBusy(true);
    try { navigator.geolocation.getCurrentPosition(result=>{
      if (id!==requestId.current) return;
      setPosition({lat:result.coords.latitude,lng:result.coords.longitude});setBusy(false);
      setMessage("");
    },failed,{enableHighAccuracy:false,timeout:10000,maximumAge:60000}); } catch { failed(); }
    return ()=>{requestId.current+=1;};
  },[open]);
  const nearby = useMemo(()=>rankNearbyBranches(branches,position),[branches,position]);
  return {nearby,position,busy,message};
}
