import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Switch } from "react-native";
import { useTheme } from "./theme-context";
import { useRouter } from "expo-router";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { Linking } from "react-native";
import useCustomAlert from '../hooks/useCustomAlert';
import { useAuth } from '../auth-context';

// Firebase imports
import { 
  getInventoryItems, 
  getItemHistory, 
  saveUserSettings, 
  getUserSettings,
  addToHistory,
  addInventoryItem
} from '../inventory-service';
import { db, auth } from '../firebase-config';
import { collection, writeBatch, query, where, getDocs, deleteDoc, doc, getDoc, setDoc,updateDoc, serverTimestamp } from 'firebase/firestore';

interface Item {
  id?: string;
  name: string;
  quantity: string | number;
  category?: string;
  lowStockThreshold?: string;
  photoUrl?: string;
  photo?: string;
  description?: string;
  userId?: string;
}

interface ItemHistory {
  id?: string;
  name: string;
  category: string;
  quantity: string | number;
  timestamp: number | any;
  action: 'add' | 'edit' | 'remove' | 'import' | 'reset';
  userId?: string;
}

export default function SettingsScreen() {
  const { setTheme, currentTheme, theme } = useTheme();
  const router = useRouter();
  const { currentUser } = useAuth();
  const [inventory, setInventory] = useState<Item[]>([]);
  const [globalThreshold, setGlobalThreshold] = useState("5");
  const [showCustomThresholds, setShowCustomThresholds] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [itemHistory, setItemHistory] = useState<ItemHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showContactOptions, setShowContactOptions] = useState(false);

  // Toggle function
  const toggleContactOptions = () => {
    setShowContactOptions(!showContactOptions);
  };

  const openEmail = () => {
    Linking.openURL('mailto:pv26632@estgl.ipv.pt');
  };
  
  const openInstagram = () => {
    Linking.openURL('https://www.instagram.com/bernardo._04_/');
  };
  
  const openLinkedIn = () => {
    Linking.openURL('https://www.linkedin.com/in/bernardo-silva-031a51339/');
  };
  
  const openGitHub = () => {
    Linking.openURL('https://github.com/gestama04');
  };

  const { showAlert, AlertComponent } = useCustomAlert();

  const validatePositiveInteger = (value: string): string => {
  // Se estiver vazio, retorna string vazia (não retorna "0")
  if (value === '') return '';
  
  // Remove qualquer caractere não numérico
  const cleanedValue = value.replace(/[^0-9]/g, '');
  
  // Se após a limpeza ficar vazio, retorna string vazia
  if (cleanedValue === '') return '';
  
  // Converte para número
  const numValue = parseInt(cleanedValue, 10);
  
  // Retorna o valor como string (incluindo zero)
  return numValue.toString();
};

const combineInventoryItems = (items: Item[]): Item[] => {
  const combinedItems: Record<string, Item> = {};

  items.forEach(item => {
    // Create a key based on name and category
    const key = `${item.name.toLowerCase()}-${(item.category || '').toLowerCase()}`;
    
    if (combinedItems[key]) {
      // If this item already exists, add the quantities
      const existingQty = parseInt(combinedItems[key].quantity.toString()) || 0;
      const newQty = parseInt(item.quantity.toString()) || 0;
      combinedItems[key].quantity = (existingQty + newQty).toString();
      
      // If the existing item doesn't have an ID but this one does, use this one's ID
      if (!combinedItems[key].id && item.id) {
        combinedItems[key].id = item.id;
      }
      
      // If the existing item doesn't have a photo but this one does, use this one's photo
      if (!combinedItems[key].photo && !combinedItems[key].photoUrl && (item.photo || item.photoUrl)) {
        combinedItems[key].photo = item.photo;
        combinedItems[key].photoUrl = item.photoUrl;
      }
    } else {
      // First time seeing this item, add it to the combined items
      combinedItems[key] = { ...item };
    }
  });

  return Object.values(combinedItems);
};

// Modificado para usar Firebase
useEffect(() => {
  const loadData = async () => {
    try {
      if (!currentUser) {
        console.log("Utilizador não autenticado");
        setLoading(false);
        return;
      }
      setLoading(true);
      
      // Carregar inventário do Firebase
      const unsubscribe = getInventoryItems((items) => {
        // Combine items with the same name and category
        const combinedItems = combineInventoryItems(items);
        setInventory(combinedItems);
      });
      
      // Carregar configurações do Utilizador diretamente do Firestore
      try {
        console.log("Carregando configurações do Utilizador...");
        
        // Tentar obter diretamente do documento do Utilizador
        const userSettingsDoc = await getDoc(doc(db, 'userSettings', currentUser.uid));
        
        if (userSettingsDoc.exists()) {
          const settings = userSettingsDoc.data();
          console.log("Configurações carregadas do Firestore:", settings);
          
          if (settings.globalLowStockThreshold !== undefined) {
            console.log("Definindo threshold global para:", settings.globalLowStockThreshold);
            setGlobalThreshold(settings.globalLowStockThreshold);
          } else {
            console.log("Threshold global não encontrado, usando padrão: 5");
            setGlobalThreshold("5");
          }
        } else {
          console.log("Documento de configurações não encontrado, usando padrão");
          setGlobalThreshold("5");
          
          // Criar configurações padrão
          await setDoc(doc(db, 'userSettings', currentUser.uid), {
            globalLowStockThreshold: "5",
            userId: currentUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      } catch (settingsError) {
        console.error("Erro ao carregar configurações:", settingsError);
        // Fallback para getUserSettings
        const userSettings = await getUserSettings();
        console.log("Configurações carregadas via getUserSettings:", userSettings);
        
        if (userSettings && 'globalLowStockThreshold' in userSettings) {
          setGlobalThreshold(userSettings.globalLowStockThreshold);
        } else {
          setGlobalThreshold("5");
        }
      }
      
      // Carregar histórico de itens
      const history = await getItemHistory();
      setItemHistory(history);
      
      setLoading(false);
      
      // Limpar o listener quando o componente for desmontado
 return () => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      setLoading(false);
    }
  };
  
  loadData();
}, [currentUser]);


  // Limpar histórico - modificado para Firebase
  const clearItemHistory = async () => {
    if (!currentUser) {
      showAlert("Erro", "Utilizador não autenticado", [
        { text: "OK", onPress: () => {} }
      ]);
      return;
    }
    
    showAlert(
      "Limpar Histórico",
      "Tem a certeza que deseja limpar o histórico de Produtos?",
      [
        { text: "Cancelar", style: "cancel", onPress: () => {} },
        {
          text: "Limpar",
          style: "destructive",
          onPress: async () => {
            try {
              // Obter referência para todos os documentos de histórico do Utilizador
              const historyRef = collection(db, 'itemHistory');
              const q = query(historyRef, where('userId', '==', currentUser.uid));
              const snapshot = await getDocs(q);
              
              // Excluir cada documento
              const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
              await Promise.all(deletePromises);
              
              // Atualizar o estado
              setItemHistory([]);
              
              // Adicionar entrada de histórico sobre a limpeza
              await addToHistory({
                name: "Histórico",
                category: "Sistema",
                quantity: "Todo",
                action: 'reset'
              });
              
              showAlert("Sucesso", "Histórico limpo com sucesso!", [
                { text: "OK", onPress: () => {} }
              ]);
            } catch (error) {
              console.error("Erro ao limpar histórico:", error);
              showAlert("Erro", "Não foi possível limpar o histórico.", [
                { text: "OK", onPress: () => {} }
              ]);
            }
          }
        }
      ]
    );
  };

  const saveGlobalThreshold = async () => {
    if (!currentUser) {
      showAlert("Erro", "Utilizador não autenticado", [
        { text: "OK", onPress: () => {} }
      ]);
      return;
    }
    
    try {
      // Garante que o valor é um inteiro positivo válido
      const validatedThreshold = validatePositiveInteger(globalThreshold);
      console.log("Salvando threshold global:", validatedThreshold);
      setGlobalThreshold(validatedThreshold); // Atualiza o estado com o valor validado
      
      // Salvar diretamente no documento do Utilizador
      try {
        await setDoc(doc(db, 'userSettings', currentUser.uid), {
          globalLowStockThreshold: validatedThreshold,
          userId: currentUser.uid,
          updatedAt: serverTimestamp()
        }, { merge: true }); // Usar merge: true para não sobrescrever outros campos
        
        console.log("Threshold global salvo diretamente no Firestore:", validatedThreshold);
      } catch (firestoreError) {
        console.error("Erro ao salvar diretamente no Firestore:", firestoreError);
        
        // Tentar salvar usando a função existente como fallback
        await saveUserSettings({
          globalLowStockThreshold: validatedThreshold
        });
      }
      
      console.log("Threshold global salvo com sucesso:", validatedThreshold);
      
      showAlert("Sucesso", "Valor global de stock baixo atualizado!", [
        { text: "OK", onPress: () => {} }
      ]);
    } catch (error) {
      console.error("Erro ao salvar configuração:", error);
      showAlert("Erro", "Falha ao salvar a configuração.", [
        { text: "OK", onPress: () => {} }
      ]);
    }
  };
  
  

  // Atualizar limite para um item específico - modificado para Firebase

const updateItemThreshold = async (index: number, newThresholdValue: string | undefined) => {
  const itemToUpdate = inventory[index];
  if (!currentUser || !itemToUpdate || !itemToUpdate.id) {
    showAlert("Erro", "Não foi possível atualizar o item", [
      { text: "OK", onPress: () => {} }
    ]);
    return;
  }

  const itemId = itemToUpdate.id;
  const itemRef = doc(db, 'inventory', itemId);

  try {
    // Se o valor for undefined ou string vazia, remover o threshold personalizado
    if (newThresholdValue === undefined || newThresholdValue === '') {
      await updateDoc(itemRef, { 
        lowStockThreshold: null, 
        updatedAt: serverTimestamp() 
      });
      
      // Atualizar o estado local
      setInventory(prevInventory => 
        prevInventory.map((item, i) => {
          if (i === index) {
            const updatedItem = { ...item };
            delete updatedItem.lowStockThreshold;
            return updatedItem;
          }
          return item;
        })
      );
      
      console.log(`Threshold personalizado removido para ${itemToUpdate.name}`);
    } else {
      // Definir ou atualizar o threshold personalizado (incluindo zero)
      await updateDoc(itemRef, { 
        lowStockThreshold: newThresholdValue, 
        updatedAt: serverTimestamp() 
      });
      
      // Atualizar o estado local
      setInventory(prevInventory => 
        prevInventory.map((item, i) => 
          i === index ? { ...item, lowStockThreshold: newThresholdValue } : item
        )
      );
      
      console.log(`Threshold personalizado definido para ${itemToUpdate.name}: ${newThresholdValue}`);
    }
  } catch (error) {
    console.error("Erro ao atualizar threshold do item:", error);
    showAlert("Erro", "Não foi possível atualizar o threshold do item", [
      { text: "OK", onPress: () => {} }
    ]);
  }
};


  // Exportar como PDF - modificado para usar dados do Firebase
  const exportAsPDF = async () => {
    if (!currentUser || inventory.length === 0) {
      showAlert("Erro", "Nenhum dado para exportar.", [
        { text: "OK", onPress: () => {} }
      ]);
      return;
    }
    
    try {
      // Ordenar inventário por quantidade em ordem crescente
      const sortedInventory = [...inventory].sort((a, b) => {
        const qtyA = typeof a.quantity === 'string' ? parseInt(a.quantity) : a.quantity as number;
        const qtyB = typeof b.quantity === 'string' ? parseInt(b.quantity) : b.quantity as number;
        return qtyA - qtyB;
      });

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
              ${sortedInventory.map(item => {
                const itemQty = typeof item.quantity === 'string' ? parseInt(item.quantity) : item.quantity as number;
                const itemThreshold = item.lowStockThreshold ? parseInt(item.lowStockThreshold) : parseInt(globalThreshold);
                const isLowStock = itemQty <= itemThreshold && itemQty > 0;
                const isOutOfStock = itemQty === 0;
                const stockStatus = isOutOfStock ? 'Sem stock' : isLowStock ? 'Stock baixo' : '';
                const stockColor = isOutOfStock ? 'red' : isLowStock ? 'orange' : 'black';
                return `
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">${item.name}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">
                      <span style="color: ${stockColor};">${item.quantity}</span>
                      <span style="color: ${stockColor};">${stockStatus}</span>
                    </td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${item.category || 'Sem categoria'}</td>
                  </tr>
                `;
              }).join('')}
            </table>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri);
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      showAlert("Erro", "Falha ao exportar PDF.", [
        { text: "OK", onPress: () => {} }
      ]);
    }
  };

  // Exportar como CSV - modificado para usar dados do Firebase
  const exportAsCSV = async () => {
    if (!currentUser || inventory.length === 0) {
      showAlert("Erro", "Nenhum dado para exportar.", [
        { text: "OK", onPress: () => {} }
      ]);
      return;
    }
    
    try {
      // Create CSV header
      const csvHeader = "Nome;Quantidade;Stock Baixo;Categoria\n";

      // Map inventory items to CSV rows
      const csvRows = inventory.map(item => {
        const itemQty = typeof item.quantity === 'string' ? parseInt(item.quantity) : item.quantity as number;
        const itemThreshold = item.lowStockThreshold ? parseInt(item.lowStockThreshold) : parseInt(globalThreshold);
        const isLowStock = itemQty <= itemThreshold && itemQty > 0;
        
        // Wrap each field in quotes to handle commas within data
        return `"${item.name}";"${item.quantity}";"${isLowStock ? 'Sim' : 'Não'}";"${item.category || 'Sem categoria'}"`;
      });

      // Join header and rows with new lines
      const csvContent = "\uFEFF" + csvHeader + csvRows.join('\n');

      const csvUri = FileSystem.documentDirectory + "inventory.csv";
      await FileSystem.writeAsStringAsync(csvUri, csvContent);
      await Sharing.shareAsync(csvUri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
    } catch (error) {
      console.error("Erro ao exportar CSV:", error);
      showAlert("Erro", "Falha ao exportar CSV.", [
        { text: "OK", onPress: () => {} }
      ]);
    }
  };

  // Exportar como JSON - modificado para usar dados do Firebase
  const exportAsJSON = async () => {
    if (!currentUser || inventory.length === 0) {
      showAlert("Erro", "Nenhum dado para exportar.", [
        { text: "OK", onPress: () => {} }
      ]);
      return;
    }
    
    try {
      // Preparar dados para exportação (remover campos internos do Firebase)
      const exportData = inventory.map(item => {
        const { id, userId, createdAt, updatedAt, ...exportableData } = item as any;
        return exportableData;
      });
      
      const jsonString = JSON.stringify(exportData, null, 2);
      const fileUri = FileSystem.documentDirectory + "backup.json";
      await FileSystem.writeAsStringAsync(fileUri, jsonString);
      await Sharing.shareAsync(fileUri);
    } catch (error) {
      console.error("Erro ao exportar JSON:", error);
      showAlert("Erro", "Falha ao exportar JSON.", [
        { text: "OK", onPress: () => {} }
      ]);
    }
  };

  // Função de exportação principal - modificada para Firebase
  const exportData = async () => {
    if (!currentUser) {
      showAlert("Erro", "Utilizador não autenticado", [
        { text: "OK", onPress: () => {} }
      ]);
      return;
    }
    
    if (inventory.length === 0) {
      showAlert("Erro", "Nenhum dado para exportar.", [
        { text: "OK", onPress: () => {} }
      ]);
      return;
    }

    showAlert(
      "Exportar Dados",
      "Escolha o formato",
      [
        {
          text: "PDF",
          onPress: () => exportAsPDF()
        },
        {
          text: "CSV (Excel)",
          onPress: () => exportAsCSV()
        },
        {
          text: "JSON (Para importar na app)",
          onPress: () => exportAsJSON()
        },
        { text: "Cancelar", style: "cancel", onPress: () => {} }
      ]
    );
  };

  // Importar dados - modificado para Firebase
const importData = async () => {
  if (!currentUser) {
    showAlert("Erro", "Utilizador não autenticado", [{ text: "OK", onPress: () => {} }]);
    return;
  }

  try {
    // Mostrar alerta com spinner durante a importação
    showAlert(
      "Importação",
      "A processar o ficheiro. Isto pode demorar algum tempo...",
      [{ text: "Cancelar", style: "cancel", onPress: () => {} }],
      true // Ativar spinner
    );

    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/json"],
      multiple: false
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      showAlert("Importação", "Operação cancelada ou nenhum ficheiro selecionado.", [{ text: "OK", onPress: () => {} }]);
      return;
    }

    const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri);
    const parsedData = JSON.parse(fileContent);

    if (!Array.isArray(parsedData)) {
      showAlert("Erro", "O ficheiro JSON deve conter uma lista (array) de Produtos.", [{ text: "OK", onPress: () => {} }]);
      return;
    }

    if (parsedData.length === 0) {
      showAlert("Informação", "O ficheiro de importação está vazio.", [{ text: "OK", onPress: () => {} }]);
      return;
    }

    // Verificar tamanho total dos dados antes de prosseguir
    const totalDataSize = JSON.stringify(parsedData).length;
    const MAX_RECOMMENDED_SIZE = 10 * 1024 * 1024; // 10MB
    
    if (totalDataSize > MAX_RECOMMENDED_SIZE) {
      showAlert(
        "Aviso",
        "O ficheiro é muito grande (mais de 10MB). Recomendamos dividir em ficheiros menores ou remover fotos grandes.",
        [
          { text: "Cancelar", style: "cancel", onPress: () => {} },
          {
            text: "Continuar Mesmo Assim",
            style: "destructive",
            onPress: () => {
              // Garantir que currentUser não é nulo aqui também
              if (currentUser) {
                processImport(parsedData, currentUser.uid);
              }
            }
          }
        ]
      );
    } else {
      await processImport(parsedData, currentUser.uid);
    }
  } catch (error) {
    console.error("Erro detalhado ao importar dados:", error);
    let errorMessage = "Falha ao importar dados.";
    if (error instanceof Error) {
      errorMessage += ` Detalhe: ${error.message}`;
    }
    showAlert("Erro na Importação", errorMessage, [{ text: "OK", onPress: () => {} }]);
  }
};

// Função auxiliar para processar a importação com tipos adequados
const processImport = async (parsedData: any[], userId: string) => {
  try {
    const itemsCollectionRef = collection(db, 'inventory');
    const historyCollectionRef = collection(db, 'itemHistory');
    
    // Constantes para controlo de lotes
    const MAX_ITEMS_PER_BATCH = 20; // Reduzido para evitar sobrecarga
    const MAX_BASE64_SIZE = 600 * 1024; // 100KB máximo para fotos base64
    
    let importedCount = 0;
    let skippedPhotos = 0;
    
    // Processar em pequenos lotes
    for (let batchIndex = 0; batchIndex < parsedData.length; batchIndex += MAX_ITEMS_PER_BATCH) {
      let currentBatch = writeBatch(db);
      let operationsInCurrentBatch = 0;
      
      // Processar um lote de itens
      const endIndex = Math.min(batchIndex + MAX_ITEMS_PER_BATCH, parsedData.length);
      
      for (let i = batchIndex; i < endIndex; i++) {
        const itemDataFromFile = parsedData[i];
        
        // Remover campos que não devem ser importados diretamente
        const { id, userId: oldUserId, createdAt, updatedAt, ...importableData } = itemDataFromFile;
        
        // Verificar e limitar tamanho da foto base64
        let photoData = importableData.photo;
        if (photoData && typeof photoData === 'string' && photoData.length > MAX_BASE64_SIZE) {
          // Foto muito grande, não importar
          photoData = null;
          skippedPhotos++;
        }
        
        const newItemDocRef = doc(itemsCollectionRef);
        
        const newItemPayload = {
          ...importableData,
          quantity: importableData.quantity?.toString() || "0",
          photo: photoData,
          photoUrl: importableData.photoUrl || null,
          userId: userId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        currentBatch.set(newItemDocRef, newItemPayload);
        operationsInCurrentBatch++;
        
        // Adicionar entrada de histórico
        const newHistoryDocRef = doc(historyCollectionRef);
        currentBatch.set(newHistoryDocRef, {
          name: importableData.name || "Produto Importado",
          category: importableData.category || "Importado",
          quantity: newItemPayload.quantity,
          action: 'add',
          timestamp: serverTimestamp(),
          userId: userId,
          itemId: newItemDocRef.id
        });
        operationsInCurrentBatch++;
      }
      
      // Enviar o lote atual
      await currentBatch.commit();
      importedCount += (endIndex - batchIndex);
      
      // Atualizar o alerta de progresso
      showAlert(
        "Importação em Progresso",
        `Processados ${importedCount} de ${parsedData.length} produtos...`,
        [],
        true // Manter spinner
      );
      
      // Pausa entre lotes para evitar sobrecarga
      if (batchIndex + MAX_ITEMS_PER_BATCH < parsedData.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Adicionar entrada de histórico geral
    await addToHistory({
      name: "Importação em Lote",
      category: "Sistema",
      quantity: parsedData.length.toString(),
      action: 'import'
    });
    
    let successMessage = `${importedCount} produtos foram importados com sucesso!`;
    if (skippedPhotos > 0) {
      successMessage += ` (${skippedPhotos} fotos foram ignoradas por serem muito grandes)`;
    }
    
    showAlert("Sucesso", successMessage, [{ text: "OK", onPress: () => {} }]);
  } catch (error) {
    console.error("Erro durante o processamento da importação:", error);
    throw error;
  }
};

  // Resetar inventário - modificado para Firebase
  const resetInventory = async () => {
    if (!currentUser) {
      showAlert("Erro", "Utilizador não autenticado", [
        { text: "OK", onPress: () => {} }
      ]);
      return;
    }
    
    showAlert(
      "Redefinir",
      "Tem a certeza? Todos os dados serão eliminados.",
      [
        { text: "Cancelar", style: "cancel", onPress: () => {} },
        {
          text: "Sim",
          style: "destructive",
          onPress: async () => {
            try {
              // Obter referência para todos os documentos de inventário do Utilizador
              const inventoryRef = collection(db, 'inventory');
              const q = query(inventoryRef, where('userId', '==', currentUser.uid));
              const snapshot = await getDocs(q);
              
              // Excluir cada documento
              const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
              await Promise.all(deletePromises);
              
              // Atualizar o estado
              setInventory([]);
              
              // Adicionar ao histórico
              await addToHistory({
                name: "Inventário",
                category: "Sistema",
                quantity: "Todo",
                action: 'reset'
              });
              
              showAlert("Sucesso", "Inventário redefinido com sucesso!", [
                { text: "OK", onPress: () => {} }
              ]);
            } catch (error) {
              console.error("Erro ao redefinir inventário:", error);
              showAlert("Erro", "Não foi possível redefinir o inventário.", [
                { text: "OK", onPress: () => {} }
              ]);
            }
          }
        }
      ]
    );
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

        {/* Nova secção para configurações de stock baixo */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
            Alertas de Stock Baixo
          </Text>
         
          <View style={styles.globalThresholdContainer}>
            <Text style={[styles.thresholdLabel, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
              Valor global para stock baixo:
            </Text>
            <TextInput
              style={[
                styles.globalInput,
                currentTheme === "dark" ? { backgroundColor: '#444', color: '#fff' } : { backgroundColor: '#f0f0f0', color: '#333' }
              ]}
              value={globalThreshold}
              onChangeText={(text) => setGlobalThreshold(validatePositiveInteger(text))}
              keyboardType="numeric"
              placeholder="5"
            />
          </View>
         
          <TouchableOpacity style={styles.actionButton} onPress={saveGlobalThreshold}>
            <MaterialIcons name="save" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Guardar Valor Global</Text>
          </TouchableOpacity>
         
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setShowCustomThresholds(!showCustomThresholds)}
          >
            <MaterialIcons
              name={showCustomThresholds ? "expand-less" : "expand-more"}
              size={24}
              color="#fff"
            />
            <Text style={styles.actionButtonText}>
              {showCustomThresholds ? "Ocultar Exceções" : "Mostrar Exceções por Produto"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => router.replace("/notifications")}
          >
            <MaterialIcons
              name="notifications"
              size={24}
              color="#fff"
            />
            <Text style={styles.actionButtonText}>
              Configurar Notificações
            </Text>
          </TouchableOpacity>
          
          {showCustomThresholds && inventory.length > 0 && (
  <View style={[
    styles.customThresholdsContainer,
    currentTheme === "dark" ? { backgroundColor: '#333' } : { backgroundColor: '#f0f0f0' }
  ]}>
    <Text style={[styles.customThresholdsTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
      Exceções para Produtos Específicos
    </Text>
    <Text style={[styles.customThresholdsDesc, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
      Ative o interruptor para definir um valor específico para cada produto
    </Text>
   
    {/* Substitua a View com altura fixa por uma ScrollView */}
    <ScrollView
      style={{maxHeight: 300}}
      nestedScrollEnabled={true}
      contentContainerStyle={{paddingBottom: 10}}
    >
      {inventory.map((item, index) => {
        // Determinar se o item tem um threshold personalizado
        const hasCustomThreshold = item.lowStockThreshold !== undefined && item.lowStockThreshold !== null && item.lowStockThreshold !== "";
        
        return (
          <View key={`${item.id || index}`} style={[
            styles.itemContainer,
            {borderBottomColor: currentTheme === "dark" ? '#444' : '#e0e0e0'}
          ]}>
            <View style={styles.itemInfo}>
              <Text style={[styles.itemName, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                {item.name}
              </Text>
              <Text style={[styles.itemCategory, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                {item.category || 'Sem categoria'} (Quantidade: {item.quantity})
              </Text>
            </View>
            
            <View style={styles.thresholdControls}>
              <Switch
                value={hasCustomThreshold}
                onValueChange={(value) => {
                  if (value) {
                    // Ao ativar o switch, definir o threshold para o valor global como ponto de partida
                    updateItemThreshold(index, globalThreshold);
                  } else {
                    // Ao desativar o switch, remover o threshold personalizado
                    updateItemThreshold(index, undefined);
                  }
                }}
                trackColor={{ false: "#767577", true: "#81b0ff" }}
                thumbColor={hasCustomThreshold ? "#3498db" : "#f4f3f4"}
                ios_backgroundColor="#3e3e3e"
              />
              
              {hasCustomThreshold && (
  <TextInput
    style={[
      styles.thresholdInput,
      currentTheme === "dark"
        ? { backgroundColor: '#444', color: '#fff', borderColor: '#555' }
        : { backgroundColor: '#f0f0f0', color: '#333', borderColor: '#ddd' }
    ]}
    value={item.lowStockThreshold || ''} // Garantir que nunca seja undefined
    onChangeText={(text) => {
      // Permitir texto vazio sem validação imediata
      setInventory(prevInventory =>
        prevInventory.map((prevItem, i) =>
          i === index ? { ...prevItem, lowStockThreshold: text } : prevItem
        )
      );
    }}
    onBlur={() => {
      // Ao perder o foco, validar e atualizar no Firebase
      const validatedText = validatePositiveInteger(item.lowStockThreshold || '');
      updateItemThreshold(index, validatedText === '' ? undefined : validatedText);
    }}
    keyboardType="numeric"
    placeholder={globalThreshold}
    placeholderTextColor={currentTheme === "dark" ? "#aaa" : "#999"}
  />
)}
            </View>
          </View>
        );
      })}
    </ScrollView>
  </View>
)}
         
          {showCustomThresholds && inventory.length === 0 && (
            <Text style={[styles.emptyInventory, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
              Não existem Produtos no inventário
            </Text>
          )}
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

        {/* Seção de histórico de ações */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
            Histórico de Ações
          </Text>
         
          {itemHistory.length > 0 ? (
            <View style={[
              styles.historyContainer,
              currentTheme === "dark" ? { backgroundColor: '#333' } : { backgroundColor: '#f0f0f0' }
            ]}>
              <ScrollView
                style={{ maxHeight: 300 }}
                nestedScrollEnabled={true}
              >
                {itemHistory.map((historyItem, index) => (
                  <View key={historyItem.id || index} style={[
                    styles.historyItemContainer,
                    { borderBottomColor: currentTheme === "dark" ? '#444' : '#e0e0e0' }
                  ]}>
                    <View style={styles.historyItemInfo}>
                      <Text style={[styles.historyItemName, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                        {historyItem.name} {historyItem.quantity ? `(${historyItem.quantity})` : ''}
                      </Text>
                      <Text style={[styles.historyItemCategory, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                        {historyItem.category}
                      </Text>
                    </View>
                    <View style={styles.historyItemAction}>
                      <Text style={[
                        styles.historyItemActionText,
                        historyItem.action === 'add' ? styles.addAction :
                        historyItem.action === 'edit' ? styles.editAction :
                        historyItem.action === 'remove' ? styles.removeAction :
                        historyItem.action === 'import' ? styles.importAction : styles.resetAction
                      ]}>
                        {historyItem.action === 'add' ? 'Adicionado' :
                         historyItem.action === 'edit' ? 'Editado' :
                         historyItem.action === 'remove' ? 'Removido' :
                         historyItem.action === 'import' ? 'Importado' : 'Apagado'}
                      </Text>
                      <Text style={[styles.historyItemDate, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                        {historyItem.timestamp && typeof historyItem.timestamp.toDate === 'function' 
                          ? historyItem.timestamp.toDate().toLocaleDateString() + ' ' + historyItem.timestamp.toDate().toLocaleTimeString()
                          : new Date(historyItem.timestamp).toLocaleDateString() + ' ' + new Date(historyItem.timestamp).toLocaleTimeString()}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : (
            <Text style={[styles.emptyHistory, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
              Nenhum histórico disponível
            </Text>
          )}

          <TouchableOpacity style={styles.actionButton} onPress={clearItemHistory}>
            <MaterialIcons name="delete-sweep" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Limpar Histórico</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
            Sobre
          </Text>
          <TouchableOpacity style={styles.infoButton} onPress={() => setShowContactOptions(!showContactOptions)}>
            <MaterialIcons name="contact-mail" size={24} color="#fff" />
            <Text style={styles.infoButtonText}>Contactos</Text>
          </TouchableOpacity>

          {showContactOptions && (
            <View style={styles.contactOptions}>
              <TouchableOpacity style={styles.contactOption} onPress={openEmail}>
                <MaterialIcons
                  name="email"
                  size={24}
                  color={currentTheme === "dark" ? "#fff" : "#000"}
                />
                <Text style={[
                  styles.contactOptionText,
                  currentTheme === "dark" ? styles.darkText : styles.lightText
                ]}>
                  Email
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactOption} onPress={openInstagram}>
                <Ionicons
                  name="logo-instagram"
                  size={24}
                  color={currentTheme === "dark" ? "#fff" : "#000"}
                />
                <Text style={[
                  styles.contactOptionText,
                  currentTheme === "dark" ? styles.darkText : styles.lightText
                ]}>
                  Instagram
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactOption} onPress={openLinkedIn}>
                <Ionicons
                  name="logo-linkedin"
                  size={24}
                  color={currentTheme === "dark" ? "#fff" : "#000"}
                />
                <Text style={[
                  styles.contactOptionText,
                  currentTheme === "dark" ? styles.darkText : styles.lightText
                ]}>
                  LinkedIn
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactOption} onPress={openGitHub}>
                <Ionicons
                  name="logo-github"
                  size={24}
                  color={currentTheme === "dark" ? "#fff" : "#000"}
                />
                <Text style={[
                  styles.contactOptionText,
                  currentTheme === "dark" ? styles.darkText : styles.lightText
                ]}>
                  GitHub
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={[styles.versionText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
            Versão 1.0.0
          </Text>
          <Text style={[styles.copyrightText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
            © 2025
          </Text>
        </View>
      </View>
      <AlertComponent />
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
    marginBottom: 30,
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
  globalThresholdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  thresholdLabel: {
    fontSize: 16,
    flex: 3,
  },
  globalInput: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginLeft: 10,
    textAlign: 'center',
  },

  customThresholdsContainer: {
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  customThresholdsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  
  customThresholdsDesc: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
  
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  
  itemInfo: {
    flex: 3,
    paddingRight: 10,
  },
  
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  
  itemCategory: {
    fontSize: 14,
    opacity: 0.7,
  },
  
  thresholdControls: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  
  thresholdInput: {
    width: 60,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    textAlign: 'center',
    fontSize: 16,
  },
  
  toggleButton: {
    backgroundColor: '#2980b9',
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 15,
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
  
  emptyInventory: {
    textAlign: 'center',
    fontSize: 16,
    marginVertical: 20,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  historyContainer: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
  },
  historyItemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  historyItemInfo: {
    flex: 2,
  },
  historyItemName: {
    fontSize: 16,
    fontWeight: '500',
  },
  historyItemCategory: {
    fontSize: 14,
    opacity: 0.7,
  },
  historyItemAction: {
    flex: 1,
    alignItems: 'flex-end',
  },
  historyItemActionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  historyItemDate: {
    fontSize: 12,
    opacity: 0.7,
  },
  addAction: {
    color: '#2ecc71',
  },
  editAction: {
    color: '#f39c12',
  },
  removeAction: {
    color: '#e74c3c',
  },
  importAction: {
    color: '#3498db', // Example color for import actions
  },

  resetAction: {
    color: '#e74c3c', // Example color for reset actions
  },
  emptyHistory: {
    textAlign: 'center',
    fontSize: 16,
    marginVertical: 20,
    fontStyle: 'italic',
  },
  // Specific styles for export buttons
  exportButton: {
    backgroundColor: '#3498db', // Same as actionButton for consistency
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
  notificationButton: {
    backgroundColor: '#ff5722',
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
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
  exportButtonText: {
    color: '#fff', // White text for better visibility
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  contactOptions: {
    marginTop: 10,
    paddingLeft: 20,
  },
  contactOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  contactOptionText: {
    marginLeft: 10,
    color: '#fff',
    fontSize: 16,
  },
});
