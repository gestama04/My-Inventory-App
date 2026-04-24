import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from '../supabase-config';
import { getUserSettings } from '../inventory-service';
import * as TaskManager from 'expo-task-manager';
import React from 'react';
import Constants from 'expo-constants';


const BACKGROUND_TASK_NAME = 'background-stock-check';

interface InventoryItem {
  id?: string;
  name: string;
  quantity: string | number;
  category?: string;
  price?: string | number;
  lowStockThreshold?: string;
  userId: string;
}

interface NotificationSettings {
  enabled: boolean;
  interval: number;
  lowStockEnabled: boolean;
  outOfStockEnabled: boolean;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
  try {
    console.log('[BackgroundTask] Executando verificação de stock em background');
    await NotificationService.checkStockLevels();
    return { success: true };
  } catch (error) {
    console.error('[BackgroundTask] Erro na verificação de stock:', error);
    return { success: false };
  }
});

export class NotificationService {
  private static authListenerInitialized = false;
  private static stockCheckInterval: ReturnType<typeof setInterval> | null = null;
  private static lastNotificationTime = 0;
  private static isBackgroundTaskRegistered = false;
  
  static async initialize() {
  // ADICIONAR ESTA VERIFICAÇÃO NO TOPO
  if (Constants.appOwnership === 'expo') {
    console.log('[NotificationService] Modo Expo Go detetado. Ignorando inicialização de Push.');
    return; 
  }

  console.log('[NotificationService] Inicializando serviço de notificações...');
  await this.cleanupStorage();
    await this.registerForPushNotificationsAsync();
    
    if (!this.authListenerInitialized) {
      this.setupAuthListener();
      this.authListenerInitialized = true;
    }

    await this.registerBackgroundTask();
  }

  static async getNotificationSettings(): Promise<NotificationSettings> {
    try {
      const settings = await AsyncStorage.getItem('notificationSettings');
      if (settings) {
        const parsed = JSON.parse(settings);
        console.log('[NotificationService] Configurações carregadas:', parsed);
        return parsed;
      }
    } catch (error) {
      console.error('[NotificationService] Erro ao carregar configurações:', error);
    }
    
    const defaultSettings = {
      enabled: true,
      interval: 60,
      lowStockEnabled: true,
      outOfStockEnabled: true,
    };
    
    console.log('[NotificationService] Usando configurações padrão:', defaultSettings);
    return defaultSettings;
  }

  static async saveNotificationSettings(settings: NotificationSettings) {
    try {
      await AsyncStorage.setItem('notificationSettings', JSON.stringify(settings));
      console.log('[NotificationService] Configurações salvas localmente:', settings);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('user_notification_settings')
          .upsert({
            user_id: user.id,
            enabled: settings.enabled,
            interval_minutes: settings.interval,
            low_stock_enabled: settings.lowStockEnabled,
            out_of_stock_enabled: settings.outOfStockEnabled,
            updated_at: new Date().toISOString(),
          });
        console.log('[NotificationService] Configurações salvas no Supabase');
      }
      
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        await this.setupPeriodicStockCheck();
      }
    } catch (error) {
      console.error('[NotificationService] Erro ao salvar configurações:', error);
      throw error;
    }
  }

  static async cleanupStorage() {
    try {
      console.log('[NotificationService] Iniciando limpeza do AsyncStorage...');
      
      const allKeys = await AsyncStorage.getAllKeys();
      console.log(`[NotificationService] Total de chaves no storage: ${allKeys.length}`);
      
      const keysToRemove = allKeys.filter(key => 
        key.startsWith('temp_') || 
        key.startsWith('cache_') ||
        key.includes('old_') ||
        key.includes('backup_') ||
        key.includes('expired_')
      );
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`[NotificationService] Removidas ${keysToRemove.length} chaves antigas`);
      }

      const remainingKeys = await AsyncStorage.getAllKeys();
      if (remainingKeys.length > 100) {
        console.log('[NotificationService] Muitas chaves detectadas, fazendo limpeza agressiva...');
        
        const essentialKeys = [
          'userSettings', 
          'notificationSettings', 
          'authToken',
          'inventorySortType',
          'inventoryFilterCategory',
          'themePreference'
        ];
        
        const nonEssentialKeys = remainingKeys.filter(key => 
          !essentialKeys.some(essential => key.includes(essential))
        );
        
        const keysToRemoveAggressively = nonEssentialKeys.slice(0, Math.floor(nonEssentialKeys.length * 0.7));
        if (keysToRemoveAggressively.length > 0) {
          await AsyncStorage.multiRemove(keysToRemoveAggressively);
          console.log(`[NotificationService] Removidas ${keysToRemoveAggressively.length} chaves adicionais`);
        }
      }
      
      const finalKeys = await AsyncStorage.getAllKeys();
      console.log(`[NotificationService] Limpeza concluída. Chaves restantes: ${finalKeys.length}`);
      
    } catch (error) {
      console.error('[NotificationService] Erro durante limpeza do storage:', error);
      
      try {
        console.log('[NotificationService] Tentando limpeza completa devido a erro...');
        await AsyncStorage.clear();
        console.log('[NotificationService] AsyncStorage limpo completamente');
      } catch (clearError) {
        console.error('[NotificationService] Erro crítico - não foi possível limpar storage:', clearError);
      }
    }
  }

  static async registerForPushNotificationsAsync() {
    let token;

    // ADICIONAR ESTA PROTEÇÃO: Se estivermos no Expo Go, abortar imediatamente
    if (Constants.appOwnership === 'expo') {
      console.log('[NotificationService] A correr no Expo Go - Notificações Push desativadas para evitar erros.');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Alertas de Inventário',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3498db',
        sound: 'default',
        description: 'Notificações sobre níveis de stock do inventário',
      });

      await Notifications.setNotificationChannelAsync('low-stock', {
        name: 'Stock Baixo',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#f39c12',
        sound: 'default',
        description: 'Alertas quando produtos estão com stock baixo',
      });

      await Notifications.setNotificationChannelAsync('out-of-stock', {
        name: 'Sem Stock',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#e74c3c',
        sound: 'default',
        description: 'Alertas quando produtos estão sem stock',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        console.log('[NotificationService] Solicitando permissões de notificação...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('[NotificationService] Permissão de notificação negada pelo usuário');
        return;
      }
      
      try {
        const projectId = '3abf848f-326e-4719-a3c6-9c4c60605aa7';
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        console.log('[NotificationService] Token de push obtido com sucesso');
      } catch (error) {
        console.error('[NotificationService] Erro ao obter token de push:', error);
      }
    } else {
      console.log('[NotificationService] Simulador detectado - notificações push não disponíveis');
    }

    return token;
  }

  static async forceStockCheck() {
    console.log('[NotificationService] Forçando verificação de stock (ignorando debounce)...');
    const originalTime = this.lastNotificationTime;
    this.lastNotificationTime = 0;
    
    try {
      await this.checkStockLevels();
    } finally {
      if (this.lastNotificationTime === 0) {
        this.lastNotificationTime = originalTime;
      }
    }
  }

  static setupAuthListener() {
    console.log('[NotificationService] Configurando listener de autenticação...');
    
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        console.log('[NotificationService] Usuário autenticado, iniciando monitoramento de stock');
        await this.setupPeriodicStockCheck();
      } else {
        console.log('[NotificationService] Usuário deslogado, parando monitoramento de stock');
        this.stopPeriodicStockCheck();
      }
    });
  }

  static async registerBackgroundTask() {
    try {
      if (this.isBackgroundTaskRegistered) {
        console.log('[NotificationService] Tarefa em background já registada');
        return;
      }

      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
      if (!isRegistered) {
        console.log('[NotificationService] Registando tarefa em background...');
        this.isBackgroundTaskRegistered = true;
        console.log('[NotificationService] Tarefa em background registada com sucesso');
      } else {
        console.log('[NotificationService] Tarefa em background já estava registada');
        this.isBackgroundTaskRegistered = true;
      }
    } catch (error) {
      console.error('[NotificationService] Erro ao registar tarefa em background:', error);
    }
  }

  static async setupPeriodicStockCheck() {
    try {
      console.log('[NotificationService] Configurando verificação periódica de stock...');
      
      if (this.stockCheckInterval) {
        clearInterval(this.stockCheckInterval);
        this.stockCheckInterval = null;
      }
      
      const settings = await this.getNotificationSettings();
      if (!settings.enabled) {
        console.log('[NotificationService] Notificações desabilitadas');
        return;
      }

      const intervalMs = settings.interval * 60 * 1000;
      console.log(`[NotificationService] Intervalo configurado: ${settings.interval} minutos`);

      await this.checkStockLevels();
      
      this.stockCheckInterval = setInterval(async () => {
        await this.checkStockLevels();
      }, intervalMs);
      
      console.log('[NotificationService] Verificação periódica configurada');
    } catch (error) {
      console.error('[NotificationService] Erro ao configurar verificação periódica:', error);
    }
  }

  static stopPeriodicStockCheck() {
    if (this.stockCheckInterval) {
      clearInterval(this.stockCheckInterval);
      this.stockCheckInterval = null;
      console.log('[NotificationService] Verificação periódica de stock interrompida');
    }
  }

  static async checkStockLevels() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[NotificationService] Usuário não autenticado para verificação de stock');
        return;
      }

      const settings = await this.getNotificationSettings();
      if (!settings.enabled) {
        console.log('[NotificationService] Notificações desabilitadas, cancelando verificação');
        return;
      }

      const now = Date.now();
      const configuredIntervalMs = settings.interval * 60 * 1000;
      const minInterval = Math.max(configuredIntervalMs * 0.5, 30000);
      
      if (now - this.lastNotificationTime < minInterval) {
        console.log(`[NotificationService] Verificação em debounce, ignorando...`);
        return;
      }

      console.log('[NotificationService] Iniciando verificação de níveis de stock...');

      const userSettings = await getUserSettings();
      const globalThreshold = parseInt(userSettings?.globalLowStockThreshold || '5');
      console.log(`[NotificationService] Threshold global configurado: ${globalThreshold}`);

      const { data: items, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('[NotificationService] Erro ao obter itens:', error);
        return;
      }

      const lowStockItems: InventoryItem[] = [];
      const outOfStockItems: InventoryItem[] = [];

      (items || []).forEach((item) => {
        const quantity = parseInt(item.quantity?.toString() || '0');
        
        if (quantity === 0) {
          outOfStockItems.push({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            category: item.category,
            lowStockThreshold: item.low_stock_threshold?.toString(),
            userId: item.user_id,
          });
        } else {
          let threshold = globalThreshold;
          if (item.low_stock_threshold) {
            const customThreshold = parseInt(item.low_stock_threshold);
            if (!isNaN(customThreshold) && customThreshold > 0) {
              threshold = customThreshold;
            }
          }
          
          if (quantity <= threshold) {
            lowStockItems.push({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              category: item.category,
              lowStockThreshold: item.low_stock_threshold?.toString(),
              userId: item.user_id,
            });
          }
        }
      });

      console.log(`[NotificationService] Verificação concluída - Stock baixo: ${lowStockItems.length}, Sem stock: ${outOfStockItems.length}`);

      if ((settings.lowStockEnabled && lowStockItems.length > 0) || 
          (settings.outOfStockEnabled && outOfStockItems.length > 0)) {
        await this.generateStockNotifications(lowStockItems, outOfStockItems, settings);
        this.lastNotificationTime = now;
      }

    } catch (error) {
      console.error('[NotificationService] Erro ao verificar níveis de stock:', error);
    }
  }

  static async generateStockNotifications(
    lowStockItems: InventoryItem[], 
    outOfStockItems: InventoryItem[],
    settings: NotificationSettings
  ) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[NotificationService] Usuário não autenticado para gerar notificações');
        return;
      }

      console.log('[NotificationService] Gerando notificações de stock...');

      if (settings.lowStockEnabled && lowStockItems.length > 0) {
        const title = lowStockItems.length === 1 
          ? '⚠️ Stock Baixo' 
          : `⚠️ ${lowStockItems.length} Produtos com Stock Baixo`;
        
        const maxItems = 3;
        const itemNames = lowStockItems.slice(0, maxItems).map(i => i.name).join(', ');
        const extra = lowStockItems.length > maxItems ? ` e mais ${lowStockItems.length - maxItems}` : '';
        const body = lowStockItems.length === 1
          ? `${lowStockItems[0].name} está com stock baixo (${lowStockItems[0].quantity} restantes)`
          : `${itemNames}${extra} estão com stock baixo`;

        await this.sendLocalNotification(title, body, 'low-stock');
      }

      if (settings.outOfStockEnabled && outOfStockItems.length > 0) {
        const title = outOfStockItems.length === 1 
          ? '🚨 Produto Esgotado' 
          : `🚨 ${outOfStockItems.length} Produtos Esgotados`;
        
        const maxItems = 3;
        const itemNames = outOfStockItems.slice(0, maxItems).map(i => i.name).join(', ');
        const extra = outOfStockItems.length > maxItems ? ` e mais ${outOfStockItems.length - maxItems}` : '';
        const body = outOfStockItems.length === 1
          ? `${outOfStockItems[0].name} está sem stock`
          : `${itemNames}${extra} estão sem stock`;

        await this.sendLocalNotification(title, body, 'out-of-stock');
      }

    } catch (error) {
      console.error('[NotificationService] Erro ao gerar notificações:', error);
    }
  }

  static async sendLocalNotification(
    title: string,
    body: string,
    channelId: string = 'default',
    data?: any
  ) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          data: data || { type: channelId },
        },
        trigger: null,
      });
      console.log(`[NotificationService] Notificação enviada: ${title}`);
    } catch (error) {
      console.error('[NotificationService] Erro ao enviar notificação:', error);
    }
  }

  static async getNotificationPermissionStatus() {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status;
    } catch (error) {
      console.error('[NotificationService] Erro ao verificar permissões:', error);
      return 'undetermined';
    }
  }

  static async clearUserDataFromCache() {
    try {
      const keysToRemove = [
        'cachedInventory',
        'cachedItemHistory',
        'pendingImageUploads',
        'localItemHistory',
        'syncQueue',
        'lastStockNotificationTime',
        'currentUser',
        'userSettings',
        'notificationSettings',
        'authToken'
      ];
      
      await AsyncStorage.multiRemove(keysToRemove);
      console.log('[NotificationService] Dados do usuário removidos do cache');
    } catch (error) {
      console.error('[NotificationService] Erro ao limpar dados do usuário do cache:', error);
    }
  }

  static async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('[NotificationService] Todas as notificações pendentes foram canceladas');
    } catch (error) {
      console.error('[NotificationService] Erro ao cancelar notificações:', error);
    }
  }

  static async cancelNotificationsByIdentifier(identifier: string) {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
      console.log(`[NotificationService] Notificação cancelada: ${identifier}`);
    } catch (error) {
      console.error(`[NotificationService] Erro ao cancelar notificação ${identifier}:`, error);
    }
  }

  static async getScheduledNotifications() {
    try {
      const notifications = await Notifications.getAllScheduledNotificationsAsync();
      console.log(`[NotificationService] ${notifications.length} notificações agendadas encontradas`);
      return notifications;
    } catch (error) {
      console.error('[NotificationService] Erro ao obter notificações agendadas:', error);
      return [];
    }
  }

  static async setBadgeCount(count: number) {
    try {
      await Notifications.setBadgeCountAsync(count);
      console.log(`[NotificationService] Badge count definido para: ${count}`);
    } catch (error) {
      console.error('[NotificationService] Erro ao definir badge count:', error);
    }
  }

  static async clearBadge() {
    try {
      await Notifications.setBadgeCountAsync(0);
      console.log('[NotificationService] Badge limpo');
    } catch (error) {
      console.error('[NotificationService] Erro ao limpar badge:', error);
    }
  }

  static async testNotification() {
    try {
      await this.sendLocalNotification(
        'Teste de Notificação',
        'Esta é uma notificação de teste do sistema de inventário.',
        'low-stock'
      );
      console.log('[NotificationService] Notificação de teste enviada');
    } catch (error) {
      console.error('[NotificationService] Erro ao enviar notificação de teste:', error);
    }
  }

  static async checkNotificationSupport() {
    try {
      const isDevice = Device.isDevice;
      const permissions = await Notifications.getPermissionsAsync();
      
      return {
        isDevice,
        permissionStatus: permissions.status,
        canAskAgain: permissions.canAskAgain,
        granted: permissions.granted
      };
    } catch (error) {
      console.error('[NotificationService] Erro ao verificar suporte a notificações:', error);
      return {
        isDevice: false,
        permissionStatus: 'undetermined',
        canAskAgain: false,
        granted: false
      };
    }
  }

  static setupNotificationReceivedListener() {
    return Notifications.addNotificationReceivedListener(notification => {
      console.log('[NotificationService] Notificação recebida:', notification);
    });
  }

  static setupNotificationResponseListener() {
    return Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[NotificationService] Resposta à notificação:', response);
      
      const notificationData = response.notification.request.content.data;
      
      if (notificationData?.type === 'low-stock') {
        console.log('[NotificationService] Navegando para tela de stock baixo');
      } else if (notificationData?.type === 'out-of-stock') {
        console.log('[NotificationService] Navegando para tela de falta de stock');
      }
    });
  }

  static cleanup() {
    console.log('[NotificationService] Limpando recursos do serviço de notificações...');
    
    this.stopPeriodicStockCheck();
    
    this.authListenerInitialized = false;
    this.isBackgroundTaskRegistered = false;
    this.lastNotificationTime = 0;
    
    console.log('[NotificationService] Limpeza concluída');
  }
}

NotificationService.initialize().catch(error => {
  console.error('[NotificationService] Erro na inicialização automática:', error);
});

export default NotificationService;

export type { InventoryItem, NotificationSettings };

export const NOTIFICATION_TYPES = {
  LOW_STOCK: 'low-stock',
  OUT_OF_STOCK: 'out-of-stock',
  GENERAL: 'general'
} as const;

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  interval: 60,
  lowStockEnabled: true,
  outOfStockEnabled: true,
};

export const formatNotificationMessage = (items: InventoryItem[], type: 'low-stock' | 'out-of-stock') => {
  const maxItemsToShow = 3;
  const itemNames = items.slice(0, maxItemsToShow).map(item => item.name).join(', ');
  const extraCount = items.length > maxItemsToShow ? ` e mais ${items.length - maxItemsToShow}` : '';
  
  if (type === 'low-stock') {
    return items.length === 1 
      ? `${itemNames} está com stock baixo`
      : `${items.length} produtos com stock baixo: ${itemNames}${extraCount}`;
  } else {
    return items.length === 1 
      ? `${itemNames} está sem stock`
      : `${items.length} produtos sem stock: ${itemNames}${extraCount}`;
  }
};

export const validateNotificationSettings = (settings: Partial<NotificationSettings>): NotificationSettings => {
  return {
    enabled: settings.enabled ?? DEFAULT_NOTIFICATION_SETTINGS.enabled,
    interval: Math.max(settings.interval ?? DEFAULT_NOTIFICATION_SETTINGS.interval, 1),
    lowStockEnabled: settings.lowStockEnabled ?? DEFAULT_NOTIFICATION_SETTINGS.lowStockEnabled,
    outOfStockEnabled: settings.outOfStockEnabled ?? DEFAULT_NOTIFICATION_SETTINGS.outOfStockEnabled,
  };
};

export const useNotificationService = () => {
  const [settings, setSettings] = React.useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [permissionStatus, setPermissionStatus] = React.useState<string>('undetermined');

  React.useEffect(() => {
    const loadSettings = async () => {
      try {
        const currentSettings = await NotificationService.getNotificationSettings();
        setSettings(currentSettings);
        
        const status = await NotificationService.getNotificationPermissionStatus();
        setPermissionStatus(status);
      } catch (error) {
        console.error('Erro ao carregar configurações de notificação:', error);
      }
    };

    loadSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<NotificationSettings>) => {
    try {
      const validatedSettings = validateNotificationSettings({ ...settings, ...newSettings });
      await NotificationService.saveNotificationSettings(validatedSettings);
      setSettings(validatedSettings);
    } catch (error) {
      console.error('Erro ao atualizar configurações de notificação:', error);
      throw error;
    }
  };

  const requestPermissions = async () => {
    try {
      await NotificationService.registerForPushNotificationsAsync();
      const status = await NotificationService.getNotificationPermissionStatus();
      setPermissionStatus(status);
      return status === 'granted';
    } catch (error) {
      console.error('Erro ao solicitar permissões de notificação:', error);
      return false;
    }
  };

  return {
    settings,
    permissionStatus,
    updateSettings,
    requestPermissions,
    testNotification: NotificationService.testNotification,
    checkSupport: NotificationService.checkNotificationSupport,
  };
};
