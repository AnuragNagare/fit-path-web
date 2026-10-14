import type { VendorState } from '@/types';

export const STATE_LABEL: Record<VendorState, string> = {
  draft: 'Not submitted',
  changes_requested: 'Changes requested',
  waiting: 'New gym, waiting',
  live: 'Live',
  live_pending: 'Live, changes waiting',
  suspended: 'Suspended',
};

export const STATE_TONE: Record<VendorState, 'active' | 'ended' | 'cancelled'> = {
  draft: 'ended', changes_requested: 'cancelled', waiting: 'active', live: 'active', live_pending: 'active', suspended: 'cancelled',
};
