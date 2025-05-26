import React, { useEffect, useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTheme } from './theme-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import useCustomAlert from '../hooks/useCustomAlert';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { CategoryIconService } from '../services/category-icon-service'; // << IMPORTAR O SERVIÇO

// Firebase imports
import { db, auth, storage } from '../firebase-config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getInventoryItem, updateInventoryItem } from '../inventory-service';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

interface Item {
  id?: string;
  name: string;
  quantity: string | number;
  category?: string;
  lowStockThreshold?: string;
  photo?: string;
  photoUrl?: string;
  description?: string;
  userId?: string;
  createdAt?: any; // Timestamp do Firestore
  updatedAt?: any; // Timestamp do Firestore
}

const genAI = new GoogleGenerativeAI("AIzaSyDuUDSAfqwznlx9XMw-Xea4f0bU-sfe_4k");

// Função para gerar descrição apenas com texto (fallback)
const generateDescription = async (name: string, category: string): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
      Crie uma descrição detalhada para um item de inventário com as seguintes características:
      - Nome: ${name}
      - Categoria: ${category}
      
      A descrição deve:
      - Ter entre 2-4 frases
      - Descrever características típicas deste tipo de item
      - Usar português de Portugal (PT-PT)
      - Ser informativa e útil para gestão de inventário
      - Não mencionar preços ou valores monetários
      
      Responda apenas com a descrição, sem introduções ou explicações adicionais.
    `;
    
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error("Erro ao gerar descrição:", error);
    return "Não foi possível gerar uma descrição automática.";
  }
};

// Função para gerar descrição com IA baseada na imagem
const generateDescriptionFromImage = async (
  imageBase64: string,
  name: string,
  category: string): Promise<string> => {
  try {
    // Usar o modelo multimodal que suporta imagens
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Preparar a imagem para o prompt
    let base64Data = imageBase64;
    if (base64Data.includes('data:')) {
      base64Data = base64Data.split(',')[1];
    }
    
    // Criar o prompt com texto e imagem
    const prompt = `
      Analise esta imagem de um item de inventário e crie uma descrição detalhada.
      
      Informações adicionais:
      - Nome do item: ${name}
      - Categoria: ${category}
      
      A descrição deve:
      - Ter entre 2-4 frases
      - Descrever características visíveis do item na imagem
      - Mencionar possíveis usos ou funções
      - Usar português de Portugal (PT-PT)
      - Ser informativa e útil para gestão de inventário
      - Não mencionar preços ou valores monetários
      
      Responda apenas com a descrição, sem introduções ou explicações adicionais.
    `;
    
    // Gerar a descrição com base na imagem e no texto
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data
        }
      }
    ]);
    
    return result.response.text().trim();
  } catch (error) {
    console.error("Erro ao gerar descrição a partir da imagem:", error);
    return "Não foi possível gerar uma descrição automática a partir da imagem.";
  }
};

// Componente separado para o editor de descrição
const DescriptionEditor = memo(({
  initialDescription,
  onSave,
  onCancel,
  theme,
  itemName,
  itemCategory,
  itemPhoto,
  itemPhotoUrl
}: {
  initialDescription: string,
  onSave: (text: string) => void,
  onCancel: () => void,
  theme: string,
  itemName: string,
  itemCategory: string,
  itemPhoto?: string,
  itemPhotoUrl?: string
}) => {
  const [text, setText] = useState(initialDescription);
  const [isGenerating, setIsGenerating] = useState(false);
  const { showAlert } = useCustomAlert();

  // Função para gerar descrição com IA baseada na imagem
  const handleGenerateDescription = async () => {
    try {
      setIsGenerating(true);
      
      // Verificar se há uma imagem disponível
      if (!itemPhoto && !itemPhotoUrl) {
        // Se não houver imagem, gerar descrição apenas com texto
        const generatedDescription = await generateDescription(itemName, itemCategory || "");
        setText(generatedDescription);
        return;
      }
      
      // Se tiver photoUrl mas não tiver photo base64
      if (itemPhotoUrl && !itemPhoto) {
        try {
          // Tentar baixar a imagem da URL
          showAlert("Processando", "A baixar imagem para análise...", []);
          
          // Aqui você precisaria de uma função para converter URL em base64
          // Como isso é complexo em React Native, vamos usar uma abordagem alternativa
          // e mostrar uma mensagem de erro específica
          
          showAlert("Aviso", "Não foi possível analisar a imagem da URL. Gerando descrição baseada apenas no nome e categoria.", [
            { text: "OK", onPress: () => {} }
          ]);
          
          const generatedDescription = await generateDescription(itemName, itemCategory || "");
          setText(generatedDescription);
          return;
        } catch (error) {
          console.error("Erro ao baixar imagem da URL:", error);
          const generatedDescription = await generateDescription(itemName, itemCategory || "");
          setText(generatedDescription);
          return;
        }
      }
      
      // Se tiver a imagem em base64
      if (itemPhoto) {
        showAlert("Processando", "A analisar imagem...", []);
        const generatedDescription = await generateDescriptionFromImage(
          itemPhoto,
          itemName,
          itemCategory || ""
        );
        setText(generatedDescription);
      }
    } catch (error) {
      console.error("Erro ao gerar descrição:", error);
      showAlert("Erro", "Não foi possível gerar uma descrição automática.", [
        { text: "OK", onPress: () => {} }
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={true}
    >
      <View style={styles.modalContainer}>
        <View style={[
          styles.modalContent,
          theme === 'dark' ? { backgroundColor: '#222' } : { backgroundColor: '#fff' }
        ]}>
          <Text style={[
            styles.modalTitle,
            theme === 'dark' ? { color: '#fff' } : { color: '#000' }
          ]}>
            Editar Descrição
          </Text>
          
          <TextInput
            style={[
              styles.descriptionInput,
              theme === 'dark' ? styles.darkInput : styles.lightInput,
              theme === 'dark' ? { color: '#fff' } : { color: '#000' }
            ]}
            multiline={true}
            value={text}
            onChangeText={setText}
            placeholder="Adicione uma descrição..."
            placeholderTextColor={theme === 'dark' ? '#aaa' : '#999'}
            autoFocus={true}
            textAlignVertical="top"
          />
          
          {/* Botão para gerar descrição com IA */}
          <TouchableOpacity
            style={[styles.aiButton, isGenerating ? styles.aiButtonDisabled : null]}
            onPress={handleGenerateDescription}
            disabled={isGenerating}
          >
            <Ionicons name="flash" size={18} color="white" style={styles.aiButtonIcon} />
            <Text style={styles.aiButtonText}>
              {isGenerating ? "A analisar imagem..." : "Gerar descrição com IA"}
            </Text>
          </TouchableOpacity>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
            >
              <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={() => onSave(text)}
            >
              <Text style={styles.buttonText}>Guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});

// Componente para o editor de fotos
const PhotoEditor = memo(({
  onSave,
  onCancel,
  onDelete,
  theme,
  hasExistingPhoto
}: {
  onSave: (photoBase64: string) => void,
  onCancel: () => void,
  onDelete: () => void,
  theme: string,
  hasExistingPhoto: boolean
}) => {
  const [isCamera, setIsCamera] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = React.useRef<CameraView>(null);
  const [scanned, setScanned] = useState(false);
  const { showAlert } = useCustomAlert();

  // Função para tirar foto
  const handleTakePhoto = async () => {
    if (!cameraRef.current) return;
    
    try {
      setScanned(true);
      
      // Adicionar um pequeno atraso antes de capturar a foto
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Capturar foto com qualidade máxima
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1.0, // Aumentar para qualidade máxima
        skipProcessing: false,
        exif: false
      });
      
      if (!photo || !photo.uri) {
        showAlert("Erro", "Não foi possível capturar a imagem.", [
          { text: "OK", onPress: () => {} }
        ]);
        setScanned(false);
        return;
      }
      
      // Redimensionar mantendo alta qualidade
      const manipResult = await manipulateAsync(
        photo.uri,
        [{ resize: { width: 1200 } }], // Aumentar a largura para melhor qualidade
        { compress: 0.9, format: SaveFormat.JPEG } // Aumentar a compressão para melhor qualidade
      );
      
      // Converter para base64
      const base64 = await FileSystem.readAsStringAsync(manipResult.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Salvar a foto
      onSave(base64);
      
    } catch (error) {
      console.error("Erro ao processar imagem:", error);
      showAlert("Erro", "Não foi possível processar a imagem.", [
        { text: "OK", onPress: () => {} }
      ]);
    } finally {
      setScanned(false);
    }
  };

  // Similarly update the pickImage function to maintain higher quality
  const pickImage = async () => {
    try {
      // Solicitar permissão para acessar a galeria
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        showAlert("Permissão negada", "Precisamos de permissão para acessar suas fotos.", [
          { text: "OK", onPress: () => {} }
        ]);
        return;
      }
      
      // Abrir seletor de imagens com alta qualidade
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1.0, // Aumentar para qualidade máxima
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        
        // Redimensionar mantendo alta qualidade
        const manipResult = await manipulateAsync(
          selectedAsset.uri,
          [{ resize: { width: 1200 } }], // Aumentar a largura para melhor qualidade
          { compress: 0.9, format: SaveFormat.JPEG } // Aumentar a compressão para melhor qualidade
        );
        
        // Converter para base64
        const base64 = await FileSystem.readAsStringAsync(manipResult.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Salvar a foto
        onSave(base64);
      }
    } catch (error) {
      console.error("Erro ao selecionar imagem:", error);
      showAlert("Erro", "Não foi possível selecionar a imagem.", [
        { text: "OK", onPress: () => {} }
      ]);
    }
  };

  // Verificar permissão da câmera
  const checkCameraPermission = async () => {
    if (!permission?.granted) {
      const { status } = await requestPermission();
      
      if (status !== 'granted') {
        showAlert("Permissão necessária",
          "A app necessita de acesso à câmera. Por favor, conceda a permissão nas definições do seu dispositivo.", [
          { text: "OK", onPress: () => {} }
        ]);
        return false;
      }
    }
    return true;
  };

  // Abrir câmera
  const openCamera = async () => {
    const hasPermission = await checkCameraPermission();
    if (hasPermission) {
      setIsCamera(true);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={true}
    >
      {isCamera ? (
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            ref={cameraRef}
          >
            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleTakePhoto}
              disabled={scanned}
            >
              <Ionicons name="camera" size={30} color="white" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsCamera(false)}
            >
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>
          </CameraView>
        </View>
      ) : (
        <View style={styles.modalContainer}>
          <View style={[
            styles.modalContent,
            theme === 'dark' ? { backgroundColor: '#222' } : { backgroundColor: '#fff' }
          ]}>
            <Text style={[
              styles.modalTitle,
              theme === 'dark' ? { color: '#fff' } : { color: '#000' }
            ]}>
              Editar Foto
            </Text>
            
            <View style={styles.photoOptionsContainer}>
              <TouchableOpacity
                style={[styles.photoOption, theme === 'dark' ? styles.darkPhotoOption : styles.lightPhotoOption]}
                onPress={openCamera}
              >
                <Ionicons
                  name="camera"
                  size={40}
                  color={theme === 'dark' ? '#fff' : '#333'}
                />
                <Text style={[
                  styles.photoOptionText,
                  theme === 'dark' ? { color: '#fff' } : { color: '#333' }
                ]}>
                  Câmera
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.photoOption, theme === 'dark' ? styles.darkPhotoOption : styles.lightPhotoOption]}
                onPress={pickImage}
              >
                <Ionicons
                  name="images"
                  size={40}
                  color={theme === 'dark' ? '#fff' : '#333'}
                />
                <Text style={[
                  styles.photoOptionText,
                  theme === 'dark' ? { color: '#fff' } : { color: '#333' }
                ]}>
                  Galeria
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Add delete option if there's an existing photo */}
            {hasExistingPhoto && (
              <TouchableOpacity
                style={styles.deletePhotoButton}
                onPress={onDelete}
              >
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color="#e74c3c"
                />
                <Text style={styles.deletePhotoText}>
                  Remover foto atual
                </Text>
              </TouchableOpacity>
            )}
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onCancel}
              >
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
});

const { width } = Dimensions.get('window');

export default function ItemDetailsScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { currentTheme } = useTheme();
  const [item, setItem] = useState<Item | null>(null);
  const [description, setDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const { showAlert, AlertComponent } = useCustomAlert();
  const [categoryIconName, setCategoryIconName] = useState<string>(CategoryIconService.DEFAULT_ICON); // Estado para o nome do ícone
  
  const formatDate = useCallback((timestamp: any) => {
    if (!timestamp) return "Data desconhecida";
    
    // Se for um timestamp do Firestore
    if (timestamp.toDate) {
      timestamp = timestamp.toDate();
    } else if (typeof timestamp === 'number') {
      // Se for um timestamp em milissegundos
      timestamp = new Date(timestamp);
    }
    
    // Formatar a data
    return timestamp.toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  // Funções para cancelar edição
  const cancelEditing = useCallback(() => {
    setIsEditing(false);
  }, []);

  const cancelEditingPhoto = useCallback(() => {
    setIsEditingPhoto(false);
  }, []);

  // Carrega o item quando o componente é montado
useEffect(() => {
  const loadItem = async () => {
    try {
      setLoading(true);
      const { id } = params;
      
      if (!id || typeof id !== 'string') {
        console.error("ID do item não fornecido");
        showAlert('Erro', 'ID do item não fornecido', [
          { text: 'OK', onPress: () => router.back() }
        ]);
        setLoading(false); 
        return;
      }
      
      console.log("A carregar item com ID:", id);
      
      // Usar a função getInventoryItem que já foi modificada para combinar quantidades
      if (typeof id === 'string') {
        try {
          const itemData = await getInventoryItem(id);
          console.log("Item carregado:", itemData);
          
          setItem(itemData);
          setDescription(itemData.description || '');
          if (itemData.category) {
            try {
              console.log(`Buscando ícone para categoria: ${itemData.category}`);
              const iconName = await CategoryIconService.getIconForCategory(itemData.category);
              setCategoryIconName(iconName);
              console.log(`Ícone definido para ${itemData.category}: ${iconName}`);
            } catch (iconError) {
              console.error("Erro ao buscar ícone da categoria:", iconError);
              setCategoryIconName(CategoryIconService.DEFAULT_ICON); // Usa ícone padrão em caso de erro
            }
          } else {
            setCategoryIconName(CategoryIconService.DEFAULT_ICON); // Usa ícone padrão se não houver categoria
          }
        } catch (error) {
          console.error("Item não encontrado:", error);
          showAlert('Erro', 'Item não encontrado', [
            { text: 'OK', onPress: () => router.back() }
          ]);
          return;
        }
      } else {
        console.error("ID inválido:", id);
        showAlert('Erro', 'ID do item inválido', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (error) {
      console.error('Erro ao carregar item:', error);
      showAlert('Erro', 'Ocorreu um erro ao carregar os detalhes do item', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } finally {
      setLoading(false);
    }
  };
  
  loadItem();
}, [params.id]);  // Adicionar params.id como dependência

  // Função para salvar a descrição
  const saveDescription = useCallback(async (newDescription: string) => {
    if (!item || !item.id) return;
    
    try {
      // Atualizar o item no Firestore
      await updateInventoryItem(item.id, { description: newDescription });
      
      // Atualizar o estado local
      setDescription(newDescription);
      setIsEditing(false);
      
      showAlert('Sucesso', 'Descrição guardada com sucesso!', [
        { text: 'OK', onPress: () => {} }
      ]);
    } catch (error) {
      console.error('Erro ao guardar descrição:', error);
      showAlert('Erro', 'Não foi possível guardar a descrição', [
        { text: 'OK', onPress: () => {} }
      ]);
    }
  }, [item, showAlert]);

  // Função para salvar a foto
  const savePhoto = useCallback(async (photoBase64: string) => {
    if (!item || !item.id) return;
    
    try {
      // Show loading indicator
      showAlert("A processar", "A guardar foto...", [], true);
      
      // Limpar o prefixo se existir
      let cleanBase64 = photoBase64;
      if (cleanBase64.includes('data:')) {
        cleanBase64 = cleanBase64.split(',')[1];
      }
      
      // Usar o serviço de inventário para atualizar a foto
      await updateInventoryItem(item.id, {}, cleanBase64);
      
      // Atualizar o estado local imediatamente com a nova foto
      setItem(prevItem => {
        if (!prevItem) return null;
        return {
          ...prevItem,
          photo: cleanBase64,
          photoUrl: prevItem.photoUrl // Manter a URL existente até que o servidor atualize
        };
      });
      
      setIsEditingPhoto(false);
      
      // Recarregar o item do Firestore para obter a URL atualizada
      if (item.id) {
        const docRef = doc(db, 'inventory', item.id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const updatedItem = { id: docSnap.id, ...docSnap.data() } as Item;
          setItem(updatedItem);
        }
      }
      
      showAlert('Sucesso', 'Foto guardada com sucesso!', [
        { text: 'OK', onPress: () => {} }
      ]);
    } catch (error) {
      console.error('Erro ao guardar foto:', error);
      showAlert('Erro', 'Não foi possível guardar a foto', [
        { text: 'OK', onPress: () => {} }
      ]);
    }
  }, [item, showAlert]);

  // Função para remover a foto
  const removePhoto = useCallback(async () => {
    if (!item || !item.id) return;
    
    try {
      // Show confirmation dialog
      showAlert('Confirmação', 'Tem certeza que deseja remover a foto?', [
        {
          text: 'Cancelar',
          onPress: () => {},
          style: 'cancel'
        },
        {
          text: 'Remover',
          onPress: async () => {
            // Show loading indicator
            showAlert("A processar", "A remover foto...", []);
            
            // Update Firestore document
            if (item.id) {
              await updateDoc(doc(db, 'inventory', item.id), {
                photoUrl: null,
                photo: null
              });
            }
            
            // Update local state immediately
            setItem(prevItem => {
              if (!prevItem) return null;
              return {
                ...prevItem,
                photoUrl: "",
                photo: undefined
              };
            });
            
            // Reload the item from Firestore to ensure consistency
            if (item.id) {
              const docRef = doc(db, 'inventory', item.id);
              const docSnap = await getDoc(docRef);
              
              if (docSnap.exists()) {
                const updatedItem = { id: docSnap.id, ...docSnap.data() } as Item;
                setItem(updatedItem);
              }
            }
            
            showAlert('Sucesso', 'Foto removida com sucesso!', [
              { text: 'OK', onPress: () => {} }
            ]);
          },
          style: 'destructive'
        }
      ]);
    } catch (error) {
      console.error('Erro ao remover foto:', error);
      showAlert('Erro', 'Não foi possível remover a foto', [
        { text: 'OK', onPress: () => {} }
      ]);
    }
  }, [item, showAlert]);

  // Renderiza a tela de carregamento
  if (loading) {
    return (
      <View style={[
        styles.loadingContainer,
        currentTheme === 'dark' ? styles.darkContainer : styles.lightContainer
      ]}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={[
          styles.loadingText,
          currentTheme === 'dark' ? styles.darkText : styles.lightText
        ]}>
          A carregar...
        </Text>
      </View>
    );
  }

  // Renderiza mensagem de erro se o item não foi encontrado
  if (!item) {
    return (
      <View style={[
        styles.loadingContainer,
        currentTheme === 'dark' ? styles.darkContainer : styles.lightContainer
      ]}>
        <Ionicons
          name="alert-circle-outline"
          size={40}
          color={currentTheme === 'dark' ? '#aaa' : '#666'}
        />
        <Text style={[
          styles.loadingText,
          currentTheme === 'dark' ? styles.darkText : styles.lightText
        ]}>
          Item não encontrado
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Renderiza a tela principal
  return (
    <>
      <StatusBar
        barStyle={currentTheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={currentTheme === 'dark' ? '#111' : '#fff'}
      />
      <Stack.Screen options={{ headerShown: false }} />
      
      <ScrollView
        style={[
          styles.container,
          currentTheme === 'dark' ? styles.darkContainer : styles.lightContainer
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Botão de voltar flutuante */}
        <TouchableOpacity
          style={[
            styles.floatingBackButton,
            currentTheme === 'dark' ? styles.darkFloatingButton : styles.lightFloatingButton
          ]}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={currentTheme === 'dark' ? '#fff' : '#000'}
          />
        </TouchableOpacity>


        {/* Imagem do item ou placeholder */}
        <View style={styles.imageContainer}>
          {item.photoUrl || item.photo ? (
            <>
      <Image
        source={{ uri: item.photoUrl || (item.photo ? `data:image/jpeg;base64,${item.photo}` : undefined) }}
        style={styles.itemImage}
        resizeMode="contain"
      />
      
    </>
  ) : (
    <View style={[
      styles.noImageContainer,
      currentTheme === 'dark' ? { backgroundColor: '#333' } : { backgroundColor: '#f5f5f5' }
    ]}>
      <TouchableOpacity
        style={styles.addPhotoButton}
        onPress={() => setIsEditingPhoto(true)}
      >
        <Ionicons
          name="camera"
          size={40}
          color={currentTheme === 'dark' ? '#555' : '#ccc'}
        />
        <Text style={[
          styles.noImageText,
          currentTheme === 'dark' ? styles.darkText : styles.lightText
        ]}>
          Adicionar foto
        </Text>
      </TouchableOpacity>
    </View>
  )}
  <View style={styles.photoActionButtons}>
        <TouchableOpacity
          style={styles.photoActionButton}
          onPress={() => {
            if (item && item.id) {
              router.replace({
                pathname: "/edit",
                params: {
                  id: item.id,
                  name: item.name,
                  category: item.category || "",
                  quantity: item.quantity.toString(),
                  returnToDetails: "true" 
                }
              });
            }
          }}
        >
          <Ionicons name="pencil" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
</View>
          
          {/* Cartão de detalhes do item */}
          <View style={[
            styles.detailsCard,
            currentTheme === 'dark' ? styles.darkCard : styles.lightCard
          ]}>
            {/* Nome do item */}
            <View style={styles.itemNameContainer}>
    <Text style={[
      styles.itemName,
      currentTheme === 'dark' ? styles.darkText : styles.lightText
    ]}>
      {item.name}
    </Text>
  </View>
            
            {/* Badge de categoria */}
            {item.category && (
              <View style={styles.categoryBadge}>
                 <MaterialCommunityIcons 
      name={categoryIconName as any} // Usa o nome do ícone do estado
      size={18}                      // Ajuste o tamanho se necessário (era 16 no Ionicons)
      color="#fff"                   // Cor do ícone
      style={{ marginRight: 6 }}     // Ajuste a margem se necessário
    />
                <Text style={styles.categoryText}>
                  {item.category}
                </Text>
              </View>
            )}
            
            {/* Indicador de quantidade */}
            <View style={styles.quantityContainer}>
              <View style={styles.quantityIconContainer}>
                <Ionicons name="cube-outline" size={24} color="#fff" />
              </View>
              <View style={styles.quantityTextContainer}>
                <Text style={[styles.quantityLabel, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
                  Quantidade
                </Text>
                <Text style={[styles.quantityValue, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
                  {item.quantity}
                </Text>
              </View>
            </View>
            
            {/* Datas de criação e atualização */}
            {(item.createdAt || item.updatedAt) && (
              <View style={styles.datesContainer}>
                {item.createdAt && (
                  <View style={styles.dateItem}>
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color={currentTheme === 'dark' ? '#aaa' : '#666'}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[
                      styles.dateText,
                      currentTheme === 'dark' ? { color: '#aaa' } : { color: '#666' }
                    ]}>
                      Criado: {formatDate(item.createdAt)}
                    </Text>
                  </View>
                )}
                
                {item.updatedAt && item.updatedAt !== item.createdAt && (
                  <View style={styles.dateItem}>
                    <Ionicons
                      name="refresh-outline"
                      size={16}
                      color={currentTheme === 'dark' ? '#aaa' : '#666'}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[
                      styles.dateText,
                      currentTheme === 'dark' ? { color: '#aaa' } : { color: '#666' }
                    ]}>
                      Atualizado: {formatDate(item.updatedAt)}
                    </Text>
                  </View>
                )}
              </View>
            )}
            
            {/* Seção de descrição */}
            <View style={styles.descriptionSection}>
              <View style={styles.descriptionHeader}>
                <Text style={[
                  styles.descriptionTitle,
                  currentTheme === 'dark' ? styles.darkText : styles.lightText
                ]}>
                  Descrição
                </Text>
                {!isEditing && (
                  <TouchableOpacity
                    style={[
                      styles.editButton,
                      currentTheme === 'dark' ? styles.darkEditButton : styles.lightEditButton
                    ]}
                    onPress={() => setIsEditing(true)}
                  >
                    <Ionicons
                      name="pencil"
                      size={18}
                      color={currentTheme === 'dark' ? '#fff' : '#007AFF'}
                    />
                    <Text style={[
                      styles.editButtonText,
                      { color: currentTheme === 'dark' ? '#fff' : '#007AFF' }
                    ]}>
                      Editar
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <View style={styles.descriptionContent}>
                {description ? (
                  <Text style={[
                    styles.descriptionText,
                    currentTheme === 'dark' ? styles.darkText : styles.lightText
                  ]}>
                    {description}
                  </Text>
                ) : (
                  <Text style={[
                    styles.emptyDescriptionText,
                    { color: currentTheme === 'dark' ? '#888' : '#999' }
                  ]}>
                    Sem descrição. Toque em "Editar" para adicionar uma descrição.
                  </Text>
                )}
              </View>
            </View>
          </View>
          
          
        </ScrollView>
        
        {isEditing && (
          <DescriptionEditor
            initialDescription={description}
            onSave={saveDescription}
            onCancel={cancelEditing}
            theme={currentTheme}
            itemName={item.name}
            itemCategory={item.category || ""}
            itemPhoto={item.photo}
            itemPhotoUrl={item.photoUrl}
          />
        )}
  
  {isEditingPhoto && (
  <PhotoEditor
    onSave={savePhoto}
    onCancel={cancelEditingPhoto}
    onDelete={removePhoto}
    theme={currentTheme}
    hasExistingPhoto={!!(item.photoUrl || item.photo)}
  />
)}

        
        <AlertComponent />
      </>
    );
  }
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    darkContainer: {
      backgroundColor: '#111',
    },
    lightContainer: {
      backgroundColor: '#f8f8f8',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 18,
      marginTop: 16,
    },
    floatingBackButton: {
      position: 'absolute',
      top: 16,
      left: 16,
      zIndex: 10,
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 5,
    },
    floatingEditButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 10,
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 5,
    },
    darkFloatingButton: {
      backgroundColor: 'rgba(40, 40, 40, 0.8)',
    },
    lightFloatingButton: {
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
    },
    imageContainer: {
      width: '100%',
      height: 300,
      backgroundColor: 'transparent',
      position: 'relative',
    },
    itemImage: {
      width: '100%',
      height: '100%',
    },
    noImageContainer: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    noImageText: {
      marginTop: 8,
      fontSize: 16,
    },
    addPhotoButton: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    photoActionButtons: {
      position: 'absolute',
      bottom: 28,
      right: 16,
      flexDirection: 'row',
    },
    photoActionButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgb(255, 72, 0)',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 5,
    },
    removePhotoButton: {
      backgroundColor: 'rgba(231, 76, 60, 0.8)',
    },
    detailsCard: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      marginTop: -24,
      padding: 24,
      paddingTop: 32,
      minHeight: 600,
    },
    darkCard: {
      backgroundColor: '#222',
    },
    lightCard: {
      backgroundColor: '#fff',
    },
    itemName: {
      fontSize: 28,
      fontWeight: 'bold',
      marginBottom: 16,
    },
    categoryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#4CAF50',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      alignSelf: 'flex-start',
      marginBottom: 24,
    },
    categoryText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    quantityContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(150, 150, 150, 0.2)',
    },
    quantityIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: '#4CAF50',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    quantityTextContainer: {
      flex: 1,
    },
    quantityLabel: {
      fontSize: 14,
      opacity: 0.7,
      marginBottom: 4,
    },
    quantityValue: {
      fontSize: 24,
      fontWeight: 'bold',
    },
    datesContainer: {
      marginBottom: 24,
    },
    dateItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    dateText: {
      fontSize: 12,
    },
    descriptionSection: {
      marginTop: 8,
    },
    descriptionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    descriptionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
    },
    editButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    darkEditButton: {
      backgroundColor: 'rgba(0, 122, 255, 0.2)',
    },
    lightEditButton: {
      backgroundColor: 'rgba(0, 122, 255, 0.1)',
    },
    editButtonText: {
      marginLeft: 4,
      fontSize: 14,
      fontWeight: '500',
    },
    descriptionContent: {
      minHeight: 100,
      backgroundColor: 'transparent',
      borderRadius: 12,
      padding: 8,
    },
    descriptionText: {
      fontSize: 16,
      lineHeight: 24,
    },
    emptyDescriptionText: {
      fontSize: 16,
      fontStyle: 'italic',
      textAlign: 'center',
      paddingVertical: 20,
    },
    descriptionInput: {
      padding: 16,
      fontSize: 16,
      minHeight: 150,
      textAlignVertical: 'top',
      width: '100%',
      borderWidth: 1,
      borderColor: '#ccc',
      borderRadius: 12,
      marginBottom: 16,
    },
    darkInput: {
      backgroundColor: '#333',
      borderColor: '#555',
    },
    lightInput: {
      backgroundColor: '#f9f9f9',
    },
    darkText: {
      color: '#fff',
    },
    lightText: {
      color: '#000',
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 16,
    },
    button: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 12,
      minWidth: 100,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    },
    cancelButton: {
      backgroundColor: '#ccc',
    },
    saveButton: {
      backgroundColor: '#4CAF50',
    },
    buttonText: {
      color: 'white',
      fontWeight: 'bold',
      fontSize: 16,
    },
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      padding: 20,
    },
    modalContent: {
      width: '90%',
      borderRadius: 16,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      marginBottom: 16,
      textAlign: 'center',
    },
    // Estilos para o editor de fotos
    photoOptionsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginVertical: 20,
    },
    photoOption: {
      width: 120,
      height: 120,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    },
    darkPhotoOption: {
      backgroundColor: '#333',
    },
    lightPhotoOption: {
      backgroundColor: '#f0f0f0',
    },
    photoOptionText: {
      marginTop: 8,
      fontSize: 16,
      fontWeight: '500',
    },
    cameraContainer: {
      flex: 1,
      backgroundColor: '#000',
    },
    camera: {
      flex: 1,
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingBottom: 30,
    },
    captureButton: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      borderWidth: 4,
      borderColor: 'white',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    closeButton: {
      position: 'absolute',
      top: 40,
      right: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    backButton: {
      marginTop: 20,
      paddingVertical: 10,
      paddingHorizontal: 20,
      backgroundColor: '#3498db',
      borderRadius: 8,
    },
    backButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    // Estilos para o botão de IA
    aiButton: {
      backgroundColor: '#6200ee',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      marginBottom: 16,
    },
    itemNameContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    itemEditButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },

    deletePhotoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 15,
      padding: 10,
      borderWidth: 1,
      borderColor: '#e74c3c',
      borderRadius: 8,
      borderStyle: 'dashed',
    },
    deletePhotoText: {
      color: '#e74c3c',
      marginLeft: 8,
      fontSize: 14,
      fontWeight: '500',
    },
    aiButtonDisabled: {
      backgroundColor: '#9e9e9e',
      opacity: 0.7,
    },
    aiButtonIcon: {
      marginRight: 8,
    },
    aiButtonText: {
      color: 'white',
      fontWeight: 'bold',
      fontSize: 14,
    }
  });
  
  
