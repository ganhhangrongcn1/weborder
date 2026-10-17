import { useEffect, useState } from 'react';
import getGrabConversionFunnel from '../services/grabConversionFunnelService.js';
import { addDaysToVietnamDateInput, toVietnamDateInputValue } from '../utils/adminDateRange.js';

export default function useGrabConversionFunnel({ branchUuid, sourceId }) {
  const yesterday = addDaysToVietnamDateInput(toVietnamDateInputValue(), -1);
  const [fromDate, setFromDate] = useState(`${yesterday.slice(0, 7)}-01`);
  const [toDate, setToDate] = useState(yesterday);
  const [report, setReport] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let disposed = false;
    let loading = false;
    setReport(null);
    const load = async () => {
      if (loading) return;
      loading = true;
      setStatus('loading');
      setError('');
      try {
        const result = await getGrabConversionFunnel({ fromDate, toDate, branchUuid, sourceId });
        if (!disposed) { setReport(result); setStatus('ready'); }
      } catch {
        if (!disposed) { setStatus('error'); setError('Chưa tải được phễu Grab. Anh thử làm mới lại nhé.'); }
      } finally { loading = false; }
    };
    load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') load(); }, 300000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [fromDate, toDate, branchUuid, sourceId, refresh]);
  return { fromDate, toDate, setFromDate, setToDate, yesterday, report, status, error, refresh: () => setRefresh(value => value + 1) };
}
