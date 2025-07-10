import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Switch, Alert } from 'react-native';
import { useTheme } from './theme-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { NotificationService } from '../services/notification-service';
import { useAuth } from '../auth-context';
import CustomAlert from '../components/CustomAlert';

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

interface NotificationSettings {
  enabled: boolean;
  interval: number;
  lowStockEnabled: boolean;
  outOfStockEnabled: boolean;
}

export default function NotificationsScreen() {
  const { currentTheme } = useTheme();
  const router = useRouter();
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [outOfStockItems, setOutOfStockItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [lastNotificationTime, setLastNotificationTime] = useState<number>(0);
 const [alertButtons, setAlertButtons] = useState<Array<{
  text: string, 
  onPress: () => void, 
  style?: "default" | "cancel" | "destructive"
}>>([]);
  const [intervalPickerVisible, setIntervalPickerVisible] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
  enabled: true,
  interval: 60,
  lowStockEnabled: true,
  outOfStockEnabled: true
});

useEffect(() => {
  NotificationService.registerForPushNotificationsAsync();
  
  let unsubscribeNotifications: (() => void) | undefined;
  

  if (currentUser) {
    unsubscribeNotifications = loadNotifications();
    
  } else {
    setLoading(false);
  }
  
  return () => {
    if (unsubscribeNotifications) {
      unsubscribeNotifications();
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
    
const loadNotificationSettings = async () => {
  const settings = await NotificationService.getNotificationSettings();
  setNotificationSettings(settings);
};

loadNotificationSettings();

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

const saveNotificationSettings = async (newSettings: NotificationSettings) => {
  try {
    await NotificationService.saveNotificationSettings(newSettings);
    setNotificationSettings(newSettings);
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    setAlertTitle('Erro');
    setAlertMessage('Não foi possível salvar as configurações');
    setAlertButtons([{ 
      text: 'OK', 
      onPress: () => setAlertVisible(false),
      style: "default" as const
    }]);
    setAlertVisible(true);
  }
};

const intervalOptions = [
  { label: '15 minutos', value: 15 },
  { label: '30 minutos', value: 30 },
  { label: '1 hora', value: 60 },
  { label: '2 horas', value: 120 },
  { label: '4 horas', value: 240 },
  { label: '8 horas', value: 480 },
  { label: '12 horas', value: 720 },
  { label: '24 horas', value: 1440 },
];

const showIntervalPicker = () => {
  const options = intervalOptions.map(option => ({
    text: option.label,
    onPress: () => {
      saveNotificationSettings({
        ...notificationSettings,
        interval: option.value
      });
      setAlertVisible(false);
    },
    style: "default" as const
  }));

  setAlertTitle('Intervalo de Notificações');
  setAlertMessage('Escolha de quanto em quanto tempo quer receber notificações:');
  setAlertButtons([
  ...options,
  { 
    text: 'Cancelar', 
    onPress: () => setAlertVisible(false), 
    style: "destructive" as const 
  }
]);
  setAlertVisible(true);
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

<View style={[styles.settingsContainer, currentTheme === "dark" ? styles.darkSettingsContainer : styles.lightSettingsContainer]}>
  <Text style={[styles.settingsTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
    Configurações de Notificação
  </Text>
  
  <View style={[styles.settingRow, currentTheme === "dark" ? styles.darkSettingRow : styles.lightSettingRow]}>
    <Text style={[styles.settingLabel, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
      Notificações Ativas
    </Text>
    <Switch
      value={notificationSettings.enabled}
      onValueChange={(value) => saveNotificationSettings({
        ...notificationSettings,
        enabled: value
      })}
      trackColor={{ false: "#767577", true: "#3498db" }}
      thumbColor={notificationSettings.enabled ? "#2980b9" : "#f4f3f4"}
    />
  </View>

  {notificationSettings.enabled && (
    <>
      <TouchableOpacity style={[styles.settingRow, currentTheme === "dark" ? styles.darkSettingRow : styles.lightSettingRow]} onPress={showIntervalPicker}>
        <Text style={[styles.settingLabel, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
          Intervalo
        </Text>
        <Text style={[styles.settingValue, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
          {intervalOptions.find(opt => opt.value === notificationSettings.interval)?.label || 'Personalizado'}
        </Text>
      </TouchableOpacity>

      <View style={[styles.settingRow, currentTheme === "dark" ? styles.darkSettingRow : styles.lightSettingRow]}>
        <Text style={[styles.settingLabel, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
          Stock Baixo
        </Text>
        <Switch
          value={notificationSettings.lowStockEnabled}
          onValueChange={(value) => saveNotificationSettings({
            ...notificationSettings,
            lowStockEnabled: value
          })}
          trackColor={{ false: "#767577", true: "#f39c12" }}
          thumbColor={notificationSettings.lowStockEnabled ? "#e67e22" : "#f4f3f4"}
        />
      </View>

      <View style={[styles.settingRow, currentTheme === "dark" ? styles.darkSettingRow : styles.lightSettingRow]}>
        <Text style={[styles.settingLabel, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
          Sem Stock
        </Text>
        <Switch
          value={notificationSettings.outOfStockEnabled}
          onValueChange={(value) => saveNotificationSettings({
            ...notificationSettings,
            outOfStockEnabled: value
          })}
          trackColor={{ false: "#767577", true: "#e74c3c" }}
          thumbColor={notificationSettings.outOfStockEnabled ? "#c0392b" : "#f4f3f4"}
        />
      </View>
    </>
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
    <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        buttons={alertButtons}
        onClose={() => setAlertVisible(false)}
      />
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
darkSettingsContainer: {
  backgroundColor: '#333',
},
lightSettingsContainer: {
  backgroundColor: '#fff',
},
settingsTitle: {
  fontSize: 18,
  fontWeight: 'bold',
  marginBottom: 16,
},
settingRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingVertical: 12,
},
darkSettingRow: {
  borderBottomWidth: 1,
  borderBottomColor: '#555',
},
lightSettingRow: {
  borderBottomWidth: 1,
  borderBottomColor: '#eee',
},
settingsContainer: {
  marginBottom: 20,
  padding: 16,
  borderRadius: 12,
},
settingLabel: {
  fontSize: 16,
  flex: 1,
},
settingValue: {
  fontSize: 14,
  color: '#666',
  marginRight: 8,
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

