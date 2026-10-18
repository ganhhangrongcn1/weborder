import { useEffect, useState } from 'react';
import { GANH_ENABLED, ganhReplyRequest } from '../../services/ganhReplyService.js';

export default function useGanhReplyModuleAccess(profile) {
  const [verifiedUser, setVerifiedUser] = useState('');
  const userId = profile?.auth_user_id || '';
  const role = profile?.role || '';
  const branch = profile?.branch_uuid || profile?.branchUuid || '';
  const status = profile?.status || '';
  useEffect(() => {
    let disposed = false;
    setVerifiedUser('');
    if (!GANH_ENABLED || !userId || status !== 'active' || !['admin', 'staff'].includes(role) || (role === 'admin' && !branch)) return undefined;
    ganhReplyRequest('bootstrap').then(data => {
      if (!disposed && data.access?.user_id === userId) setVerifiedUser(userId);
    }).catch(() => { /* Reply unavailable must not block the existing admin workspace. */ });
    return () => { disposed = true; };
  }, [userId, role, branch, status]);
  return Boolean(userId && verifiedUser === userId);
}
