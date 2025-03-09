import { Stack } from "expo-router";
import { ThemeProvider, useTheme } from "./theme-context";
import { View, StyleSheet } from "react-native";
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { NotificationService } from './notifications';

function AppLayout() {
  const { currentTheme } = useTheme();

  // Adicione este useEffect para gerenciar a splash screen nativa e notificações
  useEffect(() => {
    async function prepare() {
      try {
        // Impede que a splash screen nativa desapareça automaticamente
        await SplashScreen.preventAutoHideAsync();
        
        // Inicializar o serviço de notificações
        await NotificationService.registerForPushNotificationsAsync();
        
        // Configurar verificação periódica de stock
        await NotificationService.setupPeriodicStockCheck();
        
        // Verificar níveis de stock imediatamente
        await NotificationService.checkStockLevels();
      } catch (e) {
        console.warn('Erro ao inicializar:', e);
      } finally {
        // Esconde a splash screen nativa após inicializar tudo
        setTimeout(() => {
          SplashScreen.hideAsync();
        }, 1000); // Ajuste esse tempo conforme necessário
      }
    }

    prepare();
  }, []);

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
