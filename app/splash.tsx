import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { useTheme } from "./theme-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from '@react-navigation/native';

// Componente de splash screen embutido
function SplashScreenContent() {
  const { currentTheme } = useTheme();
 
  return (
    <View style={[
      styles.splashContainer,
      { backgroundColor: currentTheme === 'dark' ? '#222222' : '#ffffff' }
    ]}>
      <Text style={[
        styles.splashText,
        { color: currentTheme === 'dark' ? '#ffffff' : '#333333' }
      ]}>
        Inventory
      </Text>
      <Text style={[
        styles.splashSubtitle,
        { color: currentTheme === 'dark' ? '#cccccc' : '#666666' }
      ]}>
        Gestor de Stock
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { currentTheme } = useTheme();
  const [showSplash, setShowSplash] = useState(true);
 
  // Usamos useFocusEffect para garantir que o código só execute uma vez quando a tela é focada
  useFocusEffect(
    React.useCallback(() => {
      let isMounted = true;
     
      if (showSplash && isMounted) {
        const timer = setTimeout(() => {
          if (isMounted) {
            setShowSplash(false);
          }
        }, 2500);
       
        return () => {
          isMounted = false;
          clearTimeout(timer);
        };
      }
    }, [showSplash])
  );
 
  // Ocultar o cabeçalho durante a splash screen
  useEffect(() => {
    if (navigation.setOptions) {
      navigation.setOptions({
        headerShown: !showSplash
      });
    }
  }, [showSplash, navigation]);

  if (showSplash) {
    return <SplashScreenContent />;
  }

  return (
    <View style={[styles.container, currentTheme === "dark" ? styles.dark : styles.light]}>
      <View style={styles.header}>
        <Ionicons
          name="cube-outline"
          size={40}
          color={currentTheme === "dark" ? "#fff" : "#2c3e50"}
        />
        <Text style={[styles.title, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
          My Inventory App
        </Text>
      </View>
      
      <Text style={[
        styles.tagline,
        { color: currentTheme === 'dark' ? '#cccccc' : '#666666' }
      ]}>
        Gestor de Stock
      </Text>
      
      {/* Botões de navegação */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/add")}
      >
        <Text style={styles.buttonText}>Adicionar Item</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/inventory")}
      >
        <Text style={styles.buttonText}>Ver Inventário</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/statistics")}
      >
        <Text style={styles.buttonText}>Estatísticas</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/settings")}
      >
        <Text style={styles.buttonText}>Definições</Text>
      </TouchableOpacity>
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginLeft: 10,
  },
  dark: {
    backgroundColor: "#222222",
  },
  light: {
    backgroundColor: "#f9f9f9",
  },
  darkText: {
    color: "#ffffff",
  },
  lightText: {
    color: "#2c3e50",
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 42,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  tagline: {
    fontSize: 18,
    fontStyle: 'italic',
    marginBottom: 40,
  },
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashText: {
    fontSize: 42,
    fontWeight: 'bold',
  },
  splashSubtitle: {
    fontSize: 18,
    marginTop: 10,
  },
  button: {
    backgroundColor: "#3498db",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    width: width * 0.8,
    alignItems: "center",
    marginBottom: 15,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  }
});
