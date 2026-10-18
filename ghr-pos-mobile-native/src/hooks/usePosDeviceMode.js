import { useEffect, useState } from 'react';
import { readPosDeviceMode, savePosDeviceMode } from '../services/pos/posDeviceModeService';

export default function usePosDeviceMode() {
  const [mode, setMode] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    readPosDeviceMode().then(value => { if (active) setMode(value); }).catch(() => {
      if (active) setError('Không đọc được chế độ thiết bị. Vui lòng mở lại app.');
    });
    return () => { active = false; };
  }, []);
  const changeMode = async value => {
    try { await savePosDeviceMode(value); setMode(value); setError(''); return true; }
    catch { setError('Chưa lưu được chế độ thiết bị. Vui lòng thử lại.'); return false; }
  };
  return { mode, error, changeMode, ready: mode !== null };
}
