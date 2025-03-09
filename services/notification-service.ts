import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Definir a interface para os itens do inventário
interface InventoryItem {
  id?: string;
  name: string;
  quantity: string | number;
  category?: string;
  price?: string | number;
  // Adicione outros campos conforme necessário
}

// Configuração de como as notificações devem aparecer
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});


export class NotificationService {
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

  // Verificar níveis de stock e agendar notificações conforme necessário
  static async checkStockLevels() {
    try {
      const inventoryData = await AsyncStorage.getItem('inventory');
      if (!inventoryData) return;
     
      const inventory: InventoryItem[] = JSON.parse(inventoryData);
      const lowStockItems = inventory.filter(item => {
        const quantity = parseInt(item.quantity.toString());
        return quantity <= 5 && quantity > 0; // Alerta para itens com 5 ou menos unidades
      });
     
      const outOfStockItems = inventory.filter(item => {
        const quantity = parseInt(item.quantity.toString());
        return quantity === 0; // Alerta para itens sem stock
      });
     
      // Agendar novas notificações se necessário
      if (lowStockItems.length > 0) {
        await this.scheduleLowStockNotification(lowStockItems);
      }
     
      if (outOfStockItems.length > 0) {
        await this.scheduleOutOfStockNotification(outOfStockItems);
      }
     
    } catch (error) {
      console.error('Erro ao verificar níveis de stock:', error);
    }
  }

  // Agendar notificação para itens com baixo stock
  static async scheduleLowStockNotification(items: InventoryItem[]) {
    const itemNames = items.map(item => item.name).join(', ');
   
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Alerta de Stock Baixo',
        body: `Os seguintes itens estão com stock baixo: ${itemNames}`,
        data: { type: 'low-stock', items },
      },
      trigger: null, // Para notificação imediata
    });
  }

  // Agendar notificação para itens sem stock
  static async scheduleOutOfStockNotification(items: InventoryItem[]) {
    const itemNames = items.map(item => item.name).join(', ');
   
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Alerta de Falta de Stock',
        body: `Os seguintes itens estão sem stock: ${itemNames}`,
        data: { type: 'out-of-stock', items },
      },
      trigger: null, // Para notificação imediata
    });
  }

  // Configurar verificação periódica de stock (chamar na inicialização do app)
  static async setupPeriodicStockCheck() {
    // Configura um intervalo para verificar periodicamente
    setInterval(() => {
      this.checkStockLevels();
    }, 3600000); // Verifica a cada hora (3600000ms)
  }
}
