import { useCallback, useEffect, useState } from "react";
import { formatCommaNumber, parseDecimalInput } from "../lib/formatComma";

type CommaDecimalInputProps = {
  value: number;
  onChange: (next: number) => void;
  maximumFractionDigits?: number;
  min?: number;
  placeholder?: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
  disabled?: boolean;
};

/**
 * 표시는 콤마, 내부 값은 number. 포커스 중에는 편집을 위해 원문에 가깝게 두고 blur 시 정규화.
 */
export function CommaDecimalInput({
  value,
  onChange,
  maximumFractionDigits = 8,
  min,
  placeholder,
  className,
  id,
  "aria-label": ariaLabel,
  disabled
}: CommaDecimalInputProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => formatCommaNumber(value, maximumFractionDigits));

  useEffect(() => {
    if (!focused) {
      setDraft(formatCommaNumber(value, maximumFractionDigits));
    }
  }, [value, maximumFractionDigits, focused]);

  const commit = useCallback(() => {
    const n = parseDecimalInput(draft);
    if (n == null) {
      setDraft(formatCommaNumber(value, maximumFractionDigits));
      return;
    }
    let next = n;
    if (min != null && next < min) next = min;
    onChange(next);
    setDraft(formatCommaNumber(next, maximumFractionDigits));
  }, [draft, maximumFractionDigits, min, onChange, value]);

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={focused ? draft : formatCommaNumber(value, maximumFractionDigits)}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => {
        setFocused(true);
        setDraft(Number.isFinite(value) ? String(value) : "");
      }}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
