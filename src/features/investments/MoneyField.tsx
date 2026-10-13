import { TextField } from '@/components/form';

interface MoneyFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  hint?: string | undefined;
}

/** A rupee amount input. The text is parsed with `parseRupees` when the form is saved. */
export function MoneyField({ label, value, onChange, ...rest }: MoneyFieldProps) {
  return (
    <TextField
      label={`${label} (₹)`}
      className="input--money"
      inputMode="decimal"
      autoComplete="off"
      placeholder="0"
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      {...rest}
    />
  );
}
