import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { auth, db } from '../firebase-config';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getUserSettings } from '../inventory-service';
import { onAuthStateChanged } from 'firebase/auth';
import * as TaskManager from 'expo-task-manager';
import React from 'react';
const BACKGROUND_TASK_NAME = 'background-stock-check';

// Updated interface for inventory items to include the lowStockThreshold
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
  interval: number; // em minutos
  lowStockEnabled: boolean;
  outOfStockEnabled: boolean;
}

// Configuração de como as notificações devem aparecer
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Definir a tarefa em background
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
  
  // Inicializar o serviço de notificações e configurar listener de autenticação
  static async initialize() {
    console.log('[NotificationService] Inicializando serviço de notificações...');
    
    // Limpar dados antigos para evitar erro de banco de dados cheio
    await this.cleanupStorage();
    
    // Registrar para notificações push
    await this.registerForPushNotificationsAsync();
    
    // Configurar listener de autenticação (apenas uma vez)
    if (!this.authListenerInitialized) {
      this.setupAuthListener();
      this.authListenerInitialized = true;
    }

    // Registrar tarefa em background
    await this.registerBackgroundTask();
  }

  // Novo método para obter configurações de notificação
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
    
    // Configurações padrão
    const defaultSettings = {
      enabled: true,
      interval: 60, // 1 hora por padrão
      lowStockEnabled: true,
      outOfStockEnabled: true,
    };
    
    console.log('[NotificationService] Usando configurações padrão:', defaultSettings);
    return defaultSettings;
  }

  // Salvar configurações de notificação
static async saveNotificationSettings(settings: NotificationSettings) {
  try {
    // Salvar localmente
    await AsyncStorage.setItem('notificationSettings', JSON.stringify(settings));
    console.log('[NotificationService] Configurações salvas localmente:', settings);
    
    // 🆕 SALVAR NO FIRESTORE PARA O FIREBASE FUNCTIONS
    const userId = auth.currentUser?.uid;
    if (userId) {
      await setDoc(doc(db, 'userNotificationSettings', userId), {
        enabled: settings.enabled,
        interval: settings.interval,
        lowStockEnabled: settings.lowStockEnabled,
        outOfStockEnabled: settings.outOfStockEnabled,
        updatedAt: new Date()
      });
      console.log('[NotificationService] Configurações salvas no Firestore para Firebase Functions');
    }
    
    // Reconfigurar verificação periódica com novo intervalo
    if (auth.currentUser) {
      await this.setupPeriodicStockCheck();
    }
  } catch (error) {
    console.error('[NotificationService] Erro ao salvar configurações:', error);
    throw error;
  }
}

  // Limpar AsyncStorage para evitar erro SQLITE_FULL
  static async cleanupStorage() {
    try {
      console.log('[NotificationService] Iniciando limpeza do AsyncStorage...');
      
      // Obter todas as chaves
      const allKeys = await AsyncStorage.getAllKeys();
      console.log(`[NotificationService] Total de chaves no storage: ${allKeys.length}`);
      
      // Filtrar chaves antigas ou temporárias para remoção
      const keysToRemove = allKeys.filter(key => 
        key.startsWith('temp_') || 
        key.startsWith('cache_') ||
        key.includes('old_') ||
        key.includes('backup_') ||
        key.includes('expired_') ||
        // Limpar histórico de pesquisa antigo (manter apenas os 5 mais recentes)
        (key === 'searchHistory' && Math.random() > 0.7)
      );
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`[NotificationService] Removidas ${keysToRemove.length} chaves antigas`);
      }

      // Verificar se ainda há muitas chaves e fazer limpeza mais agressiva se necessário
      const remainingKeys = await AsyncStorage.getAllKeys();
      if (remainingKeys.length > 100) {
        console.log('[NotificationService] Muitas chaves detectadas, fazendo limpeza agressiva...');
        
        // Manter apenas as chaves essenciais
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
        
        // Remover 70% das chaves não essenciais
        const keysToRemoveAggressively = nonEssentialKeys.slice(0, Math.floor(nonEssentialKeys.length * 0.7));
        if (keysToRemoveAggressively.length > 0) {
          await AsyncStorage.multiRemove(keysToRemoveAggressively);
          console.log(`[NotificationService] Removidas ${keysToRemoveAggressively.length} chaves adicionais na limpeza agressiva`);
        }
      }
      
      const finalKeys = await AsyncStorage.getAllKeys();
      console.log(`[NotificationService] Limpeza concluída. Chaves restantes: ${finalKeys.length}`);
      
    } catch (error) {
      console.error('[NotificationService] Erro durante limpeza do storage:', error);
      
      // Em caso de erro crítico, tentar limpar completamente
      try {
        console.log('[NotificationService] Tentando limpeza completa devido a erro...');
        await AsyncStorage.clear();
        console.log('[NotificationService] AsyncStorage limpo completamente');
      } catch (clearError) {
        console.error('[NotificationService] Erro crítico - não foi possível limpar storage:', clearError);
      }
    }
  }

  // Registrar para notificações push
  static async registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Alertas de Inventário',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3498db',
        sound: 'default',
        description: 'Notificações sobre níveis de stock do inventário',
      });

      // Canal específico para stock baixo
      await Notifications.setNotificationChannelAsync('low-stock', {
        name: 'Stock Baixo',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#f39c12',
        sound: 'default',
        description: 'Alertas quando produtos estão com stock baixo',
      });

      // Canal específico para falta de stock
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
        const projectId = '3abf848f-326e-4719-a3c6-9c4c60605aa7'; // Seu project ID do EAS
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
  this.lastNotificationTime = 0; // Reset temporário do debounce
  
  try {
    await this.checkStockLevels();
  } finally {
    // Se não houve nova notificação, restaurar o tempo original
    if (this.lastNotificationTime === 0) {
      this.lastNotificationTime = originalTime;
    }
  }
}
  // Configurar listener de autenticação
  static setupAuthListener() {
    console.log('[NotificationService] Configurando listener de autenticação...');
    
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log('[NotificationService] Usuário autenticado, iniciando monitoramento de stock');
        await this.setupPeriodicStockCheck();
      } else {
        console.log('[NotificationService] Usuário deslogado, parando monitoramento de stock');
        this.stopPeriodicStockCheck();
      }
    });
  }

  // Registrar tarefa em background
  static async registerBackgroundTask() {
    try {
      if (this.isBackgroundTaskRegistered) {
        console.log('[NotificationService] Tarefa em background já registada');
        return;
      }

      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
      if (!isRegistered) {
        console.log('[NotificationService] Registando tarefa em background...');
        // A tarefa já foi definida no início do arquivo
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

  // Configurar verificação periódica de stock
static async setupPeriodicStockCheck() {
  try {
    // 🆕 DESABILITAR VERIFICAÇÃO LOCAL - USAR SÓ FIREBASE FUNCTIONS
    console.log('[NotificationService] Verificação de stock delegada para Firebase Functions');
    
    // Limpar interval anterior se existir
    if (this.stockCheckInterval) {
      clearInterval(this.stockCheckInterval);
      this.stockCheckInterval = null;
    }
    
    // Não criar novo interval - Firebase Functions vai cuidar disso
    console.log('[NotificationService] Firebase Functions gerenciará as notificações de stock');
    
  } catch (error) {
    console.error('[NotificationService] Erro ao configurar verificação periódica:', error);
  }
}

  // Parar verificação periódica
  static stopPeriodicStockCheck() {
    if (this.stockCheckInterval) {
      clearInterval(this.stockCheckInterval);
      this.stockCheckInterval = null;
      console.log('[NotificationService] Verificação periódica de stock interrompida');
    }
  }


  
  // Verificar níveis de stock
static async checkStockLevels() {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.log('[NotificationService] Usuário não autenticado para verificação de stock');
      return;
    }

    // Obter configurações primeiro para calcular debounce dinâmico
    const settings = await this.getNotificationSettings();
    if (!settings.enabled) {
      console.log('[NotificationService] Notificações desabilitadas, cancelando verificação');
      return;
    }

    // Implementar debounce dinâmico baseado no intervalo configurado
    const now = Date.now();
    // Usar 50% do intervalo configurado como debounce mínimo, mas nunca menos que 30 segundos
    const configuredIntervalMs = settings.interval * 60 * 1000;
    const minInterval = Math.max(configuredIntervalMs * 0.5, 30000); // Mínimo 30 segundos
    
    if (now - this.lastNotificationTime < minInterval) {
      console.log(`[NotificationService] Verificação em debounce - muito recente (${Math.round((now - this.lastNotificationTime) / 1000)}s < ${Math.round(minInterval / 1000)}s), ignorando...`);
      return;
    }

    console.log('[NotificationService] Iniciando verificação de níveis de stock...');

    // Obter configurações do usuário para threshold global
    const userSettings = await getUserSettings();
    const globalThreshold = parseInt(userSettings?.globalLowStockThreshold || '5');
    console.log(`[NotificationService] Threshold global configurado: ${globalThreshold}`);

    // Buscar todos os itens do inventário do usuário
    const inventoryRef = collection(db, 'inventory');
    const q = query(inventoryRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);

    const lowStockItems: InventoryItem[] = [];
    const outOfStockItems: InventoryItem[] = [];

    // Processar cada item do inventário
    snapshot.forEach((doc) => {
      const item = { id: doc.id, ...doc.data() } as InventoryItem;
      const quantity = parseInt(item.quantity.toString()) || 0;
      
      if (quantity === 0) {
        outOfStockItems.push(item);
      } else {
        // Verificar threshold personalizado do item ou usar o global
        let threshold = globalThreshold;
        if (item.lowStockThreshold) {
          const customThreshold = parseInt(item.lowStockThreshold);
          if (!isNaN(customThreshold) && customThreshold > 0) {
            threshold = customThreshold;
          }
        }
        
        if (quantity <= threshold) {
          lowStockItems.push(item);
        }
      }
    });

    console.log(`[NotificationService] Verificação concluída - Stock baixo: ${lowStockItems.length}, Sem stock: ${outOfStockItems.length}`);

    // Gerar notificações se necessário
    if ((settings.lowStockEnabled && lowStockItems.length > 0) || 
        (settings.outOfStockEnabled && outOfStockItems.length > 0)) {
      await this.generateStockNotifications(lowStockItems, outOfStockItems, settings);
      this.lastNotificationTime = now;
    }

  } catch (error) {
    console.error('[NotificationService] Erro ao verificar níveis de stock:', error);
  }
}

  // Gerar notificações de stock
static async generateStockNotifications(
  lowStockItems: InventoryItem[], 
  outOfStockItems: InventoryItem[],
  settings: NotificationSettings
) {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.log('[NotificationService] Usuário não autenticado para gerar notificações');
      return;
    }

    console.log('[NotificationService] Gerando notificações de stock...');
    console.log(`[NotificationService] Items com stock baixo: ${lowStockItems.length}`);
    console.log(`[NotificationService] Items sem stock: ${outOfStockItems.length}`);
    console.log(`[NotificationService] Configurações - lowStock: ${settings.lowStockEnabled}, outOfStock: ${settings.outOfStockEnabled}`);

    // Verificar se já existem notificações não lidas similares para evitar spam
    const notificationsRef = collection(db, 'notifications');
    const existingQuery = query(
      notificationsRef,
      where('userId', '==', userId),
      where('read', '==', false)
    );
    const existingSnapshot = await getDocs(existingQuery);
    
    const hasUnreadLowStockNotification = existingSnapshot.docs.some(doc => {
      const title = doc.data().title;
      console.log(`[NotificationService] Verificando notificação existente: "${title}"`);
      return title.includes('Stock Baixo');
    });
    
    const hasUnreadOutOfStockNotification = existingSnapshot.docs.some(doc => {
      const title = doc.data().title;
      return title.includes('Falta de Stock');
    });

    console.log(`[NotificationService] Notificação de stock baixo não lida existente: ${hasUnreadLowStockNotification}`);
    console.log(`[NotificationService] Notificação de falta de stock não lida existente: ${hasUnreadOutOfStockNotification}`);

    // Gerar notificação de stock baixo
    if (settings.lowStockEnabled && lowStockItems.length > 0 && !hasUnreadLowStockNotification) {
      console.log('[NotificationService] Criando notificação de stock baixo...');
      
      const title = 'Alerta de Stock Baixo';
      const itemNames = lowStockItems.slice(0, 3).map(item => item.name).join(', ');
      const extraCount = lowStockItems.length > 3 ? ` e mais ${lowStockItems.length - 3}` : '';
      const message = lowStockItems.length === 1 
        ? `${itemNames} está com stock baixo`
        : `${lowStockItems.length} produtos com stock baixo: ${itemNames}${extraCount}`;
      
      console.log(`[NotificationService] Título: ${title}`);
      console.log(`[NotificationService] Mensagem: ${message}`);
      
      try {
        // Salvar notificação no Firestore
        const docRef = await addDoc(notificationsRef, {
          userId,
          title,
          message,
          timestamp: serverTimestamp(),
          read: false,
          type: 'low-stock',
          itemIds: lowStockItems.map(item => item.id).filter(Boolean)
        });
        
        console.log(`[NotificationService] Notificação salva no Firestore com ID: ${docRef.id}`);

        // Enviar notificação local
        await this.sendLocalNotification(title, message, 'low-stock');
        console.log(`[NotificationService] Notificação de stock baixo enviada para ${lowStockItems.length} itens`);
      } catch (error) {
        console.error('[NotificationService] Erro ao salvar/enviar notificação de stock baixo:', error);
      }
    } else {
      console.log(`[NotificationService] Notificação de stock baixo não enviada - Enabled: ${settings.lowStockEnabled}, Items: ${lowStockItems.length}, HasUnread: ${hasUnreadLowStockNotification}`);
    }

    // Gerar notificação de falta de stock
    if (settings.outOfStockEnabled && outOfStockItems.length > 0 && !hasUnreadOutOfStockNotification) {
      console.log('[NotificationService] Criando notificação de falta de stock...');
      
      const title = 'Alerta de Falta de Stock';
      const itemNames = outOfStockItems.slice(0, 3).map(item => item.name).join(', ');
      const extraCount = outOfStockItems.length > 3 ? ` e mais ${outOfStockItems.length - 3}` : '';
      const message = outOfStockItems.length === 1 
        ? `${itemNames} está sem stock`
        : `${outOfStockItems.length} produtos sem stock: ${itemNames}${extraCount}`;
      
      console.log(`[NotificationService] Título: ${title}`);
      console.log(`[NotificationService] Mensagem: ${message}`);
      
      try {
        // Salvar notificação no Firestore
        const docRef = await addDoc(notificationsRef, {
          userId,
          title,
          message,
          timestamp: serverTimestamp(),
          read: false,
          type: 'out-of-stock',
          itemIds: outOfStockItems.map(item => item.id).filter(Boolean)
        });
        
        console.log(`[NotificationService] Notificação salva no Firestore com ID: ${docRef.id}`);

        // Enviar notificação local
        await this.sendLocalNotification(title, message, 'out-of-stock');
        console.log(`[NotificationService] Notificação de falta de stock enviada para ${outOfStockItems.length} itens`);
      } catch (error) {
        console.error('[NotificationService] Erro ao salvar/enviar notificação de falta de stock:', error);
      }
    } else {
      console.log(`[NotificationService] Notificação de falta de stock não enviada - Enabled: ${settings.outOfStockEnabled}, Items: ${outOfStockItems.length}, HasUnread: ${hasUnreadOutOfStockNotification}`);
    }

  } catch (error) {
    console.error('[NotificationService] Erro ao gerar notificações de stock:', error);
  }
}
  // Enviar notificação local
static async sendLocalNotification(title: string, body: string, type?: 'low-stock' | 'out-of-stock') {
  try {
    console.log(`[NotificationService] Tentando enviar notificação local: ${title}`);
    
    // Verificar se as notificações estão habilitadas
    const { status } = await Notifications.getPermissionsAsync();
    console.log(`[NotificationService] Status da permissão: ${status}`);
    
    if (status !== 'granted') {
      console.log('[NotificationService] Permissão de notificação não concedida');
      return;
    }
    
    // Determinar canal e configurações baseadas no tipo
    let channelId = 'default';
    let priority = Notifications.AndroidNotificationPriority.HIGH;
    
    if (type === 'low-stock') {
      channelId = 'low-stock';
      priority = Notifications.AndroidNotificationPriority.HIGH;
    } else if (type === 'out-of-stock') {
      channelId = 'out-of-stock';
      priority = Notifications.AndroidNotificationPriority.MAX;
    }
    
    console.log(`[NotificationService] Usando canal: ${channelId}, prioridade: ${priority}`);
    
    // Agendar notificação para ser exibida imediatamente
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority,
        data: type ? { type } : undefined,
      },
      trigger: null, // Exibir imediatamente
    });
    
    console.log(`[NotificationService] Notificação local agendada com ID: ${notificationId}`);
    console.log(`[NotificationService] Notificação local enviada: ${title}`);
  } catch (error) {
    console.error('[NotificationService] Erro ao enviar notificação local:', error);
  }
}

  // Agendar notificação de stock baixo (método legado mantido para compatibilidade)
  static async scheduleLowStockNotification(items: InventoryItem[]) {
    // Limitar o número de itens mostrados na notificação
    const maxItemsToShow = 3;
    let itemNames = items.slice(0, maxItemsToShow).map(item => item.name).join(', ');
    
    if (items.length > maxItemsToShow) {
      itemNames += ` e mais ${items.length - maxItemsToShow} ${items.length - maxItemsToShow === 1 ? 'produto' : 'produtos'}`;
    }
    
    // Usar o número correto de itens no título
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Alerta de Stock Baixo',
        body: items.length === 1
          ? `O produto ${itemNames} está com stock baixo`
          : `${items.length} produtos com stock baixo: ${itemNames}`,
        data: { type: 'low-stock', count: items.length },
      },
      trigger: null, // Para notificação imediata
    });
  }

  // Agendar notificação de falta de stock (método legado mantido para compatibilidade)
  static async scheduleOutOfStockNotification(items: InventoryItem[]) {
    // Limitar o número de itens mostrados na notificação
    const maxItemsToShow = 3;
    let itemNames = items.slice(0, maxItemsToShow).map(item => item.name).join(', ');
    
    if (items.length > maxItemsToShow) {
      itemNames += ` e mais ${items.length - maxItemsToShow} ${items.length - maxItemsToShow === 1 ? 'produto' : 'produtos'}`;
    }
    
    // Usar o número correto de itens no título
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Alerta de Falta de Stock',
        body: items.length === 1
          ? `O produto ${itemNames} está sem stock`
          : `${items.length} produtos sem stock: ${itemNames}`,
        data: { type: 'out-of-stock', count: items.length },
      },
      trigger: null, // Para notificação imediata
    });
  }

  // Obter status das permissões de notificação
  static async getNotificationPermissionStatus() {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status;
    } catch (error) {
      console.error('[NotificationService] Erro ao verificar permissões de notificação:', error);
      return 'undetermined';
    }
  }

  // Limpar dados do usuário do cache
  static async clearUserDataFromCache() {
    try {
      const keysToRemove = [
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

  // Cancelar todas as notificações pendentes
  static async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('[NotificationService] Todas as notificações pendentes foram canceladas');
    } catch (error) {
      console.error('[NotificationService] Erro ao cancelar notificações:', error);
    }
  }

  // Cancelar notificações por identificador
  static async cancelNotificationsByIdentifier(identifier: string) {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
      console.log(`[NotificationService] Notificação cancelada: ${identifier}`);
    } catch (error) {
      console.error(`[NotificationService] Erro ao cancelar notificação ${identifier}:`, error);
    }
  }

  // Obter todas as notificações agendadas
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

  // Configurar badge do app (iOS)
  static async setBadgeCount(count: number) {
    try {
      await Notifications.setBadgeCountAsync(count);
      console.log(`[NotificationService] Badge count definido para: ${count}`);
    } catch (error) {
      console.error('[NotificationService] Erro ao definir badge count:', error);
    }
  }

  // Limpar badge do app
  static async clearBadge() {
    try {
      await Notifications.setBadgeCountAsync(0);
      console.log('[NotificationService] Badge limpo');
    } catch (error) {
      console.error('[NotificationService] Erro ao limpar badge:', error);
    }
  }

  // Método para testar notificações (útil para desenvolvimento)
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

  // Verificar se o dispositivo suporta notificações
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

  // Configurar listener para quando o app recebe uma notificação
  static setupNotificationReceivedListener() {
    return Notifications.addNotificationReceivedListener(notification => {
      console.log('[NotificationService] Notificação recebida:', notification);
      // Aqui você pode adicionar lógica adicional quando uma notificação é recebida
    });
  }

  // Configurar listener para quando o usuário toca em uma notificação
  static setupNotificationResponseListener() {
    return Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[NotificationService] Resposta à notificação:', response);
      
      // Extrair dados da notificação
      const notificationData = response.notification.request.content.data;
      
      if (notificationData?.type === 'low-stock') {
        // Navegar para tela de stock baixo
        console.log('[NotificationService] Navegando para tela de stock baixo');
      } else if (notificationData?.type === 'out-of-stock') {
        // Navegar para tela de falta de stock
        console.log('[NotificationService] Navegando para tela de falta de stock');
      }
    });
  }

  // Método para limpar recursos quando o app é fechado
  static cleanup() {
    console.log('[NotificationService] Limpando recursos do serviço de notificações...');
    
    // Parar verificação periódica
    this.stopPeriodicStockCheck();
    
    // Limpar flags
    this.authListenerInitialized = false;
    this.isBackgroundTaskRegistered = false;
    this.lastNotificationTime = 0;
    
    console.log('[NotificationService] Limpeza concluída');
  }
}

// Inicializar o serviço automaticamente quando o módulo é importado
NotificationService.initialize().catch(error => {
  console.error('[NotificationService] Erro na inicialização automática:', error);
});

// Exportar o serviço como padrão também para compatibilidade
export default NotificationService;

// Exportar tipos para uso em outros arquivos
export type { InventoryItem, NotificationSettings };

// Exportar constantes úteis
export const NOTIFICATION_TYPES = {
  LOW_STOCK: 'low-stock',
  OUT_OF_STOCK: 'out-of-stock',
  GENERAL: 'general'
} as const;

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  interval: 60, // 1 hora
  lowStockEnabled: true,
  outOfStockEnabled: true,
};

// Função utilitária para formatar mensagens de notificação
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

// Função para validar configurações de notificação
export const validateNotificationSettings = (settings: Partial<NotificationSettings>): NotificationSettings => {
  return {
    enabled: settings.enabled ?? DEFAULT_NOTIFICATION_SETTINGS.enabled,
    interval: Math.max(settings.interval ?? DEFAULT_NOTIFICATION_SETTINGS.interval, 1), // Mínimo 1 minuto
    lowStockEnabled: settings.lowStockEnabled ?? DEFAULT_NOTIFICATION_SETTINGS.lowStockEnabled,
    outOfStockEnabled: settings.outOfStockEnabled ?? DEFAULT_NOTIFICATION_SETTINGS.outOfStockEnabled,
  };
};

// Hook para usar o serviço de notificações em componentes React
export const useNotificationService = () => {
  const [settings, setSettings] = React.useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [permissionStatus, setPermissionStatus] = React.useState<string>('undetermined');

  React.useEffect(() => {
    // Carregar configurações ao montar o componente
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