import type { CSSProperties } from "react";

type AssetStatusPillProps = {
  label: string;
  color?: string | null;
};

export function AssetStatusPill({ label, color }: AssetStatusPillProps) {
  const style: CSSProperties | undefined = color
    ? {
        borderColor: `${color}55`,
        backgroundColor: `${color}20`,
        color,
      }
    : undefined;

  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold"
      style={style}
    >
      {label}
    </span>
  );
}