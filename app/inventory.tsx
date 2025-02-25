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
  ScrollView
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "./theme-context";

interface Item {
  name: string;
  quantity: string;
  category: string;
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

          setItems(parsedItems);
        } catch (error) {
          console.error("Erro ao carregar itens", error);
        }
      };

      loadItems();
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
        <View key={item.name} style={styles.itemContainer}>
          <View style={styles.itemInfo}>
            <Text style={[styles.item, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
              {item.name}
            </Text>
            <Text style={[styles.quantity, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
              X{item.quantity}
            </Text>
          </View>
          <View style={styles.itemActions}>
            <TouchableOpacity onPress={() => handleEditItem(item)}>
              <Ionicons name="pencil" size={28} color={currentTheme === "dark" ? "#fff" : "grey"} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleRemoveItem(item)}>
              <Ionicons name="trash" size={26} color="red" />
            </TouchableOpacity>
          </View>
        </View>
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
    style={styles.categoriesContainer}
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
    data={allItemsSorted}
    keyExtractor={(item) => `${item.name}-${item.category}`}
    renderItem={({ item }) => (
      <View style={styles.itemContainer}>
        <View style={styles.itemInfo}>
          <Text style={[styles.item, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
            {item.name}
          </Text>
          <Text style={[styles.quantity, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
            X{item.quantity}
          </Text>
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity onPress={() => handleEditItem(item)}>
            <Ionicons name="pencil" size={28} color={currentTheme === "dark" ? "#fff" : "grey"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleRemoveItem(item)}>
            <Ionicons name="trash" size={26} color="red" />
          </TouchableOpacity>
        </View>
      </View>
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
  
  itemContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    width: "100%",
  },
  itemInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  item: {
    fontSize: 18,
  },
  quantity: {
    fontSize: 16,
    color: '#666',
  },
  itemActions: {
    flexDirection: "row",
    gap: 10,
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
    marginBottom: 16,
  },
  categoriesContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 30},
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
