import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TouchableHighlight,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Modal,
  ActivityIndicator
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "./theme-context";
import useCustomAlert from '../hooks/useCustomAlert';
import { db, auth } from '../firebase-config';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  deleteDoc, 
  doc, 
  getDoc 
} from 'firebase/firestore';
import { InventoryItem, addToHistory, deleteInventoryItem } from '../inventory-service';

// Atualizar a interface para corresponder à InventoryItem
interface Item {
  id?: string;
  name: string;
  quantity: string | number;
  category: string;
  lowStockThreshold?: string;
  userId?: string;
}

type SortType = 'nameAsc' | 'nameDesc' | 'quantityAsc' | 'quantityDesc' | 'categoryAsc' | 'categoryDesc';

export default function LowStockScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [globalLowStockThreshold, setGlobalLowStockThreshold] = useState("5");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortType, setSortType] = useState<SortType>('nameAsc');
  const [showSortOptions, setShowSortOptions] = useState(false);
  const router = useRouter();
  const { currentTheme } = useTheme();
  const { showAlert, AlertComponent } = useCustomAlert();

  // Carregar itens quando a tela ganhar foco
  useFocusEffect(
    useCallback(() => {
      const loadItems = async () => {
        setLoading(true);
        try {
          // Verificar se o Utilizador está autenticado
          const userId = auth.currentUser?.uid;
          if (!userId) {
            setLoading(false);
            return;
          }

          // Carregar threshold global das configurações do Utilizador
          const userSettingsDoc = await getDoc(doc(db, 'userSettings', userId));
          const globalThreshold = userSettingsDoc.exists()
            ? userSettingsDoc.data().globalLowStockThreshold || '5'
            : '5';
          
          setGlobalLowStockThreshold(globalThreshold);

          // Carregar inventário do Firestore
          const q = query(collection(db, 'inventory'), where('userId', '==', userId));
          const snapshot = await getDocs(q);
          
          const parsedItems: Item[] = [];
          snapshot.forEach((doc) => {
            parsedItems.push({ id: doc.id, ...doc.data() as Item });
          });

          // Filtrar itens com stock baixo
          const lowStockItems = parsedItems.filter(item => {
            const numQuantity = parseInt(item.quantity.toString());
            
            // Verificar se o item tem um threshold personalizado
            if (item.lowStockThreshold !== undefined && item.lowStockThreshold !== "") {
              const itemThreshold = parseInt(item.lowStockThreshold);
              return numQuantity > 0 && numQuantity <= itemThreshold;
            }
            
            // Caso contrário, usar o threshold global
            const threshold = parseInt(globalThreshold);
            return numQuantity > 0 && numQuantity <= threshold;
          });

          // Combinar itens com o mesmo nome e categoria
          const combinedItems = combineItems(lowStockItems);
          
          // Aplicar ordenação atual
          const sortedItems = sortItems([...combinedItems], sortType);
          
          setItems(sortedItems);
          setFilteredItems(sortedItems);
        } catch (error) {
          console.error("Erro ao carregar itens com stock baixo", error);
        } finally {
          setLoading(false);
        }
      };

      loadItems();
    }, [globalLowStockThreshold])
  );

  // Efeito para filtrar itens quando a pesquisa ou itens mudam
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredItems(items);
    } else {
      const query = searchQuery.toLowerCase().trim();
      const filtered = items.filter(
        item => 
          item.name.toLowerCase().includes(query) || 
          item.category.toLowerCase().includes(query)
      );
      setFilteredItems(filtered);
    }
  }, [searchQuery, items]);

  const combineItems = (items: Item[]): Item[] => {
    const combinedItems: Record<string, Item> = {};

    items.forEach(item => {
      const key = `${item.name}-${item.category}`;
      if (combinedItems[key]) {
        combinedItems[key].quantity = (parseInt(combinedItems[key].quantity.toString()) + parseInt(item.quantity.toString())).toString();
      } else {
        combinedItems[key] = { ...item };
      }
    });

    return Object.values(combinedItems);
  };

  const sortItems = (itemsToSort: Item[], type: SortType) => {
    switch (type) {
      case 'nameAsc':
        return itemsToSort.sort((a, b) => a.name.localeCompare(b.name));
      case 'nameDesc':
        return itemsToSort.sort((a, b) => b.name.localeCompare(a.name));
      case 'quantityAsc':
        return itemsToSort.sort((a, b) => parseInt(a.quantity.toString()) - parseInt(b.quantity.toString()) || a.name.localeCompare(b.name));
      case 'quantityDesc':
        return itemsToSort.sort((a, b) => parseInt(b.quantity.toString()) - parseInt(a.quantity.toString()) || a.name.localeCompare(b.name));
      case 'categoryAsc':
        return itemsToSort.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
      case 'categoryDesc':
        return itemsToSort.sort((a, b) => b.category.localeCompare(a.category) || a.name.localeCompare(b.name));
    }
  };

  const handleSort = (type: SortType) => {
    setSortType(type);
    const sorted = [...items];
    sortItems(sorted, type);
    setItems(sorted);
    setFilteredItems(sorted);
    setShowSortOptions(false);
  };

  const handleItemLongPress = (item: Item) => {
    showAlert(
      item.name,
      "O que deseja fazer com este item?",
      [
        { text: "Cancelar", style: "cancel", onPress: () => {} },
        { text: "Editar", onPress: () => handleEditItem(item) },
        {
          text: "Remover",
          style: "destructive",
          onPress: () => handleRemoveItem(item),
        },
      ]
    );
  };

  const handleRemoveItem = async (itemToRemove: Item) => {
    try {
      // Verificar se o Utilizador está autenticado
      const userId = auth.currentUser?.uid;
      if (!userId) {
        showAlert("Erro", "Você precisa estar autenticado para remover itens.", [
          { text: "OK", onPress: () => {} }
        ]);
        return;
      }

      if (!itemToRemove.id) {
        showAlert("Erro", "ID do item não encontrado.", [
          { text: "OK", onPress: () => {} }
        ]);
        return;
      }

      // Usar a função deleteInventoryItem do inventory-service
      await deleteInventoryItem(itemToRemove.id);
      
      // Atualizar a lista local
      const updatedLocalItems = items.filter(
        item =>
          item.name !== itemToRemove.name ||
          item.category !== itemToRemove.category
      );
      
      setItems(updatedLocalItems);
      setFilteredItems(updatedLocalItems);

      // Mostrar alerta de sucesso
      showAlert("Sucesso", "Item removido com sucesso!", [
        { text: "OK", onPress: () => {} }
      ]);
    } catch (error) {
      console.error("Erro ao remover item", error);
      showAlert("Erro", "Não foi possível remover o item.", [
        { text: "OK", onPress: () => {} }
      ]);
    }
  };

  const handleEditItem = (itemToEdit: Item) => {
    if (itemToEdit.id) {
      router.replace({
        pathname: "/edit",
        params: {
          id: itemToEdit.id,
          name: itemToEdit.name,
          category: itemToEdit.category,
          quantity: itemToEdit.quantity.toString()
        },
      });
    } else {
      showAlert("Erro", "Não foi possível editar este item.", [
        { text: "OK", onPress: () => {} }
      ]);
    }
  };

  // Função para obter ícone baseado na categoria
  const getCategoryIcon = (category: string):
    "package-variant" | "food-apple" | "cup" | "shower" | "tshirt-crew" |
    "shoe-heel" | "tools" | "pencil" | "cellphone" | "television" | "book" => {
    
    const categoryLower = category.toLowerCase();
    
    if (categoryLower.includes("alimento")) return "food-apple";
    if (categoryLower.includes("bebida")) return "cup";
    if (categoryLower.includes("higiene")) return "shower";
    if (categoryLower.includes("roupa")) return "tshirt-crew";
    if (categoryLower.includes("calçado")) return "shoe-heel";
    if (categoryLower.includes("ferramenta")) return "tools";
    if (categoryLower.includes("papelaria")) return "pencil";
    if (categoryLower.includes("smartphone")) return "cellphone";
    if (categoryLower.includes("eletrónico") || categoryLower.includes("eletrônico")) return "television";
    if (categoryLower.includes("livro")) return "book";
    
    return "package-variant";
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={[styles.container, currentTheme === "dark" ? styles.dark : styles.light]}>
        {/* Barra de pesquisa e botão de ordenação */}
        <View style={styles.headerContainer}>
          <View style={[
            styles.searchContainer, 
            currentTheme === "dark" ? styles.darkSearchContainer : styles.lightSearchContainer
          ]}>
            <Ionicons 
              name="search" 
              size={20} 
              color={currentTheme === "dark" ? "#bdc3c7" : "#7f8c8d"} 
              style={styles.searchIcon} 
            />
            <TextInput
              style={[
                styles.searchInput,
                currentTheme === "dark" ? styles.darkSearchInput : styles.lightSearchInput
              ]}
              placeholder="Pesquisar itens..."
              placeholderTextColor={currentTheme === "dark" ? "#bdc3c7" : "#7f8c8d"}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Ionicons 
                  name="close-circle" 
                  size={20} 
                  color={currentTheme === "dark" ? "#bdc3c7" : "#7f8c8d"} 
                />
              </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity 
            style={[styles.sortButton, currentTheme === "dark" ? styles.darkSortButton : styles.lightSortButton]} 
            onPress={() => setShowSortOptions(!showSortOptions)}
          >
            <Ionicons name="filter" size={20} color={currentTheme === "dark" ? "#fff" : "#333"} />
            <Text style={[styles.sortButtonText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
              {sortType === 'nameAsc' ? 'Nome A-Z' :
               sortType === 'nameDesc' ? 'Nome Z-A' :
               sortType === 'quantityAsc' ? 'Menor Qtd' : 
               sortType === 'quantityDesc' ? 'Maior Qtd' :
               sortType === 'categoryAsc' ? 'Cat. A-Z' : 'Cat. Z-A'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Modal de opções de ordenação */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={showSortOptions}
          onRequestClose={() => setShowSortOptions(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowSortOptions(false)}
          >
            <View style={[styles.modalContent, currentTheme === "dark" ? styles.darkModal : styles.lightModal]}>
              <Text style={[styles.modalTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                Ordenar por
              </Text>
              
              <TouchableOpacity
                style={[styles.sortOption, sortType === 'nameAsc' && styles.selectedOption]}
                onPress={() => handleSort('nameAsc')}
              >
                <Text style={[styles.sortOptionText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                  Nome (A-Z)
                </Text>
                {sortType === 'nameAsc' && (
                  <Ionicons name="checkmark" size={20} color="#3498db" />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.sortOption, sortType === 'nameDesc' && styles.selectedOption]}
                onPress={() => handleSort('nameDesc')}
              >
                <Text style={[styles.sortOptionText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                  Nome (Z-A)
                </Text>
                {sortType === 'nameDesc' && (
                  <Ionicons name="checkmark" size={20} color="#3498db" />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.sortOption, sortType === 'quantityAsc' && styles.selectedOption]}
                onPress={() => handleSort('quantityAsc')}
              >
                <Text style={[styles.sortOptionText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                  Quantidade (Menor)
                </Text>
                {sortType === 'quantityAsc' && (
                  <Ionicons name="checkmark" size={20} color="#3498db" />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.sortOption, sortType === 'quantityDesc' && styles.selectedOption]}
                onPress={() => handleSort('quantityDesc')}
              >
                <Text style={[styles.sortOptionText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                  Quantidade (Maior)
                </Text>
                {sortType === 'quantityDesc' && (
                  <Ionicons name="checkmark" size={20} color="#3498db" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sortOption, sortType === 'categoryAsc' && styles.selectedOption]}
                onPress={() => handleSort('categoryAsc')}
              >
                <Text style={[styles.sortOptionText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                  Categoria (A-Z)
                </Text>
                {sortType === 'categoryAsc' && (
                  <Ionicons name="checkmark" size={20} color="#3498db" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sortOption, sortType === 'categoryDesc' && styles.selectedOption]}
                onPress={() => handleSort('categoryDesc')}
              >
                <Text style={[styles.sortOptionText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                  Categoria (Z-A)
                </Text>
                {sortType === 'categoryDesc' && (
                  <Ionicons name="checkmark" size={20} color="#3498db" />
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#f39c12" />
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={64} color="#2ecc71" />
            <Text style={[styles.emptyText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
              {searchQuery.trim() !== ''
                ? "Nenhum item encontrado para esta pesquisa"
                : "Não há itens com stock baixo"}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id || `${item.name}-${item.category}`}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => (
                <TouchableHighlight
                  underlayColor={currentTheme === "dark" ? "#444" : "#f0f0f0"}
                  onLongPress={() => handleItemLongPress(item)}
                  delayLongPress={500}
                  style={styles.itemCardWrapper}
                >
                  <View style={[
                    styles.itemCard,
                    currentTheme === "dark" ? styles.darkCard : styles.lightCard
                  ]}>
                    <View style={styles.itemCardContent}>
                      <View style={styles.categoryIconContainer}>
                        <MaterialCommunityIcons
                          name={getCategoryIcon(item.category)}
                          size={24}
                          color="#f39c12"
                        />
                      </View>
                      
                      <View style={styles.itemInfo}>
                        <Text
                          numberOfLines={5} // Permite até 5 linhas
                          ellipsizeMode="tail" // Adiciona "..." no final se o texto for truncado
                          style={[styles.itemName, currentTheme === "dark" ? styles.darkText : styles.lightText]}
                        >
                          {item.name}
                        </Text>
                        <Text
                          style={[styles.itemCategory, currentTheme === "dark" ? styles.darkTextSecondary : styles.lightTextSecondary]}
                        >
                          {item.category}
                        </Text>
                      </View>

                      <View style={styles.quantityContainer}>
                        <Text style={[styles.quantityText, {color: "#f39c12"}]}>
                          {item.quantity}
                        </Text>
                        <View style={styles.lowStockBadge}>
                          <Text style={styles.badgeText}>Stock Baixo</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </TouchableHighlight>
              )}
          />
        )}
      </View>

      <AlertComponent />

      {/* Barra de botões inferior - fora do container principal para ficar fixa */}
      <View style={[
        styles.footerContainer,
        currentTheme === "dark" ? styles.darkFooter : styles.lightFooter
      ]}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, currentTheme === "dark" ? styles.darkButton : styles.lightButton]}
            onPress={() => router.replace("/add")}
          >
            <Ionicons name="add-circle" size={24} color={currentTheme === "dark" ? "#fff" : "green"} />
            <Text style={[styles.buttonText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
              Adicionar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, currentTheme === "dark" ? styles.darkButton : styles.lightButton]}
            onPress={() => router.replace("/inventory")}
          >
            <Ionicons name="list" size={24} color={currentTheme === "dark" ? "#fff" : "#3498db"} />
            <Text style={[styles.buttonText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
              Inventário
            </Text>
          </TouchableOpacity>
        </View>
        
        <Text style={[styles.longPressHint, currentTheme === "dark" ? styles.darkTextSecondary : styles.lightTextSecondary]}>
          Pressione e segure um item para editar ou remover
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  mainContent: {
    flex: 1,
    paddingBottom: 80, // Isso fará com que o conteúdo principal ocupe todo o espaço disponível
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 25,
    borderTopWidth: 1,
  },
  darkFooter: {
    backgroundColor: '#121212',
    borderTopColor: '#333',
  },
  lightFooter: {
    backgroundColor: '#f9f9f9',
    borderTopColor: '#ddd',
},
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    marginRight: 10,
    height: 40,
    borderWidth: 1,
  },
  darkSearchContainer: {
    backgroundColor: '#2c3e50',
    borderColor: '#34495e',
  },
  lightSearchContainer: {
    backgroundColor: '#f5f5f5',
    borderColor: '#ddd',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
  },
  darkSearchInput: {
    color: '#fff',
  },
  lightSearchInput: {
    color: '#333',
  },
  clearButton: {
    padding: 5,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  darkSortButton: {
    backgroundColor: '#2c3e50',
    borderColor: '#34495e',
  },
  lightSortButton: {
    backgroundColor: '#f5f5f5',
    borderColor: '#ddd',
  },
  sortButtonText: {
    marginLeft: 5,
    fontSize: 14,
    fontWeight: '500',
  },
  listContainer: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 110, // Espaço para a barra de botões
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 50,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 10,
    textAlign: "center",
  },
  itemCardWrapper: {
    borderRadius: 15,
    marginBottom: 15,
    overflow: 'hidden',
  },
  itemCard: {
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
  },
  itemCardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
  },
  categoryIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(243, 156, 18, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 4,
        flexWrap: 'wrap', 
  },
  itemCategory: {
    fontSize: 14,
  },
  quantityContainer: {
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  lowStockBadge: {
    backgroundColor: '#f39c12',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  darkButton: {
    backgroundColor: "#333",
  },
  lightButton: {
    backgroundColor: "#eee",
  },
  buttonText: {
    marginLeft: 5,
    fontSize: 16,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    borderRadius: 15,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  darkModal: {
    backgroundColor: '#1e1e1e',
  },
  lightModal: {
    backgroundColor: '#ffffff',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedOption: {
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
  },
  sortOptionText: {
    fontSize: 16,
  },
  longPressHint: {
    textAlign: 'center',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 0,
  },
  light: {
    backgroundColor: "#f9f9f9",
  },
  dark: {
    backgroundColor: "#121212",
  },
  lightText: {
    color: "#2c3e50",
  },
  darkText: {
    color: "#ffffff",
  },
  lightTextSecondary: {
    color: "#7f8c8d",
  },
  darkTextSecondary: {
    color: "#bdc3c7",
  },
  lightCard: {
    backgroundColor: "#ffffff",
  },
  darkCard: {
    backgroundColor: "#1e1e1e",
  },
});

