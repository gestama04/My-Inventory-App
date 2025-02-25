import React, { createContext, useState, useEffect, useContext, ReactNode } from "react";
import { Appearance, ColorSchemeName } from "react-native";

// Tipos de tema
export type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  currentTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Provedor do tema
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>("system");
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark">("light");

  // Atualiza o tema com base no sistema ou no estado escolhido
  const updateTheme = (selectedTheme: Theme) => {
    if (selectedTheme === "system") {
      const systemTheme = Appearance.getColorScheme() || "light";
      setCurrentTheme(systemTheme);
    } else {
      setCurrentTheme(selectedTheme);
    }
    setTheme(selectedTheme);
  };

  useEffect(() => {
    updateTheme(theme);

    // Listener para mudanças no tema do sistema
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (theme === "system") {
        setCurrentTheme(colorScheme || "light");
      }
    });

    return () => subscription.remove();
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, currentTheme, setTheme: updateTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook personalizado para aceder ao contexto
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme deve ser usado dentro de ThemeProvider");
  return context;
};
export default ThemeProvider;