import { useOutletContext } from 'react-router-dom';
import type { VendorGym } from '@/types';

// The signed-in owner's gym, shared by all pages in the owner dashboard.
export interface VendorContext {
  gym: VendorGym;
  setGym: (gym: VendorGym) => void;
}

export const useVendor = () => useOutletContext<VendorContext>();
