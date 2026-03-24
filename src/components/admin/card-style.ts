import type { CSSProperties } from "react";

type ColorStyledItem = {
  colorHex: string | null;
  colorMode: string | null;
};

export function buildColorCardStyle(item: ColorStyledItem): CSSProperties {
  if (!item.colorHex || !item.colorMode) {
    return {};
  }

  if (item.colorMode === "border") {
    return {
      borderColor: item.colorHex,
      borderWidth: 2,
    };
  }

  if (item.colorMode === "fill") {
    return {
      borderColor: `${item.colorHex}55`,
      backgroundColor: `${item.colorHex}14`,
    };
  }

  return {};
}
