// Fifth Avenue mobile design tokens.
// Light and dark palettes mirror the web client portal (warm paper + indigo),
// plus a "midnight avenue" hero ground used on the landing, sign-in and
// headline panels.

export const fonts = {
  serif: "Newsreader_400Regular",
  serifMedium: "Newsreader_500Medium",
  serifItalic: "Newsreader_400Regular_Italic",
  sans: "Sora_400Regular",
  sansMedium: "Sora_500Medium",
  sansSemi: "Sora_600SemiBold",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 } as const;

const light = {
  // Legacy keys (kept so older call sites keep working)
  background: "#F6F4EE",
  surface: "#FFFFFF",
  surfaceSecondary: "#EFECE3",
  text: "#191611",
  muted: "#6F6A5A",
  border: "rgba(25,22,17,0.10)",
  primary: "#1B2A5C",
  input: "#FFFFFF",
  selected: "rgba(27,42,92,0.08)",
  icon: "#625D4E",

  // Extended
  raised: "#FCFAF5",
  text2: "#625D4E",
  faint: "#A9A28E",
  borderStrong: "rgba(25,22,17,0.16)",
  well: "rgba(25,22,17,0.055)",
  accent: "#1B2A5C",
  onAccent: "#FFFFFF",
  accentMuted: "rgba(27,42,92,0.10)",
  success: "#17915A",
  successMuted: "rgba(23,145,90,0.11)",
  danger: "#BE3A3A",
  dangerMuted: "rgba(190,58,58,0.10)",
  warning: "#A8720C",
  warningMuted: "rgba(168,114,12,0.12)",
  purple: "#6C55CE",
  teal: "#178E80",
  pink: "#A2489A",
  gold: "#96792A",
  overlay: "rgba(25,22,17,0.45)",
  glass: "rgba(255,255,255,0.78)",
  shadow: "#191611",
  viz: ["#2C3E7E", "#17915A", "#A2489A", "#96792A", "#6C55CE", "#A85B1E", "#178E80"],
};

const dark: typeof light = {
  background: "#131217",
  surface: "#1B1A21",
  surfaceSecondary: "#22212A",
  text: "#ECEAE3",
  muted: "#8E897A",
  border: "rgba(255,255,255,0.11)",
  primary: "#5E8FE0",
  input: "#22212A",
  selected: "rgba(94,143,224,0.16)",
  icon: "#ABA697",

  raised: "#22212A",
  text2: "#ABA697",
  faint: "#6C6858",
  borderStrong: "rgba(255,255,255,0.18)",
  well: "rgba(255,255,255,0.06)",
  accent: "#5E8FE0",
  onAccent: "#0B1024",
  accentMuted: "rgba(94,143,224,0.16)",
  success: "#3FBF86",
  successMuted: "rgba(63,191,134,0.14)",
  danger: "#E57373",
  dangerMuted: "rgba(229,115,115,0.14)",
  warning: "#E0A93F",
  warningMuted: "rgba(224,169,63,0.14)",
  purple: "#9C8AE8",
  teal: "#4CC3B4",
  pink: "#D07CC8",
  gold: "#D2B25A",
  overlay: "rgba(0,0,0,0.6)",
  glass: "rgba(27,26,33,0.82)",
  shadow: "#000000",
  viz: ["#7BA5EA", "#3FBF86", "#D07CC8", "#D2B25A", "#9C8AE8", "#E0935A", "#4CC3B4"],
};

export const palettes = { light, dark };
export type Palette = typeof light;

// The midnight ground is the same in both themes: it is the brand's night sky.
export const midnight = {
  top: "#00001C",
  mid: "#0A0F3A",
  bottom: "#1B2A5C",
  text: "#F6F4EE",
  muted: "rgba(246,244,238,0.66)",
  faint: "rgba(246,244,238,0.38)",
  line: "rgba(246,244,238,0.14)",
  lamp: "#F4C26B",
  lampSoft: "rgba(244,194,107,0.18)",
  glass: "rgba(255,255,255,0.08)",
} as const;

export const springs = {
  press: { damping: 18, stiffness: 320, mass: 0.6 },
  soft: { damping: 20, stiffness: 180, mass: 0.9 },
  snappy: { damping: 22, stiffness: 260, mass: 0.8 },
} as const;

export function cardShadow(p: Palette, level: 1 | 2 = 1) {
  return level === 1
    ? {
        shadowColor: p.shadow,
        shadowOpacity: 0.07,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
      }
    : {
        shadowColor: p.shadow,
        shadowOpacity: 0.16,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 14 },
        elevation: 10,
      };
}
