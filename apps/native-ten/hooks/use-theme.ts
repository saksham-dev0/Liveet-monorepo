import { colors } from "../constants/theme";

type ThemeKey = "card" | "text" | "icon" | "border";

export function useThemeColor(
  _props: Record<string, unknown>,
  key: ThemeKey,
) {
  switch (key) {
    case "card":
      return colors.cardBg;
    case "text":
      return colors.navy;
    case "icon":
      return colors.muted;
    case "border":
      return colors.border;
    default:
      return colors.navy;
  }
}

