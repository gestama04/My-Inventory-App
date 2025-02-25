import { useState,useLayoutEffect, useEffect, useCallback } from "react";
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "./theme-context";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Ionicons } from "@expo/vector-icons";
import { Camera, useCameraPermissions, CameraView } from 'expo-camera';
import { BackHandler } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Stack } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
const genAI = new GoogleGenerativeAI("AIzaSyDuUDSAfqwznlx9XMw-Xea4f0bU-sfe_4k");

interface Item {
  name: string;
  category: string;
  quantity: string;
}

export default function EditItem() {
  const router = useRouter();
  const { name, category, quantity } = useLocalSearchParams<{ name: string; category: string; quantity: string }>();
  const navigation = useNavigation();
  const { currentTheme } = useTheme();

  const [itemName, setItemName] = useState(name || "");
  const [itemCategory, setItemCategory] = useState(category || "");
  const [itemQuantity, setItemQuantity] = useState(quantity || "1");
  const [suggestedCategory, setSuggestedCategory] = useState("");
  const [usedCategories, setUsedCategories] = useState<string[]>([]);
  const [isCategoryVisible, setIsCategoryVisible] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const predefinedCategories = [
    "Roupas", "Smartphones", "Televisões", "Tablets", "Portáteis", "Alimentos", "Objetos", "Ferramentas", 
    "Produtos de Higiene", "Acessórios", "Carros", "Videojogos", "Livros", "Móveis", "Eletrodomésticos", 
    "Material Escolar", "Decoração", "Brinquedos", "Calçado", "Jardinagem", "Desporto", "Medicamentos", 
    "Bebidas", "Música", "Cosméticos", "Papelaria", "Animais"
  ];
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        // Mimic the cancel button behavior
        router.replace("/inventory");
        return true; // Prevent default back button behavior
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => 
        BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [router])
  );

  const handleCancel = () => {
    router.replace("/inventory");
  };

  useEffect(() => {
    if (!name || !category) {
      Alert.alert("Erro", "Item inválido");
      router.replace("/inventory");
    }
  }, [name, category]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const storedItems = await AsyncStorage.getItem("inventory");
        const items = storedItems ? JSON.parse(storedItems) : [];
        if (Array.isArray(items)) {
          const categoriesFromItems = items.map((it: { category: string }) => it.category);
          const combinedCategories = Array.from(new Set([...predefinedCategories, ...categoriesFromItems]));
          setUsedCategories(combinedCategories);
        }
      } catch (error) {
        console.error("Erro ao carregar categorias", error);
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    if (typingTimeout) clearTimeout(typingTimeout);

    const timeout = setTimeout(() => {
      getSuggestedCategory(itemName);
    }, 1000);

    setTypingTimeout(timeout);
  }, [itemName]);

  const getSuggestedCategory = async (itemName: string) => {
    if (!itemName.trim()) return;
  
    try {
      // Check cache first
      const cachedCategory = await AsyncStorage.getItem(`suggestion-${itemName}`);
      if (cachedCategory) {
        setSuggestedCategory(cachedCategory);
        return;
      }
  
      // AI suggestion with retry logic
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          const model = genAI.getGenerativeModel({ model: "gemini-pro" });
          const prompt = `Dado um item chamado "${itemName}", sugira a categoria apropriada entre estas opções: ${predefinedCategories.join(", ")}. Responda apenas com o nome da categoria.`;
          
          const result = await model.generateContent(prompt);
          const responseText = result.response.text().trim();
  
          // Validate response against predefined categories
          if (predefinedCategories.includes(responseText)) {
            await AsyncStorage.setItem(`suggestion-${itemName}`, responseText);
            setSuggestedCategory(responseText);
            return;
          }
  
          // Find closest matching category
          const closestMatch = predefinedCategories.find(cat => 
            cat.toLowerCase().includes(responseText.toLowerCase()) ||
            responseText.toLowerCase().includes(cat.toLowerCase())
          ) || itemCategory || "Objetos";
  
          await AsyncStorage.setItem(`suggestion-${itemName}`, closestMatch);
          setSuggestedCategory(closestMatch);
          return;
  
        } catch (error) {
          attempts++;
          if (attempts === maxAttempts) {
            // Keep current category if available, otherwise default to "Objetos"
            setSuggestedCategory(itemCategory || "Objetos");
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
  
    } catch (error) {
      console.error("Erro ao obter sugestão da IA:", error);
      setSuggestedCategory(itemCategory || "Objetos");
    }
  };

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setIsScanning(false);

    let itemName = data;

    // Verifica se é um URL e extrai o nome do domínio
    try {
      const url = new URL(data);
      const domain = url.hostname.replace('www.', '').split('.')[0];
      itemName = domain.charAt(0).toUpperCase() + domain.slice(1);
    } catch (e) {
      // Não é um URL, mantém o valor original
    }

    setItemName(itemName);

    Alert.alert(
      `Código Scaneado`,
      `Tipo: ${type}\nDados: ${data}`,
      [
        {
          text: 'OK',
          onPress: () => setScanned(false),
        }
      ],
      { cancelable: false }
    );
  };

  const handleSave = async () => {
    try {
      const storedItems = await AsyncStorage.getItem("inventory");
      const items: Item[] = storedItems ? JSON.parse(storedItems) : [];

      const updatedItems = items.map((item) =>
        item.name === name && item.category === category
          ? { name: itemName, category: itemCategory, quantity: itemQuantity }
          : item
      );

      await AsyncStorage.setItem("inventory", JSON.stringify(updatedItems));
      Alert.alert("Sucesso", "Item atualizado com sucesso!");
      router.replace("/inventory");
    } catch (error) {
      console.error("Erro ao salvar item editado", error);
      Alert.alert("Erro", "Não foi possível salvar a edição.");
    }
  };
  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => router.replace("/inventory")}>
          <Ionicons 
            name="arrow-back" 
            size={24} 
            color={currentTheme === "dark" ? "white" : "black"} 
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, router, currentTheme]);
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardAvoiding}>
      <ScrollView contentContainerStyle={styles.scrollView}>
        <View style={[styles.container, currentTheme === "dark" ? styles.dark : styles.light]}>
          <Text style={[styles.title, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
            Editar
          </Text>

          <TextInput
            placeholder="Nome do item..."
            placeholderTextColor={currentTheme === "dark" ? "#bbb" : "#555"}
            value={itemName}
            onChangeText={setItemName}
            style={[styles.input, currentTheme === "dark" ? styles.darkInput : styles.lightInput]}
          />

          <TextInput
            placeholder="Categoria..."
            placeholderTextColor={currentTheme === "dark" ? "#bbb" : "#555"}
            value={itemCategory}
            onChangeText={setItemCategory}
            style={[styles.input, currentTheme === "dark" ? styles.darkInput : styles.lightInput]}
          />

          <TextInput
            placeholder="Quantidade..."
            placeholderTextColor={currentTheme === "dark" ? "#bbb" : "#555"}
            value={itemQuantity}
            onChangeText={setItemQuantity}
            keyboardType="numeric"
            style={[styles.input, currentTheme === "dark" ? styles.darkInput : styles.lightInput]}
          />

          <TouchableOpacity 
            style={styles.scanButton} 
            onPress={() => {
              setIsScanning(true);
            }}
            ><Text style={[
              styles.categoryDropdownText, 
              { color: 'white' } // Force white color for both themes
            ]}>Ler</Text>
            <Ionicons name="qr-code-outline" size={24} color="white" style={styles.scanButtonIcon} />
            <Ionicons name="barcode-outline" size={24} color="white" style={styles.scanButtonIcon} />
          </TouchableOpacity>

          {suggestedCategory !== "" && (
            <TouchableOpacity style={styles.suggestionButton} onPress={() => setItemCategory(suggestedCategory)}>
              <Text style={styles.suggestionText}>Sugestão IA: {suggestedCategory}</Text>
            </TouchableOpacity>
          )}

          <View style={[styles.categoryContainer, currentTheme === "dark" ? styles.darkButton : styles.lightButton]}>
            <TouchableOpacity
              onPress={() => setIsCategoryVisible(!isCategoryVisible)}
              style={styles.categoryHeader}
            >
              <Text style={[styles.categoryDropdownText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                {isCategoryVisible ? "▼ Categorias" : "▶ Categorias"}
              </Text>
            </TouchableOpacity>

            {isCategoryVisible && (
              <ScrollView style={styles.categoryList} nestedScrollEnabled={true}>
                {usedCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={styles.categoryItem}
                    onPress={() => {
                      setItemCategory(cat);
                      setIsCategoryVisible(false);
                    }}
                  >
                    <Text style={[styles.categoryItemText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

 <View style={styles.buttonContainer}>
      <TouchableOpacity
        style={[styles.button, styles.cancelButton]}
        onPress={handleCancel} // Use the new method
      >
        <Text style={styles.buttonText}>Cancelar</Text>
      </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.saveButton]} 
              onPress={handleSave}
            >
              <Text style={styles.buttonText}>Guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {isScanning && (
        <View style={styles.scannerContainer}>
          <CameraView
            style={styles.camera}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          >
            <View style={styles.layerContainer}>
              <View style={styles.layerTop} />
              <View style={styles.layerCenter}>
                <View style={styles.layerLeft} />
                <View style={styles.focused} />
                <View style={styles.layerRight} />
              </View>
              <View style={styles.layerBottom} />
            </View>
          </CameraView>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => setIsScanning(false)}
          >
            <Text style={styles.closeButtonText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoiding: {
    flex: 1,
  },
  scrollView: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  input: {
    width: "100%",
    height: 40,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    paddingLeft: 10,
    marginBottom: 10,
  },
  categoryContainer: {
    width: '55%',
    borderRadius: 8,
    marginBottom: 10,
    overflow: 'hidden',
  },
  categoryHeader: {
    padding: 10,
    alignItems: 'center',
  },
  categoryList: {
    maxHeight: 200,
  },
  categoryItem: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    alignItems: 'center',
  },
  categoryItemText: {
    fontSize: 16,
  },
  categoryDropdownText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 20,
    gap: 10,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#e74c3c",
  },
  saveButton: {
    backgroundColor: "#2ecc71",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  suggestionButton: {
    backgroundColor: "#f0f0f0",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  suggestionText: {
    fontSize: 14,
    color: "#333",
    textAlign: "center",
  },
  scanButton: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 8,
    width: "36%",
    alignItems: "center",
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  scanButtonIcon: {
    marginRight: 0,
    marginLeft: 6,
  },
  scannerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'black',
    zIndex: 1000,
  },
  camera: {
    flex: 1,
  },
  layerContainer: {
    flex: 1,
  },
  layerTop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  layerCenter: {
    flexDirection: 'row',
  },
  layerLeft: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  focused: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: '#00FF00',
  },
  layerRight: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  layerBottom: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    padding: 10,
    backgroundColor: 'white',
    borderRadius: 5,
  },
  closeButtonText: {
    color: 'black',
    fontSize: 16,
  },
  dark: {
    backgroundColor: "#222",
  },
  light: {
    backgroundColor: "#f9f9f9",
  },
  darkText: {
    color: "#fff",
  },
  lightText: {
    color: "#333",
  },
  darkInput: {
    backgroundColor: "#444",
    color: "#fff",
    borderColor: "#555",
  },
  lightInput: {
    backgroundColor: "#fff",
    color: "#333",
    borderColor: "#ccc",
  },
  darkButton: {
    backgroundColor: "#333",
  },
  lightButton: {
    backgroundColor: "#eee",
  },
});
