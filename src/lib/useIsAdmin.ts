import { useEffect, useState } from 'react';
import { useApi } from '@/lib/api';

// True when the signed-in user is an admin. Only used to show the Admin link; the API enforces access.
export function useIsAdmin(): boolean {
  const { admin } = useApi();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    admin.get('me').then(() => { if (!cancelled) setIsAdmin(true); }).catch(() => { if (!cancelled) setIsAdmin(false); });
    return () => { cancelled = true; };
  }, [admin]);

  return isAdmin;
}
