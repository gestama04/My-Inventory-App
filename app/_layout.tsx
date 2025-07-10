import { Stack } from "expo-router";
import { ThemeProvider, useTheme } from "./theme-context";
import { View, StyleSheet, StatusBar, Platform } from "react-native";
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { NotificationService } from '../services/notification-service';
import { AuthProvider } from '../auth-context';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { auth } from '../firebase-config';

// Manter a splash screen visível até que estejamos prontos para mostrar o app
SplashScreen.preventAutoHideAsync();

function AppLayout() {
  const { currentTheme } = useTheme();
  const router = useRouter();
  const [appIsReady, setAppIsReady] = useState(false);

  // Inicializar tudo que precisamos antes de mostrar a UI
  useEffect(() => {
    async function prepare() {
      try {
        // Verificar se o Firebase Auth está disponível
        if (auth) {
          console.log("Firebase Auth está disponível");
        } else {
          console.error("Firebase Auth não está disponível");
        }
        
        // Inicializar o serviço de notificações
        await NotificationService.initialize();
        
        // Qualquer outra inicialização necessária
      } catch (e) {
        console.warn('Erro ao inicializar:', e);
      } finally {
        // Marcar como pronto
        setAppIsReady(true);
      }
    }
    
    prepare();
  }, []);

  // Esconder a splash screen quando estiver pronto
  useEffect(() => {
    if (appIsReady) {
      // Esconder a splash screen após um pequeno atraso para garantir que tudo esteja renderizado
      const timer = setTimeout(() => {
        SplashScreen.hideAsync();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [appIsReady]);

  // Configurar notificações apenas quando o app estiver pronto
  useEffect(() => {
    if (!appIsReady) return;
    
    // Configurar o listener para notificações recebidas quando o app está em primeiro plano
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notificação recebida em primeiro plano:', notification);
    });
    
    // Configurar o listener para resposta a notificações (quando o Utilizador clica)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Resposta de notificação recebida:', response);
      
      // Extrair dados da notificação
      const data = response.notification.request.content.data;
      
      // Navegar com base no tipo de notificação
      if (data && data.type) {
        if (data.type === 'low-stock') {
          console.log('Navegando para tela de stock baixo');
          router.push('/low-stock');
        } else if (data.type === 'out-of-stock') {
          console.log('Navegando para tela sem stock');
          router.push('/out-of-stock');
        }
      }
    });
    
    // Limpar os listeners quando o componente for desmontado
    return () => {
      // Forma correta de remover os listeners
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  }, [router, appIsReady]);

  // Definir a cor da barra de status com base no tema
  StatusBar.setBarStyle(currentTheme === "dark" ? "light-content" : "dark-content");
  if (Platform.OS === 'android') {
    StatusBar.setBackgroundColor(currentTheme === "dark" ? "#222" : "#f9f9f9");
  }

  // Não mostrar nada enquanto estamos inicializando - mantém a splash screen visível
  if (!appIsReady) {
    return null;
  }

  return (
    <View style={[styles.container, currentTheme === "dark" ? styles.dark : styles.light]}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: -100,
          backgroundColor: currentTheme === "dark" ? "#222" : "#f9f9f9",
          zIndex: -1
        }}
      />
      
      <Stack
        initialRouteName="index"
        screenOptions={{
          headerStyle: {
            backgroundColor: currentTheme === "dark" ? "#333" : "#fff",
          },
          headerTintColor: currentTheme === "dark" ? "#fff" : "#333",
          headerTitleStyle: {
            fontWeight: "bold",
          },
          // Definir a cor de fundo para cada tela
          contentStyle: {
            backgroundColor: currentTheme === "dark" ? "#222" : "#f9f9f9"
          }
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="add" options={{ title: "       Adicionar Produto" }} />
        <Stack.Screen name="inventory" options={{ title: "Lista de Produtos" }} />
        <Stack.Screen name="edit" options={{ title: "       Editar Produto" }} />
        <Stack.Screen name="statistics" options={{ title: "Estatísticas" }} />
        <Stack.Screen name="settings" options={{ title: "Definições" }} />
        <Stack.Screen name="low-stock" options={{ title: "Stock Baixo" }} />
        <Stack.Screen name="out-of-stock" options={{ title: "Sem Stock" }} />
        <Stack.Screen name="categories" options={{ title: "Categorias" }} />
        <Stack.Screen name="notifications" options={{ title: "Notificações" }} />
        <Stack.Screen name="home" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="setup" options={{ headerShown: false }} />
        <Stack.Screen name="quick-edit" options={{ title: "Edição Rápida" }} />
      </Stack>
    </View>
  );
}

export default function Layout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
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
