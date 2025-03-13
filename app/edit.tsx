import React, { useState, useLayoutEffect, useEffect, useCallback, useRef } from "react";
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
import * as Linking from 'expo-linking';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const genAI = new GoogleGenerativeAI("AIzaSyDuUDSAfqwznlx9XMw-Xea4f0bU-sfe_4k");

// Função melhorada para classificação de produtos
export async function classifyProduct(imageBase64: string): Promise<string> {
  try {
    // Usando a instância genAI já definida globalmente
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Instruções mais específicas para o modelo
    const prompt = `
      Analise esta imagem de um produto e:
      1. Identifique o tipo de produto com precisão
      2. Classifique-o numa destas categorias específicas:
         - Alimentos
         - Bebidas
         - Produtos de Higiene
         - Produtos de Limpeza
         - Aparelhos Eletrónicos
         - Roupas
         - Papelaria
         - Ferramentas
         - Outros (especificar)
      3. Forneça apenas o nome do produto e a categoria, sem texto extra
      4. Use vocabulário de português de Portugal (PT-PT), não brasileiro (PT-BR)
      Por exemplo: use "telemóvel" em vez de "celular", "camisola" em vez de "camiseta"

      Formato da resposta:
      Nome do produto: [nome]
      Categoria: [categoria]
    `;
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64
        }
      }
    ]);
    
    return result.response.text();
  } catch (error) {
    console.error("Erro na classificação:", error);
    return "Não foi possível classificar o produto. Tente novamente.";
  }
}

// Função simplificada baseada em regras para classificação
function getLocalCategoryClassification(itemName: string): string {
  const itemLower = itemName.toLowerCase();
  
  // Mapeamento direto de palavras para categorias
  const categoryRules = [
    { keywords: ['escova', 'dente', 'pasta', 'sabonete', 'champô', 'desodorizante'], category: 'Produtos de Higiene' },
    { keywords: ['comida', 'alimento', 'fruta', 'carne', 'legume', 'cereal'], category: 'Alimentos' },
    { keywords: ['água', 'refrigerante', 'sumo', 'cerveja', 'vinho', 'café'], category: 'Bebidas' },
    { keywords: ['camisola', 't-shirt', 'calças', 'vestido', 'casaco', 'blusa'], category: 'Roupas' },
    { keywords: ['sapato', 'ténis', 'bota', 'calçado'], category: 'Calçado' },
    { keywords: ['martelo', 'chave', 'serra', 'alicate', 'ferramenta'], category: 'Ferramentas' },
    { keywords: ['caneta', 'lápis', 'caderno', 'papel'], category: 'Papelaria' },
    { keywords: ['telemóvel', 'smartphone', 'telefone'], category: 'Smartphones' },
  ];
  
  // Verificar se o nome do item contém alguma das palavras-chave
  for (const rule of categoryRules) {
    if (rule.keywords.some(keyword => itemLower.includes(keyword))) {
      return rule.category;
    }
  }
  
  return ""; // Vazio indica que devemos usar a IA
}

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
  
// Add this validation function below your state declarations
const validateQuantity = (text: string) => {
  // Remove any non-digit characters
  const cleanedText = text.replace(/[^0-9]/g, '');
  
  // Convert to number and ensure it's not negative
  const numValue = parseInt(cleanedText);
  
  // If it's a valid number, use it; otherwise, keep the current value
  if (!isNaN(numValue) && numValue >= 0) {
    setItemQuantity(cleanedText);
  } else if (cleanedText === '') {
    // Allow empty field during typing
    setItemQuantity('');
  }
};


  const cameraRef = useRef<CameraView>(null);

  const predefinedCategories = [
    "Roupas", "Smartphones", "Televisões", "Tablets", "Portáteis", "Alimentos", "Objetos", "Ferramentas",
    "Produtos de Higiene", "Acessórios", "Carros", "Videojogos", "Livros", "Móveis", "Eletrodomésticos",
    "Material Escolar", "Decoração", "Brinquedos", "Calçado", "Jardinagem", "Desporto", "Medicamentos",
    "Bebidas", "Música", "Cosméticos", "Papelaria", "Animais"
  ];

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        // Imitar o comportamento do botão cancelar
        router.replace("/inventory");
        return true; // Impedir o comportamento padrão do botão voltar
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

  const handleTakePhoto = async () => {
    if (!cameraRef.current) return;
    
    try {
      // Indicar que está processando
      setScanned(true);
      
      // Adicionar um pequeno atraso antes de capturar a foto (isso pode ajudar)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Capturar foto com options adicionais
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: false,
        exif: false
      });
      
      // Verificar se photo é undefined
      if (!photo || !photo.uri) {
        Alert.alert("Erro", "Não foi possível capturar a imagem.");
        setScanned(false);
        return;
      }
      
      // Redimensionar e comprimir a imagem para reduzir tamanho
      const manipResult = await manipulateAsync(
        photo.uri,
        [{ resize: { width: 600 } }],
        { compress: 0.7, format: SaveFormat.JPEG }
      );
      
      // Converter para base64
      const base64 = await FileSystem.readAsStringAsync(manipResult.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Fechar câmera e mostrar carregamento
      setIsScanning(false);
      Alert.alert("A Processar", "A analisar imagem...");
      
      // Classificar com IA
      const result = await classifyProduct(base64);
      
      // Extrair nome e categoria do resultado
      const nameMatch = result.match(/Nome do produto: (.+)/i);
      const categoryMatch = result.match(/Categoria: (.+)/i);
      
      if (nameMatch && categoryMatch) {
        setItemName(nameMatch[1]);
        setItemCategory(categoryMatch[1]);
        Alert.alert("Processamento concluído", result);
      } else {
        Alert.alert("Resultado", result);
      }
      
    } catch (error) {
      console.error("Erro ao processar imagem:", error);
      Alert.alert("Erro", "Não foi possível processar a imagem.");
    } finally {
      setScanned(false);
    }
  };

  const getSuggestedCategory = async (itemName: string) => {
    if (!itemName.trim()) return;
    
    // Primeiro tentar classificação local baseada em regras
    const localCategory = getLocalCategoryClassification(itemName);
    if (localCategory) {
      setSuggestedCategory(localCategory);
      // Ainda salvar no cache para uso futuro
      const cacheKey = `suggestion-${encodeURIComponent(itemName)}`;
      await AsyncStorage.setItem(cacheKey, localCategory);
      return;
    }

    try {
      // Check cache first
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
          const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          
          // Prompt melhorado com exemplos e regras mais explícitas
          const prompt = `
            Classifique o item "${itemName}" em uma destas categorias específicas:
            ${predefinedCategories.join(", ")}
            
            Use português de Portugal (PT-PT) e não português brasileiro (PT-BR).
            
            Siga estas regras de classificação:
            - Escovas de dentes, pastas de dentes, sabonetes, champôs → Produtos de Higiene
            - Telemóveis, dispositivos eletrónicos → Smartphones ou Eletrónicos
            - Comidas, frutas, grãos, comestíveis → Alimentos
            - Água, sumos, refrigerantes, vinhos → Bebidas
            - Camisolas, t-shirts, calças → Roupas
            - Sapatos, ténis, botas → Calçado
            - Chaves, martelos, serras → Ferramentas
            - Canetas, lápis, cadernos → Material Escolar ou Papelaria

            Responda apenas com o nome exato da categoria, sem pontuação ou texto adicional.
          `;

          const result = await model.generateContent(prompt);
          const responseText = result.response.text().trim();

          // Verificar se é uma categoria exata
          if (predefinedCategories.includes(responseText)) {
            await AsyncStorage.setItem(cacheKey, responseText);
            setSuggestedCategory(responseText);
            return;
          }

          // Mapeamento de palavras-chave para categorias
          const keywordMap = {
            'higiene': 'Produtos de Higiene',
            'dente': 'Produtos de Higiene',
            'escova': 'Produtos de Higiene',
            'pasta': 'Produtos de Higiene',
            'sabonete': 'Produtos de Higiene',
            'limpeza': 'Produtos de Limpeza',
            'comida': 'Alimentos',
            'alimento': 'Alimentos',
            'bebida': 'Bebidas',
            'roupa': 'Roupas',
            'sapato': 'Calçado',
            'telefone': 'Smartphones',
            'telemóvel': 'Smartphones',
            'ferramenta': 'Ferramentas',
            'papel': 'Papelaria',
            'caneta': 'Papelaria'
          };

          // Verificar correspondências de palavras-chave
          for (const [keyword, category] of Object.entries(keywordMap)) {
            if (itemName.toLowerCase().includes(keyword) ||
                responseText.toLowerCase().includes(keyword)) {
              await AsyncStorage.setItem(cacheKey, category);
              setSuggestedCategory(category);
              return;
            }
          }

          // Buscar a melhor correspondência
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
      // Ensure quantity is a valid non-negative integer
      const quantityNum = parseInt(itemQuantity);
      const finalQuantity = (!isNaN(quantityNum) && quantityNum >= 0) ? itemQuantity : "1";
  
      const storedItems = await AsyncStorage.getItem("inventory");
      const items: Item[] = storedItems ? JSON.parse(storedItems) : [];
  
      const updatedItems = items.map((item) =>
        item.name === name && item.category === category
          ? { name: itemName, category: itemCategory, quantity: finalQuantity }
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

          <View style={styles.inputContainer}>
            <TextInput
              placeholder="Nome do item..."
              placeholderTextColor={currentTheme === "dark" ? "#bbb" : "#555"}
              value={itemName}
              onChangeText={setItemName}
              style={[styles.input, currentTheme === "dark" ? styles.darkInput : styles.lightInput]}
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              placeholder="Categoria..."
              placeholderTextColor={currentTheme === "dark" ? "#bbb" : "#555"}
              value={itemCategory}
              onChangeText={setItemCategory}
              style={[styles.input, currentTheme === "dark" ? styles.darkInput : styles.lightInput]}
            />
          </View>

          <View style={styles.inputContainer}>
  <TextInput
    placeholder="Quantidade..."
    placeholderTextColor={currentTheme === "dark" ? "#bbb" : "#555"}
    value={itemQuantity}
    onChangeText={validateQuantity}
    keyboardType="numeric"
    style={[styles.input, currentTheme === "dark" ? styles.darkInput : styles.lightInput]}
  />
</View>

          <TouchableOpacity
            style={styles.scanButton}
            onPress={async () => {
              // Verificar se já tem permissão
              if (!permission?.granted) {
                // Solicitar permissão se não tiver
                const { status } = await requestPermission();
                
                if (status !== 'granted') {
                  Alert.alert(
                    "Permissão necessária",
                    "A app necessita de acesso à câmera para ler os códigos. Por favor, conceda a permissão nas definições do seu dispositivo.",
                    [
                      {
                        text: "Definições",
                        onPress: () => Linking.openSettings()
                      },
                      {
                        text: "Cancelar",
                        style: "cancel"
                      }
                    ]
                  );
                  return;
                }
              }
              
              // Se tem permissão, abrir scanner
              setIsScanning(true);
            }}
          >
            <Text style={styles.buttonText}>Ler</Text>
            <Ionicons name="qr-code-outline" size={20} color="white" style={styles.scanButtonIcon} />
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
              onPress={handleCancel}
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
            ref={cameraRef}
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
            
            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleTakePhoto}
            >
              <Ionicons name="camera" size={30} color="white" />
            </TouchableOpacity>
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
  captureButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 30,
    padding: 15,
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

