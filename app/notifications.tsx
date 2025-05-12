import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useTheme } from './theme-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { NotificationService } from '../services/notification-service';
import { useAuth } from '../auth-context';

// Firebase imports
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  deleteDoc,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase-config';
import { getInventoryItems, getUserSettings } from '../inventory-service';

interface InventoryItem {
  id?: string;
  name: string;
  quantity: string | number;
  category?: string;
  price?: string | number;
  lowStockThreshold?: string;
  userId?: string;
}

interface NotificationItem {
  id?: string;
  title: string;
  message: string;
  timestamp: any; // Firestore timestamp
  read: boolean;
  userId?: string;
  itemIds?: string[]; // IDs dos itens relacionados à notificação
}

export default function NotificationsScreen() {
  const { currentTheme } = useTheme();
  const router = useRouter();
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [outOfStockItems, setOutOfStockItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  NotificationService.registerForPushNotificationsAsync();
  
  let unsubscribeNotifications: (() => void) | undefined;
  let unsubscribeInventory: (() => void) | undefined; // Para o listener de checkInventoryItems

  if (currentUser) {
    unsubscribeNotifications = loadNotifications();
    
    const initInventoryCheck = async () => {
      unsubscribeInventory = await checkInventoryItems();
    };
    initInventoryCheck();
    
    NotificationService.setupPeriodicStockCheck();
  } else {
    setLoading(false);
  }
  
  return () => {
    if (unsubscribeNotifications) {
      unsubscribeNotifications();
    }
    if (unsubscribeInventory) { // Limpar o listener do inventário
      unsubscribeInventory();
    }
    // A limpeza do setupPeriodicStockCheck é feita pelo NotificationService
    // ou quando o Utilizador se desloga.
  };
}, [currentUser]);

  const loadNotifications = () => {
    if (!currentUser) return;
    
    // Criar query para buscar notificações do Utilizador atual, ordenadas por timestamp
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef, 
      where('userId', '==', currentUser.uid),
      orderBy('timestamp', 'desc')
    );
    
    // Usar onSnapshot para receber atualizações em tempo real
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notificationsList: NotificationItem[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        notificationsList.push({
          id: doc.id,
          title: data.title,
          message: data.message,
          timestamp: data.timestamp,
          read: data.read,
          itemIds: data.itemIds || []
        });
      });
      
      setNotifications(notificationsList);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar notificações:", error);
      setLoading(false);
    });
    
    // Retornar função de limpeza
    return unsubscribe;
  };

const checkInventoryItems = async (): Promise<(() => void) | undefined> => {
  try {
    if (!currentUser) return;
    
    const userSettings = await getUserSettings();
    // Garantir que globalThreshold é uma string e tem um valor padrão
    const globalThresholdSetting = (userSettings && 'globalLowStockThreshold' in userSettings)
      ? String(userSettings.globalLowStockThreshold ?? '5') // Usa '5' se globalLowStockThreshold for null ou undefined
      : '5';
    
    const unsubscribe = getInventoryItems((inventory) => {
      const lowStock = inventory.filter(item => {
        // Verificação robusta para item.quantity
        const quantityStr = (item.quantity !== null && item.quantity !== undefined) 
                              ? String(item.quantity) // Usar String() para conversão segura
                              : '0'; // Valor padrão se quantity for null ou undefined
        const quantity = parseInt(quantityStr, 10);

        if (isNaN(quantity)) return false; // Ignorar item se a quantidade não for um número válido

        let thresholdToCompare = parseInt(globalThresholdSetting, 10);
        // Se globalThresholdSetting não for um número válido (improvável com o fallback), usar um default seguro
        if (isNaN(thresholdToCompare)) thresholdToCompare = 5; 

        // Verificação robusta para item.lowStockThreshold
        if (item.lowStockThreshold !== null && item.lowStockThreshold !== undefined) {
          const customThresholdStr = String(item.lowStockThreshold);
          const customThreshold = parseInt(customThresholdStr, 10);
          if (!isNaN(customThreshold)) { // Usar apenas se for um número válido
            thresholdToCompare = customThreshold;
          }
        }
        return quantity <= thresholdToCompare && quantity > 0;
      });
      
      const outOfStock = inventory.filter(item => {
        const quantityStr = (item.quantity !== null && item.quantity !== undefined) 
                              ? String(item.quantity) 
                              : '0';
        const quantity = parseInt(quantityStr, 10);
        
        // Considerar NaN como não estando "sem stock" (quantity === 0)
        if (isNaN(quantity)) return false; 
        return quantity === 0;
      });
      
      setLowStockItems(lowStock);
      setOutOfStockItems(outOfStock);
      
      generateNotifications(lowStock, outOfStock); // generateNotifications deve ser chamada após os estados serem atualizados
                                                 // ou receber lowStock e outOfStock diretamente.
                                                 // A chamada aqui está correta, pois usa as variáveis locais.
    });
    
    return unsubscribe; // Retorna a função para limpar o listener de getInventoryItems
  } catch (error) {
    console.error('Erro ao verificar inventário:', error);
    return undefined;
  }
};

const formatNotificationTimestamp = (timestamp: any): string => {
  if (!timestamp) return "Data inválida";
  try {
    if (typeof timestamp.toDate === 'function') { // Timestamp do Firestore
      return timestamp.toDate().toLocaleString('pt-PT'); // Use o locale desejado
    }
    const date = new Date(timestamp); // Tenta converter se for string/número
    if (isNaN(date.getTime())) {
      return "Data inválida";
    }
    return date.toLocaleString('pt-PT');
  } catch (e) {
    console.error("Erro ao formatar timestamp da notificação:", timestamp, e);
    return "Erro na data";
  }
};

  const generateNotifications = async (lowStock: InventoryItem[], outOfStock: InventoryItem[]) => {
    if (!currentUser) return;
    
    try {
      console.log(`Gerando notificações para ${lowStock.length} itens com stock baixo e ${outOfStock.length} itens sem stock`);
      
      // Verificar se já existem notificações para estes itens
      const notificationsRef = collection(db, 'notifications');
      
      // Gerar notificação para itens com stock baixo
      if (lowStock.length > 0) {
        // Obter IDs dos itens com stock baixo
        const lowStockIds = lowStock.map(item => item.id).filter(id => id !== undefined) as string[];
        
        // Verificar se já existe uma notificação recente para estes itens
        const existingLowStockQuery = query(
          notificationsRef,
          where('userId', '==', currentUser.uid),
          where('title', '==', 'Alerta de Stock Baixo'),
          where('read', '==', false)
        );
        
        const existingLowStockSnapshot = await getDocs(existingLowStockQuery);
        
        // Se não existir notificação não lida, criar uma nova
        if (existingLowStockSnapshot.empty) {
          await addDoc(notificationsRef, {
            userId: currentUser.uid,
            title: 'Alerta de Stock Baixo',
            message: `${lowStock.length} ${lowStock.length === 1 ? 'item' : 'itens'} com stock baixo`,
            timestamp: serverTimestamp(),
            read: false,
            itemIds: lowStockIds
          });
          
          // Enviar notificação push
          NotificationService.sendLocalNotification(
            'Alerta de Stock Baixo',
            `${lowStock.length} ${lowStock.length === 1 ? 'item' : 'itens'} com stock baixo`,
            'low-stock'
          );
        }
      }
      
      // Gerar notificação para itens sem stock
      if (outOfStock.length > 0) {
        // Obter IDs dos itens sem stock
        const outOfStockIds = outOfStock.map(item => item.id).filter(id => id !== undefined) as string[];
        
        // Verificar se já existe uma notificação recente para estes itens
        const existingOutOfStockQuery = query(
          notificationsRef,
          where('userId', '==', currentUser.uid),
          where('title', '==', 'Alerta de Falta de Stock'),
          where('read', '==', false)
        );
        
        const existingOutOfStockSnapshot = await getDocs(existingOutOfStockQuery);
        
        // Se não existir notificação não lida, criar uma nova
        if (existingOutOfStockSnapshot.empty) {
          await addDoc(notificationsRef, {
            userId: currentUser.uid,
            title: 'Alerta de Falta de Stock',
            message: `${outOfStock.length} ${outOfStock.length === 1 ? 'item' : 'itens'} sem stock`,
            timestamp: serverTimestamp(),
            read: false,
            itemIds: outOfStockIds
          });
          
          // Enviar notificação push
          NotificationService.sendLocalNotification(
            'Alerta de Falta de Stock',
            `${outOfStock.length} ${outOfStock.length === 1 ? 'item' : 'itens'} sem stock`,
            'out-of-stock'
          );
        }
      }
    } catch (error) {
      console.error('Erro ao gerar notificações:', error);
    }
  };
  

  const markAsRead = async (id: string) => {
    if (!currentUser || !id) return;
    
    try {
      // Atualizar no Firestore
      const notificationRef = doc(db, 'notifications', id);
      await updateDoc(notificationRef, {
        read: true
      });
      
      // Atualizar estado local
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === id ? {...notification, read: true} : notification
        )
      );
      
      // Navegar para a tela de inventário com filtro se for notificação de stock
      const notification = notifications.find(n => n.id === id);
      if (notification && notification.itemIds && notification.itemIds.length > 0) {
        if (notification.title.includes('Stock Baixo')) {
          router.push({
            pathname: "/low-stock",
          });
        } else if (notification.title.includes('Falta de Stock')) {
          router.push({
            pathname: "/out-of-stock",
          });
        }
      }
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  };

  const clearAllNotifications = async () => {
    if (!currentUser) return;
    
    try {
      // Obter todas as notificações do Utilizador
      const notificationsRef = collection(db, 'notifications');
      const q = query(notificationsRef, where('userId', '==', currentUser.uid));
      const snapshot = await getDocs(q);
      
      // Excluir cada documento
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Atualizar estado local
      setNotifications([]);
    } catch (error) {
      console.error('Erro ao limpar notificações:', error);
    }
  };

  return (
    <View style={[styles.container, currentTheme === "dark" ? styles.dark : styles.light]}>
      <View style={styles.header}>
        {notifications.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={clearAllNotifications}>
            <Text style={styles.clearButtonText}>Limpar Todas</Text>
          </TouchableOpacity>
        )}
      </View>

      {notifications.length > 0 ? (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id || ''}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.notificationItem,
                !item.read && styles.unreadNotification,
                currentTheme === "dark" ? styles.darkItem : styles.lightItem
              ]}
              onPress={() => markAsRead(item.id || '')}
            >
              <View style={styles.notificationIcon}>
                <MaterialIcons
                  name={item.title.includes('Falta') ? "report" : "warning"}
                  size={24}
                  color={item.title.includes('Falta') ? "#e74c3c" : "#f39c12"}
                />
              </View>
              <View style={styles.notificationContent}>
                <Text style={[styles.notificationTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                  {item.title}
                </Text>
                <Text style={[styles.notificationMessage, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                  {item.message}
                </Text>
                <Text style={styles.notificationTime}>
  {formatNotificationTimestamp(item.timestamp)}
</Text>
              </View>
              {!item.read && (
                <View style={styles.unreadDot} />
              )}
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="notifications-none" size={64} color={currentTheme === "dark" ? "#555" : "#ccc"} />
          <Text style={[styles.emptyText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
            Não há notificações
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.replace("/settings")}
      >
        <Text style={styles.backButtonText}>Voltar</Text>
      </TouchableOpacity>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  clearButton: {
    padding: 8,
    backgroundColor: '#e74c3c',
    borderRadius: 8,
  },
  clearButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 20,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  darkItem: {
    backgroundColor: '#333',
  },
  lightItem: {
    backgroundColor: '#fff',
  },
  unreadNotification: {
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  notificationIcon: {
    marginRight: 16,
    justifyContent: 'center',
  },
  
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: '#777',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3498db',
    alignSelf: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    marginTop: 16,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#e74c3c',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  backButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  dark: {
    backgroundColor: '#222',
  },
  light: {
    backgroundColor: '#f9f9f9',
  },
  darkText: {
    color: '#fff',
  },
  lightText: {
    color: '#333',
  },
});

