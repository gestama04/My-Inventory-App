import { useState, useEffect, useCallback } from "react";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  TextInput,
  TouchableOpacity,
  ScrollView,
  TouchableHighlight,
  Keyboard,
  KeyboardAvoidingView, Platform
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "./theme-context";

interface Item {
  name: string;
  quantity: string;
  category: string;
  lowStockThreshold?: string;
}

export default function InventoryScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [sortType, setSortType] = useState('categoryAsc');
  const [filterCategory, setFilterCategory] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const router = useRouter();
  const { currentTheme } = useTheme();
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(5);
  const [globalLowStockThreshold, setGlobalLowStockThreshold] = useState("5");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Adicione este useEffect para ouvir eventos de teclado
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
    Alert.alert(
      item.name,
      "O que deseja fazer com este item?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Editar", onPress: () => handleEditItem(item) },
        { 
          text: "Remover", 
          style: "destructive",
          onPress: () => handleRemoveItem(item) 
        },
      ]
    );
  };

  const isLowStock = (item: Item): boolean => {
    const numQuantity = parseInt(item.quantity.toString());
    
    // Primeiro verifica se o item tem um threshold personalizado
    if (item.lowStockThreshold !== undefined && item.lowStockThreshold !== "") {
      const itemThreshold = parseInt(item.lowStockThreshold);
      return numQuantity > 0 && numQuantity <= itemThreshold;
    }
    
    // Caso contrário, usa o threshold global
    const threshold = parseInt(globalLowStockThreshold);
    return numQuantity > 0 && numQuantity <= threshold;
  };
  
  const isOutOfStock = (quantity: string | number): boolean => {
    return parseInt(quantity.toString()) === 0;
  };

  // Clear all filters
  const clearFilters = async () => {
    try {
      await AsyncStorage.removeItem('inventorySortType');
      await AsyncStorage.removeItem('inventoryFilterCategory');
      
      setSortType('categoryAsc');
      setFilterCategory('');
      setShowFilters(false);
    } catch (error) {
      console.error("Erro ao limpar filtros", error);
    }
  };

  
  useEffect(() => {
    const loadFilterPreferences = async () => {
      try {
        // FORCE CLEAR THE STORED FILTER CATEGORY
        await AsyncStorage.removeItem('inventoryFilterCategory');
  
        const savedSortType = await AsyncStorage.getItem('inventorySortType');
        const savedFilterCategory = await AsyncStorage.getItem('inventoryFilterCategory');
  
        console.log('DEBUG: Saved Sort Type:', savedSortType);
        console.log('DEBUG: Saved Filter Category:', savedFilterCategory);
  
        // Always set a default if no saved type exists
        if (savedSortType) {
          setSortType(savedSortType);
        } else {
          const defaultSortType = 'nameAsc';
          setSortType(defaultSortType);
          await AsyncStorage.setItem('inventorySortType', defaultSortType);
        }
  
        // EXPLICITLY SET TO EMPTY STRING
        setFilterCategory('');
        await AsyncStorage.setItem('inventoryFilterCategory', '');
  
      } catch (error) {
        console.error("Erro ao carregar preferências de filtro", error);
        // Fallback to default values
        setSortType('nameAsc');
        setFilterCategory('');
      }
    };
  
    loadFilterPreferences();
  }, []);
  
  
  // Modify setSortType to save to AsyncStorage
  const handleSetSortType = async (type: string) => {
    setSortType(type);
    try {
      await AsyncStorage.setItem('inventorySortType', type);
    } catch (error) {
      console.error("Erro ao salvar tipo de ordenação", error);
    }
  };
  
  // Modify setFilterCategory to save to AsyncStorage
  const handleSetFilterCategory = async (category: string) => {
    // If the same category is selected or it's already filtered, clear the filter
    const newCategory = category === filterCategory || filterCategory === category ? '' : category;
  
    setFilterCategory(newCategory);
  
    try {
      await AsyncStorage.setItem('inventoryFilterCategory', newCategory);
      console.log('DEBUG: Set Filter Category to:', newCategory);
    } catch (error) {
      console.error("Erro ao salvar categoria de filtro", error);
    }
  };
  
  
  useFocusEffect(
    useCallback(() => {
      const loadItems = async () => {
        try {
          const storedItems = await AsyncStorage.getItem("inventory");
          const parsedItems: Item[] = storedItems ? JSON.parse(storedItems) : [];
  
          if (!Array.isArray(parsedItems)) {
            console.error("Erro: Dados corrompidos no AsyncStorage.");
            Alert.alert("Erro", "Os dados do inventário estão corrompidos.");
            return;
          }
  
          // Atualiza os items no estado
          setItems(parsedItems);
          
          // Opcionalmente, carregue o threshold de low stock também
          // const storedThreshold = await AsyncStorage.getItem("lowStockThreshold");
          // if (storedThreshold) {
          //   setLowStockThreshold(parseInt(storedThreshold));
          // }
        } catch (error) {
          console.error("Erro ao carregar itens", error);
        }
      };
  
      loadItems();
      const loadSettings = async () => {
        try {
          const storedThreshold = await AsyncStorage.getItem("globalLowStockThreshold");
          if (storedThreshold) {
            setGlobalLowStockThreshold(storedThreshold);
          }
        } catch (error) {
          console.error("Erro ao carregar configurações", error);
        }
      };
      
      // Chame esta função em seu useFocusEffect ou useEffect
      loadSettings();
      // Importante: este efeito será executado sempre que a tela receber foco
      // (quando você voltar da tela de edição)
    }, [])
  );

  const handleRemoveItem = async (itemToRemove: Item) => {
    Alert.alert(
      "Confirmar remoção",
      `Tem a certeza que deseja remover o item "${itemToRemove.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          onPress: async () => {
            try {
              const updatedItems = items.filter(
                (item) =>
                  item.name !== itemToRemove.name ||
                  item.category !== itemToRemove.category
              );
              await AsyncStorage.setItem("inventory", JSON.stringify(updatedItems));
              setItems(updatedItems);
              Alert.alert("Sucesso", "Item removido com sucesso!");
            } catch (error) {
              console.error("Erro ao remover item", error);
            }
          },
        },
      ]
    );
  };

  const handleEditItem = (itemToEdit: Item) => {
    router.replace({
      pathname: "/edit",
      params: {
        name: itemToEdit.name,
        category: itemToEdit.category,
        quantity: itemToEdit.quantity
      },
    });
  };

  const handleClearInventory = async () => {
    Alert.alert(
      "Confirmar Limpeza",
      "Tem a certeza que deseja apagar o inventário todo?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apagar Tudo",
          onPress: async () => {
            try {
              await AsyncStorage.removeItem("inventory");
              setItems([]);
              Alert.alert("Sucesso", "Inventário limpo com sucesso!");
            } catch (error) {
              console.error("Erro ao limpar inventário", error);
            }
          },
        },
      ]
    );
  };

  const filteredAndSortedItems = items
  .filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
                        item.category.toLowerCase().includes(search.toLowerCase());

    // Explicitly check for empty filter or matching category
    const matchesCategory = filterCategory === '' || item.category === filterCategory;

    return matchesSearch && matchesCategory;
  })
  // ... rest of the sorting logic

    .sort((a, b) => {
      switch (sortType) {
        case 'nameAsc':
          return a.name.localeCompare(b.name);
        case 'nameDesc':
          return b.name.localeCompare(a.name);
        case 'quantityAsc':
          return parseInt(a.quantity) - parseInt(b.quantity);
        case 'quantityDesc':
          return parseInt(b.quantity) - parseInt(a.quantity);
        default:
          return 0;
      }
    });

    const renderCategorySection = (category: string, categoryItems: Item[]) => (
      <View key={category} style={styles.categorySection}>
        <Text style={styles.categoryTitle}>
          {category}
        </Text>
        {categoryItems.map((item) => (
          <TouchableHighlight
            key={item.name}
            underlayColor={currentTheme === "dark" ? "#444" : "#f0f0f0"}
            onLongPress={() => handleItemLongPress(item)}
            delayLongPress={500}
          >
            <View style={[
              styles.itemContainer,
              isOutOfStock(item.quantity) && [
                styles.outOfStockItem,
                { backgroundColor: currentTheme === "dark" ? '#3a0404' : '#ffecec' }
              ],
              isLowStock(item) && [
                styles.lowStockItem,
                { backgroundColor: currentTheme === "dark" ? '#402c01' : '#fff9e6' }
              ]
            ]}>
             {/* Container para o nome com rolagem horizontal */}
<View style={{flex: 1, marginRight: 10}}>
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    nestedScrollEnabled={true}
    contentContainerStyle={{ flexGrow: 0 }} // Mudança importante: usar 0 em vez de 1
    style={{ width: '100%' }}
  >
    <TouchableOpacity 
      activeOpacity={1}
      onPress={() => {}} // Vai capturar taps mas permitir rolagem
    >
      <Text
        style={[
          styles.item,
          { flexShrink: 0, paddingRight: 20 }, // Adicionar mais padding direito
          currentTheme === "dark" ? styles.darkText : styles.lightText,
          isOutOfStock(item.quantity) && styles.outOfStockText,
          isLowStock(item) && styles.lowStockText
        ]}
        numberOfLines={1}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  </ScrollView>
</View>

              
              <View style={styles.statusContainer}>
                <Text style={[
                  styles.quantity,
                  currentTheme === "dark" ? styles.darkText : styles.lightText,
                  isOutOfStock(item.quantity) && styles.outOfStockText,
                  isLowStock(item) && styles.lowStockText
                ]}>
                  X{item.quantity}
                </Text>
                
                {isOutOfStock(item.quantity) && (
                  <View style={styles.stockBadge}>
                    <Text style={styles.stockBadgeText}>Sem stock</Text>
                  </View>
                )}
                
                {isLowStock(item) && (
                  <View style={[styles.stockBadge, styles.lowStockBadge]}>
                    <Text style={styles.stockBadgeText}>Stock baixo</Text>
                  </View>
                )}
              </View>
              
              
            </View>
          </TouchableHighlight>
        ))}
      </View>
    );
    

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
        const aTotal = groupedItems[a].reduce((sum, item) => sum + parseInt(item.quantity), 0);
        const bTotal = groupedItems[b].reduce((sum, item) => sum + parseInt(item.quantity), 0);
        return bTotal - aTotal || a.localeCompare(b);
      case 'categoryQuantityAsc':
        const aSmallTotal = groupedItems[a].reduce((sum, item) => sum + parseInt(item.quantity), 0);
        const bSmallTotal = groupedItems[b].reduce((sum, item) => sum + parseInt(item.quantity), 0);
        return aSmallTotal - bSmallTotal || a.localeCompare(b);
      default:
        return a.localeCompare(b);
    }
  });  

  const allItemsSorted = items
  .filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
                        item.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory ? item.category === filterCategory : true;
    return matchesSearch && matchesCategory;
  })
  .sort((a, b) => {
    switch (sortType) {
      case 'nameAsc':
        return a.name.localeCompare(b.name);
      case 'nameDesc':
        return b.name.localeCompare(a.name);
      case 'quantityAsc':
        const ascDiff = parseInt(a.quantity) - parseInt(b.quantity);
        return ascDiff === 0 ? a.name.localeCompare(b.name) : ascDiff;
      case 'quantityDesc':
        const descDiff = parseInt(b.quantity) - parseInt(a.quantity);
        return descDiff === 0 ? a.name.localeCompare(b.name) : descDiff;
      default:
        return 0;
    }
  });
  
  return (
    <KeyboardAvoidingView 
    behavior={Platform.OS === "ios" ? "padding" : "height"}
    style={{ flex: 1 }}
    keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
    <View style={[styles.container, currentTheme === "dark" ? styles.dark : styles.light]}>
      <View style={styles.searchContainer}>
        <View style={[
          styles.searchInputContainer,
          currentTheme === "dark" ? styles.darkInput : styles.lightInput
        ]}>
          <TextInput
            placeholder={filterCategory ? `Filtrar em ${filterCategory}...` : "Pesquisar..."}
            placeholderTextColor={currentTheme === "dark" ? "#bbb" : "#555"}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, currentTheme === "dark" ? styles.darkText : styles.lightText]}
            />
          <TouchableOpacity
            onPress={() => {
              if (!showFilters && filterCategory) {
                setFilterCategory('');
              }
              setShowFilters(!showFilters);
            }}
            style={styles.filterButton}
          >
            <MaterialIcons
              name={showFilters || filterCategory ? 'filter-alt-off' : 'filter-alt'}
              size={24}
              color={currentTheme === 'dark' ? '#fff' : '#333'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {showFilters && (
        
<ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={[
      styles.categoriesContainer,
      keyboardVisible ? { maxHeight: 220 } : {} // Reduzir altura quando teclado está visível
          ]}
          contentContainerStyle={styles.categoriesContent}
        >
    {/* A-Z (All Items) */}
    <TouchableOpacity
      style={[styles.categoryChip, currentTheme === "dark" ? styles.darkChip : styles.lightChip]}
      onPress={() => handleSetSortType('nameAsc')}
    >
      <Text style={[styles.categoryChipText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
        A-Z
      </Text>
    </TouchableOpacity>

    {/* Z-A (All Items) */}
    <TouchableOpacity
      style={[styles.categoryChip, currentTheme === "dark" ? styles.darkChip : styles.lightChip]}
      onPress={() => handleSetSortType('nameDesc')}
    >
      <Text style={[styles.categoryChipText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
        Z-A
      </Text>
    </TouchableOpacity>

    {/* Menor Quantidade (All Items) */}
    <TouchableOpacity
      style={[styles.categoryChip, currentTheme === "dark" ? styles.darkChip : styles.lightChip]}
      onPress={() => handleSetSortType('quantityAsc')}
    >
      <Text style={[styles.categoryChipText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
        Menor Qtd
      </Text>
    </TouchableOpacity>

    {/* Maior Quantidade (All Items) */}
    <TouchableOpacity
      style={[styles.categoryChip, currentTheme === "dark" ? styles.darkChip : styles.lightChip]}
      onPress={() => handleSetSortType('quantityDesc')}
    >
      <Text style={[styles.categoryChipText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
        Maior Qtd
      </Text>
    </TouchableOpacity>

    {/* A-Z Categorias */}
    <TouchableOpacity
      style={[styles.categoryChip, currentTheme === "dark" ? styles.darkChip : styles.lightChip]}
      onPress={() => handleSetSortType('categoryAsc')}
    >
      <Text style={[styles.categoryChipText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
        A-Z Cat
      </Text>
    </TouchableOpacity>

    {/* Z-A Categorias */}
    <TouchableOpacity
      style={[styles.categoryChip, currentTheme === "dark" ? styles.darkChip : styles.lightChip]}
      onPress={() => handleSetSortType('categoryDesc')}
    >
      <Text style={[styles.categoryChipText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
        Z-A Cat
      </Text>
    </TouchableOpacity>

    {/* Maior Quantidade por Categoria */}
    <TouchableOpacity
      style={[styles.categoryChip, currentTheme === "dark" ? styles.darkChip : styles.lightChip]}
      onPress={() => handleSetSortType('categoryQuantityDesc')}
    >
      <Text style={[styles.categoryChipText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
        Maior Qtd Cat
      </Text>
    </TouchableOpacity>

    {/* Menor Quantidade por Categoria */}
    <TouchableOpacity
      style={[styles.categoryChip, currentTheme === "dark" ? styles.darkChip : styles.lightChip]}
      onPress={() => handleSetSortType('categoryQuantityAsc')}
    >
      <Text style={[styles.categoryChipText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
        Menor Qtd Cat
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


{sortType === 'nameAsc' || sortType === 'nameDesc' ||
 sortType === 'quantityAsc' || sortType === 'quantityDesc' ? (
  <FlatList
  style={{ marginTop: showFilters ? -345 : 0, marginBottom: keyboardVisible ? keyboardHeight - 120 : 0}} // Ajusta a margem apenas quando os filtros estão visíveis
    data={allItemsSorted}
    keyboardShouldPersistTaps="handled"
    keyboardDismissMode="on-drag"
    keyExtractor={(item) => `${item.name}-${item.category}`}
    renderItem={({ item }) => (
      <TouchableHighlight
        underlayColor={currentTheme === "dark" ? "#444" : "#f0f0f0"}
        onLongPress={() => handleItemLongPress(item)}
        delayLongPress={500}
      >
        <View style={[
          styles.itemContainer,
          isOutOfStock(item.quantity) && [
            styles.outOfStockItem,
            { backgroundColor: currentTheme === "dark" ? '#3a0404' : '#ffecec' }
          ],
          isLowStock(item) && [
            styles.lowStockItem,
            { backgroundColor: currentTheme === "dark" ? '#402c01' : '#fff9e6' }
          ]
        ]}>
         {/* Container para o nome com rolagem horizontal */}
<View style={{flex: 1, marginRight: 10}}>
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    nestedScrollEnabled={true}
    contentContainerStyle={{ flexGrow: 0 }} // Mudança importante: usar 0 em vez de 1
    style={{ width: '100%' }}
  >
    <TouchableOpacity 
      activeOpacity={1}
      onPress={() => {}} // Vai capturar taps mas permitir rolagem
    >
      <Text
        style={[
          styles.item,
          { flexShrink: 0, paddingRight: 20 }, // Adicionar mais padding direito
          currentTheme === "dark" ? styles.darkText : styles.lightText,
          isOutOfStock(item.quantity) && styles.outOfStockText,
          isLowStock(item) && styles.lowStockText
        ]}
        numberOfLines={1}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  </ScrollView>
</View>

         
          {/* StatusContainer separado, ao lado do ScrollView */}
          <View style={styles.statusContainer}>
            <Text style={[
              styles.quantity,
              currentTheme === "dark" ? styles.darkText : styles.lightText,
              isOutOfStock(item.quantity) && styles.outOfStockText,
              isLowStock(item) && styles.lowStockText
            ]}>
              X{item.quantity}
            </Text>
           
            {isOutOfStock(item.quantity) && (
              <View style={styles.stockBadge}>
                <Text style={styles.stockBadgeText}>Sem stock</Text>
              </View>
            )}
           
            {isLowStock(item) && (
              <View style={[styles.stockBadge, styles.lowStockBadge]}>
                <Text style={styles.stockBadgeText}>Stock baixo</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableHighlight>
    )}
  />
) : (
  <FlatList
    data={sortedCategories}
    keyExtractor={(category) => category}
    renderItem={({ item: category }) =>
      renderCategorySection(
        category,
        groupedItems[category].sort((a, b) => {
          switch (sortType) {
            case 'categoryAsc':
              return a.name.localeCompare(b.name);
            case 'categoryDesc':
              return b.name.localeCompare(a.name);
            case 'categoryQuantityAsc':
              const ascDiff = parseInt(a.quantity) - parseInt(b.quantity);
              return ascDiff === 0 ? a.name.localeCompare(b.name) : ascDiff;
            case 'categoryQuantityDesc':
              const descDiff = parseInt(b.quantity) - parseInt(a.quantity);
              return descDiff === 0 ? a.name.localeCompare(b.name) : descDiff;
            default:
              return 0;
          }
        })
      )
    }
  />
)}

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

    </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
  },
  mainItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  itemContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    width: "100%",
    alignItems: "center",
  },
  nameScrollContainer: {
    flex: 1,
    maxWidth: '70%',
  },
  itemContent: {
    flex: 1,
    flexDirection: "column", // Alterado para column para permitir quebra de linha
    marginRight: 10,
  },
  infoActionGroup: {
    flex: 1,
    marginRight: 10,
  },
  nameAndBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', 
    width: '100%',
  },
  
  item: {
    fontSize: 18,
    paddingVertical: 4,
    paddingRight: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    flexShrink: 0,
    marginLeft: 'auto',
    paddingLeft: 8,
  }, 

  inlineBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    flexShrink: 0, // Impede que este componente encolha
  },
  badgesArea: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    flexWrap: 'nowrap', // Impede a quebra de linha nos badges
  },
  
  quantity: {
    fontSize: 16,
    marginRight: 4,
    fontWeight: 'bold',
  },
 
  categorySection: {
    marginBottom: 20,
    width: '100%',
  },
  categoryTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#00B4D8",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 10,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
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
  searchInput: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
  },
  voiceButton: {
    padding: 10,
  },
  filterButton: {
    padding: 10,
  },
  categoriesContainer: {
    width: '100%',
    marginBottom: 0,
  },
  categoriesContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 5
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
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  textAndBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },

  outOfStockItem: {

    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c',
  },
  
  lowStockItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
  },
  
  outOfStockText: {
    color: '#e74c3c',
  },
  
  lowStockText: {
    color: '#f39c12',
  },
  
  stockBadge: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  
  lowStockBadge: {
    backgroundColor: '#f39c12',
  },
  
  stockBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  nameAndQuantity: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  
  badgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  
  itemInfo: {
    flex: 1,
    marginRight: 10,
  },
  
  itemActions: {
    flexDirection: "row",
    gap: 10,
    alignSelf: 'center',
    marginLeft: 5,
    flexShrink: 0,
  },
  light: {
    backgroundColor: "#ffffff",
  },
  dark: {
    backgroundColor: "#222222",
  },
  lightText: {
    color: "#000000",
  },
  darkText: {
    color: "#ffffff",
  },
  lightInput: {
    backgroundColor: "#f0f0f0",
  },
  darkInput: {
    backgroundColor: "#333333",
  },
});
