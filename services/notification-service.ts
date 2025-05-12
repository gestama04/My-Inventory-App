import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { auth, db } from '../firebase-config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getUserSettings } from '../inventory-service';
import { onAuthStateChanged } from 'firebase/auth';

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

// Configuração de como as notificações devem aparecer
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class NotificationService {
  private static authListenerInitialized = false;
  
  // Inicializar o serviço de notificações e configurar listener de autenticação
  static async initialize() {
    // Limpar dados antigos para evitar erro de banco de dados cheio
    await this.cleanupStorage();
    
    // Registrar para notificações push
    await this.registerForPushNotificationsAsync();
    
    // Configurar listener de autenticação (apenas uma vez)
    if (!this.authListenerInitialized) {
      this.setupAuthListener();
      this.authListenerInitialized = true;
    }
  }
  
  // Método para limpar dados antigos e liberar espaço
  static async cleanupStorage() {
    try {
      console.log("Iniciando limpeza de armazenamento...");
      
      // 1. Limpar histórico antigo (manter apenas os últimos 100 itens)
      const localHistoryData = await AsyncStorage.getItem("localItemHistory");
      if (localHistoryData) {
        try {
          const history = JSON.parse(localHistoryData);
          if (history.length > 100) {
            const trimmedHistory = history.slice(0, 100);
            await AsyncStorage.setItem("localItemHistory", JSON.stringify(trimmedHistory));
            console.log(`Histórico local reduzido de ${history.length} para 100 itens`);
          }
        } catch (e) {
          // Se houver erro no parsing, remover o item corrompido
          await AsyncStorage.removeItem("localItemHistory");
          console.log("Histórico local corrompido foi removido");
        }
      }
      
      const cachedHistoryData = await AsyncStorage.getItem("cachedItemHistory");
      if (cachedHistoryData) {
        try {
          const history = JSON.parse(cachedHistoryData);
          if (history.length > 100) {
            const trimmedHistory = history.slice(0, 100);
            await AsyncStorage.setItem("cachedItemHistory", JSON.stringify(trimmedHistory));
            console.log(`Histórico em cache reduzido de ${history.length} para 100 itens`);
          }
        } catch (e) {
          // Se houver erro no parsing, remover o item corrompido
          await AsyncStorage.removeItem("cachedItemHistory");
          console.log("Histórico em cache corrompido foi removido");
        }
      }
      
      // 2. Limpar uploads de imagens pendentes antigos (mais de 7 dias)
      const pendingUploadsData = await AsyncStorage.getItem("pendingImageUploads");
      if (pendingUploadsData) {
        try {
          const uploads = JSON.parse(pendingUploadsData);
          const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
          const recentUploads = uploads.filter((upload: any) => 
            !upload.timestamp || upload.timestamp > oneWeekAgo
          );
          if (recentUploads.length < uploads.length) {
            await AsyncStorage.setItem("pendingImageUploads", JSON.stringify(recentUploads));
            console.log(`Uploads pendentes reduzidos de ${uploads.length} para ${recentUploads.length}`);
          }
        } catch (e) {
          // Se houver erro no parsing, remover o item corrompido
          await AsyncStorage.removeItem("pendingImageUploads");
          console.log("Lista de uploads pendentes corrompida foi removida");
        }
      }
      
      // 3. Limpar fila de sincronização antiga (mais de 30 dias)
      const syncQueueData = await AsyncStorage.getItem("syncQueue");
      if (syncQueueData) {
        try {
          const queue = JSON.parse(syncQueueData);
          const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
          const recentQueue = queue.filter((item: any) => 
            !item.timestamp || item.timestamp > thirtyDaysAgo
          );
          if (recentQueue.length < queue.length) {
            await AsyncStorage.setItem("syncQueue", JSON.stringify(recentQueue));
            console.log(`Fila de sincronização reduzida de ${queue.length} para ${recentQueue.length}`);
          }
        } catch (e) {
          // Se houver erro no parsing, remover o item corrompido
          await AsyncStorage.removeItem("syncQueue");
          console.log("Fila de sincronização corrompida foi removida");
        }
      }
      
      console.log("Limpeza de armazenamento concluída");
    } catch (error) {
      console.error("Erro durante limpeza de armazenamento:", error);
    }
  }
  
  // Configurar listener de autenticação
  private static setupAuthListener() {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("Utilizador autenticado, a configurar verificação periódica de stock");
        this.setupPeriodicStockCheck();
      } else {
        console.log("Utilizador desconectado, a limpar verificação periódica de stock");
        this.clearStockCheck();
      }
    });
  }

  // Registrar para notificações push
  static async registerForPushNotificationsAsync() {
    if (!Device.isDevice) {
      console.log('Notificações push só funcionam em dispositivos físicos');
      return;
    }
    
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Permissão para notificações não concedida!');
      return;
    }
    
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
  }

  // Limpar verificação periódica de stock
  static async clearStockCheck() {
    try {
      // Obter o ID do intervalo armazenado
      const intervalId = await AsyncStorage.getItem('stockCheckIntervalId');
      if (intervalId) {
        // Limpar o intervalo
        clearInterval(parseInt(intervalId));
        // Remover o ID do intervalo do AsyncStorage
        await AsyncStorage.removeItem('stockCheckIntervalId');
        console.log("Verificação periódica de stock interrompida");
      }
    } catch (error) {
      console.error("Erro ao limpar verificação de stock:", error);
    }
  }

  static async debugStockCounts() {
    try {
      // Verificar se o Utilizador está autenticado
      if (!auth.currentUser) {
        console.log('DEBUG: Utilizador não autenticado, não é possível verificar níveis de stock');
        return { lowStockItems: [], outOfStockItems: [] };
      }
      
      const userId = auth.currentUser.uid;
      
      // Obter configurações do Utilizador para o threshold global
      const userSettings = await getUserSettings();
      const globalThreshold = userSettings && 'globalLowStockThreshold' in userSettings
        ? userSettings.globalLowStockThreshold || '5'  // Adicionar fallback se for null
        : '5';
      
      console.log("DEBUG: Threshold global:", globalThreshold);
      
      // Buscar itens diretamente do Firestore
      const inventoryRef = collection(db, 'inventory');
      const q = query(inventoryRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      const inventory: InventoryItem[] = [];
      snapshot.forEach(doc => {
        inventory.push({ id: doc.id, ...doc.data() } as InventoryItem);
      });
      
      console.log(`DEBUG: Total de itens no inventário: ${inventory.length}`);
      
      // Listar todos os itens com suas quantidades
      inventory.forEach(item => {
        const quantity = item.quantity !== null && item.quantity !== undefined 
          ? item.quantity 
          : '0';
        const threshold = item.lowStockThreshold !== null && item.lowStockThreshold !== undefined
          ? item.lowStockThreshold
          : globalThreshold;
        console.log(`DEBUG: Item: ${item.name}, Quantidade: ${quantity}, Threshold: ${threshold}`);
      });
      
      // Filtrar itens considerando thresholds personalizados
      const lowStockItems = inventory.filter(item => {
        // Adicionar verificação de null/undefined
        const quantityStr = item.quantity !== null && item.quantity !== undefined 
          ? item.quantity.toString() 
          : '0';
        const quantity = parseInt(quantityStr);
        
        // Verificar se este item tem um threshold personalizado
        if (item.lowStockThreshold !== null && item.lowStockThreshold !== undefined) {
          const thresholdStr = item.lowStockThreshold.toString();
          const customThreshold = parseInt(thresholdStr);
          // Considerar apenas thresholds válidos (não NaN)
          if (!isNaN(customThreshold)) {
            return quantity <= customThreshold && quantity > 0;
          }
        }
        
        // Usar threshold global se não houver threshold personalizado ou se for inválido
        return quantity <= parseInt(globalThreshold) && quantity > 0;
      });
      
      const outOfStockItems = inventory.filter(item => {
        // Adicionar verificação de null/undefined
        const quantityStr = item.quantity !== null && item.quantity !== undefined 
          ? item.quantity.toString() 
          : '0';
        const quantity = parseInt(quantityStr);
        return quantity === 0;
      });
      
      console.log(`DEBUG: Itens com stock baixo: ${lowStockItems.length}`);
      console.log(`DEBUG: Itens sem stock: ${outOfStockItems.length}`);
      
      // Listar itens com stock baixo
      console.log("DEBUG: Lista de itens com stock baixo:");
      lowStockItems.forEach(item => {
        console.log(`DEBUG: - ${item.name} (Quantidade: ${item.quantity})`);
      });
      
      // Listar itens sem stock
      console.log("DEBUG: Lista de itens sem stock:");
      outOfStockItems.forEach(item => {
        console.log(`DEBUG: - ${item.name}`);
      });
      
      return { lowStockItems, outOfStockItems };
    } catch (error) {
      console.error('DEBUG: Erro ao contar itens:', error);
      return { lowStockItems: [], outOfStockItems: [] };
    }
  }

  static async checkStockLevels() {
    try {
      // Verificar se o Utilizador está autenticado
      if (!auth.currentUser) {
        console.log("Utilizador não autenticado, não é possível verificar níveis de stock");
        return;
      }
      
      const userId = auth.currentUser.uid;
      
      // Obter configurações do Utilizador para o threshold global
      const userSettings = await getUserSettings();
      const globalThreshold = userSettings && 'globalLowStockThreshold' in userSettings
        ? userSettings.globalLowStockThreshold || '5'  // Adicionar fallback se for null
        : '5';
      
      console.log("Verificando níveis de stock com threshold global:", globalThreshold);
      
      // Buscar itens diretamente do Firestore para garantir dados atualizados
      const inventoryRef = collection(db, 'inventory');
      const q = query(inventoryRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      const inventory: InventoryItem[] = [];
      snapshot.forEach(doc => {
        inventory.push({ id: doc.id, ...doc.data() } as InventoryItem);
      });
      
      console.log(`Total de itens no inventário: ${inventory.length}`);
      
      // Filtrar itens considerando thresholds personalizados
      const lowStockItems = inventory.filter(item => {
        // Adicionar verificação de null/undefined
        const quantityStr = item.quantity !== null && item.quantity !== undefined 
          ? item.quantity.toString() 
          : '0';
        const quantity = parseInt(quantityStr);
        
        // Verificar se este item tem um threshold personalizado
        if (item.lowStockThreshold !== null && item.lowStockThreshold !== undefined) {
          const thresholdStr = item.lowStockThreshold.toString();
          const customThreshold = parseInt(thresholdStr);
          // Considerar apenas thresholds válidos (não NaN)
          if (!isNaN(customThreshold)) {
            return quantity <= customThreshold && quantity > 0;
          }
        }
        
        // Usar threshold global se não houver threshold personalizado ou se for inválido
        return quantity <= parseInt(globalThreshold) && quantity > 0;
      });
      
      const outOfStockItems = inventory.filter(item => {
        // Adicionar verificação de null/undefined
        const quantityStr = item.quantity !== null && item.quantity !== undefined 
          ? item.quantity.toString() 
          : '0';
        const quantity = parseInt(quantityStr);
        return quantity === 0; // Sempre alertar para itens com estoque zero
      });
      
      console.log(`Itens com stock baixo: ${lowStockItems.length}`);
      console.log(`Itens sem stock: ${outOfStockItems.length}`);
      
            // Verificar se já existe uma notificação recente para evitar duplicação
            const lastNotificationTime = await AsyncStorage.getItem('lastStockNotificationTime');
            const currentTime = Date.now();
            
            // Só envia notificações se a última foi há mais de 1 hora ou se nunca foi enviada
            if (!lastNotificationTime || (currentTime - parseInt(lastNotificationTime)) > 3600000) {
              // Agendar novas notificações se necessário
              if (lowStockItems.length > 0) {
                await this.scheduleLowStockNotification(lowStockItems);
              }
              
              if (outOfStockItems.length > 0) {
                await this.scheduleOutOfStockNotification(outOfStockItems);
              }
              
              // Atualizar o timestamp da última notificação
              await AsyncStorage.setItem('lastStockNotificationTime', currentTime.toString());
            } else {
              console.log("Notificação recente já enviada, aguardando intervalo mínimo");
            }
          } catch (error) {
            console.error('Erro ao verificar níveis de stock:', error);
          }
        }
      
        // Agendar notificação para itens com baixo stock
        static async scheduleLowStockNotification(items: InventoryItem[]) {
          // Limitar o número de itens mostrados na notificação
          const maxItemsToShow = 3;
          let itemNames = items.slice(0, maxItemsToShow).map(item => item.name).join(', ');
          
          if (items.length > maxItemsToShow) {
            itemNames += ` e mais ${items.length - maxItemsToShow} ${items.length - maxItemsToShow === 1 ? 'item' : 'itens'}`;
          }
          
          // Criar uma versão simplificada dos itens para a notificação
          const simplifiedItems = items.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity
          }));
          
          // Usar o número correto de itens no título
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Alerta de Stock Baixo',
              body: items.length === 1
                ? `O item ${itemNames} está com stock baixo`
                : `${items.length} itens com stock baixo: ${itemNames}`,
              data: { type: 'low-stock', count: items.length },
            },
            trigger: null, // Para notificação imediata
          });
        }
        
        // Agendar notificação para itens sem stock
        static async scheduleOutOfStockNotification(items: InventoryItem[]) {
          // Limitar o número de itens mostrados na notificação
          const maxItemsToShow = 3;
          let itemNames = items.slice(0, maxItemsToShow).map(item => item.name).join(', ');
          
          if (items.length > maxItemsToShow) {
            itemNames += ` e mais ${items.length - maxItemsToShow} ${items.length - maxItemsToShow === 1 ? 'item' : 'itens'}`;
          }
          
          // Criar uma versão simplificada dos itens para a notificação
          const simplifiedItems = items.map(item => ({
            id: item.id,
            name: item.name
          }));
          
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
      
        // Modificar o método sendLocalNotification para incluir o tipo
        static async sendLocalNotification(title: string, body: string, type?: 'low-stock' | 'out-of-stock') {
          try {
            // Verificar se as notificações estão habilitadas
            const { status } = await Notifications.getPermissionsAsync();
            if (status !== 'granted') {
              console.log('Permissão de notificação não concedida');
              return;
            }
            
            // Agendar notificação para ser exibida imediatamente
            await Notifications.scheduleNotificationAsync({
              content: {
                title,
                body,
                sound: true,
                priority: Notifications.AndroidNotificationPriority.HIGH,
                data: type ? { type } : undefined,
              },
              trigger: null, // Exibir imediatamente
            });
          } catch (error) {
            console.error('Erro ao enviar notificação local:', error);
          }
        }
      
        // Configurar verificação periódica de stock (chamar na inicialização do app)
        static async setupPeriodicStockCheck() {
          try {
            // Verificar se o Utilizador está autenticado
            if (!auth.currentUser) {
              console.log("Utilizador não autenticado, não é possível configurar verificação periódica");
              return;
            }
            
            // Limpar dados antigos para evitar erro de banco de dados cheio
            await this.cleanupStorage();
            
            // Limpar qualquer intervalo existente
            await this.clearStockCheck();
            
            // Configura um intervalo para verificar periodicamente
            const newIntervalId = setInterval(() => {
              this.checkStockLevels();
            }, 3600000); // Verifica a cada hora (3600000ms)
            
            // Armazenar o ID do intervalo
            await AsyncStorage.setItem('stockCheckIntervalId', newIntervalId.toString());
            
            // Executar uma verificação inicial imediatamente
            await this.checkStockLevels();
            
            console.log("Verificação periódica de stock configurada com sucesso");
          } catch (error) {
            console.error('Erro ao configurar verificação periódica:', error);
          }
        }
      }
      
