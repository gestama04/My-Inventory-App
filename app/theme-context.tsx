import React, { createContext, useState, useEffect, useContext, ReactNode } from "react";
import { Appearance, ColorSchemeName } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  const [theme, setThemeState] = useState<Theme>("system");
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark">("light");
  const [isLoading, setIsLoading] = useState(true);

  // Carregar a preferência de tema salva
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('themePreference');
        if (savedTheme) {
          setThemeState(savedTheme as Theme);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Erro ao carregar preferência de tema:', error);
        setIsLoading(false);
      }
    };

    loadThemePreference();
  }, []);

  // Atualiza o tema com base no sistema ou no estado escolhido
  const updateTheme = async (selectedTheme: Theme) => {
    if (selectedTheme === "system") {
      const systemTheme = Appearance.getColorScheme() || "light";
      setCurrentTheme(systemTheme);
    } else {
      setCurrentTheme(selectedTheme);
    }
    setThemeState(selectedTheme);
    
    // Salvar a preferência no AsyncStorage
    try {
      await AsyncStorage.setItem('themePreference', selectedTheme);
    } catch (error) {
      console.error('Erro ao salvar preferência de tema:', error);
    }
  };

  useEffect(() => {
    if (!isLoading) {
      updateTheme(theme);
    }

    // Listener para mudanças no tema do sistema
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (theme === "system") {
        setCurrentTheme(colorScheme || "light");
      }
    });

    return () => subscription.remove();
  }, [theme, isLoading]);

  if (isLoading) {
    return null;
  }

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