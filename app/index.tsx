import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "./theme-context";
import { Ionicons } from "@expo/vector-icons";

export default function HomeScreen() {
  const router = useRouter();
  const { currentTheme } = useTheme();

  return (
    <View style={[styles.container, currentTheme === "dark" ? styles.dark : styles.light]}>
      <View style={styles.header}>
        <Ionicons
          name="cube-outline"
          size={40}
          color={currentTheme === "dark" ? "#fff" : "#2c3e50"}
        />
        <Text style={[styles.title, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
          Inventário Pessoal
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.buttonPrimary, currentTheme === "dark" ? styles.darkButton : styles.lightButton]}
        onPress={() => router.push("/inventory")}
      >
        <Ionicons name="list" size={24} color="#fff" />
        <Text style={styles.buttonText}>Ver Inventário</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.buttonSecondary, currentTheme === "dark" ? styles.darkButton : styles.lightButton]}
        onPress={() => router.push("/add")}
      >
        <Ionicons name="add-circle" size={24} color="#fff" />
        <Text style={styles.buttonText}>Adicionar Item</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.buttonStatistics, currentTheme === "dark" ? styles.darkButton : styles.lightButton]}
        onPress={() => router.push("/statistics")}
      >
        <Ionicons name="bar-chart" size={24} color="#fff" />
        <Text style={styles.buttonText}>Estatísticas</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.buttonSettings, currentTheme === "dark" ? styles.darkButton : styles.lightButton]}
        onPress={() => router.push("/settings")}
      >
        <Ionicons name="settings-outline" size={24} color="#fff" />
        <Text style={styles.buttonText}>Definições</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginTop: 10,
    textAlign: "center",
  },
  buttonPrimary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3498db",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginBottom: 20,
    width: "80%",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonSecondary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2ecc71",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginBottom: 20,
    width: "80%",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonStatistics: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#9b59b6",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginBottom: 20,
    width: "80%",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonSettings: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f39c12",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    width: "80%",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  light: {
    backgroundColor: "#f9f9f9",
  },
  dark: {
    backgroundColor: "#222222",
  },
  lightText: {
    color: "#2c3e50",
  },
  darkText: {
    color: "#ffffff",
  },
  darkButton: {
    backgroundColor: "#34495e",
  },
  lightButton: {
    backgroundColor: "#3498db",
  },
});
