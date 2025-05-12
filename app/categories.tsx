import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TouchableHighlight,
  TextInput
} from "react-native";
import { InventoryItem } from '../inventory-service';
import { useRouter } from "expo-router";
import { useTheme } from "./theme-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import useCustomAlert from '../hooks/useCustomAlert';
import { db, auth } from '../firebase-config';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  deleteDoc, 
  doc,
  writeBatch
} from 'firebase/firestore';
import { addToHistory } from '../inventory-service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { CategoryIconService } from '../services/category-icon-service';



// Tipo para o cache de ícones
interface IconCache {
  [category: string]: string;
}

// interface CategoryItem para incluir o ícone
interface CategoryItem {
  name: string;
  count: number;
  icon?: string; // Adicionamos o ícone aqui
}

type SortType = 'nameAsc' | 'nameDesc' | 'countAsc' | 'countDesc';

export default function CategoriesScreen() {
  const router = useRouter();
  const { currentTheme } = useTheme();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortType, setSortType] = useState<SortType>('nameAsc');
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { showAlert, AlertComponent } = useCustomAlert();

useEffect(() => {
    loadCategories();
  }, []);

  // Efeito para filtrar categorias quando a pesquisa ou categorias mudam
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredCategories(categories);
    } else {
      const query = searchQuery.toLowerCase().trim();
      const filtered = categories.filter(
        category => category.name.toLowerCase().includes(query)
      );
      setFilteredCategories(filtered);
    }
  }, [searchQuery, categories]);


const loadCategories = async () => {
  try {
    // Verificar se o Utilizador está autenticado
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setLoading(false);
      return;
    }
    
    // Buscar itens do Firestore
    const q = query(collection(db, 'inventory'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    // Contar itens por categoria e somar as quantidades
    const categoryCounts: Record<string, number> = {};
    
    snapshot.forEach((doc) => {
      const item = doc.data();
      const category = item.category || "Sem Categoria";
      const quantity = item.quantity ? parseInt(item.quantity) : 1;
      
      if (categoryCounts[category]) {
        categoryCounts[category] += quantity;
      } else {
        categoryCounts[category] = quantity;
      }
    });
    
    // Converter para array de objetos
    const categoryItems: CategoryItem[] = Object.keys(categoryCounts).map(name => ({
      name,
      count: categoryCounts[name]
    }));
    
    // Aplicar ordenação atual
    sortCategories(categoryItems, sortType);
    
    // Obter ícones para cada categoria
    const categoriesWithIcons = await Promise.all(
      categoryItems.map(async (item) => {
        const icon = await CategoryIconService.getIconForCategory(item.name);
        return { ...item, icon };
      })
    );
    
    setCategories(categoriesWithIcons);
    setFilteredCategories(categoriesWithIcons);
  } catch (error) {
    console.error("Erro ao carregar categorias:", error);
  } finally {
    setLoading(false);
  }
};

  const sortCategories = (items: CategoryItem[], type: SortType) => {
    switch (type) {
      case 'nameAsc':
        return items.sort((a, b) => a.name.localeCompare(b.name));
      case 'nameDesc':
        return items.sort((a, b) => b.name.localeCompare(a.name));
      case 'countAsc':
        return items.sort((a, b) => a.count - b.count || a.name.localeCompare(b.name));
      case 'countDesc':
        return items.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    }
  };

  const handleSort = (type: SortType) => {
    setSortType(type);
    const sorted = [...categories];
    sortCategories(sorted, type);
    setCategories(sorted);
    setFilteredCategories(sorted);
    setShowSortOptions(false);
  };

  const navigateToInventoryWithCategory = async (category: string) => {
    try {
      // Usar um parâmetro de rota em vez de AsyncStorage
      router.push({
        pathname: "/inventory",
        params: { directCategoryFilter: category }
      });
    } catch (error) {
      console.error("Erro ao aplicar filtro de categoria:", error);
      router.push("/inventory");
    }
  };

  const handleDeleteCategory = async (category: string) => {
    showAlert(
      "Apagar Categoria",
      `Tem certeza que deseja apagar todos os itens da categoria "${category}"?`,
      [
        { text: "Cancelar", style: "cancel", onPress: () => {} },
        { 
          text: "Apagar", 
          style: "destructive", 
          onPress: async () => {
            try {
              // Verificar se o Utilizador está autenticado
              const userId = auth.currentUser?.uid;
              if (!userId) {
                showAlert("Erro", "Você precisa estar autenticado para apagar categorias.", [
                  { text: "OK", onPress: () => {} }
                ]);
                return;
              }
              
              // Buscar todos os itens da categoria
              const q = query(
                collection(db, 'inventory'), 
                where('userId', '==', userId),
                where('category', '==', category)
              );
              
              const snapshot = await getDocs(q);
              
              if (snapshot.empty) {
                showAlert("Aviso", "Não foram encontrados itens nesta categoria.", [
                  { text: "OK", onPress: () => {} }
                ]);
                return;
              }
              
              // Usar batch para deletar múltiplos documentos de uma vez
              const batch = writeBatch(db);
              
              // Adicionar cada item ao histórico antes de deletar
              const deletedItems: InventoryItem[] = [];

              snapshot.forEach((document) => {
                const item = document.data() as InventoryItem;
                deletedItems.push(item);
              
              // Adicionar ao batch para deletar
              batch.delete(doc(db, 'inventory', document.id));
              });
              
              // Executar o batch
              await batch.commit();
              
              // Adicionar ao histórico
              for (const item of deletedItems) {
                await addToHistory({
                  name: item.name,
                  category: item.category,
                  quantity: item.quantity,
                  action: 'remove'
                });
              }
              
              // Recarregar categorias
              loadCategories();
              
              showAlert("Sucesso", `Categoria "${category}" apagada com sucesso!`, [
                { text: "OK", onPress: () => {} }
              ]);
            } catch (error) {
              console.error("Erro ao apagar categoria:", error);
              showAlert("Erro", "Não foi possível apagar a categoria.", [
                { text: "OK", onPress: () => {} }
              ]);
            }
          }
        }
      ]
    );
  };

const renderCategoryItem = ({ item }: { item: CategoryItem }) => (
  <TouchableHighlight
    style={[styles.categoryCard, currentTheme === "dark" ? styles.darkCard : styles.lightCard]}
    onPress={() => navigateToInventoryWithCategory(item.name)}
    onLongPress={() => handleDeleteCategory(item.name)}
    underlayColor={currentTheme === "dark" ? "#2c3e50" : "#ecf0f1"}
    delayLongPress={500}
  >
    <View style={styles.categoryCardContent}>
      <View style={styles.categoryIconContainer}>
        <MaterialCommunityIcons
          name={(item.icon || "package-variant") as any}
          size={28}
          color="#3498db"
        />
      </View>
      <View style={styles.categoryInfo}>
        <Text style={[styles.categoryName, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
          {item.name}
        </Text>
        <Text style={[styles.categoryCount, currentTheme === "dark" ? styles.darkTextSecondary : styles.lightTextSecondary]}>
          {item.count} {item.count === 1 ? "produto" : "produtos"}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color={currentTheme === "dark" ? "#bdc3c7" : "#7f8c8d"} />
    </View>
  </TouchableHighlight>
);


  return (
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
            placeholder="Pesquisar categorias..."
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
            {sortType === 'nameAsc' ? 'A-Z' : 
             sortType === 'nameDesc' ? 'Z-A' : 
             sortType === 'countAsc' ? 'Menor Qtd' : 'Maior Qtd'}
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
              style={[styles.sortOption, sortType === 'countAsc' && styles.selectedOption]} 
              onPress={() => handleSort('countAsc')}
            >
              <Text style={[styles.sortOptionText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                Quantidade (Menor)
              </Text>
              {sortType === 'countAsc' && (
                <Ionicons name="checkmark" size={20} color="#3498db" />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.sortOption, sortType === 'countDesc' && styles.selectedOption]} 
              onPress={() => handleSort('countDesc')}
            >
              <Text style={[styles.sortOptionText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                Quantidade (Maior)
              </Text>
              {sortType === 'countDesc' && (
                <Ionicons name="checkmark" size={20} color="#3498db" />
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {loading ? (
        <ActivityIndicator size="large" color="#3498db" style={styles.loader} />
      ) : (
        <FlatList
          data={filteredCategories}
          renderItem={renderCategoryItem}
          keyExtractor={(item) => item.name}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={64} color="#bdc3c7" />
              <Text style={[styles.emptyText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                {searchQuery.trim() !== '' 
                  ? "Nenhuma categoria encontrada para esta pesquisa" 
                  : "Nenhuma categoria encontrada"}
              </Text>
            </View>
          }
        />
      )}
      
      <AlertComponent />
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
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
  listContainer: {
    padding: 20,
    paddingTop: 10,
  },
  categoryCard: {
    borderRadius: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  categoryCardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
  },
  categoryIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(52, 152, 219, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 50,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 10,
    textAlign: "center",
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  deleteButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    padding: 5,
  },
  longPressHint: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 12,
    fontStyle: 'italic',
  }
});
