import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeChoice = "light" | "dark" | "system";

const COLORS = {
  light: {
    background: "#F8F7F4",
    surface: "#FFFFFF",
    surfaceSecondary: "#F0F2F6",
    text: "#17243A",
    muted: "#818895",
    border: "#E9EAF0",
    primary: "#17243A",
    input: "#FFFFFF",
    selected: "#F5F7FA",
    icon: "#53617A",
  },
  dark: {
    background: "#101827",
    surface: "#1B2638",
    surfaceSecondary: "#263348",
    text: "#F4F6FA",
    muted: "#A5AFBF",
    border: "#344258",
    primary: "#9DB7FF",
    input: "#263348",
    selected: "#293951",
    icon: "#C0CBE0",
  },
};

type ThemeContextType = {
  theme: ThemeChoice;
  setTheme: (theme: ThemeChoice) => Promise<void>;
  colors: typeof COLORS.light;
  isDark: boolean;
  isThemeReady: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(
  undefined
);

export function ThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const systemScheme = useColorScheme();

  const [theme, setThemeState] = useState<ThemeChoice>("system");
  const [isThemeReady, setIsThemeReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem("app-theme");

        if (
          mounted &&
          (savedTheme === "light" ||
            savedTheme === "dark" ||
            savedTheme === "system")
        ) {
          setThemeState(savedTheme);
        }
      } catch (error) {
        console.warn("Unable to load saved theme:", error);
      } finally {
        if (mounted) setIsThemeReady(true);
      }
    };

    loadTheme();

    return () => {
      mounted = false;
    };
  }, []);

  const setTheme = async (newTheme: ThemeChoice) => {
    setThemeState(newTheme);

    try {
      await AsyncStorage.setItem("app-theme", newTheme);
    } catch (error) {
      console.warn("Unable to save theme:", error);
    }
  };

  const isDark =
    theme === "system"
      ? systemScheme === "dark"
      : theme === "dark";

  const colors = isDark ? COLORS.dark : COLORS.light;

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      colors,
      isDark,
      isThemeReady,
    }),
    [theme, colors, isDark, isThemeReady]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useAppTheme must be used inside ThemeProvider");
  }

  return context;
}