import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Image
} from "react-native";
import { useRouter, Stack, useFocusEffect } from "expo-router";
import { useTheme } from "./theme-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
// Importar serviços do Firebase
import { getInventoryStats } from '../inventory-service';
import { useAuth } from '../auth-context';

const { width } = Dimensions.get('window');

// Interface para os itens do inventário
interface InventoryItem {
  id?: string;
  name: string;
  quantity: string | number;
  category?: string;
  price?: string | number;
  lowStockThreshold?: string;
  photo?: string; // Adicionar esta propriedade
  photoUrl?: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const { currentTheme } = useTheme();
  const { currentUser } = useAuth();
  const dailyTips = [
    "Defina limites de stock baixo personalizados para cada produto nas definições para receber notificações quando precisar de reabastecer.",
    "Use a câmera para adicionar produtos rapidamente - basta tirar uma foto e a IA identificará o produto automaticamente.",
    "Organize os seus produtos por categorias para facilitar a localização e gestão do seu inventário.",
    "Verifique regularmente os produtos com stock baixo para nunca ficar sem os essenciais.",
    "Utilize a função de pesquisa para encontrar rapidamente produtos específicos no seu inventário.",
    "Adicione fotos aos seus produtos para identificá-los mais facilmente na lista de inventário.",
    "Exporte o seu inventário para backup ou para compartilhar com outras pessoas.",
    "Configure notificações para ser alertado quando os produtos estiverem prestes a acabar.",
    "Pressione e segure um produto na lista para aceder rapidamente às opções de editar ou remover.",
    "Utilize o filtro de ordenação para visualizar os seus produtos por nome, quantidade ou categoria.",
    "Mantenha o seu inventário atualizado para ter sempre informações precisas sobre os seus produtos.",
    "Adicione descrições detalhadas aos seus produtos para incluir informações importantes como data de validade.",
    "Aproveite o tema escuro para reduzir o cansaço visual quando utilizar a app à noite.",
    "Faça uma revisão mensal do seu inventário para identificar padrões de consumo e planear compras futuras.",
    "Utilize a função de histórico para acompanhar as alterações feitas no seu inventário ao longo do tempo.",
    "Agrupe produtos semelhantes na mesma categoria para manter o seu inventário organizado.",
    "Defina quantidades mínimas diferentes para produtos sazonais conforme a época do ano.",
    "Tire fotos dos códigos de barras dos produtos para facilitar a reposição exata deles.",
    "Faça um inventário físico periodicamente para garantir que os dados da app correspondam à realidade.",
    "Utilize o ecrã de estatísticas para visualizar as suas tendências de consumo e otimizar as suas compras.",
    "Personalize as categorias de acordo com suas necessidades específicas para uma melhor organização.",
    "Compartilhe a gestão do inventário com familiares ou colegas para manter tudo atualizado.",
    "Aproveite a função de pesquisa por histórico para encontrar rapidamente produtos que você já adicionou antes.",
    "Utilize a visualização por categorias para ter uma visão geral organizada do seu inventário.",
    "Mantenha a sua app atualizada para aproveitar as novas funcionalidades e melhorias de desempenho.",
    "Crie um sistema de etiquetas físicas que correspondam às categorias da app para organizar o seu espaço físico.",
    "Utilize a função de filtro para identificar rapidamente produtos que precisam de atenção.",
    "Faça backups regulares dos seus dados para evitar perda de informações importantes."
  ];
  const getTipOfTheDay = () => {
    // Obter a data atual
    const today = new Date();
    // Usar o dia do mês como índice (0-30)
    const dayOfMonth = today.getDate();
    // Usar o módulo para garantir que o índice esteja dentro dos limites do array
    const tipIndex = dayOfMonth % dailyTips.length;
    // Retornar a dica correspondente ao dia
    return dailyTips[tipIndex];
  };
  const [inventoryStats, setInventoryStats] = useState({
    totalItems: 0,
    totalCategories: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    recentlyAdded: [] as InventoryItem[],
    categories: [] as string[],
    lowStockItemsList: [] as InventoryItem[],
    outOfStockItemsList: [] as InventoryItem[]
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLowStockItems, setShowLowStockItems] = useState(false);
  const [showOutOfStockItems, setShowOutOfStockItems] = useState(false);

const loadInventoryStats = async () => {
  try {
    if (!currentUser) {
      console.error('Utilizador não autenticado');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    
    const stats = await getInventoryStats();
    
    console.log("DEBUG: Stats recebidas do getInventoryStats:");
    console.log("DEBUG: totalItems:", stats.totalItems);
    console.log("DEBUG: totalCategories:", stats.totalCategories);
    console.log("DEBUG: lowStockItems:", stats.lowStockItems);
    console.log("DEBUG: outOfStockItems:", stats.outOfStockItems);
    console.log("DEBUG: recentlyAdded length:", stats.recentlyAdded?.length || 0);
    console.log("DEBUG: lowStockItemsList length:", stats.lowStockItemsList?.length || 0);
    console.log("DEBUG: outOfStockItemsList length:", stats.outOfStockItemsList?.length || 0);
    
    // Check if recentlyAdded has base64 photos that might be causing issues
   if (stats.recentlyAdded && stats.recentlyAdded.length > 0) {
  console.log("DEBUG: recentlyAdded has base64 items:", stats.recentlyAdded.some((item: InventoryItem) => item.photo));
  if (stats.recentlyAdded.some((item: InventoryItem) => item.photo)) {
    const samplePhotoLength = stats.recentlyAdded.find((item: InventoryItem) => item.photo)?.photo?.length || 0;
    console.log("DEBUG: Base64 photo length:", samplePhotoLength);
  }
}

    
    // Create a new object to ensure state update
    const updatedStats = {
      totalItems: stats.totalItems,
      totalCategories: stats.totalCategories,
      lowStockItems: stats.lowStockItems,
      outOfStockItems: stats.outOfStockItems,
      recentlyAdded: stats.recentlyAdded || [],
      categories: stats.categories || [],
      lowStockItemsList: stats.lowStockItemsList || [],
      outOfStockItemsList: stats.outOfStockItemsList || []
    };
    
    console.log("DEBUG: updatedStats.recentlyAdded length:", updatedStats.recentlyAdded.length);
    
    setInventoryStats(updatedStats);
    
    console.log("DEBUG: Estado após atualização:");
    console.log("DEBUG: recentlyAdded items count:", inventoryStats.recentlyAdded?.length || 0);
    console.log("DEBUG: lowStockItemsList count:", inventoryStats.lowStockItemsList?.length || 0);
    console.log("DEBUG: outOfStockItemsList count:", inventoryStats.outOfStockItemsList?.length || 0);
    
  } catch (error) {
    console.error('Erro ao carregar estatísticas:', error);
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

  // Carregar estatísticas ao montar o componente
  useEffect(() => {
  if (currentUser) {
    loadInventoryStats().then(() => {
      // Adicionar este log para verificar o tamanho dos objetos
      console.log("DEBUG: recentlyAdded items count:", inventoryStats.recentlyAdded.length);
      console.log("DEBUG: lowStockItemsList count:", inventoryStats.lowStockItemsList.length);
      console.log("DEBUG: outOfStockItemsList count:", inventoryStats.outOfStockItemsList.length);
      
      // Verificar se algum item ainda tem base64
      const hasBase64 = inventoryStats.recentlyAdded.some(item => item.photo && item.photo.length > 100);
      console.log("DEBUG: recentlyAdded has base64 items:", hasBase64);
    });
  } else {
    setLoading(false);
  }
}, [currentUser]);
  
  // Função para atualizar os dados
  const onRefresh = async () => {
    setRefreshing(true);
    await loadInventoryStats();
  };

  // Função para navegar para o inventário com filtros
  const navigateToInventory = (filter?: { type: string, value: any }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (filter) {
      // Salvar o filtro temporariamente para ser usado na tela de inventário
      AsyncStorage.setItem('tempInventoryFilter', JSON.stringify(filter))
        .then(() => {
          router.push("/inventory" as any);
        })
        .catch(err => {
          console.error("Erro ao salvar filtro:", err);
          router.push("/inventory" as any);
        });
    } else {
      // Limpar qualquer filtro existente
      AsyncStorage.removeItem('tempInventoryFilter')
        .then(() => {
          router.push("/inventory" as any);
        })
        .catch(err => {
          console.error("Erro ao limpar filtro:", err);
          router.push("/inventory" as any);
        });
    }
  };

  // Função para mostrar categorias
  const showCategories = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Navegar para uma nova tela ou mostrar um modal com as categorias
    // Por enquanto, vamos apenas navegar para o inventário com um filtro de categorias
    router.push("/categories" as any);
  };

  // Função para feedback tátil ao pressionar botões
  const handleButtonPress = (route: "/inventory" | "/add" | "/statistics" | "/settings") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(route as any);
  };

  // Função para renderizar imagem do item (suporta tanto photoUrl quanto photo base64)
const renderItemImage = (item: InventoryItem) => {
  if (item.photoUrl) {
    return ( <Image source={{ uri: item.photoUrl }} style={styles.recentItemIcon} resizeMode="cover" /> );
  } else if (item.photo) { // << Deve entrar aqui se photo existir e photoUrl não
    return ( <Image source={{ uri: `data:image/jpeg;base64,${item.photo}` }} style={styles.recentItemIcon} resizeMode="cover" /> );
  } else {
    // Fallback para ícone de categoria usando a função LOCAL getCategoryIcon
    return ( 
      <View style={styles.recentItemIcon}>
        <MaterialCommunityIcons
          name={getCategoryIcon(item.category)} // Usa a função local para ícones de categoria
          size={24}
          color="#3498db"
        />
      </View>
    );
  }
};

  useFocusEffect(
    useCallback(() => {
      // Esta função será executada sempre que o ecrã Home ganhar foco
      if (currentUser) {
        console.log("HomeScreen focado, carregando estatísticas...");
        setLoading(true); // Para mostrar o indicador de loading ao re-carregar
        loadInventoryStats();
      }
  
      return () => {
        // Opcional: Função de limpeza executada quando o ecrã perde o foco
        console.log("HomeScreen perdeu o foco.");
      };
    }, [currentUser]) // A dependência currentUser garante que só executa se houver user
  );
  
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
    <ScrollView
      style={[styles.container, currentTheme === "dark" ? styles.dark : styles.light]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Cabeçalho com gradiente */}
      <LinearGradient
        colors={currentTheme === "dark"
          ? ['#2c3e50', '#1a1a1a']
          : ['#3498db', '#2980b9']}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          {/* Adicionar botão de perfil */}
    <TouchableOpacity 
      style={styles.profileButton}
      onPress={() => router.push("/profile" as any)}
    >
      {currentUser?.photoURL ? (
        <Image 
          source={{ uri: currentUser.photoURL }} 
          style={styles.profileImage} 
        />
      ) : (
        <View style={[
          styles.profileImagePlaceholder,
          { backgroundColor: currentTheme === "dark" ? "#34495e" : "#bdc3c7" }
        ]}>
          <Text style={styles.profileInitial}>
            {currentUser?.displayName ? currentUser.displayName[0].toUpperCase() : 
             currentUser?.email ? currentUser.email[0].toUpperCase() : "?"}
          </Text>
        </View>
      )}
    </TouchableOpacity>
    <View style={styles.logoContainer}>
  <Ionicons 
    name="cube" 
    size={40} 
    color="#fff" 
    style={styles.logoIcon}
  />
  <Text style={styles.title}>
    My Inventory
  </Text>
</View>
<Text style={styles.subtitle}>
  Organize os seus produtos com facilidade
</Text>
        </View>
      </LinearGradient>

      {/* Widgets de estatísticas */}
      <View style={styles.statsContainer}>
        <Text style={[styles.sectionTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
          Visão Geral
        </Text>
        
        {loading ? (
          <ActivityIndicator size="large" color="#3498db" style={styles.loader} />
        ) : (
          <View style={styles.statsGrid}>
            <TouchableOpacity
              style={[styles.statCard, currentTheme === "dark" ? styles.darkCard : styles.lightCard]}
              onPress={() => navigateToInventory()}
            >
              <Ionicons name="cube" size={28} color="#3498db" />
              <Text style={styles.statValue}>{inventoryStats.totalItems}</Text>
              <Text style={[styles.statLabel, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                Total de Produtos
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.statCard, currentTheme === "dark" ? styles.darkCard : styles.lightCard]}
              onPress={showCategories}
            >
              <Ionicons name="apps" size={28} color="#2ecc71" />
              <Text style={styles.statValue}>{inventoryStats.totalCategories}</Text>
              <Text style={[styles.statLabel, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                Categorias
              </Text>
            </TouchableOpacity>
{/* Lista de itens com stock baixo */}
{showLowStockItems && inventoryStats.lowStockItemsList.length > 0 && (
  <View style={styles.itemListContainer}>
    <View style={[
      styles.itemListHeader,
      {
        backgroundColor: currentTheme === "dark" ? "#1e1e1e" : "#ffffff",
        borderBottomColor: currentTheme === "dark" ? "#333" : "#eee"
      }
    ]}>
      <Text style={[styles.itemListTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
        Itens com Stock Baixo
      </Text>
      <TouchableOpacity onPress={() => setShowLowStockItems(false)}>
        <Ionicons name="close" size={24} color={currentTheme === "dark" ? "#fff" : "#333"} />
      </TouchableOpacity>
    </View>
   
    <ScrollView
      style={[
        styles.itemList,
        { backgroundColor: currentTheme === "dark" ? "#1e1e1e" : "#ffffff" }
      ]}
      nestedScrollEnabled={true}
    >
      {inventoryStats.lowStockItemsList.map((item, index) => (
        <View
          key={index}
          style={[
            styles.itemCard,
            currentTheme === "dark" ? styles.darkCard : styles.lightCard,
            { borderBottomColor: currentTheme === "dark" ? "#333" : "#eee" }
          ]}
        >
          <View style={styles.itemIcon}>
            <MaterialCommunityIcons
              name={getCategoryIcon(item.category)}
              size={24}
              color="#f39c12"
            />
          </View>
          <View style={styles.itemDetails}>
            <Text style={[styles.itemName, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
              {item.name}
            </Text>
            <Text style={styles.itemCategory}>
              {item.category}
            </Text>
          </View>
          <View style={styles.itemQuantity}>
            <Text style={[styles.itemQuantityText, {color: "#f39c12"}]}>
              {item.quantity}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
   
  </View>
)}

{/* Lista de itens sem stock */}
{showOutOfStockItems && inventoryStats.outOfStockItemsList.length > 0 && (
  <View style={styles.itemListContainer}>
    <View style={[
      styles.itemListHeader,
      {
        backgroundColor: currentTheme === "dark" ? "#1e1e1e" : "#ffffff",
        borderBottomColor: currentTheme === "dark" ? "#333" : "#eee"
      }
    ]}>
      <Text style={[styles.itemListTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
        Itens Sem Stock
      </Text>
      <TouchableOpacity onPress={() => setShowOutOfStockItems(false)}>
        <Ionicons name="close" size={24} color={currentTheme === "dark" ? "#fff" : "#333"} />
      </TouchableOpacity>
    </View>
   
    <ScrollView
      style={[
        styles.itemList,
        { backgroundColor: currentTheme === "dark" ? "#1e1e1e" : "#ffffff" }
      ]}
      nestedScrollEnabled={true}
    >
      {inventoryStats.outOfStockItemsList.map((item, index) => (
        <View
          key={index}
          style={[
            styles.itemCard,
            currentTheme === "dark" ? styles.darkCard : styles.lightCard,
            { borderBottomColor: currentTheme === "dark" ? "#333" : "#eee" }
          ]}
        >
          <View style={styles.itemIcon}>
            <MaterialCommunityIcons
              name={getCategoryIcon(item.category)}
              size={24}
              color="#e74c3c"
            />
          </View>
          <View style={styles.itemDetails}>
            <Text style={[styles.itemName, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
              {item.name}
            </Text>
            <Text style={styles.itemCategory}>
              {item.category}
            </Text>
          </View>
          <View style={styles.itemQuantity}>
            <Text style={[styles.itemQuantityText, {color: "#e74c3c"}]}>
              {item.quantity}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  </View>
)}          

<TouchableOpacity
  style={[styles.statCard, currentTheme === "dark" ? styles.darkCard : styles.lightCard]}
  onPress={() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navegar diretamente para a página de baixo estoque
    router.push("/low-stock" as any);
  }}
>
  <Ionicons name="warning" size={28} color="#f39c12" />
  <Text style={styles.statValue}>{inventoryStats.lowStockItems}</Text>
  <Text style={[styles.statLabel, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
    Stock Baixo
  </Text>
</TouchableOpacity>

<TouchableOpacity
  style={[styles.statCard, currentTheme === "dark" ? styles.darkCard : styles.lightCard]}
  onPress={() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navegar diretamente para a página de sem estoque
    router.push("/out-of-stock" as any);
  }}
>
  <Ionicons name="alert-circle" size={28} color="#e74c3c" />
  <Text style={styles.statValue}>{inventoryStats.outOfStockItems}</Text>
  <Text style={[styles.statLabel, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
    Sem Stock
  </Text>
</TouchableOpacity>

          </View>
        )}
      </View>

      {/* Ações rápidas */}
      <View style={styles.actionsContainer}>
        <Text style={[styles.sectionTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
          Ações Rápidas
        </Text>
       
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#0984e3" }]}
            onPress={() => handleButtonPress("/inventory")}
          >
            <Ionicons name="list" size={32} color="#fff" />
            <Text style={styles.actionButtonText}>Ver Inventário</Text>
          </TouchableOpacity>
         
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#2ecc71" }]}
            onPress={() => handleButtonPress("/add")}
          >
            <Ionicons name="add-circle" size={32} color="#fff" />
            <Text style={styles.actionButtonText}>Adicionar Produto</Text>
          </TouchableOpacity>
        </View>
       
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#ff5722" }]}
            onPress={() => handleButtonPress("/statistics")}
          >
            <Ionicons name="bar-chart" size={32} color="#fff" />
            <Text style={styles.actionButtonText}>Estatísticas</Text>
          </TouchableOpacity>
         
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#7f8c8d" }]}
            onPress={() => handleButtonPress("/settings")}
          >
            <Ionicons name="settings-outline" size={32} color="#fff" />
            <Text style={styles.actionButtonText}>Definições</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Itens recentes */}
{!loading && inventoryStats.recentlyAdded && inventoryStats.recentlyAdded.length > 0 ? (
  <View style={styles.recentItemsContainer}>
    <Text style={[styles.sectionTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
      Adicionados Recentemente ({inventoryStats.recentlyAdded.length})
    </Text>
    
    {inventoryStats.recentlyAdded.map((item, index) => {
      // <<<<<<< COLOQUE O CONSOLE.LOG AQUI >>>>>>>>>
      console.log(
        `DEBUG RENDER HomeScreen: Item ${index} - Name: ${item.name}, ID: ${item.id}, Has photoUrl: ${!!item.photoUrl}, Has photo base64: ${!!item.photo}, Base64 Length: ${item.photo?.length || 0}, Category: ${item.category}`
      );
      // <<<<<<< FIM DO CONSOLE.LOG >>>>>>>>>

      return (
        <TouchableOpacity
          // É melhor usar um ID único do item para a key, se disponível
          key={item.id || index} 
          style={[styles.recentItemCard, currentTheme === "dark" ? styles.darkCard : styles.lightCard]}
          onPress={() => {
            if (item.id) {
              router.push({
                pathname: "/item-details",
                params: { id: item.id }
              } as any);
            } else {
              // Adicionar um log ou alerta se o item não tiver ID pode ser útil
              console.warn("Tentativa de navegar para detalhes de item sem ID:", item);
              // showAlert("Erro", "Não foi possível abrir os detalhes deste item (ID em falta).", [{text: "OK"}]);
            }
          }}
        >
          {renderItemImage(item)}
          <View style={styles.recentItemDetails}>
            <Text style={[styles.recentItemName, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
              {item.name}
            </Text>
            <Text style={styles.recentItemCategory}>
              {item.category || "Sem categoria"}
            </Text>
          </View>
          <View style={styles.recentItemQuantity}>
            <Text style={styles.recentItemQuantityText}>
              {item.quantity}
            </Text>
          </View>
        </TouchableOpacity>
      );
    })}
    
    <TouchableOpacity
      style={styles.viewAllButton}
      onPress={() => handleButtonPress("/inventory")}
    >
      <Text style={styles.viewAllButtonText}>Ver Todos os Produtos</Text>
      <Ionicons name="arrow-forward" size={16} color="#3498db" />
    </TouchableOpacity>
  </View>
) : !loading ? (
  <View style={styles.recentItemsContainer}>
    <Text style={[styles.sectionTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
      Adicionados Recentemente
    </Text>
    <View style={[styles.recentItemCard, currentTheme === "dark" ? styles.darkCard : styles.lightCard, {justifyContent: 'center', alignItems: 'center', padding: 20}]}>
      <Text style={[currentTheme === "dark" ? styles.darkText : styles.lightText, {opacity: 0.7}]}>
        Nenhum item adicionado recentemente
      </Text>
    </View>
  </View>
) : null}

      {/* Dica do dia */}
      <View style={[styles.tipCard, currentTheme === "dark" ? styles.darkCard : styles.lightCard]}>
  <View style={styles.tipHeader}>
    <Ionicons name="bulb" size={24} color="#f39c12" />
    <Text style={[styles.tipTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
      Dica do Dia
    </Text>
  </View>
  <Text style={[styles.tipText, currentTheme === "dark" ? styles.darkTextSecondary : styles.lightTextSecondary]}>
    {getTipOfTheDay()}
  </Text>
</View>

      {/* Rodapé */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, currentTheme === "dark" ? styles.darkTextSecondary : styles.lightTextSecondary]}>
        © 2025
          My Inventory v1.0.0
        </Text>
      </View>
    </ScrollView>
    </>
  );
}


// Função para obter ícone baseado na categoria
function getCategoryIcon(category?: string):
  "package-variant" | "food-apple" | "cup" | "shower" | "tshirt-crew" |
  "shoe-heel" | "tools" | "pencil" | "cellphone" | "television" | "book" {
  
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
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 30,
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
  },
  header: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    marginTop: -36,
  },
  logoIcon: {
    marginRight: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
  },
  statsContainer: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
  },
  logoImage: {
    width: 48,
    height: 48,
    marginRight: 10, // Ajuste conforme necessário para o espaçamento
  },
  
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  statCard: {
    width: (width - 50) / 2,
    padding: 15,
    borderRadius: 15,
    alignItems: "center",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    marginVertical: 5,
    color: "#3498db",
  },
  statLabel: {
    fontSize: 14,
    textAlign: "center",
  },
  actionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  actionButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  actionButton: {
    width: (width - 50) / 2,
    padding: 15,
    borderRadius: 15,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 8,
    textAlign: "center",
  },
  recentItemsContainer: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  recentItemCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  recentItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(52, 152, 219, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    overflow: 'hidden',
  },
  recentItemDetails: {
    flex: 1,
  },
  recentItemName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  recentItemCategory: {
    fontSize: 14,
    color: "#7f8c8d",
  },
  recentItemQuantity: {
    backgroundColor: "rgba(52, 152, 219, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    minWidth: 35,
    alignItems: "center",
  },
  itemListContainer: {
    marginHorizontal: 20,
    marginBottom: 25,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  itemListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
  },
  itemListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  itemList: {
    maxHeight: 300,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(52, 152, 219, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 14,
    color: "#7f8c8d",
  },
  itemQuantity: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    minWidth: 35,
    alignItems: "center",
  },
  itemQuantityText: {
    fontWeight: "bold",
  },
  
  recentItemQuantityText: {
    color: "#3498db",
    fontWeight: "bold",
  },
  profileButton: {
    position: 'absolute',
    top: -50,
    right: 8,
    zIndex: 10,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileInitial: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    padding: 10,
  },
  viewAllButtonText: {
    color: "#3498db",
    fontSize: 16,
    marginRight: 5,
  },
  noRecentItemsContainer: {
    paddingHorizontal: 20,
    marginBottom: 25,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  noRecentItemsText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  tipCard: {
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 15,
    marginBottom: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tipHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  tipTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    alignItems: "center",
    marginTop: 10,
    paddingBottom: 20,
  },
  footerText: {
    fontSize: 14,
  },
  loader: {
    marginVertical: 20,
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
