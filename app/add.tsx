import { useState, useEffect, useLayoutEffect } from "react";
import { View, TextInput, StyleSheet, Alert, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "./theme-context";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Ionicons } from "@expo/vector-icons";
import { Camera, useCameraPermissions, CameraView } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';

const genAI = new GoogleGenerativeAI("AIzaSyDuUDSAfqwznlx9XMw-Xea4f0bU-sfe_4k");

export default function AddItemScreen() {
  const [item, setItem] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [usedCategories, setUsedCategories] = useState<string[]>([]);
  const [suggestedCategory, setSuggestedCategory] = useState("");
  const [isCategoryVisible, setIsCategoryVisible] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const navigation = useNavigation();
  const { currentTheme } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

  const predefinedCategories = [
    "Roupas", "Smartphones", "Televisões", "Tablets", "Portáteis", "Alimentos", "Objetos", "Ferramentas", 
    "Produtos de Higiene", "Acessórios", "Carros", "Videojogos", "Livros", "Móveis", "Eletrodomésticos", 
    "Material Escolar", "Decoração", "Brinquedos", "Calçado", "Jardinagem", "Desporto", "Medicamentos", 
    "Bebidas", "Música", "Cosméticos", "Papelaria", "Animais"
  ];  

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

    setItem(itemName);

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

  const handleAddItem = async () => {
    if (item.trim() === "" || category.trim() === "") {
      Alert.alert("Erro", "Por favor, insira um nome e uma categoria.");
      return;
    }

    try {
      const storedItems = await AsyncStorage.getItem("inventory");
      const items = storedItems ? JSON.parse(storedItems) : [];

      if (!Array.isArray(items)) {
        console.error("Erro: Dados corrompidos no AsyncStorage.");
        Alert.alert("Erro", "Os dados do inventário estão corrompidos.");
        return;
      }

      items.push({
        name: item.trim(),
        category: category.trim(),
        quantity: quantity.trim() || "1"
      });

      await AsyncStorage.setItem("inventory", JSON.stringify(items));
      setItem("");
      setCategory("");
      setQuantity("1");
      setSuggestedCategory("");
      Alert.alert("Sucesso", "Item adicionado com sucesso!");
      router.replace("/inventory");
    } catch (error) {
      console.error("Erro ao salvar item", error);
      Alert.alert("Erro", "Ocorreu um erro ao salvar o item.");
    }
  };

  const getSuggestedCategory = async (itemName: string) => {
    if (!itemName.trim()) return;
  
    try {
      // First check cache
      const cacheKey = `suggestion-${encodeURIComponent(itemName)}`;
      const cachedCategory = await AsyncStorage.getItem(cacheKey);
      if (cachedCategory) {
        setSuggestedCategory(cachedCategory);
        return;
      }
  
      // If no cache, try AI suggestion with retry logic
      let attempts = 0;
      const maxAttempts = 3;
  
      while (attempts < maxAttempts) {
        try {
          const model = genAI.getGenerativeModel({ model: "gemini-pro" });
          const prompt = `Dado um item chamado "${itemName}", sugira a categoria apropriada entre estas opções: ${predefinedCategories.join(", ")}. Responda apenas com o nome da categoria.`;
  
          const result = await model.generateContent(prompt);
          const responseText = result.response.text().trim();
  
          if (predefinedCategories.includes(responseText)) {
            await AsyncStorage.setItem(cacheKey, responseText);
            setSuggestedCategory(responseText);
            return;
          }
  
          const closestMatch = predefinedCategories.find(cat => 
            cat.toLowerCase().includes(responseText.toLowerCase()) ||
            responseText.toLowerCase().includes(cat.toLowerCase())
          ) || "Objetos"; // Default to "Objetos" if no match
  
          await AsyncStorage.setItem(cacheKey, closestMatch);
          setSuggestedCategory(closestMatch);
          return;
  
        } catch (error) {
          attempts++;
          if (attempts === maxAttempts) {
            setSuggestedCategory("Objetos");
          }
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
        }
      }
  
    } catch (error) {
      console.error("Erro ao obter sugestão da IA:", error);
      setSuggestedCategory("Objetos");
    }
  };

  useEffect(() => {
    if (typingTimeout) clearTimeout(typingTimeout);

    const timeout = setTimeout(() => {
      getSuggestedCategory(item);
    }, 1000);

    setTypingTimeout(timeout);
  }, [item]);

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
            Adicionar
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              placeholder="Nome do item..."
              placeholderTextColor={currentTheme === "dark" ? "#bbb" : "#555"}
              value={item}
              onChangeText={setItem}
              style={[styles.input, currentTheme === "dark" ? styles.darkInput : styles.lightInput]}
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              placeholder="Categoria..."
              placeholderTextColor={currentTheme === "dark" ? "#bbb" : "#555"}
              value={category}
              onChangeText={setCategory}
              style={[styles.input, currentTheme === "dark" ? styles.darkInput : styles.lightInput]}
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              placeholder="Quantidade..."
              placeholderTextColor={currentTheme === "dark" ? "#bbb" : "#555"}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              style={[styles.input, currentTheme === "dark" ? styles.darkInput : styles.lightInput]}
            />
          </View>

          <TouchableOpacity 
          
            style={styles.scanButton} 
            onPress={() => {
              setIsScanning(true);
            }}
          ><Text style={styles.addButtonText}>Ler</Text>
            <Ionicons name="qr-code-outline" size={20} color="white" style={styles.scanButtonIcon} />
            <Ionicons name="barcode-outline" size={24} color="white" style={styles.scanButtonIcon} />
          </TouchableOpacity>

          {suggestedCategory !== "" && (
            <TouchableOpacity style={styles.suggestionButton} onPress={() => setCategory(suggestedCategory)}>
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
                      setCategory(cat);
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
          
          <TouchableOpacity style={styles.addButton} onPress={handleAddItem}>
            <Text style={styles.addButtonText}>Guardar</Text>
          </TouchableOpacity>
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
  inputContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    position: 'relative',
  },
  input: {
    flex: 1,
    height: 40,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    paddingLeft: 10,
    paddingRight: 40,
  },
  darkInput: {
    backgroundColor: "#444",
    color: "#fff",
  },
  lightInput: {
    backgroundColor: "#fff",
    color: "#333",
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
  },
  addButton: {
    backgroundColor: "#4CAF50",
    padding: 15,
    borderRadius: 8,
    width: "44%",
    alignItems: "center",
    marginTop: 20,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 18,
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
  darkButton: {
    backgroundColor: "#333",
  },
  lightButton: {
    backgroundColor: "#eee",
  },
});
