import { supabase } from './supabase-config';
import { 
  uploadImageToCloudinary, 
  deleteImageFromCloudinary 
} from './cloudinary-service';
import { addListener } from './supabase-listeners';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RealtimeChannel } from '@supabase/supabase-js';

// ============================================
// VERIFICAR CONECTIVIDADE
// ============================================
const isOnline = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('https://www.google.com', {
      method: 'HEAD',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.status === 200;
  } catch (error) {
    console.log('Erro ao verificar conectividade:', error);
    return false;
  }
};

// ============================================
// TIPOS
// ============================================
export interface InventoryItem {
  id?: string;
  name: string;
  quantity: string | number;
  category?: string;
  lowStockThreshold?: string;
  photoUrl?: string;
  photo_public_id?: string;
  photo?: string;
  description?: string;
  price?: string | number;
  createdAt?: any;
  updatedAt?: any;
  userId: string;
  user_id?: string;
}

// Converter item do Supabase para formato da app
const convertFromSupabase = (item: any): InventoryItem => ({
  id: item.id,
  name: item.name,
  quantity: item.quantity?.toString() || '0',
  category: item.category,
  lowStockThreshold: item.low_stock_threshold?.toString(),
  photoUrl: item.photo_url,
  photo_public_id: item.photo_public_id,
  photo: item.photo,
  description: item.description,
  price: item.price,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
  userId: item.user_id,
  user_id: item.user_id,
});

// Converter item da app para formato do Supabase
const convertToSupabase = (item: Partial<InventoryItem>, userId: string) => ({
  name: item.name,
  quantity: parseInt(item.quantity?.toString() || '0'),
  category: item.category || null,
  low_stock_threshold: item.lowStockThreshold ? parseInt(item.lowStockThreshold) : null,
  photo_url: item.photoUrl || null,
  photo_public_id: item.photo_public_id || null,
  description: item.description || null,
  price: item.price ? parseFloat(item.price.toString()) : null,
  user_id: userId,
});

// ============================================
// OBTER UTILIZADOR ATUAL
// ============================================
const getCurrentUserId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
};

// ============================================
// COMBINAR ITENS (mesma lógica)
// ============================================
const combineItems = (items: InventoryItem[]): InventoryItem[] => {
  const combinedItems: Record<string, InventoryItem> = {};

  items.forEach(item => {
    const key = `${item.name.toLowerCase()}-${(item.category || '').toLowerCase()}`;
    
    if (combinedItems[key]) {
      const existingQty = parseInt(combinedItems[key].quantity.toString()) || 0;
      const newQty = parseInt(item.quantity.toString()) || 0;
      combinedItems[key].quantity = (existingQty + newQty).toString();
      
      if (!combinedItems[key].id && item.id) {
        combinedItems[key].id = item.id;
      }
      
      if (!combinedItems[key].photo && !combinedItems[key].photoUrl && (item.photo || item.photoUrl)) {
        combinedItems[key].photo = item.photo;
        combinedItems[key].photoUrl = item.photoUrl;
      }
      
      if (!combinedItems[key].lowStockThreshold && item.lowStockThreshold) {
        combinedItems[key].lowStockThreshold = item.lowStockThreshold;
      }
    } else {
      combinedItems[key] = { ...item };
    }
  });

  return Object.values(combinedItems);
};

// ============================================
// OBTER ITENS COM REALTIME
// ============================================
let inventoryChannel: RealtimeChannel | null = null;

export const getInventoryItems = (callback: (items: InventoryItem[]) => void) => {
  const setupSubscription = async () => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        console.log('Utilizador não autenticado ao obter itens');
        callback([]);
        return () => {};
      }

      // Obter itens iniciais
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, quantity, category, low_stock_threshold, photo_url, photo_public_id, description, user_id, created_at, updated_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao obter itens:', error);
        const cachedItems = await loadItemsFromCache();
        callback(combineItems(cachedItems));
        return () => {};
      }

      const items = (data || []).map(convertFromSupabase);
      const combinedItems = combineItems(items);
      callback(combinedItems);

      // Guardar no cache
      await saveItemsToCache(items);

      // Configurar Realtime
      if (inventoryChannel) {
        supabase.removeChannel(inventoryChannel);
      }

      inventoryChannel = supabase
        .channel('inventory-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'inventory_items',
            filter: `user_id=eq.${userId}`,
          },
          async (payload) => {
            console.log('Realtime change:', payload.eventType);
            
            // Recarregar todos os itens
            const { data: newData } = await supabase
              .from('inventory_items')
              .select('id, name, quantity, category, low_stock_threshold, photo_url, photo_public_id, description, user_id, created_at, updated_at')
              .eq('user_id', userId)
              .order('created_at', { ascending: false });

            if (newData) {
              const newItems = newData.map(convertFromSupabase);
              callback(combineItems(newItems));
              await saveItemsToCache(newItems);
            }
          }
        )
        .subscribe();

      return () => {
        if (inventoryChannel) {
          supabase.removeChannel(inventoryChannel);
          inventoryChannel = null;
        }
      };
    } catch (error) {
      console.error('Erro ao configurar listener de itens:', error);
      const cachedItems = await loadItemsFromCache();
      callback(combineItems(cachedItems));
      return () => {};
    }
  };

  let unsubscribe: (() => void) | null = null;
  
  setupSubscription().then(unsub => {
    unsubscribe = unsub;
  });

  return addListener(() => {
    if (unsubscribe) unsubscribe();
  });
};

// ============================================
// CACHE LOCAL
// ============================================
const loadItemsFromCache = async (): Promise<InventoryItem[]> => {
  try {
    const cachedItems = await AsyncStorage.getItem('cachedInventory');
    if (cachedItems) {
      return JSON.parse(cachedItems);
    }
    return [];
  } catch (error) {
    console.error('Erro ao carregar itens do cache:', error);
    return [];
  }
};

const saveItemsToCache = async (items: InventoryItem[]): Promise<void> => {
  try {
    const itemsForCache = items.map(item => {
      const { photo, ...rest } = item;
      return rest;
    });
    await AsyncStorage.setItem('cachedInventory', JSON.stringify(itemsForCache));
  } catch (error) {
    console.error('Erro ao salvar itens no cache:', error);
  }
};

// ============================================
// ADICIONAR ITEM
// ============================================
export const addInventoryItem = async (
  item: Omit<InventoryItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  photo?: string
) => {
  try {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Utilizador não autenticado');

    const online = await isOnline();
    if (!online) {
      console.log("Offline: A guardar item localmente...");
      return await saveItemLocally(item, photo, userId);
    }

    let photoUrl: string | null = null;
    let photoPublicId: string | null = null;

    // Upload da foto para Cloudinary se existir
    if (photo) {
      try {
        const uploadResult = await uploadImageToCloudinary(photo, `inventory/${userId}`);
        photoUrl = uploadResult.secure_url;
        photoPublicId = uploadResult.public_id;
      } catch (uploadError) {
        console.error('Erro ao fazer upload da foto:', uploadError);
      }
    }

    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        ...convertToSupabase(item, userId),
        photo_url: photoUrl,
        photo_public_id: photoPublicId,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Erro ao adicionar item:', error);
      throw error;
    }

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

    return data.id;
  } catch (error) {
    console.error('Erro ao adicionar item:', error);
    const userId = await getCurrentUserId() || 'unknown';
    return await saveItemLocally(item, photo, userId);
  }
};

// Salvar item localmente
const saveItemLocally = async (
  item: Omit<InventoryItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  photo?: string,
  userId?: string
) => {
  try {
    const localItem = {
      ...item,
      photo,
      userId: userId || 'unknown',
      user_id: userId || 'unknown',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      id: `local_${Date.now()}`
    };
    
    const storedItems = await AsyncStorage.getItem("cachedInventory") || '[]';
    const items = JSON.parse(storedItems);
    items.push(localItem);
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

// ============================================
// OBTER UM ITEM
// ============================================
export const getInventoryItem = async (itemId: string): Promise<InventoryItem> => {
  try {
    if (itemId.startsWith('local_')) {
      const storedItems = await AsyncStorage.getItem("cachedInventory") || '[]';
      const items = JSON.parse(storedItems);
      const localItem = items.find((item: any) => item.id === itemId);
      
      if (localItem) {
        return localItem as InventoryItem;
      }
      throw new Error('Item local não encontrado');
    }
    
    const { data, error } = await supabase
      .from('inventory_items')
      .select('id, name, quantity, category, low_stock_threshold, photo_url, photo_public_id, description, user_id, created_at, updated_at')
      .eq('id', itemId)
      .single();

    if (error) {
      console.error('Erro ao obter item:', error);
      throw error;
    }

    return convertFromSupabase(data);
  } catch (error) {
    console.error('Erro ao obter item:', error);
    throw error;
  }
};

// ============================================
// ATUALIZAR ITEM
// ============================================
export const updateInventoryItem = async (
  itemId: string,
  updatedData: Partial<Omit<InventoryItem, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'photo'>>,
  newPhoto?: string
) => {
  try {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Utilizador não autenticado');

    if (itemId.startsWith('local_')) {
      return await updateLocalItem(itemId, updatedData, newPhoto);
    }

    const online = await isOnline();
    if (!online) {
      return await updateLocalItem(itemId, updatedData, newPhoto);
    }

    const currentItem = await getInventoryItem(itemId);
    if (!currentItem) throw new Error('Item original não encontrado para atualização.');

    let photoUrl = currentItem.photoUrl;
    let photoPublicId = currentItem.photo_public_id;

    // Processar nova foto
    if (newPhoto) {
      try {
        // Deletar foto antiga do Cloudinary
        if (currentItem.photo_public_id) {
          await deleteImageFromCloudinary(currentItem.photo_public_id);
        }
        
        const uploadResult = await uploadImageToCloudinary(newPhoto, `inventory/${userId}`);
        photoUrl = uploadResult.secure_url;
        photoPublicId = uploadResult.public_id;
      } catch (uploadError) {
        console.error('Erro ao fazer upload da nova foto:', uploadError);
      }
    }

    const { error } = await supabase
      .from('inventory_items')
      .update({
        name: updatedData.name ?? currentItem.name,
        quantity: parseInt(updatedData.quantity?.toString() || currentItem.quantity.toString()),
        category: updatedData.category ?? currentItem.category,
        low_stock_threshold: updatedData.lowStockThreshold 
          ? parseInt(updatedData.lowStockThreshold) 
          : currentItem.lowStockThreshold ? parseInt(currentItem.lowStockThreshold) : null,
        description: updatedData.description ?? currentItem.description,
        price: updatedData.price ? parseFloat(updatedData.price.toString()) : currentItem.price,
        photo_url: photoUrl,
        photo_public_id: photoPublicId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId);

    if (error) {
      console.error('Erro ao atualizar item:', error);
      throw error;
    }

    // Adicionar ao histórico
    const nameChanged = updatedData.name !== undefined && updatedData.name !== currentItem.name;
    const categoryChanged = updatedData.category !== undefined && updatedData.category !== currentItem.category;
    const quantityChanged = updatedData.quantity !== undefined && updatedData.quantity !== currentItem.quantity;

    if (nameChanged || categoryChanged || quantityChanged) {
      try {
        await addToHistory({
          name: updatedData.name || currentItem.name,
          category: updatedData.category || currentItem.category || '',
          quantity: updatedData.quantity?.toString() || currentItem.quantity?.toString() || '0',
          action: 'edit',
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

// Atualizar item localmente
const updateLocalItem = async (
  itemId: string,
  updatedData: Partial<InventoryItem>,
  newPhoto?: string
) => {
  try {
    const storedItems = await AsyncStorage.getItem("cachedInventory") || '[]';
    const items = JSON.parse(storedItems);
    
    const itemIndex = items.findIndex((item: any) => item.id === itemId);
    
    if (itemIndex === -1) {
      throw new Error('Item não encontrado localmente');
    }
    
    const updatedItem = {
      ...items[itemIndex],
      ...updatedData,
      updatedAt: Date.now()
    };
    
    if (newPhoto) {
      updatedItem.photo = newPhoto;
    }
    
    items[itemIndex] = updatedItem;
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

// ============================================
// DELETAR ITEM
// ============================================
export const deleteInventoryItem = async (itemId: string) => {
  try {
    if (itemId.startsWith('local_')) {
      return await deleteLocalItem(itemId);
    }
    
    const online = await isOnline();
    if (!online) {
      return await deleteLocalItem(itemId);
    }
    
    const item = await getInventoryItem(itemId);
    
    // Deletar foto do Cloudinary
    if (item.photo_public_id) {
      await deleteImageFromCloudinary(item.photo_public_id);
    }
    
    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('Erro ao deletar item:', error);
      throw error;
    }
    
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
    return await deleteLocalItem(itemId);
  }
};

// Deletar item localmente
const deleteLocalItem = async (itemId: string) => {
  try {
    const storedItems = await AsyncStorage.getItem("cachedInventory") || '[]';
    const items = JSON.parse(storedItems);
    
    const itemIndex = items.findIndex((item: any) => item.id === itemId);
    
    if (itemIndex === -1) {
      throw new Error('Item não encontrado localmente');
    }
    
    const deletedItem = items[itemIndex];
    items.splice(itemIndex, 1);
    await AsyncStorage.setItem("cachedInventory", JSON.stringify(items));
    
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

// ============================================
// HISTÓRICO
// ============================================
export const addToHistory = async (historyEntry: any) => {
  try {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Utilizador não autenticado');

    const online = await isOnline();
    
    if (online) {
      const { error } = await supabase
        .from('item_history')
        .insert({
          user_id: userId,
          name: historyEntry.name,
          category: historyEntry.category,
          quantity: parseInt(historyEntry.quantity?.toString() || '0'),
          action: historyEntry.action,
        });

      if (error) {
        console.error('Erro ao adicionar ao histórico:', error);
        throw error;
      }
    } else {
      const historyData = await AsyncStorage.getItem("localItemHistory") || '[]';
      const history = JSON.parse(historyData);
      history.unshift({
        ...historyEntry,
        userId,
        timestamp: Date.now()
      });
      await AsyncStorage.setItem("localItemHistory", JSON.stringify(history));
      
      // Adicionar à fila de sincronização
      const syncQueue = await AsyncStorage.getItem("syncQueue") || '[]';
      const queue = JSON.parse(syncQueue);
      queue.push({
        type: 'addHistory',
        entry: { ...historyEntry, userId },
        timestamp: Date.now()
      });
      await AsyncStorage.setItem("syncQueue", JSON.stringify(queue));
    }
  } catch (error) {
    console.error('Erro ao adicionar ao histórico:', error);
    
    try {
      const userId = await getCurrentUserId() || 'unknown';
      const historyData = await AsyncStorage.getItem("localItemHistory") || '[]';
      const history = JSON.parse(historyData);
      history.unshift({
        ...historyEntry,
        userId,
        timestamp: Date.now()
      });
      await AsyncStorage.setItem("localItemHistory", JSON.stringify(history));
    } catch (localError) {
      console.error('Erro ao salvar histórico localmente:', localError);
    }
  }
};

export const getItemHistory = async (limitCount?: number) => {
  try {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Utilizador não autenticado');

    const online = await isOnline();
    
    if (!online) {
      return await getLocalItemHistory(limitCount);
    }

    let query = supabase
      .from('item_history')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    if (limitCount) {
      query = query.limit(limitCount);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao obter histórico:', error);
      return await getLocalItemHistory(limitCount);
    }

    const history = (data || []).map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      action: item.action,
      timestamp: item.timestamp,
      userId: item.user_id,
    }));

    await AsyncStorage.setItem("cachedItemHistory", JSON.stringify(history));
    
    return history;
  } catch (error) {
    console.error('Erro ao obter histórico:', error);
    return await getLocalItemHistory(limitCount);
  }
};

const getLocalItemHistory = async (limitCount?: number) => {
  try {
    const cachedHistoryData = await AsyncStorage.getItem("cachedItemHistory") || '[]';
    const localHistoryData = await AsyncStorage.getItem("localItemHistory") || '[]';
    
    const cachedHistory = JSON.parse(cachedHistoryData);
    const localHistory = JSON.parse(localHistoryData);
    
    const combinedHistory = [...localHistory, ...cachedHistory]
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    if (limitCount && limitCount > 0) {
      return combinedHistory.slice(0, limitCount);
    }
    
    return combinedHistory;
  } catch (error) {
    console.error('Erro ao obter histórico local:', error);
    return [];
  }
};

export const clearItemHistory = async () => {
  try {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Utilizador não autenticado');

    const { error } = await supabase
      .from('item_history')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Erro ao limpar histórico:', error);
      throw error;
    }

    await AsyncStorage.removeItem("cachedItemHistory");
    await AsyncStorage.removeItem("localItemHistory");

    return true;
  } catch (error) {
    console.error('Erro ao limpar histórico:', error);
    throw error;
  }
};

// ============================================
// ESTATÍSTICAS
// ============================================
export const getInventoryStats = async () => {
  console.log("[STATS_DEBUG] getInventoryStats: Iniciando...");
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.log('[STATS_DEBUG] Utilizador não autenticado, retornando stats vazias.');
      return {
        totalItems: 0, totalCategories: 0, lowStockItems: 0, outOfStockItems: 0,
        recentlyAdded: [], categories: [], lowStockItemsList: [], outOfStockItemsList: []
      };
    }

    const online = await isOnline();
    let items: InventoryItem[] = [];

    if (online) {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, quantity, category, low_stock_threshold, photo_url, photo_public_id, description, user_id, created_at, updated_at')
        .eq('user_id', userId);

      if (error) {
        console.error('Erro ao obter itens para stats:', error);
        items = await loadItemsFromCache();
      } else {
        items = (data || []).map(convertFromSupabase);
        await saveItemsToCache(items);
      }
    } else {
      items = await loadItemsFromCache();
      
      // Tentar carregar stats do cache se offline
      const cachedStatsJson = await AsyncStorage.getItem(`inventory_stats_${userId}`);
      if (cachedStatsJson) {
        return JSON.parse(cachedStatsJson);
      }
    }

    // Obter threshold global
    let globalThreshold = 5;
    try {
      const settings = await getUserSettings();
      if (settings?.globalLowStockThreshold) {
        globalThreshold = parseInt(settings.globalLowStockThreshold);
      }
    } catch (e) {
      console.warn('Erro ao obter threshold global:', e);
    }

    // Calcular estatísticas
    const categoriesSet = new Set<string>();
    items.forEach(item => {
      if (item.category) categoriesSet.add(item.category);
    });

    const totalQuantity = items.reduce((sum, item) => {
      const quantity = parseInt(item.quantity?.toString() || '0');
      return sum + (isNaN(quantity) ? 0 : quantity);
    }, 0);

    const combinedItems = combineItems(items);

    const lowStockItems = combinedItems.filter(item => {
      const quantity = parseInt(item.quantity?.toString() || '0');
      
      if (item.lowStockThreshold !== undefined && item.lowStockThreshold !== null) {
        const customThreshold = parseInt(item.lowStockThreshold);
        // CORREÇÃO: Usar >= 0 para que o limite ZERO seja respeitado!
        if (!isNaN(customThreshold) && customThreshold >= 0) { 
          return quantity <= customThreshold && quantity > 0;
        }
      }
      
      // CORREÇÃO: Usar >= 0 aqui também
      return globalThreshold >= 0 && quantity <= globalThreshold && quantity > 0;
    });

    const outOfStockItems = combinedItems.filter(item => {
      const quantity = parseInt(item.quantity?.toString() || '0');
      return quantity === 0;
    });

    const recentlyAdded = items
      .sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 5);

    const mapToLightItem = (item: InventoryItem) => {
      const { photo, ...rest } = item;
      return rest;
    };

    const stats = {
      totalItems: totalQuantity,
      totalCategories: categoriesSet.size,
      lowStockItems: lowStockItems.length,
      outOfStockItems: outOfStockItems.length,
      recentlyAdded,
      categories: Array.from(categoriesSet),
      lowStockItemsList: lowStockItems.map(mapToLightItem),
      outOfStockItemsList: outOfStockItems.map(mapToLightItem)
    };

    // Salvar stats no cache
    const statsForCache = {
      ...stats,
      recentlyAdded: stats.recentlyAdded.map(mapToLightItem),
    };
    await AsyncStorage.setItem(`inventory_stats_${userId}`, JSON.stringify(statsForCache));

    return stats;
  } catch (error) {
    console.error('[STATS_DEBUG] Erro GERAL dentro de getInventoryStats:', error);
    return {
      totalItems: 0, totalCategories: 0, lowStockItems: 0, outOfStockItems: 0,
      recentlyAdded: [], categories: [], lowStockItemsList: [], outOfStockItemsList: []
    };
  }
};

// ============================================
// CONFIGURAÇÕES DO UTILIZADOR
// ============================================
export const getUserSettings = async () => {
  try {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Utilizador não autenticado');
    
    const online = await isOnline();
    
    if (!online) {
      const localSettings = await AsyncStorage.getItem("userSettings");
      if (localSettings) {
        return JSON.parse(localSettings);
      }
      return { globalLowStockThreshold: '5' };
    }

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { globalLowStockThreshold: '5' };
      }
      throw error;
    }

    const settings = {
      globalLowStockThreshold: data.global_low_stock_threshold?.toString() || '5',
    };

    await AsyncStorage.setItem("userSettings", JSON.stringify(settings));
    
    return settings;
  } catch (error) {
    console.error('Erro ao obter configurações:', error);
    const localSettings = await AsyncStorage.getItem("userSettings");
    if (localSettings) {
      return JSON.parse(localSettings);
    }
    return { globalLowStockThreshold: '5' };
  }
};

export const saveUserSettings = async (settings: any) => {
  try {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Utilizador não autenticado');
    
    await AsyncStorage.setItem("userSettings", JSON.stringify({
      ...settings,
      userId,
      updatedAt: Date.now()
    }));
    
    const online = await isOnline();
    
    if (!online) {
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

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        global_low_stock_threshold: parseInt(settings.globalLowStockThreshold || '5'),
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Erro ao salvar configurações:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    throw error;
  }
};

// ============================================
// SINCRONIZAÇÃO
// ============================================
export const syncPendingChanges = async () => {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.log("Sync: Utilizador não autenticado.");
      return;
    }

    const online = await isOnline();
    if (!online) {
      console.log("Sync: Offline, a pular sincronização.");
      return;
    }

    const syncQueueData = await AsyncStorage.getItem("syncQueue");
    if (!syncQueueData) return;

    const syncQueue = JSON.parse(syncQueueData);
    if (!syncQueue.length) return;

    console.log(`Sync: Processando ${syncQueue.length} operações pendentes...`);

    const remainingQueue = [];

    for (const operation of syncQueue) {
      try {
        switch (operation.type) {
          case 'add':
            await processAddItem(operation.item);
            break;
          case 'update':
            await processUpdateItem(operation.itemId, operation.updatedData, operation.newPhoto);
            break;
          case 'delete':
            await processDeleteItem(operation.itemId);
            break;
          case 'addHistory':
            await processAddHistory(operation.entry);
            break;
          case 'saveSettings':
            await processSaveSettings(operation.settings);
            break;
          default:
            console.warn('Tipo de operação desconhecido:', operation.type);
        }
      } catch (error) {
        console.error(`Sync: Erro ao processar operação ${operation.type}:`, error);
        remainingQueue.push(operation);
      }
    }

    await AsyncStorage.setItem("syncQueue", JSON.stringify(remainingQueue));
    console.log(`Sync: Concluído. ${syncQueue.length - remainingQueue.length} operações processadas, ${remainingQueue.length} pendentes.`);
  } catch (error) {
    console.error('Erro geral ao sincronizar:', error);
  }
};

const processAddItem = async (item: any) => {
  const userId = await getCurrentUserId();
  if (!userId) return;

  let photoUrl = null;
  let photoPublicId = null;

  if (item.photo) {
    try {
      const uploadResult = await uploadImageToCloudinary(item.photo, `inventory/${userId}`);
      photoUrl = uploadResult.secure_url;
      photoPublicId = uploadResult.public_id;
    } catch (e) {
      console.warn('Sync: Erro no upload da foto:', e);
    }
  }

  const { error } = await supabase
    .from('inventory_items')
    .insert({
      ...convertToSupabase(item, userId),
      photo_url: photoUrl,
      photo_public_id: photoPublicId,
    });

  if (error) throw error;
};

const processUpdateItem = async (itemId: string, updatedData: any, newPhoto?: string) => {
  if (itemId.startsWith('local_')) return;

  const userId = await getCurrentUserId();
  if (!userId) return;

  let photoUrl = updatedData.photoUrl;
  let photoPublicId = updatedData.photo_public_id;

  if (newPhoto) {
    try {
      const currentItem = await getInventoryItem(itemId);
      if (currentItem?.photo_public_id) {
        await deleteImageFromCloudinary(currentItem.photo_public_id);
      }

      const uploadResult = await uploadImageToCloudinary(newPhoto, `inventory/${userId}`);
      photoUrl = uploadResult.secure_url;
      photoPublicId = uploadResult.public_id;
    } catch (e) {
      console.warn('Sync: Erro no upload da nova foto:', e);
    }
  }

  const { error } = await supabase
    .from('inventory_items')
    .update({
      ...convertToSupabase(updatedData, userId),
      photo_url: photoUrl,
      photo_public_id: photoPublicId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  if (error) throw error;
};

const processDeleteItem = async (itemId: string) => {
  if (itemId.startsWith('local_')) return;

  try {
    const item = await getInventoryItem(itemId);
    if (item?.photo_public_id) {
      await deleteImageFromCloudinary(item.photo_public_id);
    }
  } catch (e) {
    // Item pode já não existir
  }

  const { error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', itemId);

  if (error && error.code !== 'PGRST116') throw error;
};

const processAddHistory = async (entry: any) => {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const { error } = await supabase
    .from('item_history')
    .insert({
      user_id: userId,
      name: entry.name,
      category: entry.category,
      quantity: parseInt(entry.quantity?.toString() || '0'),
      action: entry.action,
    });

  if (error) throw error;
};

const processSaveSettings = async (settings: any) => {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const { error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: userId,
      global_low_stock_threshold: parseInt(settings.globalLowStockThreshold || '5'),
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;
};

// ============================================
// CONSOLIDAR ITENS
// ============================================
export const consolidateInventoryItems = async () => {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.log('Utilizador não autenticado ao consolidar itens');
      return false;
    }

    const { data, error } = await supabase
      .from('inventory_items')
      .select('id, name, quantity, category, low_stock_threshold, photo_url, photo_public_id, description, user_id, created_at, updated_at')
      .eq('user_id', userId);

    if (error) throw error;

    const items = (data || []).map(convertFromSupabase);
    
    const groupedItems: Record<string, {items: InventoryItem[], totalQuantity: number}> = {};
    
    items.forEach(item => {
      const key = `${item.name.toLowerCase()}-${(item.category || '').toLowerCase()}`;
      
      if (!groupedItems[key]) {
        groupedItems[key] = { items: [], totalQuantity: 0 };
      }
      
      groupedItems[key].items.push(item);
      groupedItems[key].totalQuantity += parseInt(item.quantity?.toString() || '0');
    });
    
    for (const key in groupedItems) {
      const group = groupedItems[key];
      
      if (group.items.length > 1) {
        console.log(`Consolidando ${group.items.length} itens para ${group.items[0].name}`);
        
        const baseItem = group.items[0];
        
        if (baseItem.id) {
          await supabase
            .from('inventory_items')
            .update({
              quantity: group.totalQuantity,
              updated_at: new Date().toISOString(),
            })
            .eq('id', baseItem.id);
          
          for (let i = 1; i < group.items.length; i++) {
            const itemToDelete = group.items[i];
            if (itemToDelete.id) {
              await supabase
                .from('inventory_items')
                .delete()
                .eq('id', itemToDelete.id);
            }
          }
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao consolidar itens:', error);
    return false;
  }
};

// Upload de imagem pendentes (compatibilidade)
export const syncPendingImageUploads = async () => {
  // Esta função agora é parte do syncPendingChanges
  await syncPendingChanges();
};
