import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTheme } from './theme-context';
import { useAuth } from '../auth-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getInventoryItems, addToHistory } from '../inventory-service';
import { updateDoc, doc, getDoc, serverTimestamp, collection, query, where, getDocs, deleteDoc  } from 'firebase/firestore';
import { db } from '../firebase-config';
import useCustomAlert from '../hooks/useCustomAlert';
import { CategoryIconService } from '../services/category-icon-service';
import { getUserSettings } from '../inventory-service';

interface InventoryItem {
  id?: string;
  name: string;
  quantity: string | number;
  category?: string;
  price?: string | number;
  lowStockThreshold?: string;
  photoUrl?: string;
  photo?: string;
  description?: string;
  userId?: string;
  categoryIcon?: string;
}

export default function QuickEditScreen() {
  const { currentTheme } = useTheme();
  const { currentUser } = useAuth();
  const router = useRouter();
  const { showAlert, AlertComponent } = useCustomAlert();
  const [globalLowStockThreshold, setGlobalLowStockThreshold] = useState("5");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([]);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  
  // Novo estado para controlar valores temporários dos inputs
  const [tempQuantities, setTempQuantities] = useState<Record<string, string>>({});

  // Carregar inventário
useEffect(() => {
  if (!currentUser) {
    setLoading(false);
    return;
  }

  // Carregar configurações do usuário (valor real salvo)
  const loadUserSettings = async () => {
    try {
      console.log("Carregando configurações reais do usuário...");
      
      // Primeiro tentar getUserSettings (que você usa no settings.tsx)
      const userSettings = await getUserSettings();
      console.log("Configurações carregadas:", userSettings);
      
      if (userSettings && 'globalLowStockThreshold' in userSettings) {
        const savedThreshold = userSettings.globalLowStockThreshold;
        console.log("Threshold global encontrado:", savedThreshold);
        setGlobalLowStockThreshold(savedThreshold);
      } else {
        // Se não encontrar, tentar diretamente do Firestore
        const userSettingsDoc = await getDoc(doc(db, 'userSettings', currentUser.uid));
        
        if (userSettingsDoc.exists()) {
          const settings = userSettingsDoc.data();
          const savedThreshold = settings.globalLowStockThreshold || "5";
          console.log("Threshold do Firestore:", savedThreshold);
          setGlobalLowStockThreshold(savedThreshold);
        } else {
          console.log("Nenhuma configuração encontrada, usando padrão: 5");
          setGlobalLowStockThreshold("5");
        }
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      setGlobalLowStockThreshold("5");
    }
  };

  loadUserSettings();

  const unsubscribe = getInventoryItems(async (items) => {
    // Obter ícones para cada categoria
    const itemsWithIcons = await Promise.all(
      items.map(async (item) => {
        const icon = await CategoryIconService.getIconForCategory(item.category || 'Sem Categoria');
        return { ...item, categoryIcon: icon };
      })
    );
    
    setInventory(itemsWithIcons);
    setLoading(false);
    setRefreshing(false);
    
    // Limpar valores temporários quando o inventário é atualizado
    setTempQuantities({});
  });

  return unsubscribe;
}, [currentUser]);

  // Filtrar inventário baseado na pesquisa
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredInventory(inventory);
    } else {
      const filtered = inventory.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredInventory(filtered);
    }
  }, [inventory, searchQuery]);

const onRefresh = () => {
  // O refresh será controlado automaticamente pelo getInventoryItems
};

const updateQuantity = async (item: InventoryItem, newQuantity: number) => {
  if (!item.id || newQuantity < 0) return;
  
  setUpdatingItems(prev => new Set(prev).add(item.id!));
  
  try {
    // Buscar TODOS os itens com o mesmo nome e categoria no Firestore
    const q = query(
      collection(db, 'inventory'),
      where('userId', '==', currentUser?.uid),
      where('name', '==', item.name),
      where('category', '==', item.category || '')
    );
    
    const snapshot = await getDocs(q);
    const duplicateItems = snapshot.docs;
    
    if (duplicateItems.length <= 1) {
      // Se há apenas um item, atualizar normalmente
      const updateData: any = {
        quantity: newQuantity.toString(),
        updatedAt: serverTimestamp()
      };
      
      if (item.lowStockThreshold !== undefined && item.lowStockThreshold !== null && item.lowStockThreshold !== '') {
        updateData.lowStockThreshold = item.lowStockThreshold;
      }
      
      const itemRef = doc(db, 'inventory', item.id);
      await updateDoc(itemRef, updateData);
    } else {
      // Se há múltiplos itens duplicados, consolidar
      console.log(`Encontrados ${duplicateItems.length} itens duplicados para ${item.name}`);
      
      // Manter apenas o primeiro item e deletar os outros
      const [firstItem, ...itemsToDelete] = duplicateItems;
      
      // Atualizar o primeiro item com a nova quantidade
      const updateData: any = {
        quantity: newQuantity.toString(),
        updatedAt: serverTimestamp()
      };
      
      if (item.lowStockThreshold !== undefined && item.lowStockThreshold !== null && item.lowStockThreshold !== '') {
        updateData.lowStockThreshold = item.lowStockThreshold;
      }
      
      await updateDoc(firstItem.ref, updateData);
      
      // Deletar os itens duplicados
      const deletePromises = itemsToDelete.map(itemDoc => deleteDoc(itemDoc.ref));
      await Promise.all(deletePromises);
      
      console.log(`Consolidados ${duplicateItems.length} itens em 1 item com quantidade ${newQuantity}`);
    }
    
    // Adicionar ao histórico
    await addToHistory({
      name: item.name,
      category: item.category || 'Sem categoria',
      quantity: newQuantity.toString(),
      action: 'edit'
    });
    
    // Limpar valor temporário após atualização bem-sucedida
    setTempQuantities(prev => {
      const newTemp = { ...prev };
      delete newTemp[item.id!];
      return newTemp;
    });
    
  } catch (error) {
    console.error('Erro ao atualizar quantidade:', error);
    showAlert(
      'Erro',
      'Não foi possível atualizar a quantidade. Tente novamente.',
      [{ text: 'OK', onPress: () => {} }]
    );
  } finally {
    setUpdatingItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(item.id!);
      return newSet;
    });
  }
};

  const incrementQuantity = (item: InventoryItem) => {
    const currentQty = parseInt(item.quantity.toString()) || 0;
    updateQuantity(item, currentQty + 1);
  };

  const decrementQuantity = (item: InventoryItem) => {
    const currentQty = parseInt(item.quantity.toString()) || 0;
    if (currentQty > 0) {
      updateQuantity(item, currentQty - 1);
    }
  };

  // Nova função para lidar com mudanças temporárias no input
  const handleQuantityInputChange = (item: InventoryItem, value: string) => {
    if (!item.id) return;
    
    // Permitir apenas números
    const numericValue = value.replace(/[^0-9]/g, '');
    
    // Atualizar valor temporário
    setTempQuantities(prev => ({
      ...prev,
      [item.id!]: numericValue
    }));
  };

  // Nova função para quando o utilizador termina de editar
  const handleQuantityInputBlur = (item: InventoryItem) => {
    if (!item.id) return;
    
    const tempValue = tempQuantities[item.id];
    if (tempValue !== undefined) {
      const quantity = tempValue === '' ? 0 : parseInt(tempValue);
      if (quantity >= 0) {
        updateQuantity(item, quantity);
      }
    }
  };

  // Função para obter o valor a mostrar no input
  const getDisplayQuantity = (item: InventoryItem): string => {
    if (!item.id) return item.quantity.toString();
    
    // Se há um valor temporário, usar esse
    if (tempQuantities[item.id] !== undefined) {
      return tempQuantities[item.id];
    }
    
    // Senão, usar a quantidade atual do item
    return item.quantity.toString();
  };

const renderInventoryItem = ({ item }: { item: InventoryItem }) => {
  const quantity = parseInt(item.quantity.toString()) || 0;
  const isUpdating = updatingItems.has(item.id || '');
  const displayQuantity = getDisplayQuantity(item);
     
  return (
    <TouchableOpacity 
      style={[
        styles.itemContainer,
        currentTheme === 'dark' ? styles.darkItemContainer : styles.lightItemContainer
      ]}
      onPress={() => {
        if (item.id) {
          router.replace({
            pathname: '/edit',
            params: { 
              id: item.id,
              returnToDetails: 'false'
            }
          });
        }
      }}
      activeOpacity={0.7}
    >
  {/* Linha superior: Ícone da categoria + Nome/Categoria + Indicador de stock */}
  <View style={styles.topRow}>
    {/* Ícone da categoria em vez da foto do produto */}
    <View style={styles.categoryIconContainer}>
      <MaterialCommunityIcons
        name={(item.categoryIcon || CategoryIconService.DEFAULT_ICON) as any}
        size={32}
        color="#3498db"
      />
    </View>

          {/* Informações do produto */}
          <View style={styles.productInfo}>
            <Text style={[
              styles.productName,
              currentTheme === 'dark' ? styles.darkText : styles.lightText
            ]}>
              {item.name}
            </Text>
            {item.category && (
              <Text style={[
                styles.productCategory,
                currentTheme === 'dark' ? styles.darkSecondaryText : styles.lightSecondaryText
              ]}>
                {item.category}
              </Text>
            )}
          </View>

          {/* Indicador de stock corrigido */}
<View style={styles.stockIndicatorContainer}>
  {quantity === 0 && (
    <MaterialIcons name="error" size={20} color="#e74c3c" />
  )}
  {(() => {
    // Lógica de low stock igual ao settings.tsx
    if (quantity === 0) return null;
    
    let thresholdToCompare = parseInt(globalLowStockThreshold, 10);
    if (isNaN(thresholdToCompare)) thresholdToCompare = 5; 

    // Verificar se tem threshold personalizado
    if (item.lowStockThreshold !== null && item.lowStockThreshold !== undefined && item.lowStockThreshold !== '') {
      const customThresholdStr = String(item.lowStockThreshold);
      const customThreshold = parseInt(customThresholdStr, 10);
      if (!isNaN(customThreshold)) {
        thresholdToCompare = customThreshold;
      }
    }
    
    const isLowStock = quantity <= thresholdToCompare && quantity > 0;
    
    return isLowStock ? (
      <MaterialIcons name="warning" size={20} color="#f39c12" />
    ) : null;
  })()}
</View>
        </View>

        {/* Linha inferior: Controles de quantidade */}
        <View style={styles.bottomRow}>
          {isUpdating ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#3498db" />
              <Text style={[
                styles.loadingText,
                currentTheme === 'dark' ? styles.darkSecondaryText : styles.lightSecondaryText
              ]}>
                A atualizar...
              </Text>
            </View>
          ) : (
            <View style={styles.quantityControls}>
              <TouchableOpacity
  style={[
    styles.quantityButton,
    styles.decrementButton,
    quantity === 0 && styles.disabledButton
  ]}
  onPress={(e) => {
    e.stopPropagation(); // Impede que o toque se propague para o container pai
    decrementQuantity(item);
  }}
  disabled={quantity === 0}
>
  <MaterialIcons name="remove" size={16} color="#fff" />
</TouchableOpacity>

              <View style={styles.quantityInputContainer}>
                <TextInput
  style={[
    styles.quantityInput,
    currentTheme === 'dark' ? styles.darkInput : styles.lightInput
  ]}
  value={displayQuantity}
  onChangeText={(value) => handleQuantityInputChange(item, value)}
  onBlur={() => handleQuantityInputBlur(item)}
  onFocus={(e) => e.stopPropagation()} // Impede conflitos ao focar no input
  keyboardType="numeric"
  textAlign="center"
  selectTextOnFocus
/>
                <Text style={[
                  styles.quantityLabel,
                  currentTheme === 'dark' ? styles.darkSecondaryText : styles.lightSecondaryText
                ]}>
                  unidades
                </Text>
              </View>

              <TouchableOpacity
  style={[styles.quantityButton, styles.incrementButton]}
  onPress={(e) => {
    e.stopPropagation(); // Impede que o toque se propague para o container pai
    incrementQuantity(item);
  }}
>
  <MaterialIcons name="add" size={16} color="#fff" />
</TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[
        styles.centerContainer,
        currentTheme === 'dark' ? styles.darkContainer : styles.lightContainer
      ]}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={[
          styles.loadingText,
          currentTheme === 'dark' ? styles.darkText : styles.lightText
        ]}>
          A carregar produtos...
        </Text>
      </View>
    );
  }

  return (
    <View style={[
      styles.container,
      currentTheme === 'dark' ? styles.darkContainer : styles.lightContainer
    ]}>
      {/* Header com pesquisa */}
      <View style={styles.header}>
        <View style={[
          styles.searchContainer,
          currentTheme === 'dark' ? styles.darkSearchContainer : styles.lightSearchContainer
        ]}>
          <MaterialIcons name="search" size={20} color="#999" />
          <TextInput
            style={[
              styles.searchInput,
              currentTheme === 'dark' ? styles.darkText : styles.lightText
            ]}
            placeholder="Pesquisar produtos..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="clear" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Lista de produtos */}
      {filteredInventory.length > 0 ? (
        <FlatList
          data={filteredInventory}
          keyExtractor={(item) => item.id || item.name}
          renderItem={renderInventoryItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#3498db']}
              tintColor="#3498db"
            />
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      ) : (
        <View style={styles.centerContainer}>
          <MaterialIcons 
            name="inventory" 
            size={64} 
            color={currentTheme === 'dark' ? '#555' : '#ccc'} 
          />
          <Text style={[
            styles.emptyText,
            currentTheme === 'dark' ? styles.darkText : styles.lightText
          ]}>
            {searchQuery ? 'Nenhum produto encontrado' : 'Nenhum produto no inventário'}
          </Text>
          {!searchQuery && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push('/add' as any)}
            >
              <Text style={styles.addButtonText}>Adicionar Primeiro Produto</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Botão flutuante para adicionar produto */}
      {filteredInventory.length > 0 && (
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => router.push('/add' as any)}
        >
          <MaterialIcons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      <AlertComponent />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  darkContainer: {
    backgroundColor: '#222',
  },
  lightContainer: {
    backgroundColor: '#f9f9f9',
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  darkSearchContainer: {
    backgroundColor: '#333',
  },
  lightSearchContainer: {
    backgroundColor: '#fff',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
  },
  itemContainer: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  darkItemContainer: {
    backgroundColor: '#333',
  },
  lightItemContainer: {
    backgroundColor: '#fff',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  bottomRow: {
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 14,
    opacity: 0.7,
  },
  stockIndicatorContainer: {
    marginLeft: 8,
    minWidth: 24,
    alignItems: 'center',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  quantityButton: {
    width: 30,        // Reduzido ainda mais
    height: 30,       // Reduzido ainda mais
    borderRadius: 16, // Ajustado proporcionalmente
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  incrementButton: {
    backgroundColor: '#27ae60',
  },
  decrementButton: {
    backgroundColor: '#e74c3c',
  },
  disabledButton: {
    backgroundColor: '#bdc3c7',
  },
  quantityInputContainer: {
    alignItems: 'center',
    marginHorizontal: 16,  // Reduzido
  },
  quantityInput: {
    width: 55,        // Reduzido de 60 para 50
    height: 30,       // Reduzido de 32 para 28
    borderWidth: 1,
    borderRadius: 7,  // Reduzido de 8 para 6
    fontSize: 14,     // Reduzido de 16 para 14
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 3,  // Reduzido de 4 para 2
    paddingVertical: 0, // Remover padding vertical para evitar corte
  },
  darkInput: {
    backgroundColor: '#444',
    borderColor: '#555',
    color: '#fff',
  },
  lightInput: {
    backgroundColor: '#f8f9fa',
    borderColor: '#ddd',
    color: '#333',
  },
  quantityLabel: {
    fontSize: 11,     // Reduzido de 11 para 10
    opacity: 0.7,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 8,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    opacity: 0.7,
  },
  emptyText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
    opacity: 0.7,
  },
  addButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  categoryIconContainer: {
  width: 50,
  height: 50,
  borderRadius: 25,
  backgroundColor: "rgba(52, 152, 219, 0.1)",
  justifyContent: "center",
  alignItems: "center",
  marginRight: 16,
},
  floatingButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  darkText: {
    color: '#fff',
  },
  lightText: {
    color: '#333',
  },
  darkSecondaryText: {
    color: '#bbb',
  },
  lightSecondaryText: {
    color: '#666',
  },
});
