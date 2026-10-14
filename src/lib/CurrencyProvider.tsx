import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@clerk/react';
import { CURRENCIES, CurrencyContext, type CurrencyContextValue } from './currency-context';

// A device preference, so it is kept on sign-out (unlike searches and saved gyms).
const CURRENCY_KEY = 'trace:currency';

function readCurrency(): string {
  const saved = localStorage.getItem(CURRENCY_KEY);
  return CURRENCIES.some(c => c.code === saved) ? (saved as string) : 'INR';
}

// Prices are shown in INR by default. Other currencies convert the INR amount with
// live exchange rates from /api/rates; if those can't be loaded, INR is shown.
export default function CurrencyProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [chosen, setChosen] = useState(readCurrency);
  const [rates, setRates] = useState<Record<string, number> | null>(null);

  // Prices only appear after sign-in, so the rates are only fetched then.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    fetch('/api/rates')
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('rates unavailable'))))
      .then((data: { rates: Record<string, number> }) => { if (!cancelled) setRates(data.rates); })
      .catch(() => { if (!cancelled) setRates(null); });
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn]);

  const setCurrency = useCallback((code: string) => {
    localStorage.setItem(CURRENCY_KEY, code);
    setChosen(code);
  }, []);

  const value = useMemo<CurrencyContextValue>(() => {
    const options = CURRENCIES.filter(c => c.code === 'INR' || rates?.[c.code]).map(c => ({ code: c.code, name: c.name }));
    const currency = chosen !== 'INR' && rates?.[chosen] ? chosen : 'INR';
    const rate = currency === 'INR' ? 1 : (rates?.[currency] ?? 1);

    const format = (inr: number) => {
      const amount = inr * rate;
      // Small amounts (a day pass in USD) need cents; larger ones read better as whole numbers.
      const digits = amount < 10 && currency !== 'INR' ? 2 : 0;
      return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : undefined, {
        style: 'currency',
        currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(amount);
    };

    return { currency, setCurrency, options, format, converted: currency !== 'INR' };
  }, [chosen, rates, setCurrency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}
