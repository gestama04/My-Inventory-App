import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from "react-native";
import { useTheme } from "./theme-context";
import { useRouter } from "expo-router";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';

interface Item {
  name: string;
  quantity: string;
  category: string;
}
export default function SettingsScreen() {
  const { setTheme, currentTheme, theme } = useTheme();
  const router = useRouter();

  const exportAsPDF = async (data: string) => {
    try {
      const inventory: Item[] = JSON.parse(data);;
      const htmlContent = `
        <html>
          <body>
            <h1>Inventário</h1>
            <table style="width:100%; border-collapse: collapse;">
              <tr style="background-color: #f2f2f2;">
                <th style="border: 1px solid #ddd; padding: 8px;">Nome</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Quantidade</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Categoria</th>
              </tr>
              ${inventory.map(item => `
                <tr>
                  <td style="border: 1px solid #ddd; padding: 8px;">${item.name}</td>
                  <td style="border: 1px solid #ddd; padding: 8px;">${item.quantity}</td>
                  <td style="border: 1px solid #ddd; padding: 8px;">${item.category}</td>
                </tr>
              `).join('')}
            </table>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri);
    } catch (error) {
      Alert.alert("Erro", "Falha ao exportar PDF.");
    }
  };

  const exportAsCSV = async (data: string) => {
    try {
      const inventory: Item[] = JSON.parse(data);
      const csvContent = "Nome,Quantidade,Categoria\n" + 
        inventory.map(item => `${item.name},${item.quantity},${item.category}`).join('\n');

      const csvUri = FileSystem.documentDirectory + "inventory.csv";
      await FileSystem.writeAsStringAsync(csvUri, csvContent);
      await Sharing.shareAsync(csvUri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
    } catch (error) {
      Alert.alert("Erro", "Falha ao exportar CSV.");
    }
  };

  const exportData = async () => {
    try {
      const data = await AsyncStorage.getItem("inventory");
      if (!data) {
        Alert.alert("Erro", "Nenhum dado para exportar.");
        return;
      }

      Alert.alert(
        "Exportar Dados",
        "Escolha o formato",
        [
          {
            text: "PDF",
            onPress: () => exportAsPDF(data)
          },
          {
            text: "CSV (Excel)",
            onPress: () => exportAsCSV(data)
          },
          {
            text: "JSON",
            onPress: async () => {
              const fileUri = FileSystem.documentDirectory + "backup.json";
              await FileSystem.writeAsStringAsync(fileUri, data);
              await Sharing.shareAsync(fileUri);
            }
          },
          {
            text: "Cancelar",
            style: "cancel"
          }
        ]
      );
    } catch (error) {
      Alert.alert("Erro", "Falha ao exportar os dados.");
    }
  };

  const importData = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/plain"],
        multiple: false
      });
  
      if (result.canceled) {
        Alert.alert("Importação", "Operação cancelada.");
        return;
      }
  
      const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const parsedData = JSON.parse(fileContent);
  
      if (!Array.isArray(parsedData)) {
        Alert.alert("Erro", "O ficheiro deve conter uma lista de itens.");
        return;
      }
  
      await AsyncStorage.setItem("inventory", JSON.stringify(parsedData));
      Alert.alert("Sucesso", "Dados importados com sucesso!");
    } catch (error) {
      Alert.alert("Erro", "Selecione um ficheiro JSON válido.");
      console.error(error);
    }
  };  
  

  const resetInventory = async () => {
    Alert.alert("Redefinir", "Tem a certeza? Todos os dados serão eliminados.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sim", onPress: async () => await AsyncStorage.removeItem("inventory") },
    ]);
  };

  return (
    <ScrollView style={[styles.scrollView, currentTheme === "dark" ? styles.dark : styles.light]}>
      <View style={styles.container}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
            Temas
          </Text>
          <View style={styles.themeContainer}>
            <TouchableOpacity 
              style={[styles.themeButton, theme === "light" ? styles.activeTheme : null]} 
              onPress={() => setTheme("light")}>
              <Ionicons name="sunny" size={24} color={theme === "light" ? "#ffffff" : "#2c3e50"} />
              <Text style={[styles.themeButtonText, theme === "light" ? styles.activeThemeText : null]}>Claro</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.themeButton, theme === "dark" ? styles.activeTheme : null]} 
              onPress={() => setTheme("dark")}>
              <Ionicons name="moon" size={24} color={theme === "dark" ? "#ffffff" : "#2c3e50"} />
              <Text style={[styles.themeButtonText, theme === "dark" ? styles.activeThemeText : null]}>Escuro</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.themeButton, theme === "system" ? styles.activeTheme : null]} 
              onPress={() => setTheme("system")}>
              <Ionicons name="settings" size={24} color={theme === "system" ? "#ffffff" : "#2c3e50"} />
              <Text style={[styles.themeButtonText, theme === "system" ? styles.activeThemeText : null]}>Sistema</Text>
            </TouchableOpacity>


          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
            Gestão de Dados
          </Text>
          <TouchableOpacity style={styles.actionButton} onPress={exportData}>
            <MaterialIcons name="cloud-upload" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Exportar Dados</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={importData}>
            <MaterialIcons name="file-download" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Importar Dados</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerButton} onPress={resetInventory}>
            <MaterialIcons name="delete" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Redefinir Inventário</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
            Sobre
          </Text>
          <TouchableOpacity style={styles.infoButton} onPress={() => Alert.alert("Suporte", "Email: pv26632@estgl.ipv.pt")}>
            <MaterialIcons name="email" size={24} color="#fff" />
            <Text style={styles.infoButtonText}>Contacto</Text>
          </TouchableOpacity>
          <Text style={[styles.versionText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
            Versão 1.0.0
          </Text>
          <Text style={[styles.copyrightText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
            © 2025
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 80,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 15,
  },
  themeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  themeButton: {
    flex: 1,
    marginHorizontal: 5,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  activeTheme: {
    backgroundColor: '#3498db',
  },
  themeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  activeThemeText: {
    color: '#fff',
  },
  actionButton: {
    backgroundColor: '#3498db',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  dangerButton: {
    backgroundColor: '#e74c3c',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoButton: {
    backgroundColor: '#8e44ad',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  infoButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 14,
    marginTop: 10,
  },
  copyrightText: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 5,
    color: '#666',
  },
  light: {
    backgroundColor: '#f9f9f9',
  },
  dark: {
    backgroundColor: '#222222',
  },
  lightText: {
    color: '#2c3e50',
  },
  darkText: {
    color: '#ffffff',
  },
});
