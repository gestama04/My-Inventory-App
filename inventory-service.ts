import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  getDoc,
  Timestamp,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { addListener, removeListener } from './firestore-listeners';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  uploadString
} from 'firebase/storage';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, storage, auth } from './firebase-config';
import { uploadImage } from './firebase-service';

const isOnline = async () => {
  try {
    // Criar um controller para abortar a requisição após um timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos de timeout
    
    const response = await fetch('https://www.google.com', {
      method: 'HEAD',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId); // Limpar o timeout se a requisição completar
    return response.status === 200;
  } catch (error) {
    console.log('Erro ao verificar conectividade:', error);
    return false;
  }
};

export interface InventoryItem {
  id?: string;
  name: string;
  quantity: string | number;
  category?: string;
  lowStockThreshold?: string;
  photoUrl?: string;
  photo?: string; // Base64 para compatibilidade com código existente
  description?: string;
  price?: string | number;
  createdAt?: any;
  updatedAt?: any;
  userId: string;
}


// Obter itens do utilizador atual
export const getInventoryItems = (callback: (items: InventoryItem[]) => void) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.log('Utilizador não autenticado ao obter itens');
      callback([]);
      return () => {};
    }

    const q = query(
      collection(db, 'inventory'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const items: InventoryItem[] = [];
        snapshot.forEach((doc) => {
          // Certifique-se de que todos os campos necessários estão presentes
          const data = doc.data();
          items.push({ 
            id: doc.id, 
            name: data.name || '',
            quantity: data.quantity || 0,
            category: data.category || '',
            lowStockThreshold: data.lowStockThreshold,
            photoUrl: data.photoUrl,
            photo: data.photo,
            description: data.description,
            price: data.price,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            userId: data.userId
          } as InventoryItem);
        });
        
        // Consolidar itens com o mesmo nome e categoria
        const combinedItems = combineItems(items);
        
        // Retornar os itens combinados
        callback(combinedItems);
      },
      (error) => {
        console.error('Erro ao observar itens:', error);
        // Tentar carregar do cache local em caso de erro
        loadItemsFromCache().then(cachedItems => {
          if (cachedItems.length > 0) {
            // Consolidar os itens do cache também
            const combinedCachedItems = combineItems(cachedItems);
            callback(combinedCachedItems);
          }
        });
      }
    );
    
    // Registrar o listener para poder cancelá-lo mais tarde
    return addListener(unsubscribe);
  } catch (error) {
    console.error('Erro ao configurar listener de itens:', error);
    return () => {};
  }
};


const loadItemsFromCache = async (): Promise<InventoryItem[]> => {
  try {
    const cachedItems = await AsyncStorage.getItem('cachedInventory');
    if (cachedItems) {
      const items = JSON.parse(cachedItems);
      // Consolidar os itens do cache
      return combineItems(items);
    }
    return [];
  } catch (error) {
    console.error('Erro ao carregar itens do cache:', error);
    return [];
  }
};

export const addInventoryItem = async (
  item: Omit<InventoryItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  photo?: string // photo é a string base64
) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Utilizador não autenticado');

    const online = await isOnline();
    if (!online) {
      console.log("Offline: A guardar item localmente...");
      return await saveItemLocally(item, photo, userId);
    }

    // Criar o novo item com a foto base64 incluída diretamente
    const newItemData = {
      ...item,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      photo: photo || null // Salvar a foto base64 diretamente no documento
    };

    console.log("A guardar item no Firestore com foto base64...");
    const docRef = await addDoc(collection(db, 'inventory'), newItemData);
    const newItemId = docRef.id;

    // Adicionar ao histórico
    try {
      await addToHistory({
        name: item.name,
        category: item.category || '',
        quantity: item.quantity,
        action: 'add'
      });
    } catch (historyError) {
      console.warn("Erro ao adicionar ao histórico:", historyError);
    }

    return newItemId; // Retorna o ID do item criado
  } catch (error) {
    console.error('Erro ao adicionar item:', error);
    // Tentar salvar localmente como fallback
    const userId = auth.currentUser?.uid || 'unknown';
    console.log("Erro geral: Tentando salvar item localmente como fallback...");
    return await saveItemLocally(item, photo, userId);
  }
};




// Função para salvar item localmente
const saveItemLocally = async (
  item: Omit<InventoryItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  photo?: string,
  userId?: string
) => {
  try {
    const localItem = {
      ...item,
      photo, // Manter a foto como base64
      userId: userId || 'unknown',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      id: `local_${Date.now()}`
    };
    
    // Obter itens existentes
    const storedItems = await AsyncStorage.getItem("cachedInventory") || '[]';
    const items = JSON.parse(storedItems);
    
    // Adicionar novo item
    items.push(localItem);
    
    // Salvar de volta
    await AsyncStorage.setItem("cachedInventory", JSON.stringify(items));
    
    // Adicionar à fila de sincronização
    const syncQueue = await AsyncStorage.getItem("syncQueue") || '[]';
    const queue = JSON.parse(syncQueue);
    queue.push({
      type: 'add',
      item: localItem,
      timestamp: Date.now()
    });
    await AsyncStorage.setItem("syncQueue", JSON.stringify(queue));
    
    console.log("Item salvo localmente com sucesso");
    return localItem.id;
  } catch (error) {
    console.error("Erro ao salvar item localmente:", error);
    throw new Error("Não foi possível salvar o item nem localmente");
  }
};

// Obter um item específico
export const getInventoryItem = async (itemId: string) => {
  try {
    // Verificar se é um ID local
    if (itemId.startsWith('local_')) {
      const storedItems = await AsyncStorage.getItem("cachedInventory") || '[]';
      const items = JSON.parse(storedItems);
      const localItem = items.find((item: any) => item.id === itemId);
      
      if (localItem) {
        return localItem as InventoryItem;
      }
      throw new Error('Item local não encontrado');
    }
    
    // Tentar obter do Firestore
    const docRef = doc(db, 'inventory', itemId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const item = { id: docSnap.id, ...docSnap.data() } as InventoryItem;
      
      // Buscar todos os itens com o mesmo nome e categoria para combinar as quantidades
      const userId = auth.currentUser?.uid;
      if (userId) {
        const q = query(
          collection(db, 'inventory'),
          where('userId', '==', userId),
          where('name', '==', item.name),
          where('category', '==', item.category || '')
        );
        
        const snapshot = await getDocs(q);
        
        // Se encontramos mais de um item, combinar as quantidades
        if (snapshot.size > 1) {
          let totalQuantity = 0;
          snapshot.forEach((doc) => {
            const itemData = doc.data();
            const quantity = parseInt(itemData.quantity?.toString() || '0');
            totalQuantity += isNaN(quantity) ? 0 : quantity;
          });
          
          // Atualizar a quantidade do item com o total
          item.quantity = totalQuantity.toString();
          console.log(`Item ${item.name} tem quantidade combinada de ${totalQuantity}`);
        }
      }
      
      return item;
    } else {
      throw new Error('Item não encontrado');
    }
  } catch (error) {
    console.error('Erro ao obter item:', error);
    throw error;
  }
};

// Atualizar item existente
export const updateInventoryItem = async (
  itemId: string,
  updatedData: Partial<Omit<InventoryItem, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'photo'>>,
  newPhoto?: string
) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Utilizador não autenticado');

    // Verificar se é um ID local
    if (itemId.startsWith('local_')) {
      console.log("Atualizando item localmente (offline)...");
      return await updateLocalItem(itemId, updatedData, newPhoto);
    }

    // Verificar conectividade
    const online = await isOnline();
    if (!online) {
      console.log("Offline: Atualizando item localmente...");
      return await updateLocalItem(itemId, updatedData, newPhoto);
    }

    // Obter o item atual para o histórico e para saber se tem foto antiga
    console.log("Obtendo item atual para atualização...");
    const currentItem = await getInventoryItem(itemId);
    if (!currentItem) throw new Error('Item original não encontrado para atualização.');

    // Se estamos atualizando a quantidade e o nome/categoria não mudou,
    // primeiro consolidar todos os itens com o mesmo nome e categoria
    if (updatedData.quantity !== undefined) {
      // Se o nome ou categoria estão sendo alterados, não precisamos consolidar
      const nameChanged = updatedData.name !== undefined && updatedData.name !== currentItem.name;
      const categoryChanged = updatedData.category !== undefined && updatedData.category !== currentItem.category;
      
      if (!nameChanged && !categoryChanged) {
        console.log(`Consolidando itens para ${currentItem.name} antes da atualização`);
        
        // Buscar todos os itens com o mesmo nome e categoria
        const q = query(
          collection(db, 'inventory'),
          where('userId', '==', userId),
          where('name', '==', currentItem.name),
          where('category', '==', currentItem.category || '')
        );
        
        const snapshot = await getDocs(q);
        
        // Se encontramos mais de um item, consolidar
        if (snapshot.size > 1) {
          // Usar o primeiro item como base para consolidação
          let baseItemId = itemId;
          let otherItemIds: string[] = [];
          
          snapshot.forEach((doc) => {
            if (doc.id !== itemId) {
              otherItemIds.push(doc.id);
            }
          });
          
          // Deletar os outros itens
          for (const id of otherItemIds) {
            await deleteDoc(doc(db, 'inventory', id));
          }
          
          console.log(`Consolidado ${otherItemIds.length + 1} itens em um único item`);
        }
      }
    }

    const itemRef = doc(db, 'inventory', itemId);
    const updatePayload: any = {
      ...updatedData,
      updatedAt: serverTimestamp()
    };

    // Processar a foto se houver
    if (newPhoto) {
      try {
        console.log("Processando nova foto para atualização...");
        // Verificar se já existe uma foto antiga para deletar
        if (currentItem.photoUrl) {
          console.log("Deletando foto antiga:", currentItem.photoUrl);
          try {
            const oldPhotoRef = ref(storage, currentItem.photoUrl);
            await deleteObject(oldPhotoRef);
          } catch(e: any){
            if (e.code !== 'storage/object-not-found') console.warn("Erro ao deletar foto antiga", e);
          }
        }
    
        // Salvar a foto base64 diretamente no documento
        updatePayload.photo = newPhoto;
        // Limpar a URL da foto, já que estamos usando base64 diretamente
        updatePayload.photoUrl = null;
        
        console.log("Foto salva diretamente no documento como base64");
      } catch (uploadError) {
        console.error(`Erro ao processar a nova imagem:`, uploadError);
      }
    }
    
    // Se não foi enviada nova foto, photoUrl não é incluído no updatePayload
    if (updatedData.hasOwnProperty('photoUrl') && updatedData.photoUrl === undefined) {
       console.log("Removendo photoUrl existente (pedido explícito)...");
       if (currentItem.photoUrl) {
         try {
           const oldPhotoRef = ref(storage, currentItem.photoUrl);
           await deleteObject(oldPhotoRef);
         } catch(e){console.warn("Erro ao deletar foto na remoção explícita:", e)}
       }
       updatePayload.photoUrl = null;
    }

    console.log("Atualizando documento no Firestore...");
    await updateDoc(itemRef, updatePayload);
    console.log("Documento atualizado.");

    const nameChanged = updatedData.name !== undefined && updatedData.name !== currentItem.name;
const categoryChanged = updatedData.category !== undefined && updatedData.category !== currentItem.category;
const quantityChanged = updatedData.quantity !== undefined && updatedData.quantity !== currentItem.quantity;

// Adicionar ao histórico se qualquer campo relevante foi alterado
if (nameChanged || categoryChanged || quantityChanged) {
  try {
    await addToHistory({
      name: updatedData.name || currentItem.name,
      category: updatedData.category || currentItem.category || '',
      quantity: updatedData.quantity?.toString() || currentItem.quantity?.toString() || '0',
      action: 'edit', // Usar 'edit' em vez de 'update'
      previousData: {
        name: currentItem.name,
        category: currentItem.category || '',
        quantity: currentItem.quantity?.toString() || '0'
      }
    });
  } catch (historyError) {
    console.warn("Erro ao adicionar edição ao histórico:", historyError);
  }
}

return true;
  } catch (error) {
    console.error('Erro ao atualizar item:', error);
    return await updateLocalItem(itemId, updatedData, newPhoto);
  }
};

// Função para atualizar item localmente
const updateLocalItem = async (
  itemId: string,
  updatedData: Partial<InventoryItem>,
  newPhoto?: string
) => {
  try {
    // Obter itens existentes
    const storedItems = await AsyncStorage.getItem("cachedInventory") || '[]';
    const items = JSON.parse(storedItems);
    
    // Encontrar o item
    const itemIndex = items.findIndex((item: any) => item.id === itemId);
    
    if (itemIndex === -1) {
      throw new Error('Item não encontrado localmente');
    }
    
    // Atualizar o item
    const updatedItem = {
      ...items[itemIndex],
      ...updatedData,
      updatedAt: Date.now()
    };
    
    // Se tiver nova foto, atualizar
    if (newPhoto) {
      updatedItem.photo = newPhoto;
    }
    
    items[itemIndex] = updatedItem;
    
    // Salvar de volta
    await AsyncStorage.setItem("cachedInventory", JSON.stringify(items));
    
    // Adicionar à fila de sincronização
    const syncQueue = await AsyncStorage.getItem("syncQueue") || '[]';
    const queue = JSON.parse(syncQueue);
    queue.push({
      type: 'update',
      itemId,
      updatedData,
      newPhoto,
      timestamp: Date.now()
    });
    await AsyncStorage.setItem("syncQueue", JSON.stringify(queue));
    
    console.log("Item atualizado localmente com sucesso");
    return true;
  } catch (error) {
    console.error("Erro ao atualizar item localmente:", error);
    throw error;
  }
};

// Deletar item
export const deleteInventoryItem = async (itemId: string) => {
  try {
    // Verificar se é um ID local
    if (itemId.startsWith('local_')) {
      return await deleteLocalItem(itemId);
    }
    
    // Verificar conectividade
    const online = await isOnline();
    if (!online) {
      return await deleteLocalItem(itemId);
    }
    
        // Obter o item para o histórico e para deletar a foto
        const item = await getInventoryItem(itemId);
    
        // Deletar a foto do Storage se existir
        if (item.photoUrl) {
          try {
            const photoRef = ref(storage, item.photoUrl);
            await deleteObject(photoRef);
          }
          catch (error) {
            console.log('Erro ao deletar foto (pode não existir):', error);
          }
        }
    
        // Deletar o documento do Firestore
        await deleteDoc(doc(db, 'inventory', itemId));
        
        // Adicionar ao histórico
        await addToHistory({
          name: item.name,
          category: item.category || '',
          quantity: item.quantity,
          action: 'remove'
        });
        
        return true;
      } catch (error) {
        console.error('Erro ao deletar item:', error);
        
        // Tentar deletar localmente como fallback
        return await deleteLocalItem(itemId);
      }
    };
    
    // Função para deletar item localmente
    const deleteLocalItem = async (itemId: string) => {
      try {
        // Obter itens existentes
        const storedItems = await AsyncStorage.getItem("cachedInventory") || '[]';
        const items = JSON.parse(storedItems);
        
        // Encontrar o item
        const itemIndex = items.findIndex((item: any) => item.id === itemId);
        
        if (itemIndex === -1) {
          throw new Error('Item não encontrado localmente');
        }
        
        // Guardar informações do item para o histórico
        const deletedItem = items[itemIndex];
        
        // Remover o item
        items.splice(itemIndex, 1);
        
        // Salvar de volta
        await AsyncStorage.setItem("cachedInventory", JSON.stringify(items));
        
        // Adicionar à fila de sincronização apenas se não for um item local
        if (!itemId.startsWith('local_')) {
          const syncQueue = await AsyncStorage.getItem("syncQueue") || '[]';
          const queue = JSON.parse(syncQueue);
          queue.push({
            type: 'delete',
            itemId,
            timestamp: Date.now()
          });
          await AsyncStorage.setItem("syncQueue", JSON.stringify(queue));
        }
        
        // Adicionar ao histórico local
        try {
          const historyData = await AsyncStorage.getItem("localItemHistory") || '[]';
          const history = JSON.parse(historyData);
          history.unshift({
            name: deletedItem.name,
            category: deletedItem.category || '',
            quantity: deletedItem.quantity,
            action: 'remove',
            timestamp: Date.now()
          });
          await AsyncStorage.setItem("localItemHistory", JSON.stringify(history));
        } catch (historyError) {
          console.warn("Erro ao adicionar ao histórico local:", historyError);
        }
        
        console.log("Item deletado localmente com sucesso");
        return true;
      } catch (error) {
        console.error("Erro ao deletar item localmente:", error);
        throw error;
      }
    };
    
    // Obter histórico de itens
    export const getItemHistory = async (limitCount?: number) => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Utilizador não autenticado');
    
        // Verificar conectividade
        const online = await isOnline();
        
        if (!online) {
          // Retornar histórico local quando offline
          return await getLocalItemHistory(limitCount);
        }
    
        let q;
        if (limitCount) {
          q = query(
            collection(db, 'itemHistory'),
            where('userId', '==', userId),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
          );
        } else {
          q = query(
            collection(db, 'itemHistory'),
            where('userId', '==', userId),
            orderBy('timestamp', 'desc')
          );
        }
        
        const snapshot = await getDocs(q);
        
        const history: any[] = [];
        snapshot.forEach((doc) => {
          history.push({ id: doc.id, ...doc.data() });
        });
        
        // Salvar em cache para uso offline
        await AsyncStorage.setItem("cachedItemHistory", JSON.stringify(history));
        
        return history;
      } catch (error) {
        console.error('Erro ao obter histórico:', error);
        
        // Tentar obter do cache local em caso de erro
        return await getLocalItemHistory(limitCount);
      }
    };
    
const combineItems = (items: InventoryItem[]): InventoryItem[] => {
  const combinedItems: Record<string, InventoryItem> = {};

  items.forEach(item => {
    // Criar uma chave baseada no nome e categoria (ambos em minúsculas para evitar problemas de case)
    const key = `${item.name.toLowerCase()}-${(item.category || '').toLowerCase()}`;
    
    if (combinedItems[key]) {
      // Se este item já existe, somar as quantidades
      const existingQty = parseInt(combinedItems[key].quantity.toString()) || 0;
      const newQty = parseInt(item.quantity.toString()) || 0;
      combinedItems[key].quantity = (existingQty + newQty).toString();
      
      // Se o item existente não tem ID mas este tem, usar o ID deste
      if (!combinedItems[key].id && item.id) {
        combinedItems[key].id = item.id;
      }
      
      // Se o item existente não tem foto mas este tem, usar a foto deste
      if (!combinedItems[key].photo && !combinedItems[key].photoUrl && (item.photo || item.photoUrl)) {
        combinedItems[key].photo = item.photo;
        combinedItems[key].photoUrl = item.photoUrl;
      }
      
      // Manter o threshold personalizado se existir
      if (!combinedItems[key].lowStockThreshold && item.lowStockThreshold) {
        combinedItems[key].lowStockThreshold = item.lowStockThreshold;
      }
    } else {
      // Primeira vez que vemos este item, adicionar aos itens combinados
      combinedItems[key] = { ...item };
    }
  });

  return Object.values(combinedItems);
};

    // Função para obter histórico local
    const getLocalItemHistory = async (limitCount?: number) => {
      try {
        // Combinar histórico local e em cache
        const cachedHistoryData = await AsyncStorage.getItem("cachedItemHistory") || '[]';
        const localHistoryData = await AsyncStorage.getItem("localItemHistory") || '[]';
        
        const cachedHistory = JSON.parse(cachedHistoryData);
        const localHistory = JSON.parse(localHistoryData);
        
        // Combinar e ordenar por timestamp (mais recente primeiro)
        const combinedHistory = [...localHistory, ...cachedHistory]
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        // Aplicar limite se necessário
        if (limitCount && limitCount > 0) {
          return combinedHistory.slice(0, limitCount);
        }
        
        return combinedHistory;
      } catch (error) {
        console.error('Erro ao obter histórico local:', error);
        return [];
      }
    };
    
    // Adicionar entrada ao histórico
    export const addToHistory = async (historyEntry: any) => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Utilizador não autenticado');
    
        // Verificar conectividade
        const online = await isOnline();
        
        const entry = {
          ...historyEntry,
          userId,
          timestamp: online ? serverTimestamp() : Date.now()
        };
    
        if (online) {
          // Adicionar ao Firestore se online
          await addDoc(collection(db, 'itemHistory'), entry);
        } else {
          // Adicionar ao histórico local se offline
          const historyData = await AsyncStorage.getItem("localItemHistory") || '[]';
          const history = JSON.parse(historyData);
          history.unshift({
            ...entry,
            timestamp: Date.now() // Usar timestamp local
          });
          await AsyncStorage.setItem("localItemHistory", JSON.stringify(history));
          
          // Adicionar à fila de sincronização
          const syncQueue = await AsyncStorage.getItem("syncQueue") || '[]';
          const queue = JSON.parse(syncQueue);
          queue.push({
            type: 'addHistory',
            entry,
            timestamp: Date.now()
          });
          await AsyncStorage.setItem("syncQueue", JSON.stringify(queue));
        }
      } catch (error) {
        console.error('Erro ao adicionar ao histórico:', error);
        
        // Tentar salvar localmente como fallback
        try {
          const historyData = await AsyncStorage.getItem("localItemHistory") || '[]';
          const history = JSON.parse(historyData);
          history.unshift({
            ...historyEntry,
            userId: auth.currentUser?.uid || 'unknown',
            timestamp: Date.now()
          });
          await AsyncStorage.setItem("localItemHistory", JSON.stringify(history));
        } catch (localError) {
          console.error('Erro ao salvar histórico localmente:', localError);
        }
      }
    };
    
    // Obter estatísticas do inventário
    export const getInventoryStats = async () => {
      console.log("[STATS_DEBUG] getInventoryStats: Iniciando...");
      try {
        if (!auth.currentUser) {
          console.log('[STATS_DEBUG] Utilizador não autenticado, retornando stats vazias.');
          return {
            totalItems: 0, totalCategories: 0, lowStockItems: 0, outOfStockItems: 0,
            recentlyAdded: [], categories: [], lowStockItemsList: [], outOfStockItemsList: []
          };
        }
    
        const userId = auth.currentUser.uid;
        console.log(`[STATS_DEBUG] UserID: ${userId}`);
    
        const online = await isOnline(); // Garante que esta função existe e funciona
        console.log(`[STATS_DEBUG] Online: ${online}`);
    
        let items: InventoryItem[] = [];
        let itemsForStatCalculation: InventoryItem[] = []; // Usaremos esta para os cálculos, pode conter base64 temporariamente
    
        if (online) {
          console.log("[STATS_DEBUG] Online: Tentando obter itens do Firestore...");
          try {
            const q = query(collection(db, 'inventory'), where('userId', '==', userId));
            const snapshot = await getDocs(q);
            snapshot.forEach((doc) => {
              items.push({ id: doc.id, ...doc.data() } as InventoryItem);
            });
            itemsForStatCalculation = [...items]; // Copia para os cálculos
            console.log(`[STATS_DEBUG] Firestore retornou ${items.length} itens.`);
    
            try {
              console.log("[STATS_DEBUG] Preparando itens para cachedInventory (AsyncStorage)...");
              // ALTERAÇÃO: Mapear itens para remover o campo 'photo' (base64) antes de salvar no cache
              const itemsForCache = items.map(item => {
                const { photo, ...restOfItem } = item; // Extrai 'photo'
                return { 
                  ...restOfItem, 
                  photoUrl: item.photoUrl // Mantém photoUrl, mas 'photo' (base64) é removido
                                          // Se quiseres um placeholder para saber que havia uma foto base64:
                                          // photo: photo ? "[base64_removed_for_cache]" : undefined 
                };
              });
    
              console.log("[STATS_DEBUG] Tentando salvar itens (sem base64) no cachedInventory...");
              const itemsString = JSON.stringify(itemsForCache);
              console.log(`[STATS_DEBUG] Novo tamanho de cachedInventory a ser salvo: ${itemsString.length} caracteres`);
              await AsyncStorage.setItem("cachedInventory", itemsString);
              console.log("[STATS_DEBUG] cachedInventory salvo com sucesso.");
            } catch (e: any) {
              console.error("[STATS_DEBUG] ERRO ao salvar cachedInventory no AsyncStorage:", e.message, e.code, e);
            }
          } catch (firestoreError: any) {
            console.error("[STATS_DEBUG] ERRO ao obter itens do Firestore:", firestoreError.message, firestoreError.code, firestoreError);
            console.log("[STATS_DEBUG] Tentando carregar do cache após erro Firestore...");
            try {
              const cachedItemsRaw = await AsyncStorage.getItem("cachedInventory") || '[]';
              items = JSON.parse(cachedItemsRaw); // Estes já não terão base64
              itemsForStatCalculation = [...items]; // Usa os itens do cache para cálculo
              console.log(`[STATS_DEBUG] Carregado do cachedInventory (após erro Firestore): ${items.length} itens.`);
            } catch (e: any) {
              console.error("[STATS_DEBUG] ERRO ao carregar cachedInventory (após erro Firestore):", e.message, e.code, e);
              items = [];
              itemsForStatCalculation = [];
            }
          }
        } else { // Offline
          console.log("[STATS_DEBUG] Offline: Tentando obter itens do cachedInventory (AsyncStorage)...");
          try {
            const cachedItemsRaw = await AsyncStorage.getItem("cachedInventory") || '[]';
            items = JSON.parse(cachedItemsRaw); // Estes já não terão base64
            itemsForStatCalculation = [...items]; // Usa os itens do cache para cálculo
            console.log(`[STATS_DEBUG] Carregado do cachedInventory (offline): ${items.length} itens.`);
          } catch (e: any) {
            console.error("[STATS_DEBUG] ERRO ao carregar cachedInventory (offline):", e.message, e.code, e);
            items = [];
            itemsForStatCalculation = [];
          }
        }
    
        if (!online) {
          console.log("[STATS_DEBUG] Offline: Verificando se há estatísticas em cache (inventory_stats)...");
          try {
            const cachedStatsJson = await AsyncStorage.getItem(`inventory_stats_${userId}`);
            if (cachedStatsJson) {
              console.log("[STATS_DEBUG] Estatísticas encontradas em cache (inventory_stats). Retornando.");
              // ALTERAÇÃO: Os itens dentro destas stats cacheadas já devem estar sem base64
              return JSON.parse(cachedStatsJson);
            }
            console.log("[STATS_DEBUG] Nenhuma estatística em cache (inventory_stats) encontrada.");
          } catch (e: any) {
            console.error("[STATS_DEBUG] ERRO ao carregar inventory_stats do AsyncStorage (offline):", e.message, e.code, e);
          }
        }
    
        console.log("[STATS_DEBUG] Obtendo configuração de threshold global...");
        let globalThreshold = '5';
        try {
          // ... (tua lógica para obter globalThreshold, não precisa de alteração aqui) ...
          if (online) {
            const userSettingsDoc = await getDoc(doc(db, 'userSettings', userId));
            if (userSettingsDoc.exists()) {
              globalThreshold = userSettingsDoc.data().globalLowStockThreshold || '5';
            }
          } else {
            const localSettingsRaw = await AsyncStorage.getItem("userSettings");
            if (localSettingsRaw) {
              const settings = JSON.parse(localSettingsRaw);
              globalThreshold = settings.globalLowStockThreshold || '5';
            }
          }
          console.log(`[STATS_DEBUG] Global threshold definido para: ${globalThreshold}`);
        } catch (settingsError: any) {
          console.warn("[STATS_DEBUG] Erro ao obter configurações do utilizador (threshold):", settingsError.message, settingsError.code, settingsError);
        }
        
        // Usa 'itemsForStatCalculation' que pode ter base64 se online, ou não se offline/cache
        console.log("[STATS_DEBUG] Calculando estatísticas com base em " + itemsForStatCalculation.length + " itens (em memória)...");
        const categoriesSet = new Set<string>();
        itemsForStatCalculation.forEach(item => {
          if (item.category) categoriesSet.add(item.category);
        });
    
        const totalQuantity = itemsForStatCalculation.reduce((sum, item) => {
          const quantity = parseInt(item.quantity?.toString() || '0');
          return sum + (isNaN(quantity) ? 0 : quantity);
        }, 0);
    
        // A TUA LÓGICA ORIGINAL DE FILTRO DEVE ESTAR AQUI
        const combinedItems = combineItems(itemsForStatCalculation);

// Depois, filtre os itens combinados para encontrar aqueles com estoque baixo
const lowStockItems = combinedItems.filter(item => {
  const quantity = parseInt(item.quantity?.toString() || '0');
  
  // First check if item has a custom threshold
  if (item.lowStockThreshold !== undefined) {
    const customThreshold = parseInt(item.lowStockThreshold);
    // Only consider as low stock if the custom threshold is greater than 0
    if (!isNaN(customThreshold) && customThreshold > 0) {
      return quantity <= customThreshold && quantity > 0;
    }
  }
  
  // If we get here, use the global threshold
  // Only consider as low stock if the global threshold is greater than 0
  const globalThresholdValue = parseInt(globalThreshold);
  return globalThresholdValue > 0 && quantity <= globalThresholdValue && quantity > 0;
});

// Também filtre os itens sem estoque a partir dos itens combinados
const outOfStockItems = combinedItems.filter(item => {
  const quantity = parseInt(item.quantity?.toString() || '0');
  return quantity === 0;
});
        console.log(`[STATS_DEBUG] Itens com stock baixo (cálculo): ${lowStockItems.length}, Sem stock (cálculo): ${outOfStockItems.length}`);
    
    
        console.log("[STATS_DEBUG] Obtendo itens adicionados recentemente do inventário...");
let recentlyAddedFromHistory: InventoryItem[] = [];

try {
  // Em vez de buscar do histórico, pegar os 5 itens mais recentes do inventário
  const recentlyAdded = itemsForStatCalculation
    .sort((a, b) => {
      // Ordenar por createdAt se existir, senão por updatedAt
      const aTime = a.createdAt?.toDate?.() || a.updatedAt?.toDate?.() || new Date(0);
      const bTime = b.createdAt?.toDate?.() || b.updatedAt?.toDate?.() || new Date(0);
      return bTime.getTime() - aTime.getTime();
    })
    .slice(0, 5);

  recentlyAddedFromHistory = recentlyAdded.map(item => ({
    id: item.id || `recent_${Date.now()}_${Math.random()}`,
    name: item.name || 'Item sem nome',
    quantity: item.quantity || '0',
    category: item.category || 'Sem categoria',
    price: item.price,
    lowStockThreshold: item.lowStockThreshold,
    description: item.description,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    photoUrl: item.photoUrl,
    photo: item.photo,
    userId: userId,
  } as InventoryItem));

  console.log(`[STATS_DEBUG] ${recentlyAddedFromHistory.length} itens mais recentes do inventário encontrados.`);
} catch (error: any) {
  console.warn("[STATS_DEBUG] Erro ao obter itens recentes do inventário:", error.message);
  recentlyAddedFromHistory = [];
}

    
        // ALTERAÇÃO: Preparar listas para o objeto stats SEM base64
        const mapToLightItem = (item: InventoryItem): Omit<InventoryItem, 'photo'> & { photoUrl?: string } => {
      const { photo, ...rest } = item; // Remove 'photo' (base64)
      return { ...rest, photoUrl: item.photoUrl }; // Mantém photoUrl
    };

    // 1. Crie o objeto 'statsToReturnToUI'. Este é o que sua função retornará.
    //    Para 'recentlyAdded', use 'recentlyAddedFromHistory' diretamente.
    const statsToReturnToUI = {
      totalItems: totalQuantity,
      totalCategories: categoriesSet.size,
      lowStockItems: lowStockItems?.length || 0,
      outOfStockItems: outOfStockItems?.length || 0,
      recentlyAdded: recentlyAddedFromHistory, // << USA a lista que PODE conter 'photo' (base64)
      categories: Array.from(categoriesSet),
      // Para estas listas, o HomeScreen usa getCategoryIcon local, então elas podem continuar leves
      lowStockItemsList: lowStockItems.map(mapToLightItem),   
      outOfStockItemsList: outOfStockItems.map(mapToLightItem) 
    };
    
    // 2. Crie uma versão "LEVE" deste objeto APENAS PARA SALVAR NO ASYNCSTORAGE
    //    Esta versão terá 'photo' (base64) removido de 'recentlyAdded'.
    console.log("[STATS_DEBUG] Preparando estatísticas leves para salvar no AsyncStorage (`inventory_stats_...`)...");
    try {
      const statsForAsyncStorageCache = {
        ...statsToReturnToUI, // Começa com todos os dados do objeto que vai para a UI
        // AGORA, para a chave 'recentlyAdded' DESTE OBJETO DE CACHE, 
        // aplique mapToLightItem para remover a base64
        recentlyAdded: statsToReturnToUI.recentlyAdded.map(item => mapToLightItem(item)), 
      };

      const statsStringForCache = JSON.stringify(statsForAsyncStorageCache);
      console.log(`[STATS_DEBUG] Tamanho das stats (leves) a serem salvas no AsyncStorage: ${statsStringForCache.length} caracteres`);
      await AsyncStorage.setItem(`inventory_stats_${userId}`, statsStringForCache);
      console.log("[STATS_DEBUG] Estatísticas (leves) salvas no AsyncStorage com sucesso.");
    } catch (statsCacheError: any) {
      console.error("[STATS_DEBUG] ERRO ao salvar estatísticas (leves) no AsyncStorage:", statsCacheError.message);
    }
    
    console.log("[STATS_DEBUG] getInventoryStats: Retornando stats para a UI (recentlyAdded pode conter base64).");
    return statsToReturnToUI; // << RETORNA O OBJETO ORIGINAL PARA A UI

  } catch (error: any) { // Bloco catch geral de getInventoryStats
    console.error('[STATS_DEBUG] Erro GERAL dentro de getInventoryStats:', error.message, error.code, error);
    // Retorno padrão em caso de erro geral
    return {
      totalItems: 0, totalCategories: 0, lowStockItems: 0, outOfStockItems: 0,
      recentlyAdded: [], categories: [], lowStockItemsList: [], outOfStockItemsList: []
    };
  }
};
    
    // Salvar configurações do utilizador
    export const saveUserSettings = async (settings: any) => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Utilizador não autenticado');
        
        // Verificar conectividade
        const online = await isOnline();
        
        // Salvar localmente em todos os casos
        await AsyncStorage.setItem("userSettings", JSON.stringify({
          ...settings,
          userId,
          updatedAt: Date.now()
        }));
        
        if (!online) {
          // Se offline, adicionar à fila de sincronização
          const syncQueue = await AsyncStorage.getItem("syncQueue") || '[]';
          const queue = JSON.parse(syncQueue);
          queue.push({
            type: 'saveSettings',
            settings,
            timestamp: Date.now()
          });
          await AsyncStorage.setItem("syncQueue", JSON.stringify(queue));
          return true;
        }
        
        // Se online, tentar salvar no Firestore
        try {
          await updateDoc(doc(db, 'userSettings', userId), {
            ...settings,
            updatedAt: serverTimestamp()
          });
          return true;
        } catch (error) {
          // Se o documento não existir, crie-o
          if (error instanceof Error && error.message.includes('No document to update')) {
            await setDoc(doc(db, 'userSettings', userId), {
              userId,
              ...settings,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            return true;
          }          
          throw error;
        }
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    throw error;
  }
};

// Obter configurações do Utilizador

export const getUserSettings = async () => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Utilizador não autenticado');
    
    // Verificar conectividade
    const online = await isOnline();
    
    // Se offline, usar configurações locais
    if (!online) {
      const localSettings = await AsyncStorage.getItem("userSettings");
      if (localSettings) {
        return JSON.parse(localSettings);
      }
      
      // Se não houver configurações locais, usar padrão
      const defaultSettings = {
        globalLowStockThreshold: '5',
        darkMode: false,
        notificationsEnabled: true
      };
      
      // Salvar localmente
      await AsyncStorage.setItem("userSettings", JSON.stringify({
        ...defaultSettings,
        userId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }));
      
      return defaultSettings;
    }
    
    // Se online, tentar obter do Firestore
   // Se online, tentar obter do Firestore
const q = query(collection(db, 'userSettings'), where('userId', '==', userId));
const snapshot = await getDocs(q);

    
    if (!snapshot.empty) {
      const settings = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      
      // Salvar em cache para uso offline
      await AsyncStorage.setItem("userSettings", JSON.stringify(settings));
      
      return settings;
    } else {
      // Criar configurações padrão se não existirem
      const defaultSettings = {
        globalLowStockThreshold: '5',
        darkMode: false,
        notificationsEnabled: true
      };
      
      // Salvar no Firestore
      await saveUserSettings(defaultSettings);
      
      // Salvar localmente
      await AsyncStorage.setItem("userSettings", JSON.stringify({
        ...defaultSettings,
        userId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }));
      
      return defaultSettings;
    }
  } catch (error) {
    console.error('Erro ao obter configurações:', error);
    
    // Em caso de erro, tentar obter configurações locais
    try {
      const localSettings = await AsyncStorage.getItem("userSettings");
      if (localSettings) {
        return JSON.parse(localSettings);
      }
    } catch (localError) {
      console.error('Erro ao obter configurações locais:', localError);
    }
    
    // Se tudo falhar, retornar configurações padrão
    return {
      globalLowStockThreshold: '5',
      darkMode: false,
      notificationsEnabled: true
    };
  }
};

// Sincronizar dados offline quando voltar online
export const syncOfflineData = async () => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    
    // Verificar se está online
    const online = await isOnline();
    if (!online) return;
    
    console.log("Iniciando sincronização de dados offline...");
    
    // Obter fila de sincronização
    const syncQueueData = await AsyncStorage.getItem("syncQueue");
    if (!syncQueueData) return;
    
    const syncQueue = JSON.parse(syncQueueData);
    if (!syncQueue.length) return;
    
    // Processar cada item na fila
    const newQueue = [];
    
    for (const item of syncQueue) {
      try {
        switch (item.type) {
          case 'add':
            // Adicionar item ao Firestore
            await processAddItem(item.item);
            break;
            
          case 'update':
            // Atualizar item no Firestore
            await processUpdateItem(item.itemId, item.updatedData, item.newPhoto);
            break;
            
          case 'delete':
            // Deletar item do Firestore
            await processDeleteItem(item.itemId);
            break;
            
          case 'addHistory':
            // Adicionar ao histórico
            await processAddHistory(item.entry);
            break;
            
          case 'saveSettings':
            // Salvar configurações
            await processSaveSettings(item.settings);
            break;
            
          default:
            // Item desconhecido, manter na fila
            newQueue.push(item);
        }
      } catch (error) {
        console.error(`Erro ao processar item de sincronização (${item.type}):`, error);
        // Manter na fila para tentar novamente mais tarde
        newQueue.push(item);
      }
    }
    
    // Salvar a nova fila (itens que falharam)
    await AsyncStorage.setItem("syncQueue", JSON.stringify(newQueue));
    
    console.log(`Sincronização concluída. ${syncQueue.length - newQueue.length} itens processados, ${newQueue.length} itens pendentes.`);
    
    // Processar uploads de imagens pendentes
    await syncPendingImageUploads();
    
  } catch (error) {
    console.error('Erro ao sincronizar dados offline:', error);
  }
};

// Processar adição de item
const processAddItem = async (item: any) => {
  console.log("Sync: Processando adição de item offline:", item.name);
  // Remover ID local e photo base64 temporariamente
  const { id, photo, ...itemData } = item;
  const userId = itemData.userId || auth.currentUser?.uid; // Garante userId
  if (!userId) {
    console.error("Sync: UserID não encontrado para adição offline.");
    throw new Error("UserID não encontrado para sync");
  }

  // Adicionar item ao Firestore sem a foto
  const newItemData = {
    ...itemData,
    userId, // Garante que o userId está correto
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    photoUrl: '' // Começa sem photoUrl
  };
  const docRef = await addDoc(collection(db, 'inventory'), newItemData);
  console.log("Sync: Item adicionado ao Firestore, ID:", docRef.id);

  // Se havia foto base64, fazer upload agora
  if (photo) {
    try {
      console.log("Sync: Tentando upload da foto para item adicionado offline (via uploadString)...");
  
      const filename = `${Date.now()}-${item.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.jpg`;
      const storageRef = ref(storage, `items/${userId}/${filename}`);
      
      // Garantir que a foto é uma string base64 válida
      const base64Data = photo.includes('base64,') ? photo.split('base64,')[1] : photo;
      
      const uploadResult = await uploadString(storageRef, base64Data, 'base64', { contentType: 'image/jpeg' });
      const photoUrl = await getDownloadURL(uploadResult.ref);
      console.log("Sync: Upload da foto concluído, URL:", photoUrl);
  
      // Atualizar o documento recém-criado com a photoUrl
      await updateDoc(docRef, { photoUrl });
      console.log("Sync: Documento atualizado com photoUrl.");
    } catch (uploadError) {
      console.error(`Sync: Erro no upload da imagem para ${item.name}:`, uploadError);
      throw uploadError; // Faz com que o item da syncQueue não seja removido
    }
  }
};


// Processar atualização de item
const processUpdateItem = async (itemId: string, updatedData: any, newPhoto?: string) => {
  console.log("Sync: Processando atualização de item offline:", itemId);
  // Ignorar se for um ID local (não deveria estar na fila de sync)
  if (itemId.startsWith('local_')) {
    console.warn("Sync: Tentando processar update de item com ID local, ignorando:", itemId);
    return;
  }
  const userId = auth.currentUser?.uid; // Precisa do userId para o path da foto
  if (!userId) throw new Error("UserID não encontrado para sync");

  const updatePayload: any = {
    ...updatedData,
    updatedAt: serverTimestamp()
  };

  // Se tiver nova foto base64
  if (newPhoto) {
    try {
      console.log("Sync: Tentando upload da nova foto para item atualizado offline (via uploadString)...");
      // Obter item atual para saber se tem foto antiga
      const currentItemSnap = await getDoc(doc(db, 'inventory', itemId));
      if (currentItemSnap.exists() && currentItemSnap.data().photoUrl) {
         console.log("Sync: Deletando foto antiga:", currentItemSnap.data().photoUrl);
         try {
           const oldPhotoRef = ref(storage, currentItemSnap.data().photoUrl);
           await deleteObject(oldPhotoRef);
         } catch(e: any){
            if (e.code !== 'storage/object-not-found') console.warn("Sync: Erro ao deletar foto antiga", e);
         }
      }
  
      const filename = `${Date.now()}-${(updatedData.name || currentItemSnap.data()?.name || 'item').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.jpg`;
      const storageRef = ref(storage, `items/${userId}/${filename}`);
  
      // Garantir que a foto é uma string base64 válida
      const base64Data = newPhoto.includes('base64,') ? newPhoto.split('base64,')[1] : newPhoto;
      
      const uploadResult = await uploadString(storageRef, base64Data, 'base64', { contentType: 'image/jpeg' });
      const photoUrl = await getDownloadURL(uploadResult.ref);
      console.log("Sync: Upload da nova foto concluído, URL:", photoUrl);
  
      updatePayload.photoUrl = photoUrl; // Adiciona a nova URL ao payload

    } catch (uploadError) {
      console.error(`Sync: Erro no upload da nova imagem para ${itemId}:`, uploadError);
      throw uploadError; // Faz com que o item da syncQueue não seja removido
    }
  } else if (updatedData.hasOwnProperty('photoUrl') && updatedData.photoUrl === undefined) {
    // Lógica para remover a foto explicitamente durante o sync (se necessário)
    console.log("Sync: Removendo photoUrl existente (pedido explícito)...");
     const currentItemSnap = await getDoc(doc(db, 'inventory', itemId));
     if (currentItemSnap.exists() && currentItemSnap.data().photoUrl) {
         try {
           const oldPhotoRef = ref(storage, currentItemSnap.data().photoUrl);
           await deleteObject(oldPhotoRef);
         } catch(e){console.warn("Sync: Erro ao deletar foto na remoção explícita:", e)}
     }
     updatePayload.photoUrl = null; // Define como null no Firestore
  }

  // Atualizar o documento no Firestore
  console.log("Sync: Atualizando documento no Firestore...");
  await updateDoc(doc(db, 'inventory', itemId), updatePayload);
  console.log("Sync: Documento atualizado.");
};

// Processar exclusão de item
const processDeleteItem = async (itemId: string) => {
  // Ignorar se for um ID local
  if (itemId.startsWith('local_')) return;

  // Verificar se o item ainda existe
  try {
    const docRef = doc(db, 'inventory', itemId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      // Deletar a foto do Storage se existir
      const item = docSnap.data();
      if (item.photoUrl) {
        try {
          const photoRef = ref(storage, item.photoUrl);
          await deleteObject(photoRef);
        } catch (error) {
          console.log('Erro ao deletar foto (pode não existir):', error);
        }
      }
      
      // Deletar o documento do Firestore
      await deleteDoc(docRef);
    }
  } catch (error) {
    console.error('Erro ao verificar/deletar item:', error);
    throw error;
  }
};

// Processar adição ao histórico
const processAddHistory = async (entry: any) => {
  await addDoc(collection(db, 'itemHistory'), {
    ...entry,
    timestamp: serverTimestamp()
  });
};

// Processar salvamento de configurações
const processSaveSettings = async (settings: any) => {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('Utilizador não autenticado');

  try {
    await updateDoc(doc(db, 'userSettings', userId), {
      ...settings,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    // Se o documento não existir, crie-o
    if (error instanceof Error && error.message.includes('No document to update')) {
      await addDoc(collection(db, 'userSettings'), {
        userId,
        ...settings,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      throw error;
    }
  }
};

// Sincronizar uploads de imagens pendentes
export const syncPendingImageUploads = async () => {
  try {
    const userId = auth.currentUser?.uid; // Precisa do userId
    if (!userId) {
       console.log("Sync Uploads: Utilizador não autenticado.");
       return; // Não pode fazer upload sem user ID
    }

    const pendingUploadsData = await AsyncStorage.getItem('pendingImageUploads');
    if (!pendingUploadsData) return;

    const pendingUploads = JSON.parse(pendingUploadsData);
    if (!pendingUploads.length) return;

    console.log(`Sync Uploads: Processando ${pendingUploads.length} uploads de imagens pendentes...`);

    const remainingUploads = []; // Guarda os que falharem

    for (const upload of pendingUploads) {
      try {
        const { itemId, photo } = upload; // userId já temos acima

        // Verificar se o item ainda existe no Firestore
        const docRef = doc(db, 'inventory', itemId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          console.log(`Sync Uploads: Fazendo upload da foto para item ${itemId} (via uploadString)...`);
        
          // Deletar foto antiga se existir (opcional, mas bom para limpar)
          if (docSnap.data().photoUrl) {
            try {
              const oldPhotoRef = ref(storage, docSnap.data().photoUrl);
              await deleteObject(oldPhotoRef);
            } catch(e: any){
              if (e.code !== 'storage/object-not-found') console.warn("Sync Uploads: Erro ao deletar foto antiga", e);
            }
          }
        
          const filename = `${Date.now()}-${(docSnap.data()?.name || 'item').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.jpg`;
          const storageRef = ref(storage, `items/${userId}/${filename}`);
        
          // Garantir que a foto é uma string base64 válida
          const base64Data = photo.includes('base64,') ? photo.split('base64,')[1] : photo;
          
          // Upload da string base64
          const uploadResult = await uploadString(storageRef, base64Data, 'base64', { contentType: 'image/jpeg' });
          
          // Obter a URL de download
          const photoUrl = await getDownloadURL(uploadResult.ref);
          console.log(`Sync Uploads: Upload concluído para ${itemId}, URL: ${photoUrl}`);
        
          // Atualizar o documento com a URL da foto
          await updateDoc(docRef, { photoUrl, updatedAt: serverTimestamp() });
          console.log(`Sync Uploads: Documento ${itemId} atualizado com photoUrl.`);

        } else {
          console.log(`Sync Uploads: Item ${itemId} não encontrado no Firestore, ignorando upload pendente.`);
          // Item foi deletado enquanto a foto estava pendente, não faz upload
        }
      } catch (error) {
        console.error(`Sync Uploads: Erro ao processar upload pendente para ${upload.itemId}:`, error);
        // Manter na lista para tentar novamente mais tarde
        remainingUploads.push(upload);
      }
    }

    // Salvar os uploads restantes que falharam
    await AsyncStorage.setItem('pendingImageUploads', JSON.stringify(remainingUploads));

    console.log(`Sync Uploads: Processamento concluído. ${pendingUploads.length - remainingUploads.length} processados, ${remainingUploads.length} pendentes.`);
  } catch (error) {
    console.error('Erro geral ao sincronizar uploads pendentes:', error);
  }
};
export const consolidateInventoryItems = async () => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.log('Utilizador não autenticado ao consolidar itens');
      return false;
    }

    // Obter todos os itens do usuário
    const q = query(
      collection(db, 'inventory'),
      where('userId', '==', userId)
    );
    
    const snapshot = await getDocs(q);
    
    // Agrupar itens por nome e categoria
    const groupedItems: Record<string, {items: InventoryItem[], totalQuantity: number}> = {};
    
    snapshot.forEach((doc) => {
      // Explicitamente tipar os dados do documento como InventoryItem
      const item = { id: doc.id, ...doc.data() } as InventoryItem;
      const key = `${item.name.toLowerCase()}-${(item.category || '').toLowerCase()}`;
      
      if (!groupedItems[key]) {
        groupedItems[key] = { items: [], totalQuantity: 0 };
      }
      
      groupedItems[key].items.push(item);
      groupedItems[key].totalQuantity += parseInt(item.quantity?.toString() || '0');
    });
    
    // Para cada grupo com mais de um item, consolidar em um único item
    for (const key in groupedItems) {
      const group = groupedItems[key];
      
      if (group.items.length > 1) {
        console.log(`Consolidando ${group.items.length} itens para ${group.items[0].name}`);
        
        // Usar o primeiro item como base
        const baseItem = group.items[0];
        
        // Verificar se o ID existe antes de atualizar
        if (baseItem.id) {
          // Atualizar a quantidade do primeiro item para o total
          await updateDoc(doc(db, 'inventory', baseItem.id), {
            quantity: group.totalQuantity.toString(),
            updatedAt: serverTimestamp()
          });
          
          // Excluir os outros itens
          for (let i = 1; i < group.items.length; i++) {
            const itemToDelete = group.items[i];
            if (itemToDelete.id) {
              await deleteDoc(doc(db, 'inventory', itemToDelete.id));
            } else {
              console.warn('Item sem ID encontrado durante a consolidação, não pode ser excluído:', itemToDelete);
            }
          }
        } else {
          console.error('Item base sem ID encontrado durante a consolidação, não pode ser atualizado:', baseItem);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao consolidar itens:', error);
    return false;
  }
};
