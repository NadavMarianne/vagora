// The app's looks. Each person picks one in Settings (saved on their account), Night by default.
// Every screen draws itself from the picked theme's values: colors, fonts, shapes, and shadows.
import { Archivo_500Medium } from "@expo-google-fonts/archivo/500Medium";
import { Archivo_800ExtraBold } from "@expo-google-fonts/archivo/800ExtraBold";
import { ArchivoBlack_400Regular } from "@expo-google-fonts/archivo-black/400Regular";
import { Caveat_700Bold } from "@expo-google-fonts/caveat/700Bold";
import { Fraunces_800ExtraBold } from "@expo-google-fonts/fraunces/800ExtraBold";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { Lato_400Regular } from "@expo-google-fonts/lato/400Regular";
import { Lato_700Bold } from "@expo-google-fonts/lato/700Bold";
import { Manrope_400Regular } from "@expo-google-fonts/manrope/400Regular";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { Manrope_800ExtraBold } from "@expo-google-fonts/manrope/800ExtraBold";
import { Nunito_400Regular } from "@expo-google-fonts/nunito/400Regular";
import { Nunito_700Bold } from "@expo-google-fonts/nunito/700Bold";
import { Nunito_800ExtraBold } from "@expo-google-fonts/nunito/800ExtraBold";
import { Orbitron_800ExtraBold } from "@expo-google-fonts/orbitron/800ExtraBold";
import { PlayfairDisplay_800ExtraBold } from "@expo-google-fonts/playfair-display/800ExtraBold";
import { SpaceGrotesk_400Regular } from "@expo-google-fonts/space-grotesk/400Regular";
import { SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk/700Bold";
import { WorkSans_400Regular } from "@expo-google-fonts/work-sans/400Regular";
import { WorkSans_600SemiBold } from "@expo-google-fonts/work-sans/600SemiBold";

/** Every font file the themes use, loaded once when the app starts. */
export const FONTS = {
  Archivo_500Medium,
  Archivo_800ExtraBold,
  ArchivoBlack_400Regular,
  Caveat_700Bold,
  Fraunces_800ExtraBold,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  Lato_400Regular,
  Lato_700Bold,
  Manrope_400Regular,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  Nunito_400Regular,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Orbitron_800ExtraBold,
  PlayfairDisplay_800ExtraBold,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_700Bold,
  WorkSans_400Regular,
  WorkSans_600SemiBold,
};

export type ThemeId = "night" | "clean" | "warm" | "velvet" | "neon" | "paper" | "pop";

export type Theme = {
  id: ThemeId;
  name: string;
  /** A few words for the picker. */
  description: string;
  /** Light text on a dark background. */
  dark: boolean;
  colors: {
    background: string;
    /** Cards, fields, and rows. */
    surface: string;
    /** Quieter panels inside cards. */
    surfaceAlt: string;
    text: string;
    muted: string;
    border: string;
    /** The main button and accents, and the text on top of it. */
    primary: string;
    onPrimary: string;
    /** Outlined (secondary) buttons. */
    outline: string;
    outlineText: string;
    /** Agree or admit (green), contest or dispute (red), warnings (orange), news (info). */
    good: string;
    onGood: string;
    bad: string;
    onBad: string;
    warning: string;
    onWarning: string;
    info: string;
    onInfo: string;
    /** The balance card. */
    balance: string;
    balanceText: string;
    balanceLabel: string;
    /** Explanation boxes. */
    note: string;
    noteText: string;
    error: string;
  };
  fonts: {
    regular: string;
    bold: string;
    /** Titles and big numbers. */
    heading: string;
    /** A handwritten or display touch, for small labels. Same as `bold` when a theme has none. */
    accent: string;
  };
  /** Titles in capitals, and button titles in capitals. */
  upperTitles: boolean;
  upperButtons: boolean;
  radius: { card: number; button: number; chip: number };
  borderWidth: number;
  /** CSS-style shadows, like "4px 4px 0 #111111" (none when empty). */
  shadow: { card: string; button: string };
};

const NIGHT: Theme = {
  id: "night",
  name: "Night",
  description: "Dark plum and violet, easy on the eyes",
  dark: true,
  colors: {
    background: "#15121C",
    surface: "#211C2C",
    surfaceAlt: "#2A2438",
    text: "#F3F0FA",
    muted: "#A9A1BD",
    border: "#332C44",
    primary: "#A78BFA",
    onPrimary: "#15121C",
    outline: "#4A3F66",
    outlineText: "#F3F0FA",
    good: "#4ADE80",
    onGood: "#0B2914",
    bad: "#F87171",
    onBad: "#2A0A0A",
    warning: "#F59E0B",
    onWarning: "#1F1300",
    info: "#A78BFA",
    onInfo: "#15121C",
    balance: "#2A2140",
    balanceText: "#F3F0FA",
    balanceLabel: "#C4B5FD",
    note: "#2A2438",
    noteText: "#DCD6EA",
    error: "#F87171",
  },
  fonts: {
    regular: "Manrope_400Regular",
    bold: "Manrope_700Bold",
    heading: "Manrope_800ExtraBold",
    accent: "Manrope_700Bold",
  },
  upperTitles: false,
  upperButtons: false,
  radius: { card: 20, button: 14, chip: 12 },
  borderWidth: 1,
  shadow: { card: "", button: "" },
};

const CLEAN: Theme = {
  id: "clean",
  name: "Clean",
  description: "White, calm, and tidy",
  dark: false,
  colors: {
    background: "#F5F6FA",
    surface: "#FFFFFF",
    surfaceAlt: "#EEF0FB",
    text: "#161A2B",
    muted: "#5B6275",
    border: "#E3E6EF",
    primary: "#3443C9",
    onPrimary: "#FFFFFF",
    outline: "#C9CEDD",
    outlineText: "#161A2B",
    good: "#2E7D32",
    onGood: "#FFFFFF",
    bad: "#C62828",
    onBad: "#FFFFFF",
    warning: "#B35A00",
    onWarning: "#FFFFFF",
    info: "#3443C9",
    onInfo: "#FFFFFF",
    balance: "#FFFFFF",
    balanceText: "#161A2B",
    balanceLabel: "#5B6275",
    note: "#EEF0FB",
    noteText: "#262B40",
    error: "#C62828",
  },
  fonts: {
    regular: "Inter_400Regular",
    bold: "Inter_600SemiBold",
    heading: "Inter_700Bold",
    accent: "Inter_600SemiBold",
  },
  upperTitles: false,
  upperButtons: false,
  radius: { card: 14, button: 12, chip: 8 },
  borderWidth: 1,
  shadow: { card: "", button: "" },
};

const WARM: Theme = {
  id: "warm",
  name: "Warm",
  description: "Cream and coral, soft and cozy",
  dark: false,
  colors: {
    background: "#FFF7F0",
    surface: "#FFFFFF",
    surfaceAlt: "#FCEDE3",
    text: "#3A2A26",
    muted: "#765B54",
    border: "#F1DCD2",
    primary: "#B4473A",
    onPrimary: "#FFFFFF",
    outline: "#B4473A",
    outlineText: "#B4473A",
    good: "#2E7D32",
    onGood: "#FFFFFF",
    bad: "#C62828",
    onBad: "#FFFFFF",
    warning: "#B35A00",
    onWarning: "#FFFFFF",
    info: "#B4473A",
    onInfo: "#FFFFFF",
    balance: "#F4A896",
    balanceText: "#3A1712",
    balanceLabel: "#6E2C22",
    note: "#FCEDE3",
    noteText: "#3A2A26",
    error: "#C62828",
  },
  fonts: {
    regular: "Nunito_400Regular",
    bold: "Nunito_700Bold",
    heading: "Nunito_800ExtraBold",
    accent: "Nunito_800ExtraBold",
  },
  upperTitles: false,
  upperButtons: false,
  radius: { card: 24, button: 18, chip: 12 },
  borderWidth: 1,
  shadow: { card: "0 4px 16px rgba(180, 71, 58, 0.12)", button: "" },
};

const VELVET: Theme = {
  id: "velvet",
  name: "Velvet",
  description: "Burgundy and gold, elegant",
  dark: true,
  colors: {
    background: "#2A0F17",
    surface: "#331219",
    surfaceAlt: "#3A1520",
    text: "#F7EDE4",
    muted: "#D9B9A6",
    border: "#6B3A44",
    primary: "#E2C27A",
    onPrimary: "#2A0F17",
    outline: "#E2C27A",
    outlineText: "#E2C27A",
    good: "#7FCB8F",
    onGood: "#12301A",
    bad: "#E05A4A",
    onBad: "#1E0508",
    warning: "#F0A04B",
    onWarning: "#2A0F17",
    info: "#E2C27A",
    onInfo: "#2A0F17",
    balance: "#3A1520",
    balanceText: "#F7EDE4",
    balanceLabel: "#E2C27A",
    note: "#3A1520",
    noteText: "#E8D3C4",
    error: "#F08A7E",
  },
  fonts: {
    regular: "Lato_400Regular",
    bold: "Lato_700Bold",
    heading: "PlayfairDisplay_800ExtraBold",
    accent: "PlayfairDisplay_800ExtraBold",
  },
  upperTitles: false,
  upperButtons: true,
  radius: { card: 4, button: 4, chip: 4 },
  borderWidth: 1,
  shadow: { card: "", button: "" },
};

const NEON: Theme = {
  id: "neon",
  name: "Neon",
  description: "Black with glowing pink and cyan",
  dark: true,
  colors: {
    background: "#07060D",
    surface: "#0E0C1C",
    surfaceAlt: "#15132A",
    text: "#EDEBFF",
    muted: "#A7A2D6",
    border: "#2B2850",
    primary: "#5EF2FF",
    onPrimary: "#07060D",
    outline: "#5EF2FF",
    outlineText: "#5EF2FF",
    good: "#39FF88",
    onGood: "#03220F",
    bad: "#FF4D6A",
    onBad: "#07060D",
    warning: "#FFB020",
    onWarning: "#07060D",
    info: "#FF3DAC",
    onInfo: "#07060D",
    balance: "#1E0B1C",
    balanceText: "#FFFFFF",
    balanceLabel: "#FF8FD2",
    note: "#15132A",
    noteText: "#C9C4F0",
    error: "#FF8FA3",
  },
  fonts: {
    regular: "SpaceGrotesk_400Regular",
    bold: "SpaceGrotesk_700Bold",
    heading: "Orbitron_800ExtraBold",
    accent: "Orbitron_800ExtraBold",
  },
  upperTitles: true,
  upperButtons: true,
  radius: { card: 14, button: 10, chip: 8 },
  borderWidth: 1.5,
  shadow: {
    card: "0 0 18px rgba(255, 61, 172, 0.35)",
    button: "0 0 14px rgba(94, 242, 255, 0.55)",
  },
};

const PAPER: Theme = {
  id: "paper",
  name: "Paper and ink",
  description: "Cream paper, ink lines, handwritten notes",
  dark: false,
  colors: {
    background: "#F4EEE2",
    surface: "#FFFDF7",
    surfaceAlt: "#F4EEE2",
    text: "#1C1A17",
    muted: "#4A453D",
    border: "#1C1A17",
    primary: "#1F3A93",
    onPrimary: "#FFFDF7",
    outline: "#1C1A17",
    outlineText: "#1C1A17",
    good: "#2F6B3A",
    onGood: "#FFFDF7",
    bad: "#C23622",
    onBad: "#FFFDF7",
    warning: "#A84B00",
    onWarning: "#FFFDF7",
    info: "#1F3A93",
    onInfo: "#FFFDF7",
    balance: "#FFFDF7",
    balanceText: "#1C1A17",
    balanceLabel: "#4A453D",
    note: "#FCEBD5",
    noteText: "#3D2A12",
    error: "#B02E1C",
  },
  fonts: {
    regular: "WorkSans_400Regular",
    bold: "WorkSans_600SemiBold",
    heading: "Fraunces_800ExtraBold",
    accent: "Caveat_700Bold",
  },
  upperTitles: false,
  upperButtons: false,
  radius: { card: 12, button: 9, chip: 6 },
  borderWidth: 2,
  shadow: { card: "4px 4px 0 #1C1A17", button: "3px 3px 0 #1C1A17" },
};

const POP: Theme = {
  id: "pop",
  name: "Bold pop",
  description: "Yellow, black lines, loud and fun",
  dark: false,
  colors: {
    background: "#FFE14D",
    surface: "#FFFFFF",
    surfaceAlt: "#FFF4B8",
    text: "#111111",
    muted: "#333333",
    border: "#111111",
    primary: "#2D5BFF",
    onPrimary: "#FFFFFF",
    outline: "#111111",
    outlineText: "#111111",
    good: "#2BD36B",
    onGood: "#111111",
    bad: "#FF3B3B",
    onBad: "#111111",
    warning: "#FF8A1E",
    onWarning: "#111111",
    info: "#FF4FA3",
    onInfo: "#111111",
    balance: "#FF4FA3",
    balanceText: "#111111",
    balanceLabel: "#111111",
    note: "#FFF4B8",
    noteText: "#111111",
    error: "#B00020",
  },
  fonts: {
    regular: "Archivo_500Medium",
    bold: "Archivo_800ExtraBold",
    heading: "ArchivoBlack_400Regular",
    accent: "ArchivoBlack_400Regular",
  },
  upperTitles: true,
  upperButtons: true,
  radius: { card: 0, button: 0, chip: 0 },
  borderWidth: 3,
  shadow: { card: "6px 6px 0 #111111", button: "4px 4px 0 #111111" },
};

/** In the order the picker shows them. */
export const THEMES: Theme[] = [NIGHT, CLEAN, WARM, VELVET, NEON, PAPER, POP];

export const DEFAULT_THEME = NIGHT;

export function themeById(id: string | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? DEFAULT_THEME;
}
