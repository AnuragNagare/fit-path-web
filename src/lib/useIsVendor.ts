import { useEffect, useState } from 'react';
import { useApi } from '@/lib/api';

// True when the signed-in user owns a gym profile. Only used to show the "My gym" link.
export function useIsVendor(): boolean {
  const { vendor } = useApi();
  const [isVendor, setIsVendor] = useState(false);

  useEffect(() => {
    let cancelled = false;
    vendor.me().then(gym => { if (!cancelled) setIsVendor(gym !== null); }).catch(() => { if (!cancelled) setIsVendor(false); });
    return () => { cancelled = true; };
  }, [vendor]);

  return isVendor;
}
