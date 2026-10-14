import { ChevronDown } from 'lucide-react';
import { useCurrency } from '@/lib/currency-context';

export default function CurrencyPicker() {
  const { currency, setCurrency, options } = useCurrency();

  return (
    <label className="currency-picker">
      <span className="sr-only">Currency</span>
      <select value={currency} onChange={e => setCurrency(e.target.value)} aria-label="Show prices in">
        {options.map(o => (
          <option key={o.code} value={o.code}>{o.name} ({o.code})</option>
        ))}
      </select>
      <ChevronDown size={15} aria-hidden="true" />
    </label>
  );
}
