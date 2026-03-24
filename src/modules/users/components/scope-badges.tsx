import type { CSSProperties } from "react";

type ScopeBadgeScope = {
  id: string;
  name: string;
  colorHex: string | null;
  colorMode: string | null;
};

function buildScopeBadgeStyle(scope: ScopeBadgeScope): CSSProperties {
  if (!scope.colorHex) return {};
  if (scope.colorMode === "fill") {
    return { borderColor: `${scope.colorHex}55`, backgroundColor: `${scope.colorHex}14`, color: scope.colorHex };
  }
  return { borderColor: scope.colorHex, color: scope.colorHex };
}

export function ScopeBadges({
  scopes,
  emptyLabel = "No departments",
}: {
  scopes: ScopeBadgeScope[];
  emptyLabel?: string;
}) {
  if (scopes.length === 0) {
    return <span className="rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs text-slate-500 dark:border-[#4b5255] dark:text-slate-400">{emptyLabel}</span>;
  }

  return (
    <>
      {scopes.map((scope) => (
        <span key={scope.id} className="rounded-full border px-2.5 py-1 text-xs font-medium" style={buildScopeBadgeStyle(scope)}>
          {scope.name}
        </span>
      ))}
    </>
  );
}
