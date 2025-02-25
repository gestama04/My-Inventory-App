import { Stack } from "expo-router";
import { ThemeProvider, useTheme } from "./theme-context";
import { View, StyleSheet } from "react-native";

function AppLayout() {
  const { currentTheme } = useTheme();

  return (
    <View style={[styles.container, currentTheme === "dark" ? styles.dark : styles.light]}>
      <Stack
        initialRouteName="splash"
        screenOptions={{
          headerStyle: {
            backgroundColor: currentTheme === "dark" ? "#333" : "#fff",
          },
          headerTintColor: currentTheme === "dark" ? "#fff" : "#333",
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
      >
        <Stack.Screen 
          name="splash" 
          options={{ 
            headerShown: false,
            animation: "none" 
          }} 
        />
        <Stack.Screen name="index" options={{ title: "My Inventory App" }} />
        <Stack.Screen name="add" options={{ title: "       Adicionar Item" }} />
        <Stack.Screen name="inventory" options={{ title: "Lista de Itens" }} />
        <Stack.Screen name="edit" options={{ title: "       Editar Item" }} />
        <Stack.Screen name="statistics" options={{ title: "Estatísticas" }} />
        <Stack.Screen name="settings" options={{ title: "Definições" }} />
      </Stack>
    </View>
  );
}

export default function Layout() {
  return (
    <ThemeProvider>
      <AppLayout />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  light: {
    backgroundColor: "#f9f9f9",
  },
  dark: {
    backgroundColor: "#222",
  },
});
