import { Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";

// 「更多设置」侧栏用的小型表单控件：分段选择 / 步进器 / 开关。只用 token。

type SegmentedOption<T extends string> = { value: T; label: ReactNode; title?: string };

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={ariaLabel} aria-disabled={disabled || undefined}>
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            className={`segmented-item ${checked ? "is-checked" : ""}`}
            title={option.title}
            disabled={disabled}
            onClick={() => {
              if (!checked) onChange(option.value);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function NumberStepper({
  value,
  min,
  max,
  onChange,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}) {
  const safe = Number.isFinite(value) ? value : min;
  const set = (next: number) => onChange(Math.min(max, Math.max(min, Math.round(next))));
  return (
    <div className="stepper" role="group" aria-label={ariaLabel}>
      <button type="button" aria-label={`${ariaLabel}减少`} disabled={safe <= min} onClick={() => set(safe - 1)}>
        <Minus size={13} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={ariaLabel}
        min={min}
        max={max}
        value={safe}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) set(next);
        }}
      />
      <button type="button" aria-label={`${ariaLabel}增加`} disabled={safe >= max} onClick={() => set(safe + 1)}>
        <Plus size={13} />
      </button>
    </div>
  );
}

export function SwitchRow({
  checked,
  onChange,
  label,
  description,
  title,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  title?: string;
}) {
  return (
    <label className="switch-row" title={title}>
      <span className="switch-row-text">
        <span className="switch-row-label">{label}</span>
        {description && <small>{description}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
