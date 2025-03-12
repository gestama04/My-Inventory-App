import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useTheme } from './theme-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { NotificationService } from '../services/notification-service';

interface InventoryItem {
  id?: string;
  name: string;
  quantity: string | number;
  category?: string;
  price?: string | number;
  lowStockThreshold?: string; // Add this property
}


interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

export default function NotificationsScreen() {
  const { currentTheme } = useTheme();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [outOfStockItems, setOutOfStockItems] = useState<InventoryItem[]>([]);

  useEffect(() => {
    // Registrar para notificações ao montar o componente
    NotificationService.registerForPushNotificationsAsync();
    
    // Verificar itens de stock baixo e sem stock
    checkInventoryItems();
    
    // Iniciar verificação periódica
    NotificationService.setupPeriodicStockCheck();
  }, []);

  const checkInventoryItems = async () => {
    try {
      // Get the global threshold
      const globalThresholdStr = await AsyncStorage.getItem('globalLowStockThreshold') || '5';
      const globalThreshold = parseInt(globalThresholdStr);
      
      const inventoryData = await AsyncStorage.getItem('inventory');
      if (!inventoryData) return;
     
      const inventory: InventoryItem[] = JSON.parse(inventoryData);
     
      // Find items with low stock, using custom thresholds where available
      const lowStock = inventory.filter(item => {
        const quantity = parseInt(item.quantity.toString());
        
        // Check if this item has a custom threshold
        if (item.lowStockThreshold !== undefined) {
          const customThreshold = parseInt(item.lowStockThreshold);
          // Only consider valid thresholds (not NaN)
          if (!isNaN(customThreshold)) {
            return quantity <= customThreshold && quantity > 0;
          }
        }
        
        // Fall back to global threshold if no custom threshold or invalid threshold
        return quantity <= globalThreshold && quantity > 0;
      });
     
      // Find items without stock
      const outOfStock = inventory.filter(item => {
        const quantity = parseInt(item.quantity.toString());
        return quantity === 0;
      });
     
      setLowStockItems(lowStock);
      setOutOfStockItems(outOfStock);
     
      // Generate local screen notifications
      generateNotificationItems(lowStock, outOfStock);
    } catch (error) {
      console.error('Erro ao verificar inventário:', error);
    }
  };
  

  const generateNotificationItems = (lowStock: InventoryItem[], outOfStock: InventoryItem[]) => {
    const newNotifications: NotificationItem[] = [];
    
    if (lowStock.length > 0) {
      newNotifications.push({
        id: `low-stock-${Date.now()}`,
        title: 'Alerta de Stock Baixo',
        message: `${lowStock.length} itens com stock baixo`,
        timestamp: Date.now(),
        read: false
      });
    }
    
    if (outOfStock.length > 0) {
      newNotifications.push({
        id: `out-of-stock-${Date.now()}`,
        title: 'Alerta de Falta de Stock',
        message: `${outOfStock.length} itens sem stock`,
        timestamp: Date.now(),
        read: false
      });
    }
    
    setNotifications(prev => [...newNotifications, ...prev]);
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id ? {...notification, read: true} : notification
      )
    );
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  return (
    <View style={[styles.container, currentTheme === "dark" ? styles.dark : styles.light]}>
      <View style={styles.header}>
        <Text style={[styles.title, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
          Notificações
        </Text>
        {notifications.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={clearAllNotifications}>
            <Text style={styles.clearButtonText}>Limpar Todas</Text>
          </TouchableOpacity>
        )}
      </View>

      {notifications.length > 0 ? (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[
                styles.notificationItem, 
                !item.read && styles.unreadNotification,
                currentTheme === "dark" ? styles.darkItem : styles.lightItem
              ]}
              onPress={() => markAsRead(item.id)}
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
                  {new Date(item.timestamp).toLocaleString()}
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
        onPress={() => router.push("/")}
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
    justifyContent: 'space-between',
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

