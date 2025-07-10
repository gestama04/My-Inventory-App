import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "./theme-context";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Ionicons } from "@expo/vector-icons";
import { Camera, useCameraPermissions, CameraView } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import useCustomAlert from '../hooks/useCustomAlert';
import { addInventoryItem, getInventoryItem } from '../inventory-service';
import * as ImagePicker from 'expo-image-picker';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase-config';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as ImageManipulator from 'expo-image-manipulator';

// Interface para histórico de itens
interface ItemHistory {
  name: string;
  category: string;
  quantity: string;
  timestamp: number;
  action: 'add' | 'edit' | 'remove';
}

const genAI = new GoogleGenerativeAI("AIzaSyDuUDSAfqwznlx9XMw-Xea4f0bU-sfe_4k");

// Função para classificação de produtos
export async function classifyProduct(imageBase64: string): Promise<string> {
  try {
    // genAI já definida globalmente
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
   
    // Instruções mais específicas para o modelo
    const prompt = `
    Analise esta imagem de um produto e:
    1. Identifique o tipo de produto com precisão:
   - Se tiver marca visível (logo ou nome), inclua-a no nome
   - Se for uma planta, identifique a espécie se possível
   - Se for um animal, identifique a raça/espécie se possível
    2. Classifique-o na categoria que acha mais apropriada
    3. Determine a quantidade do produto (número de unidades, peso, volume, etc.)
    4. Forneça apenas o nome do produto com precisão e a categoria, sem texto extra
    5. Use vocabulário de português de Portugal (PT-PT), não brasileiro (PT-BR)
       Por exemplo: use "telemóvel" em vez de "celular", "camisola" em vez de "camiseta"
    6. IMPORTANTE:
       - Inclua APENAS unidades de medida (g, kg, ml, L) no NOME do produto
         Por exemplo: "Pó de Talco 200g" como nome
       - Para produtos múltiplos, NÃO inclua a quantidade no nome
         Por exemplo: para 2 cintos, use "Cintos" como nome e "2" como quantidade
    7. A quantidade deve refletir o número de unidades/itens
       Por exemplo: "2" para dois cintos, "3" para três camisas
   
    Formato da resposta:
    Nome do produto: [nome sem incluir quantidade de unidades]
    Categoria: [categoria]
    Quantidade: [número de unidades]
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
 
    // Processar a resposta para remover "Outros: " se ainda presente
    let responseText = result.response.text();
 
    // Verificar se há "Categoria: Outros (" ou "Categoria: Outros:" na resposta
    const categoryMatch = responseText.match(/Categoria:\s*Outros\s*(?:\(|\:)\s*([^)]+)(?:\))?/i);
    if (categoryMatch && categoryMatch[1]) {
      // Substituir "Outros (categoria)" ou "Outros: categoria" por apenas "categoria"
      responseText = responseText.replace(
        /Categoria:\s*Outros\s*(?:\(|\:)\s*([^)]+)(?:\))?/i,
        `Categoria: ${categoryMatch[1]}`
      );
    }
 
    return responseText;
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

export default function AddItemScreen() {
  const [item, setItem] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [usedCategories, setUsedCategories] = useState<string[]>([]);
  const [suggestedCategory, setSuggestedCategory] = useState("");
  const [isCategoryVisible, setIsCategoryVisible] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | number | null>(null);
  const router = useRouter();
  const navigation = useNavigation();
  const { currentTheme } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [scanMode, setScanMode] = useState<'barcode' | 'photo' | 'simple' | null>(null);
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { showAlert, AlertComponent } = useCustomAlert();
  const [capturedImageBase64, setCapturedImageBase64] = useState("");
  const scrollViewRef = useRef<KeyboardAwareScrollView>(null);
  const cameraRef = useRef<CameraView>(null);
  const [flashMode, setFlashMode] = useState<'off' | 'on'>('off');
  const [zoom, setZoom] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(0); // 0 = 1x, 1 = 3x
  
  const { width } = Dimensions.get('window');
  
  const predefinedCategories = [
    "Roupas", "Smartphones", "Televisões", "Tablets", "Portáteis", "Alimentos", "Objetos", "Ferramentas",
    "Produtos de Higiene", "Acessórios", "Carros", "Videojogos", "Livros", "Móveis", "Eletrodomésticos",
    "Material Escolar", "Decoração", "Brinquedos", "Calçado", "Jardinagem", "Desporto", "Medicamentos",
    "Bebidas", "Música", "Cosméticos", "Papelaria", "Animais", "Plantas", "Flores", "Animais de Estimação"
  ];

  // Validação de quantidade
  const validateQuantity = (text: string) => {
    // Remove caracteres não numéricos
    const cleanedText = text.replace(/[^0-9]/g, '');
   
    // Converte para número e garante que não seja negativo
    const numValue = parseInt(cleanedText);
   
    // Se for um número válido, use-o; caso contrário, mantenha o valor atual
    if (!isNaN(numValue) && numValue >= 0) {
      setQuantity(cleanedText);
    } else if (cleanedText === '') {
      // Permitir campo vazio durante a digitação
      setQuantity('');
    }
  };

const processAppQRCode = (qrData: string) => {
  try {
    const data = JSON.parse(qrData);
    
    // Verificar se é QR Code da app
    if (data.app === 'MyInventoryApp' && data.name && data.category) {
      return {
        id: data.id || null, // 🆕 ID do produto original
        name: data.name,
        category: data.category,
        quantity: data.quantity || '1',
        hasPhoto: data.hasPhoto || false, // 🆕 Indicador se tem foto
        isAppQR: true
      };
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

  // Função para capturar foto com alta qualidade
  const handleTakePhoto = async () => {
    if (!cameraRef.current) return;
    
    try {
      setScanned(true);
      
      // Adicionar um pequeno atraso antes de capturar a foto
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Capturar foto com a maior qualidade possível
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1.0, // Máxima qualidade
        skipProcessing: false,
        exif: true
      });
      
      if (!photo || !photo.uri) {
        showAlert("Erro", "Não foi possível capturar a imagem.", [
          { text: "OK", onPress: () => {} }
        ]);
        setScanned(false);
        return;
      }
      
      // Redimensionar mantendo boa qualidade
      const manipResult = await manipulateAsync(
        photo.uri,
        [{ resize: { width: 1200 } }], // Resolução maior para melhor qualidade
        { compress: 0.9, format: SaveFormat.JPEG } // Menos compressão
      );
      
      // Converter para base64
      const base64 = await FileSystem.readAsStringAsync(manipResult.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Atualizar estado
      setCapturedImageBase64(base64);
      
      // Fechar câmera
      setIsScanning(false);
      setScanMode(null);
      
      // Se estiver no modo de foto com IA, analisar com IA
      // Se for modo 'simple', apenas salvar a foto sem análise
      if (scanMode === 'photo') {
        showAlert("A processar", "A analisar imagem com IA...", [], true);
        
        try {
          const result = await classifyProduct(base64);
          
          // Extrair nome, categoria e quantidade do resultado
          const nameMatch = result.match(/Nome do produto: (.+)/i);
          const categoryMatch = result.match(/Categoria: (.+)/i);
          const quantityMatch = result.match(/Quantidade: (.+)/i);
          
          if (nameMatch && categoryMatch) {
            // Extrair o nome do produto
            let productName = nameMatch[1].trim();
            
            // Limpar o nome do produto de qualquer menção a unidades
            productName = productName.replace(/\d+\s*(unidades|peças|itens|pares)/i, '').trim();
            
            // Extrair a quantidade se foi detectada
            if (quantityMatch && quantityMatch[1]) {
              const quantityValue = quantityMatch[1].trim();
              
              // Verificar se a quantidade contém unidades de peso/volume
              const hasWeightVolumeUnit = /\d+\s*(g|kg|ml|l|litros?|gramas?|quilos?)/i.test(quantityValue);
              
              if (hasWeightVolumeUnit) {
                // Se tem unidade de peso/volume, incluir no nome do produto
                if (!productName.includes(quantityValue)) {
                  productName = `${productName} ${quantityValue}`;
                }
                // Definir quantidade como 1
                setQuantity("1");
              } else {
                // Se não tem unidade de peso/volume, extrair apenas o valor numérico para a quantidade
                const numericValue = quantityValue.match(/^(\d+)/);
                if (numericValue && numericValue[1]) {
                  setQuantity(numericValue[1]);
                } else {
                  setQuantity("1");
                }
              }
            } else {
              setQuantity("1");
            }
            
            setItem(productName);
            setCategory(categoryMatch[1]);
            
            showAlert("Análise concluída", result, [
              { text: "OK", onPress: () => {} }
            ]);
          } else {
            showAlert("Resultado", result, [
              { text: "OK", onPress: () => {} }
            ]);
          }
        } catch (error) {
          console.error("Erro na análise com IA:", error);
          showAlert("Erro", "Não foi possível analisar a imagem com IA.", [
            { text: "OK", onPress: () => {} }
          ]);
        }
      }
      // Se for modo 'simple', não faz nada aqui - apenas mantém a foto capturada
    } catch (error) {
      console.error("Erro ao processar imagem:", error);
      showAlert("Erro", "Não foi possível processar a imagem.", [
        { text: "OK", onPress: () => {} }
      ]);
    } finally {
      setScanned(false);
    }
  };
  
// Função para abrir galeria
const openGallery = async (mode: 'simple' | 'photo' | 'barcode') => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      showAlert("Permissão necessária",
        "A app necessita de acesso à galeria. Por favor, conceda a permissão nas definições do seu dispositivo.", [
        { text: "Definições", onPress: () => Linking.openSettings() },
        { text: "Cancelar", style: "cancel", onPress: () => {} }
      ]);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      const imageUri = result.assets[0].uri;
      
      // Se for modo barcode, explicar que precisa usar câmera
      if (mode === 'barcode') {
        showAlert(
          "📱 Use a Câmera para QR Codes",
          "Para ler QR Codes da app, use a câmera diretamente.\n\nA câmera detecta QR Codes e códigos de barras automaticamente com maior precisão.",
          [{ text: 'OK', onPress: () => {} }]
        );
        return;
      }
      
      // Para outros modos, continuar com o processamento normal
      const manipResult = await manipulateAsync(
        imageUri,
        [{ resize: { width: 1200 } }],
        { compress: 0.9, format: SaveFormat.JPEG }
      );
      
      const base64 = await FileSystem.readAsStringAsync(manipResult.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      setCapturedImageBase64(base64);
      
      if (mode === 'photo') {
        showAlert("A processar", "A analisar imagem com IA...", [], true);
        
        try {
          const result = await classifyProduct(base64);
          
          const nameMatch = result.match(/Nome do produto: (.+)/i);
          const categoryMatch = result.match(/Categoria: (.+)/i);
          const quantityMatch = result.match(/Quantidade: (.+)/i);
          
          if (nameMatch && categoryMatch) {
            let productName = nameMatch[1].trim();
            productName = productName.replace(/\d+\s*(unidades|peças|itens|pares)/i, '').trim();
            
            if (quantityMatch && quantityMatch[1]) {
              const quantityValue = quantityMatch[1].trim();
              const hasWeightVolumeUnit = /\d+\s*(g|kg|ml|l|litros?|gramas?|quilos?)/i.test(quantityValue);
              
              if (hasWeightVolumeUnit) {
                if (!productName.includes(quantityValue)) {
                  productName = `${productName} ${quantityValue}`;
                }
                setQuantity("1");
              } else {
                const numericValue = quantityValue.match(/^(\d+)/);
                if (numericValue && numericValue[1]) {
                  setQuantity(numericValue[1]);
                } else {
                  setQuantity("1");
                }
              }
            } else {
              setQuantity("1");
            }
            
            setItem(productName);
            setCategory(categoryMatch[1]);
            
            showAlert("Análise concluída", result, [
              { text: "OK", onPress: () => {} }
            ]);
          } else {
            showAlert("Resultado", result, [
              { text: "OK", onPress: () => {} }
            ]);
          }
        } catch (error) {
          console.error("Erro na análise com IA:", error);
          showAlert("Erro", "Não foi possível analisar a imagem com IA.", [
            { text: "OK", onPress: () => {} }
          ]);
        }
      }
    }
  } catch (error) {
    console.error("Erro ao abrir galeria:", error);
    showAlert("Erro", "Não foi possível abrir a galeria.", [
      { text: "OK", onPress: () => {} }
    ]);
  }
};

// Função para alternar flash
const zoomIn = () => {
  const newZoom = Math.min(zoomLevel + 0.25, 1); // Incrementos de 0.25 (equivale a 0.5x)
  setZoomLevel(newZoom);
};

const zoomOut = () => {
  const newZoom = Math.max(zoomLevel - 0.25, 0);
  setZoomLevel(newZoom);
};

const toggleFlash = () => {
  setFlashMode(flashMode === 'off' ? 'on' : 'off');
};


  // Carregar categorias usadas anteriormente
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
  
        // Buscar categorias do Firebase
        const q = query(collection(db, 'inventory'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        
        const categoriesFromItems: string[] = [];
        snapshot.forEach((doc) => {
          const item = doc.data();
          if (item.category) {
            categoriesFromItems.push(item.category);
          }
        });
        
        // Combinar com categorias predefinidas
        const combinedCategories = Array.from(new Set([...predefinedCategories, ...categoriesFromItems]));
        setUsedCategories(combinedCategories);
      } catch (error) {
        console.error("Erro ao carregar categorias", error);
      }
    };
    
    loadCategories();
  }, []);

const loadImageFromFirestore = async (itemId: string) => {
  try {
    if (!auth.currentUser) return;
    
    const itemData = await getInventoryItem(itemId);
    
    if (itemData && (itemData.photo || itemData.photoUrl)) {
      // Se tem foto em base64, usar diretamente
      if (itemData.photo) {
        setCapturedImageBase64(itemData.photo);
      }
      // Se tem apenas URL, você pode implementar download se necessário
      // Por agora, vamos usar apenas a base64
      
      console.log('✅ Imagem carregada do produto original');
    }
  } catch (error) {
    console.error('❌ Erro ao carregar imagem:', error);
  }
};

  // Função para lidar com leitura de código de barras/QR
const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
  setScanned(true);
  setIsScanning(false);
  setScanMode(null);

  console.log('Código detectado:', { type, data });

  const appQRData = processAppQRCode(data);
  
  if (appQRData) {
    // Preencher dados básicos
    setItem(appQRData.name);
    setCategory(appQRData.category);
    setQuantity(appQRData.quantity);
    
    // 🆕 Se tem foto e ID, carregar a imagem do Firestore
    if (appQRData.hasPhoto && appQRData.id) {
      loadImageFromFirestore(appQRData.id);
    }
    
    showAlert(
      '✅ QR Code da App Detectado',
      `Produto: ${appQRData.name}\nCategoria: ${appQRData.category}\nQuantidade: ${appQRData.quantity}${appQRData.hasPhoto ? '\n📷 A carregar imagem...' : ''}`,
      [{ text: 'OK', onPress: () => setScanned(false) }]
    );
    return;
  }

  // Resto do código igual...
  let itemName = data;
  
  try {
    const url = new URL(data);
    const domain = url.hostname.replace('www.', '').split('.')[0];
    itemName = domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch (e) {
    // Não é URL
  }

  setItem(itemName);
  
  showAlert(
    `📱 Código Lido`,
    `Tipo: ${type}\nDados: ${data}`,
    [{ text: 'OK', onPress: () => setScanned(false) }]
  );
};
  // Função para adicionar item ao inventário
  const handleAddItem = async () => {
    // Verificar se o Utilizador está autenticado
    if (!auth.currentUser) {
      showAlert("Erro", "Você precisa de estar autenticado para adicionar produtos.", [
        { text: "OK", onPress: () => {} }
      ]);
      return;
    }
    
    // Verificar se os campos obrigatórios estão preenchidos
    if (item.trim() === "" || category.trim() === "") {
      showAlert("Erro", "Por favor, insira um nome e uma categoria.", [
        { text: "OK", onPress: () => {} }
      ]);
      return;
    }
    
    // Garantir que a quantidade seja um número inteiro não negativo válido
    const quantityNum = parseInt(quantity);
    const finalQuantity = (!isNaN(quantityNum) && quantityNum >= 0) ? quantity : "1";
    
    try {
      setIsLoading(true);
      showAlert("A processar", "A guardar produto...", [], true);
      
      // Criar o novo item
      const newItem = {
        name: item.trim(),
        category: category.trim(),
        quantity: finalQuantity,
        description: "" // Inicializar com descrição vazia
      };
      
      // Adicionar ao Firebase usando o serviço
      await addInventoryItem(newItem, capturedImageBase64);
      
      // Limpar os campos após adicionar
      setItem("");
      setCategory("");
      setQuantity("1");
      setSuggestedCategory("");
      setCapturedImageBase64("");
      
      showAlert("Sucesso", "Produto adicionado com sucesso!", [
        { text: "OK", onPress: () => router.replace("/inventory") }
      ]);
    } catch (error) {
      console.error("Erro ao salvar produto", error);
      showAlert("Erro", "Ocorreu um erro ao salvar o produto.", [
        { text: "OK", onPress: () => {} }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Obter sugestão de categoria baseada no nome do item
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
      // Verificar cache primeiro
      const cacheKey = `suggestion-${encodeURIComponent(itemName)}`;
      const cachedCategory = await AsyncStorage.getItem(cacheKey);
      if (cachedCategory) {
        setSuggestedCategory(cachedCategory);
        return;
      }

      // Se não houver cache, tentar sugestão de IA com lógica de retry
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
          
          // Prompt melhorado com exemplos e regras mais explícitas
          const prompt = `
            Classifique o produto "${itemName}" numa destas categorias específicas:
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

  // Efeito para obter sugestão de categoria quando o nome do item muda
  useEffect(() => {
    if (typingTimeout) clearTimeout(typingTimeout);
  
    const timeout = setTimeout(() => {
      getSuggestedCategory(item);
    }, 1000);
  
    setTypingTimeout(timeout);
  }, [item]);

  // Configurar o botão de voltar na barra de navegação
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

  const takePlainPhoto = async () => {
    // Verificar permissão da câmera
    if (!permission?.granted) {
      const { status } = await requestPermission();
      
      if (status !== 'granted') {
        showAlert("Permissão necessária",
          "A app necessita de acesso à câmera. Por favor, conceda a permissão nas definições do seu dispositivo.", [
          { text: "Definições", onPress: () => Linking.openSettings() },
          { text: "Cancelar", style: "cancel", onPress: () => {} }
        ]);
        return;
      }
    }
    
    // Abrir câmera em modo simples sem análise de IA
    setIsScanning(true);
    // Usar um modo diferente para identificar que é uma foto simples
    setScanMode('simple');
  }
  
  // Função para abrir a câmera com permissão
  const openCamera = async (mode: 'barcode' | 'photo'| 'simple') => {
    // Check if already has permission
    if (!permission?.granted) {
      // Request permission if not
      const { status } = await requestPermission();
      
      if (status !== 'granted') {
        showAlert(
          "Permissão necessária",
          "A app necessita de acesso à câmera. Por favor, conceda a permissão nas definições do seu dispositivo.",
          [
            {
              text: "Definições",
              onPress: () => Linking.openSettings()
            },
            {
              text: "Cancelar",
              style: "cancel",
              onPress: () => {}
            }
          ]
        );
        return;
      }
    }
    
    // If has permission, open scanner in specified mode
    setScanMode(mode);
    setIsScanning(true);
  };
  

 return (
    <View style={{ flex: 1 }}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollView}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={Platform.OS === 'ios' ? 120 : 80} // Provides extra space below keyboard
        showsVerticalScrollIndicator={true}
        ref={scrollViewRef}
      >
        <View style={[
          styles.container,
          currentTheme === "dark" ? styles.dark : styles.light
        ]}>
          
          
          {/* Seção de imagem */}
          {capturedImageBase64 ? (
  <View style={styles.imagePreviewContainer}>
    <Image
      source={{ uri: `data:image/jpeg;base64,${capturedImageBase64}` }}
      style={styles.imagePreview}
      resizeMode="contain"
    />
    <TouchableOpacity
      style={styles.removeImageButton}
      onPress={() => setCapturedImageBase64("")}
    >
      <Ionicons name="close-circle" size={24} color="white" />
    </TouchableOpacity>
  </View>
) : (
  <TouchableOpacity
    style={[
      styles.noImageContainer,
      currentTheme === "dark" ? { backgroundColor: '#333' } : { backgroundColor: '#f0f0f0' }
    ]}
    onPress={takePlainPhoto}
  >
    <Ionicons
      name="camera-outline"
      size={50}
      color={currentTheme === "dark" ? "#666" : "#ccc"}
    />
    <Text style={[
      styles.noImageText,
      currentTheme === "dark" ? styles.darkText : styles.lightText
    ]}>
      Adicionar Fotografia
    </Text>
  </TouchableOpacity>
)}

          
{/* Botões de câmera */}
<View style={styles.cameraButtonsContainer}>
  <TouchableOpacity
    style={[styles.cameraButton, styles.aiButton]}
    onPress={() => openCamera('photo')}
  >
    <Ionicons name="flash" size={22} color="white" style={styles.buttonIcon} />
    <Text style={styles.buttonText}>Analisar com IA</Text>
  </TouchableOpacity>
   
  <TouchableOpacity
    style={[styles.cameraButton, styles.barcodeButton]}
    onPress={() => openCamera('barcode')}
  >
    <View style={styles.iconContainer}>
      <Text style={styles.buttonText}>Ler  </Text>
      <View style={styles.iconGroup}>
        <Ionicons name="barcode-outline" size={22} color="white" />
        <Text style={styles.iconSeparator}>/</Text>
        <Ionicons name="qr-code-outline" size={19} color="white" />
      </View>
    </View>
  </TouchableOpacity>
</View>

          {/* Campos de entrada */}
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={[
                styles.inputLabel,
                currentTheme === "dark" ? styles.darkText : styles.lightText
              ]}>
                Nome
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  placeholder="Nome do produto..."
                  placeholderTextColor={currentTheme === "dark" ? "#bbb" : "#999"}
                  value={item}
                  onChangeText={setItem}
                  style={[
                    styles.input, 
                    currentTheme === "dark" ? styles.darkInput : styles.lightInput
                  ]}
                />
              </View>
            </View>
            
<View style={styles.inputGroup}>
  <Text style={[
    styles.inputLabel,
    currentTheme === "dark" ? styles.darkText : styles.lightText
  ]}>
    Categoria
  </Text>
  <View style={styles.categoryInputContainer}>
    <TextInput
      placeholder="Categoria..."
      placeholderTextColor={currentTheme === "dark" ? "#bbb" : "#999"}
      value={category}
      onChangeText={setCategory}
      style={[
        styles.input,
        styles.categoryInput,
        currentTheme === "dark" ? styles.darkInput : styles.lightInput
      ]}
    />
    <TouchableOpacity
      style={styles.dropdownIcon}
      onPress={() => setIsCategoryVisible(!isCategoryVisible)}
    >
      <Ionicons
        name={isCategoryVisible ? "chevron-up" : "chevron-down"}
        size={24}
        color={currentTheme === "dark" ? "#fff" : "#555"}
      />
    </TouchableOpacity>
    
    {isCategoryVisible && (
      <View style={[
        styles.categoryDropdown,
        currentTheme === "dark" ? styles.darkCard : styles.lightCard
      ]}>
        <ScrollView
          style={styles.categoryList}
          nestedScrollEnabled={true}
        >
          {usedCategories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryItem,
                currentTheme === "dark" ? styles.darkCategoryItem : styles.lightCategoryItem
              ]}
              onPress={() => {
                setCategory(cat);
                setIsCategoryVisible(false);
              }}
            >
              <Text style={[
                styles.categoryItemText,
                currentTheme === "dark" ? styles.darkText : styles.lightText
              ]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    )}
  
  {suggestedCategory !== "" && (
    <TouchableOpacity
      style={styles.suggestionButton}
      onPress={() => setCategory(suggestedCategory)}
    >
      <Text style={styles.suggestionText}>
        Sugestão IA: {suggestedCategory}
      </Text>
    </TouchableOpacity>
  )}
</View>

            </View>
            
            <View style={styles.inputGroup}>
              <Text style={[
                styles.inputLabel,
                currentTheme === "dark" ? styles.darkText : styles.lightText
              ]}>
                Quantidade
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  placeholder="Quantidade..."
                  placeholderTextColor={currentTheme === "dark" ? "#bbb" : "#999"}
                  value={quantity}
                  onChangeText={validateQuantity}
                  keyboardType="numeric"
                  style={[
                    styles.input, 
                    currentTheme === "dark" ? styles.darkInput : styles.lightInput
                  ]}
                />
              </View>
            </View>
            
          </View>
          
          {/* Botão de salvar */}
          <TouchableOpacity 
            style={styles.saveButton} 
            onPress={handleAddItem}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={22} color="white" style={styles.buttonIcon} />
                <Text style={styles.saveButtonText}>Guardar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
      
      {/* Câmera para leitura de código ou captura de foto */}
      {isScanning && (
  <View style={styles.scannerContainer}>
    <CameraView
  style={styles.camera}
  onBarcodeScanned={scanMode === 'barcode' && !scanned ? handleBarCodeScanned : undefined}
  ref={cameraRef}
  zoom={zoomLevel}
  enableTorch={flashMode === 'on'} // MUDAR de flash para enableTorch
>
      {scanMode === 'barcode' ? (
        <View style={styles.layerContainer}>
          <View style={styles.layerTop} />
          <View style={styles.layerCenter}>
            <View style={styles.layerLeft} />
            <View style={styles.focused} />
            <View style={styles.layerRight} />
          </View>
          <View style={styles.layerBottom} />
        </View>
      ) : (
        <View style={styles.photoGuideContainer}>
          <View style={styles.photoGuide} />
        </View>
      )}
      
      {/* Controles superiores da câmera */}
      <View style={styles.cameraTopControls}>
  <TouchableOpacity
    style={styles.flashButton}
    onPress={toggleFlash}
  >
    <Ionicons 
      name={flashMode === 'on' ? "flash" : "flash-off"} 
      size={24} 
      color={flashMode === 'on' ? "#FFD700" : "white"} 
    />
  </TouchableOpacity>
  
  {/* Controles de zoom */}
  <View style={styles.zoomControls}>
    <TouchableOpacity 
      style={[styles.zoomButton, zoomLevel <= 0 && styles.zoomButtonDisabled]} 
      onPress={zoomOut}
      disabled={zoomLevel <= 0}
    >
      <Ionicons name="remove" size={20} color={zoomLevel <= 0 ? "#666" : "white"} />
    </TouchableOpacity>
    
    <View style={styles.zoomIndicator}>
      <Text style={styles.zoomText}>
        {(1 + zoomLevel * 2).toFixed(1)}x
      </Text>
    </View>
    
    <TouchableOpacity 
      style={[styles.zoomButton, zoomLevel >= 1 && styles.zoomButtonDisabled]} 
      onPress={zoomIn}
      disabled={zoomLevel >= 1}
    >
      <Ionicons name="add" size={20} color={zoomLevel >= 1 ? "#666" : "white"} />
    </TouchableOpacity>
  </View>
</View>
      
      <View style={styles.cameraControls}>
  {/* Botão de galeria à esquerda */}
 <TouchableOpacity
    style={styles.galleryButtonCamera}
    onPress={() => {
      setIsScanning(false);
      setScanMode(null);
      setZoomLevel(0);
      setFlashMode('off');
      openGallery(scanMode || 'simple');
    }}
  >
    <Ionicons name="images" size={24} color="white" />
  </TouchableOpacity>

  {/* Botão de captura no centro */}
  <TouchableOpacity
    style={styles.captureButton}
    onPress={handleTakePhoto}
    disabled={scanned}
  >
    <View style={styles.captureButtonInner} />
  </TouchableOpacity>
  
  {/* Botão de fechar à direita */}
  <TouchableOpacity
    style={styles.closeButton}
    onPress={() => {
      setIsScanning(false);
      setScanMode(null);
      setZoomLevel(0);
      setFlashMode('off');
    }}
  >
    <Ionicons name="close" size={28} color="white" />
  </TouchableOpacity>
</View>
      
      <View style={styles.cameraInstructions}>
  <Text style={styles.cameraInstructionsText}>
    {scanMode === 'barcode' 
      ? 'Posicione o código de barras ou QR code na área destacada' 
      : 'Posicione o produto no centro do ecrã'}
  </Text>
</View>
    </CameraView>
  </View>
)}
      
      <AlertComponent />
    </View>
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
  },
  dark: {
    backgroundColor: "#111",
  },
  light: {
    backgroundColor: "#f8f8f8",
  },
  darkText: {
    color: "#fff",
  },
  lightText: {
    color: "#333",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
  },
  
  // Seção de imagem
  imageSection: {
    width: '100%',
    height: 200,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePreviewContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 6,
  },
  noImageContainer: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 20,
  },
  noImageText: {
    marginTop: 10,
    fontSize: 16,
    opacity: 0.7,
  },
  galleryButtonCamera: {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  justifyContent: 'center',
  alignItems: 'center',
},
  
  // Botões de câmera
  cameraButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  cameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  aiButton: {
    backgroundColor: '#6200ee',
  },
  barcodeButton: {
    backgroundColor: '#F57C00',
  },
  buttonIcon: {
    marginRight: 8,
  },
buttonTextSmall: {
  color: 'white',
  fontWeight: '600',
  fontSize: 13,
},
cameraTopControls: {
  position: 'absolute',
  top: 50,
  left: 0,
  right: 0,
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingHorizontal: 20,
},
flashButton: {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  justifyContent: 'center',
  alignItems: 'center',
},
zoomControls: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  borderRadius: 20,
  paddingHorizontal: 8,
  paddingVertical: 4,
},
zoomButton: {
  width: 32,
  height: 32,
  borderRadius: 16,
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  justifyContent: 'center',
  alignItems: 'center',
  marginHorizontal: 4,
},
zoomButtonDisabled: {
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
},
zoomIndicator: {
  paddingHorizontal: 12,
  paddingVertical: 4,
},
zoomText: {
  color: 'white',
  fontSize: 14,
  fontWeight: 'bold',
  minWidth: 35,
  textAlign: 'center',
},
  // Formulário
  formContainer: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    width: '100%',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  darkInput: {
    backgroundColor: "#333",
    color: "#fff",
    borderColor: "#555",
  },
  lightInput: {
    backgroundColor: "#fff",
    color: "#333",
    borderColor: "#ddd",
  },
  
  // Sugestão de categoria
  suggestionButton: {
    marginTop: 8,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  suggestionText: {
    color: '#2196F3',
    fontSize: 14,
  },
  photoButton: {
    backgroundColor: '#9C27B0', // Purple color to differentiate
  },
  
  // Seletor de categorias
  categoryContainer: {
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  darkCard: {
    backgroundColor: "#222",
  },
  lightCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee",
  },
  categoryHeader: {
    padding: 16,
  },
  categoryHeaderText: {
    fontSize: 16,
    fontWeight: '600',
  },
  categoryList: {
    maxHeight: 200,
  },
  categoryItem: {
    padding: 14,
    borderTopWidth: 1,
  },
  darkCategoryItem: {
    borderTopColor: '#333',
  },
  lightCategoryItem: {
    borderTopColor: '#eee',
  },
  categoryItemText: {
    fontSize: 15,
  },
  categoryInputContainer: {
    position: 'relative',
    width: '100%',
  },
  categoryInput: {
    paddingRight: 40, // Espaço para o ícone de dropdown
  },
  dropdownIcon: {
    position: 'absolute',
    right: 12,
    top: 13,
    zIndex: 10,
  },
  categoryDropdown: {
    position: 'absolute',
    top: 55, // Posicionado logo abaixo do input
    left: 0,
    right: 0,
    borderRadius: 10,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  // Botão de salvar
  saveButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
   iconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  iconSeparator: {
    color: 'white',
    fontSize: 14,
    marginHorizontal: 2,
  },
  // Câmera
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
    height: 200,
  },
  layerLeft: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  focused: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  layerRight: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  layerBottom: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  photoGuideContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoGuide: {
    width: 280,
    height: 280,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
cameraControls: {
  position: 'absolute',
  bottom: 30,
  left: 20,
  right: 20,
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'white',
  },
closeButton: {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  justifyContent: 'center',
  alignItems: 'center',
},
  cameraInstructions: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  cameraInstructionsText: {
    color: 'white',
    fontSize: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    textAlign: 'center',
    overflow: 'hidden',
  }
});

