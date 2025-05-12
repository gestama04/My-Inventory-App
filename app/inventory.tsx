import { useState, useEffect, useCallback } from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  TouchableHighlight,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  ActivityIndicator
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "./theme-context";
import useCustomAlert from '../hooks/useCustomAlert';
import { db, auth } from '../firebase-config';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc
} from 'firebase/firestore';
import { deleteInventoryItem } from '../inventory-service';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

interface Item {
  id?: string;
  name: string;
  quantity: string | number;
  category: string;
  lowStockThreshold?: string;
  photo?: string;
  photoUrl?: string;
  description?: string;
  userId?: string;
  createdAt?: any;
  updatedAt?: any;
}

export default function InventoryScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredInventory, setFilteredInventory] = useState<Item[]>([]);
  const [sortType, setSortType] = useState('categoryAsc');
  const [filterCategory, setFilterCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showSortOptions, setShowSortOptions] = useState(false);
  const router = useRouter();
  const { currentTheme } = useTheme();
  const [globalLowStockThreshold, setGlobalLowStockThreshold] = useState("5");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const { showAlert, AlertComponent } = useCustomAlert();
  const [loading, setLoading] = useState(true);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const params = useLocalSearchParams();



  const handleItemPress = (item: Item) => {
    console.log("Item pressed:", item);
    router.push({
      pathname: "/item-details",
      params: {
        id: item.id,
        name: item.name,
        category: item.category
      }
    });
  };

useEffect(() => {
  if (params?.directCategoryFilter) {
    const categoryFilter = params.directCategoryFilter as string;
    console.log('Aplicando filtro direto de categoria:', categoryFilter);
    setFilterCategory(categoryFilter);
  }
}, [params]);

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

  useEffect(() => {
    const loadSearchHistory = async () => {
      try {
        const history = await AsyncStorage.getItem("searchHistory");
        if (history) {
          setSearchHistory(JSON.parse(history));
        }
      } catch (error) {
        console.error("Erro ao carregar histórico de pesquisa:", error);
      }
    };

    loadSearchHistory();
  }, []);

  const addToSearchHistory = async (term: string) => {
    if (!term.trim() || term.length < 2) return;

    try {
      const updatedHistory = [
        term,
        ...searchHistory.filter(item => item !== term)
      ].slice(0, 10);

      setSearchHistory(updatedHistory);
      await AsyncStorage.setItem("searchHistory", JSON.stringify(updatedHistory));
    } catch (error) {
      console.error("Erro ao salvar histórico de pesquisa:", error);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    setShowHistory(text.length === 0);

    const filtered = items.filter(
      (item: Item) =>
        item.name.toLowerCase().includes(text.toLowerCase()) ||
        item.category.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredInventory(filtered);
  };

  const selectHistoryItem = (term: string) => {
    setSearchQuery(term);
    setShowHistory(false);

    const filtered = items.filter(
      (item) =>
        item.name.toLowerCase().includes(term.toLowerCase()) ||
        item.category.toLowerCase().includes(term.toLowerCase())
    );
    setFilteredInventory(filtered);

    addToSearchHistory(term);
  };

  const clearSearchHistory = async () => {
    try {
      await AsyncStorage.removeItem("searchHistory");
      setSearchHistory([]);
      showAlert("Sucesso", "Histórico de pesquisa limpo!", [
        { text: "OK", onPress: () => {} }
      ]);
    } catch (error) {
      console.error("Erro ao limpar histórico:", error);
    }
  };

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (event) => {
        setKeyboardVisible(true);
        setKeyboardHeight(event.endCoordinates.height);
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

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

  const isLowStock = (item: Item): boolean => {
    const numQuantity = parseInt(item.quantity.toString());

    if (item.lowStockThreshold !== undefined && item.lowStockThreshold !== "") {
      const itemThreshold = parseInt(item.lowStockThreshold);
      return numQuantity > 0 && numQuantity <= itemThreshold;
    }

    const threshold = parseInt(globalLowStockThreshold);
    return numQuantity > 0 && numQuantity <= threshold;
  };

  const isOutOfStock = (quantity: string | number): boolean => {
    return parseInt(quantity.toString()) === 0;
  };

const clearFilters = async () => {
  try {
    await AsyncStorage.removeItem('inventorySortType');
    await AsyncStorage.removeItem('inventoryFilterCategory');
    setSortType('categoryAsc');
    setFilterCategory('');
    setShowFilters(false);
    
    // Clear the router params if they exist
    if (params?.directCategoryFilter) {
      router.setParams({});
    }
  } catch (error) {
    console.error("Erro ao limpar filtros", error);
  }
};

useEffect(() => {
  const loadFilterPreferences = async () => {
    try {
      const savedSortType = await AsyncStorage.getItem('inventorySortType');
      
      // Only load filter category from storage if no direct filter is provided
      if (!params?.directCategoryFilter) {
        const savedFilterCategory = await AsyncStorage.getItem('inventoryFilterCategory');
        console.log('DEBUG: Saved Filter Category:', savedFilterCategory);
        
        if (savedFilterCategory && savedFilterCategory !== '') {
          setFilterCategory(savedFilterCategory);
        } else {
          setFilterCategory('');
        }
      }
      
      if (savedSortType) {
        setSortType(savedSortType);
      } else {
        const defaultSortType = 'nameAsc';
        setSortType(defaultSortType);
        await AsyncStorage.setItem('inventorySortType', defaultSortType);
      }
    } catch (error) {
      console.error("Erro ao carregar preferências de filtro", error);
      setSortType('nameAsc');
      setFilterCategory('');
    }
  };
  
  loadFilterPreferences();
}, [params]);

  const handleSetSortType = async (type: string) => {
    setSortType(type);
    try {
      await AsyncStorage.setItem('inventorySortType', type);
    } catch (error) {
      console.error("Erro ao salvar tipo de ordenação", error);
    }
  };

  const handleSetFilterCategory = async (category: string) => {
    const newCategory = category === filterCategory ? '' : category;

    setFilterCategory(newCategory);

    try {
      await AsyncStorage.setItem('inventoryFilterCategory', newCategory);
      console.log('DEBUG: Set Filter Category to:', newCategory);
    } catch (error) {
      console.error("Erro ao salvar categoria de filtro", error);
    }
  };

  const handleSort = (type: string) => {
    handleSetSortType(type);
    setShowSortOptions(false);
  };

  useFocusEffect(
    useCallback(() => {
      const loadUserSettings = async () => {
        try {
          const userId = auth.currentUser?.uid;
          if (!userId) return;
          
          const userSettingsDoc = await getDoc(doc(db, 'userSettings', userId));
          if (userSettingsDoc.exists()) {
            const settings = userSettingsDoc.data();
            if (settings.globalLowStockThreshold) {
              setGlobalLowStockThreshold(settings.globalLowStockThreshold);
            }
          }
        } catch (error) {
          console.error("Erro ao carregar configurações do Utilizador:", error);
        }
      };

      const loadItems = async () => {
        setLoading(true);
        try {
          // Verificar se o Utilizador está autenticado
          const userId = auth.currentUser?.uid;
          if (!userId) {
            setLoading(false);
            return;
          }

          // Carregar inventário do Firestore
          const q = query(collection(db, 'inventory'), where('userId', '==', userId));
          const snapshot = await getDocs(q);
          
          const parsedItems: Item[] = [];
          snapshot.forEach((doc) => {
            parsedItems.push({ id: doc.id, ...doc.data() as Item });
          });

          setItems(parsedItems);
          setFilteredInventory(parsedItems);
        } catch (error) {
          console.error("Erro ao carregar itens", error);
        } finally {
          setLoading(false);
        }
      };

      loadUserSettings();
      loadItems();
    }, [])
  );

  const handleRemoveItem = async (itemToRemove: Item) => {
    try {
      if (!itemToRemove.id) {
        showAlert("Erro", "ID do item não encontrado", [
          { text: "OK", onPress: () => {} }
        ]);
        return;
      }
      
      // Usar a função do serviço para deletar o item
      await deleteInventoryItem(itemToRemove.id);
      
      // Atualizar a UI
      const updatedItems = items.filter(item => item.id !== itemToRemove.id);
      setItems(updatedItems);
      setFilteredInventory(updatedItems);
      
      showAlert("Sucesso", "Item removido com sucesso!", [
        { text: "OK", onPress: () => {} }
      ]);
    } catch (error) {
      console.error("Erro ao remover item", error);
      showAlert("Erro", "Não foi possível remover o item", [
        { text: "OK", onPress: () => {} }
      ]);
    }
  };

  const handleEditItem = (itemToEdit: Item) => {
    router.replace({
      pathname: "/edit",
      params: {
        id: itemToEdit.id,
        name: itemToEdit.name,
        category: itemToEdit.category,
        quantity: itemToEdit.quantity.toString()
      },
    });
  };

  const handleClearInventory = async () => {
    showAlert(
      "Confirmar Limpeza",
      "Tem a certeza que deseja apagar o inventário todo?",
      [
        { text: "Cancelar", style: "cancel", onPress: () => {} },
        {
          text: "Apagar Tudo",
          style: "destructive",
          onPress: async () => {
            try {
              const userId = auth.currentUser?.uid;
              if (!userId) {
                showAlert("Erro", "Utilizador não autenticado", [
                  { text: "OK", onPress: () => {} }
                ]);
                return;
              }
              
              // Obter todos os itens do Utilizador
              const q = query(collection(db, 'inventory'), where('userId', '==', userId));
              const snapshot = await getDocs(q);
              
              // Deletar cada item individualmente
              const deletePromises = snapshot.docs.map(async (doc) => {
                // Usar a função do serviço para cada item
                await deleteInventoryItem(doc.id);
              });
              
              await Promise.all(deletePromises);
              
              // Atualizar a UI
              setItems([]);
              setFilteredInventory([]);
              
              showAlert("Sucesso", "Inventário limpo com sucesso!", [
                { text: "OK", onPress: () => {} }
              ]);
            } catch (error) {
              console.error("Erro ao limpar inventário", error);
              showAlert("Erro", "Não foi possível limpar o inventário", [
                { text: "OK", onPress: () => {} }
              ]);
            }
          },
        },
      ]
    );
  };

  // Get category icon based on category name
  const getCategoryIcon = (category?: string):
    "package-variant" | "food-apple" | "cup" | "shower" | "tshirt-crew" |
    "shoe-heel" | "tools" | "pencil" | "cellphone" | "television" | "book" => {
    
    if (!category) return "package-variant";
    
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

const filteredAndSortedItems = items
  .filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === '' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  })
  .sort((a, b) => {
    switch (sortType) {
      case 'nameAsc':
        return a.name.localeCompare(b.name);
      case 'nameDesc':
        return b.name.localeCompare(a.name);
      case 'quantityAsc':
        return parseInt(a.quantity.toString()) - parseInt(b.quantity.toString());
      case 'quantityDesc':
        return parseInt(b.quantity.toString()) - parseInt(a.quantity.toString());
      case 'newestFirst':
        return b.createdAt?.toMillis() - a.createdAt?.toMillis() || 0;
      case 'oldestFirst':
        return a.createdAt?.toMillis() - b.createdAt?.toMillis() || 0;
      default:
        return 0;
    }
  });

  const groupedItems = filteredAndSortedItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, Item[]>);

  const uniqueCategories = [...new Set(items.map(item => item.category))];

  const sortedCategories = Object.keys(groupedItems).sort((a, b) => {
    switch (sortType) {
      case 'categoryAsc':
        return a.localeCompare(b);
      case 'categoryDesc':
        return b.localeCompare(a);
      case 'categoryQuantityDesc':
        const aTotal = groupedItems[a].reduce((sum, item) => sum + parseInt(item.quantity.toString()), 0);
        const bTotal = groupedItems[b].reduce((sum, item) => sum + parseInt(item.quantity.toString()), 0);
        return bTotal - aTotal || a.localeCompare(b);
      case 'categoryQuantityAsc':
        const aSmallTotal = groupedItems[a].reduce((sum, item) => sum + parseInt(item.quantity.toString()), 0);
        const bSmallTotal = groupedItems[b].reduce((sum, item) => sum + parseInt(item.quantity.toString()), 0);
        return aSmallTotal - bSmallTotal || a.localeCompare(b);
      default:
        return a.localeCompare(b);
    }
  });

return (
  <View style={{ flex: 1 }}>
    <KeyboardAwareScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 80 }} // Adicione padding para o espaço dos botões
      keyboardShouldPersistTaps="handled"
      enableOnAndroid={true}
      enableAutomaticScroll={true}
      extraScrollHeight={Platform.OS === "ios" ? 90 : 30}
    >
      <View style={[styles.container, currentTheme === "dark" ? styles.dark : styles.light]}>
        {/* Header with search and sort */}
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
              placeholder={filterCategory ? `Filtrar em ${filterCategory}...` : "Pesquisar..."}
              placeholderTextColor={currentTheme === "dark" ? "#bdc3c7" : "#7f8c8d"}
              value={searchQuery}
              onChangeText={handleSearch}
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
   sortType === 'newestFirst' ? 'Mais Recentes' :
   sortType === 'oldestFirst' ? 'Mais Antigos' : 'Ordenar'}
</Text>
          </TouchableOpacity>
        </View>

        {/* Histórico de pesquisa */}
        {showHistory && searchHistory.length > 0 && (
          <View style={[
            styles.historyContainer,
            currentTheme === "dark" ? styles.darkHistoryContainer : styles.lightHistoryContainer
          ]}>
            <View style={styles.historyHeader}>
              <Text style={[
                styles.historyTitle,
                currentTheme === "dark" ? styles.darkText : styles.lightText
              ]}>
                Pesquisas recentes
              </Text>
              <TouchableOpacity onPress={clearSearchHistory}>
                <Text style={styles.clearHistoryText}>Limpar</Text>
              </TouchableOpacity>
            </View>
            {searchHistory.map((term, index) => (
              <TouchableOpacity
                key={index}
                style={styles.historyItem}
                onPress={() => selectHistoryItem(term)}
              >
                <Ionicons name="time-outline" size={16} color={currentTheme === "dark" ? "#bbb" : "#555"} />
                <Text style={[
                  styles.historyItemText,
                  currentTheme === "dark" ? styles.darkText : styles.lightText
                ]}>
                  {term}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Category filter chips */}
        {showFilters && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesContainer}
            contentContainerStyle={styles.categoriesContent}
          >
            {/* Botão de limpar filtros */}
    <TouchableOpacity
      style={[styles.categoryChip, styles.clearFilterChip, currentTheme === "dark" ? styles.darkChip : styles.lightChip]}
      onPress={clearFilters}
    >
      <Text style={[styles.categoryChipText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
        Limpar Filtros
      </Text>
    </TouchableOpacity>
            {/* A-Z (All Items) */}
            <TouchableOpacity
              style={[styles.categoryChip, currentTheme === "dark" ? styles.darkChip : styles.lightChip]}
              onPress={() => {
                handleSetSortType('nameAsc');
                setShowFilters(false);
              }}
            >
              <Text style={[styles.categoryChipText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                A-Z
              </Text>
            </TouchableOpacity>

            {/* Z-A (All Items) */}
            <TouchableOpacity
              style={[styles.categoryChip, currentTheme === "dark" ? styles.darkChip : styles.lightChip]}
              onPress={() => {
                handleSetSortType('nameDesc');
                setShowFilters(false);
              }}
            >
              <Text style={[styles.categoryChipText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                Z-A
              </Text>
            </TouchableOpacity>

            {/* Menor Quantidade (All Items) */}
            <TouchableOpacity
              style={[styles.categoryChip, currentTheme === "dark" ? styles.darkChip : styles.lightChip]}
              onPress={() => {
                handleSetSortType('quantityAsc');
                setShowFilters(false);
              }}
            >
              <Text style={[styles.categoryChipText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                Menor Qtd
              </Text>
            </TouchableOpacity>

            {/* Maior Quantidade (All Items) */}
            <TouchableOpacity
              style={[styles.categoryChip, currentTheme === "dark" ? styles.darkChip : styles.lightChip]}
              onPress={() => {
                handleSetSortType('quantityDesc');
                setShowFilters(false);
              }}
            >
              <Text style={[styles.categoryChipText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                Maior Qtd
              </Text>
            </TouchableOpacity>

{/* Mais Recentes */}
<TouchableOpacity
  style={[styles.categoryChip, currentTheme === "dark" ? styles.darkChip : styles.lightChip]}
  onPress={() => {
    handleSetSortType('newestFirst');
    setShowFilters(false);
  }}
>
  <Text style={[styles.categoryChipText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
    Mais Recentes
  </Text>
</TouchableOpacity>

{/* Mais Antigos */}
<TouchableOpacity
  style={[styles.categoryChip, currentTheme === "dark" ? styles.darkChip : styles.lightChip]}
  onPress={() => {
    handleSetSortType('oldestFirst');
    setShowFilters(false);
  }}
>
  <Text style={[styles.categoryChipText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
    Mais Antigos
  </Text>
</TouchableOpacity>

            {/* Existing category filters */}
            {uniqueCategories.map(category => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryChip,
                  currentTheme === "dark" ? styles.darkChip : styles.lightChip
                ]}
                onPress={() => {
                  handleSetFilterCategory(category);
                  setShowFilters(false);
                }}
              >
                <Text style={[
                  styles.categoryChipText,
                  currentTheme === "dark" ? styles.darkText : styles.lightText
                ]}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

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
  style={[styles.sortOption, sortType === 'newestFirst' && styles.selectedOption]}
  onPress={() => handleSort('newestFirst')}
>
  <Text style={[styles.sortOptionText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
    Mais Recentes
  </Text>
  {sortType === 'newestFirst' && (
    <Ionicons name="checkmark" size={20} color="#3498db" />
  )}
</TouchableOpacity>

<TouchableOpacity
  style={[styles.sortOption, sortType === 'oldestFirst' && styles.selectedOption]}
  onPress={() => handleSort('oldestFirst')}
>
  <Text style={[styles.sortOptionText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
    Mais Antigos
  </Text>
  {sortType === 'oldestFirst' && (
    <Ionicons name="checkmark" size={20} color="#3498db" />
  )}
</TouchableOpacity>
                              </View>
                            </TouchableOpacity>
                          </Modal>
                  
                          {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#3498db" />
          </View>
        ) : filteredAndSortedItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="basket-outline" size={64} color="#bdc3c7" />
            <Text style={[styles.emptyText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
              {searchQuery.trim() !== ''
                ? "Nenhum item encontrado para esta pesquisa"
                : "O seu inventário está vazio"}
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {filteredAndSortedItems.map((item) => (
              <TouchableHighlight
                key={item.id || `${item.name}-${item.category}`}
                underlayColor={currentTheme === "dark" ? "#444" : "#f0f0f0"}
                onLongPress={() => handleItemLongPress(item)}
                onPress={() => handleItemPress(item)}
                delayLongPress={500}
                style={styles.itemCardWrapper}
              >
                <View style={[
                  styles.itemCard,
                  currentTheme === "dark" ? styles.darkCard : styles.lightCard,
                  isOutOfStock(item.quantity) && [
                    styles.outOfStockCard,
                    { borderLeftColor: '#e74c3c' }
                  ],
                  isLowStock(item) && [
                    styles.lowStockCard,
                    { borderLeftColor: '#f39c12' }
                  ],
                  !isOutOfStock(item.quantity) && !isLowStock(item) && [
                    styles.inStockCard,
                    { borderLeftColor: '#2ecc71' }
                  ]
                ]}>
                  <View style={styles.itemCardContent}>
                    {/* Show item photo if available, otherwise show category icon */}
                    {item.photoUrl ? (
                      <Image
                        source={{ uri: item.photoUrl }}
                        style={styles.itemThumbnail}
                      />
                    ) : item.photo ? (
                      <Image
                        source={{ uri: `data:image/jpeg;base64,${item.photo}` }}
                        style={styles.itemThumbnail}
                      />
                    ) : (
                      <View style={[
                        styles.categoryIconContainer,
                        isOutOfStock(item.quantity) && { backgroundColor: "rgba(231, 76, 60, 0.1)" },
                        isLowStock(item) && { backgroundColor: "rgba(243, 156, 18, 0.1)" },
                        !isOutOfStock(item.quantity) && !isLowStock(item) && { backgroundColor: "rgba(46, 204, 113, 0.1)" }
                      ]}>
                        <MaterialCommunityIcons
                          name={getCategoryIcon(item.category)}
                          size={24}
                          color={
                            isOutOfStock(item.quantity) ? "#e74c3c" :
                            isLowStock(item) ? "#f39c12" : "#2ecc71"
                          }
                        />
                      </View>
                    )}
                    
                    <View style={styles.itemInfo}>
                      <Text
                        numberOfLines={2}
                        ellipsizeMode="tail"
                        style={[
                          styles.itemName,
                          currentTheme === "dark" ? styles.darkText : styles.lightText,
                          isOutOfStock(item.quantity) && styles.outOfStockText,
                          isLowStock(item) && styles.lowStockText
                        ]}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={[
                          styles.itemCategory,
                          currentTheme === "dark" ? styles.darkTextSecondary : styles.lightTextSecondary
                        ]}
                      >
                        {item.category}
                      </Text>
                    </View>
                    
                    <View style={styles.quantityContainer}>
                      <Text style={[
                        styles.quantityText,
                        {
                          color: isOutOfStock(item.quantity) ? "#e74c3c" :
                                 isLowStock(item) ? "#f39c12" : "#2ecc71"
                        }
                      ]}>
                        {item.quantity}
                      </Text>
                      
                      {isOutOfStock(item.quantity) && (
                        <View style={[styles.stockBadge, { backgroundColor: '#e74c3c' }]}>
                          <Text style={styles.badgeText}>Sem stock</Text>
                        </View>
                      )}
                      
                      {isLowStock(item) && (
                        <View style={[styles.stockBadge, { backgroundColor: '#f39c12' }]}>
                          <Text style={styles.badgeText}>Stock baixo</Text>
                        </View>
                      )}
                      
                      {!isOutOfStock(item.quantity) && !isLowStock(item) && (
                        <View style={[styles.stockBadge, { backgroundColor: '#2ecc71' }]}>
                          <Text style={styles.badgeText}>Em stock</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </TouchableHighlight>
            ))}
          </View>
        )}
      </View>
    </KeyboardAwareScrollView>
    
    <View style={[
      styles.footerContainer,
      currentTheme === "dark" ? styles.darkFooter : styles.lightFooter,
      { position: 'absolute', bottom: 0, left: 0, right: 0 } // Torna o footer fixo
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
          onPress={handleClearInventory}
        >
          <Ionicons name="trash-bin" size={24} color={currentTheme === "dark" ? "#fff" : "red"} />
          <Text style={[styles.buttonText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
            Eliminar Tudo
          </Text>
        </TouchableOpacity>
      </View>
      
      <Text style={[styles.longPressHint, currentTheme === "dark" ? styles.darkTextSecondary : styles.lightTextSecondary]}>
        Toque num produto para ver os seus detalhes.
      </Text>
    </View>
    
    {/* AlertComponent fora de tudo para não ser afetado pelo scroll */}
    <AlertComponent />
  </View>
);
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  mainContent: {
    flex: 1,
    paddingBottom: 80,
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
    paddingBottom: 12,
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
    width: '100%',
    marginBottom: 0,
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
    paddingBottom: 20,
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
  },
  outOfStockCard: {
    borderLeftWidth: 4,
  },
  lowStockCard: {
    borderLeftWidth: 4,
  },
  inStockCard: {
    borderLeftWidth: 4,
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
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  itemThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
  stockBadge: {
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
  outOfStockText: {
    color: '#e74c3c',
  },
  lowStockText: {
    color: '#f39c12',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
  },
  categoriesContainer: {
    width: '100%',
    marginBottom: 12,
    maxHeight: 110,
  },
  categoriesContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 24
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  darkChip: {
    backgroundColor: '#333',
  },
  lightChip: {
    backgroundColor: '#e0e0e0',
  },
  categoryChipText: {
    fontSize: 13,
  },
  historyContainer: {
    width: '100%',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    zIndex: 10,
    marginHorizontal: 20,
  },
  darkHistoryContainer: {
    backgroundColor: '#333',
  },
  lightHistoryContainer: {
    backgroundColor: '#fff',
  },
  clearFilterChip: {
    backgroundColor: '#e74c3c',
  },
  clearFilterButton: {
    padding: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  darkClearButton: {
    backgroundColor: '#2c3e50',
  },
  lightClearButton: {
    backgroundColor: '#f5f5f5',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#444', // Default dark color, will be overridden dynamically
  },
  historyHeaderLight: {
    borderBottomColor: '#eee',
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  clearHistoryText: {
    color: '#3498db',
    fontSize: 14,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#444', // Default dark color, will be overridden dynamically
  },
  historyItemLight: {
    borderBottomColor: '#eee',
  },
  historyItemText: {
    marginLeft: 8,
    fontSize: 14,
  },
});