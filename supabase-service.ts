import { supabase } from './supabase-config';
import { uploadImageToCloudinary, deleteImageFromCloudinary, CloudinaryUploadResult } from './cloudinary-service';
import { RealtimeChannel } from '@supabase/supabase-js';

// ============================================
// TIPOS
// ============================================
export interface InventoryItem {
  id?: string;
  user_id: string;
  name: string;
  quantity: number;
  category?: string;
  description?: string;
  price?: number;
  low_stock_threshold?: number;
  photo_url?: string;
  photo_public_id?: string;
  photo?: string; // Base64 para compatibilidade offline
  created_at?: string;
  updated_at?: string;
}

export interface UserProfile {
  user_id: string;
  first_name?: string;
  last_name?: string;
  birth_date?: string;
  expo_push_token?: string;
  last_token_update?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserSettings {
  user_id: string;
  global_low_stock_threshold?: number;
  created_at?: string;
  updated_at?: string;
}

export interface UserNotificationSettings {
  user_id: string;
  enabled: boolean;
  interval_minutes: number;
  low_stock_enabled: boolean;
  out_of_stock_enabled: boolean;
  updated_at?: string;
}

export interface ItemHistory {
  id?: string;
  user_id: string;
  item_id?: string;
  name?: string;
  category?: string;
  quantity?: number;
  action: 'add' | 'update' | 'delete' | 'consume';
  timestamp?: string;
}

// ============================================
// AUTH HELPERS
// ============================================
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const getCurrentUserId = async (): Promise<string | null> => {
  const user = await getCurrentUser();
  return user?.id || null;
};

export const getCurrentSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

// ============================================
// INVENTORY CRUD
// ============================================
export const getInventoryItems = async (userId: string): Promise<InventoryItem[]> => {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Erro ao obter itens:', error);
    throw error;
  }
  
  return data || [];
};

export const getInventoryItem = async (itemId: string): Promise<InventoryItem | null> => {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('id', itemId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Erro ao obter item:', error);
    throw error;
  }
  
  return data;
};

export const addInventoryItem = async (
  item: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>,
  photo?: string
): Promise<string> => {
  let photoUrl: string | undefined;
  let photoPublicId: string | undefined;
  
  // Upload da foto para Cloudinary se existir
  if (photo) {
    try {
      const uploadResult = await uploadImageToCloudinary(photo, `inventory/${item.user_id}`);
      photoUrl = uploadResult.secure_url;
      photoPublicId = uploadResult.public_id;
    } catch (error) {
      console.error('Erro ao fazer upload da foto:', error);
      // Continua sem foto se falhar o upload
    }
  }
  
  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      ...item,
      photo_url: photoUrl,
      photo_public_id: photoPublicId,
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('Erro ao adicionar item:', error);
    throw error;
  }
  
  return data.id;
};

export const updateInventoryItem = async (
  itemId: string,
  updates: Partial<InventoryItem>,
  newPhoto?: string
): Promise<void> => {
  let photoUrl = updates.photo_url;
  let photoPublicId = updates.photo_public_id;
  
  // Se há nova foto, fazer upload
  if (newPhoto) {
    try {
      // Obter item atual para deletar foto antiga
      const currentItem = await getInventoryItem(itemId);
      if (currentItem?.photo_public_id) {
        await deleteImageFromCloudinary(currentItem.photo_public_id);
      }
      
      const userId = updates.user_id || currentItem?.user_id;
      const uploadResult = await uploadImageToCloudinary(newPhoto, `inventory/${userId}`);
      photoUrl = uploadResult.secure_url;
      photoPublicId = uploadResult.public_id;
    } catch (error) {
      console.error('Erro ao fazer upload da nova foto:', error);
    }
  }
  
  // Remover campos que não devem ser atualizados diretamente
  const { id, created_at, photo, ...updateData } = updates as any;
  
  const { error } = await supabase
    .from('inventory_items')
    .update({
      ...updateData,
      photo_url: photoUrl,
      photo_public_id: photoPublicId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);
  
  if (error) {
    console.error('Erro ao atualizar item:', error);
    throw error;
  }
};

export const deleteInventoryItem = async (itemId: string): Promise<void> => {
  // Obter item para deletar foto do Cloudinary
  const item = await getInventoryItem(itemId);
  if (item?.photo_public_id) {
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
};

// ============================================
// USER PROFILE
// ============================================
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Erro ao obter perfil:', error);
    throw error;
  }
  
  return data;
};

export const upsertUserProfile = async (profile: UserProfile): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .upsert({
      ...profile,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    });
  
  if (error) {
    console.error('Erro ao guardar perfil:', error);
    throw error;
  }
};

export const updateExpoPushToken = async (userId: string, token: string): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .upsert({
      user_id: userId,
      expo_push_token: token,
      last_token_update: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    });
  
  if (error) {
    console.error('Erro ao guardar push token:', error);
    throw error;
  }
};

// ============================================
// USER SETTINGS
// ============================================
export const getUserSettings = async (userId: string): Promise<UserSettings | null> => {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Erro ao obter configurações:', error);
    throw error;
  }
  
  return data;
};

export const upsertUserSettings = async (settings: UserSettings): Promise<void> => {
  const { error } = await supabase
    .from('user_settings')
    .upsert({
      ...settings,
      updated_at: new Date().toISOString(),
    });
  
  if (error) {
    console.error('Erro ao guardar configurações:', error);
    throw error;
  }
};

// ============================================
// NOTIFICATION SETTINGS
// ============================================
export const getNotificationSettings = async (userId: string): Promise<UserNotificationSettings | null> => {
  const { data, error } = await supabase
    .from('user_notification_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Erro ao obter configurações de notificação:', error);
    throw error;
  }
  
  return data;
};

export const upsertNotificationSettings = async (settings: UserNotificationSettings): Promise<void> => {
  const { error } = await supabase
    .from('user_notification_settings')
    .upsert({
      ...settings,
      updated_at: new Date().toISOString(),
    });
  
  if (error) {
    console.error('Erro ao guardar configurações de notificação:', error);
    throw error;
  }
};

// ============================================
// ITEM HISTORY
// ============================================
export const addToHistory = async (entry: Omit<ItemHistory, 'id' | 'timestamp'>): Promise<void> => {
  const { error } = await supabase
    .from('item_history')
    .insert(entry);
  
  if (error) {
    console.error('Erro ao adicionar ao histórico:', error);
    throw error;
  }
};

export const getItemHistory = async (userId: string, limit: number = 50): Promise<ItemHistory[]> => {
  const { data, error } = await supabase
    .from('item_history')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Erro ao obter histórico:', error);
    throw error;
  }
  
  return data || [];
};

export const clearItemHistory = async (userId: string): Promise<void> => {
  const { error } = await supabase
    .from('item_history')
    .delete()
    .eq('user_id', userId);
  
  if (error) {
    console.error('Erro ao limpar histórico:', error);
    throw error;
  }
};

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================
let inventoryChannel: RealtimeChannel | null = null;

export const subscribeToInventory = (
  userId: string,
  onInsert: (item: InventoryItem) => void,
  onUpdate: (item: InventoryItem) => void,
  onDelete: (item: { id: string }) => void
): (() => void) => {
  // Cancelar subscrição anterior se existir
  if (inventoryChannel) {
    supabase.removeChannel(inventoryChannel);
  }
  
  inventoryChannel = supabase
    .channel('inventory-changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'inventory_items',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        console.log('Realtime INSERT:', payload);
        onInsert(payload.new as InventoryItem);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'inventory_items',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        console.log('Realtime UPDATE:', payload);
        onUpdate(payload.new as InventoryItem);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'inventory_items',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        console.log('Realtime DELETE:', payload);
        onDelete({ id: payload.old.id });
      }
    )
    .subscribe();
  
  // Retornar função para cancelar subscrição
  return () => {
    if (inventoryChannel) {
      supabase.removeChannel(inventoryChannel);
      inventoryChannel = null;
    }
  };
};

export const unsubscribeFromInventory = (): void => {
  if (inventoryChannel) {
    supabase.removeChannel(inventoryChannel);
    inventoryChannel = null;
  }
};

// ============================================
// UPLOAD DE IMAGEM (compatibilidade com código existente)
// ============================================
export const uploadImage = async (base64Image: string, path: string): Promise<string> => {
  const result = await uploadImageToCloudinary(base64Image, path);
  return result.secure_url;
};

// ============================================
// BATCH OPERATIONS
// ============================================
export const batchUpdateItems = async (
  items: { id: string; updates: Partial<InventoryItem> }[]
): Promise<void> => {
  // Supabase não tem batch nativo, mas podemos fazer upsert de múltiplos
  const updates = items.map(({ id, updates }) => ({
    id,
    ...updates,
    updated_at: new Date().toISOString(),
  }));
  
  const { error } = await supabase
    .from('inventory_items')
    .upsert(updates);
  
  if (error) {
    console.error('Erro no batch update:', error);
    throw error;
  }
};

export const batchDeleteItems = async (itemIds: string[]): Promise<void> => {
  const { error } = await supabase
    .from('inventory_items')
    .delete()
    .in('id', itemIds);
  
  if (error) {
    console.error('Erro no batch delete:', error);
    throw error;
  }
};

// Export supabase para casos especiais
export { supabase };
