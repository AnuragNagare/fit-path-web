import { createContext, useContext } from 'react';

// Currencies offered in the picker (only those the rates service returns are shown).
export const CURRENCIES = [
  { code: 'INR', name: 'Indian rupee' },
  { code: 'USD', name: 'US dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British pound' },
  { code: 'AED', name: 'UAE dirham' },
  { code: 'SAR', name: 'Saudi riyal' },
  { code: 'QAR', name: 'Qatari riyal' },
  { code: 'KWD', name: 'Kuwaiti dinar' },
  { code: 'SGD', name: 'Singapore dollar' },
  { code: 'MYR', name: 'Malaysian ringgit' },
  { code: 'THB', name: 'Thai baht' },
  { code: 'IDR', name: 'Indonesian rupiah' },
  { code: 'HKD', name: 'Hong Kong dollar' },
  { code: 'CNY', name: 'Chinese yuan' },
  { code: 'JPY', name: 'Japanese yen' },
  { code: 'KRW', name: 'South Korean won' },
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'NZD', name: 'New Zealand dollar' },
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'CHF', name: 'Swiss franc' },
  { code: 'ZAR', name: 'South African rand' },
  { code: 'BDT', name: 'Bangladeshi taka' },
  { code: 'LKR', name: 'Sri Lankan rupee' },
  { code: 'NPR', name: 'Nepalese rupee' },
  { code: 'PKR', name: 'Pakistani rupee' },
] as const;

export interface CurrencyContextValue {
  currency: string; // the one in use (INR when rates are unavailable)
  setCurrency: (code: string) => void;
  options: { code: string; name: string }[];
  format: (inr: number) => string; // converts an INR amount and formats it
  converted: boolean; // true when prices are shown in something other than INR
}

export const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used inside CurrencyProvider');
  return ctx;
}
