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
  Image,
  Modal,
  Share,
  Animated,
  Easing
} from "react-native";
import { useRouter, Stack, useFocusEffect } from "expo-router";
import { useTheme } from "./theme-context";
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { GoogleGenerativeAI } from "@google/generative-ai";
// Importar serviços do inventário
import { getInventoryStats } from '../inventory-service';
import { useAuth } from '../auth-context';
import useCustomAlert from '../hooks/useCustomAlert';

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

const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY as string);


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

const generateDailyInsight = async () => {
  if (!currentUser || inventoryStats.totalItems === 0) return;
  
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `
    Com base nos seguintes dados do inventário:
    - Total de produtos: ${inventoryStats.totalItems}
    - Categorias: ${inventoryStats.totalCategories}
    - Produtos com stock baixo: ${inventoryStats.lowStockItems}
    - Produtos sem stock: ${inventoryStats.outOfStockItems}
    - Principais categorias: ${inventoryStats.categories.slice(0, 3).join(', ')}
    
    Gere uma análise breve e útil (máximo 100 palavras) em português de Portugal sobre o estado do inventário e dê uma sugestão prática para melhorar a gestão.
    `;
    
    const result = await model.generateContent(prompt);
    const insight = result.response.text();
    setDailyInsight(insight);
  } catch (error) {
    console.error("Erro ao gerar insight:", error);
    setDailyInsight("Mantenha o seu inventário organizado verificando regularmente os produtos com stock baixo e atualizando as quantidades.");
  }
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
  const [dailyInsight, setDailyInsight] = useState<string>("");
  const [showInsightModal, setShowInsightModal] = useState(false);
  const { showAlert, AlertComponent } = useCustomAlert();
  const [pulseAnim] = useState(new Animated.Value(1));
  const [waveAnim1] = useState(new Animated.Value(0.3));
  const [waveAnim2] = useState(new Animated.Value(0.6));
  const [waveAnim3] = useState(new Animated.Value(0.4));
  const [floatAnim] = useState(new Animated.Value(0));

  
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
  
// Gerar insight apenas uma vez por sessão (quando há items)
const [insightGenerated, setInsightGenerated] = useState(false);

useEffect(() => {
  if (inventoryStats.totalItems > 0 && !insightGenerated && !dailyInsight) {
    generateDailyInsight();
    setInsightGenerated(true);
  }
}, [inventoryStats.totalItems, insightGenerated, dailyInsight]);

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
  const handleButtonPress = (route: "/inventory" | "/add" | "/statistics" | "/settings" | "/quick-edit") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(route as any);
  };

useEffect(() => {
  // Animação de respiração suave para o círculo principal
  const breatheAnimation = Animated.loop(
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.2,
        duration: 2000,
        easing: Easing.bezier(0.4, 0.0, 0.6, 1.0),
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.bezier(0.4, 0.0, 0.6, 1.0),
        useNativeDriver: true,
      }),
    ])
  );

  // Ondas mais suaves e elegantes
  const smoothWave1 = Animated.loop(
    Animated.sequence([
      Animated.timing(waveAnim1, {
        toValue: 1,
        duration: 1500,
        easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
        useNativeDriver: false,
      }),
      Animated.timing(waveAnim1, {
        toValue: 0.2,
        duration: 1500,
        easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
        useNativeDriver: false,
      }),
    ])
  );

  const smoothWave2 = Animated.loop(
    Animated.sequence([
      Animated.timing(waveAnim2, {
        toValue: 1,
        duration: 1800,
        easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
        useNativeDriver: false,
      }),
      Animated.timing(waveAnim2, {
        toValue: 0.3,
        duration: 1800,
        easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
        useNativeDriver: false,
      }),
    ])
  );

  const smoothWave3 = Animated.loop(
    Animated.sequence([
      Animated.timing(waveAnim3, {
        toValue: 1,
        duration: 2200,
        easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
        useNativeDriver: false,
      }),
      Animated.timing(waveAnim3, {
        toValue: 0.4,
        duration: 2200,
        easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
        useNativeDriver: false,
      }),
    ])
  );

  // Movimento orbital suave
  const orbitAnimation = Animated.loop(
    Animated.timing(floatAnim, {
      toValue: 1,
      duration: 4000,
      easing: Easing.linear,
      useNativeDriver: true,
    })
  );

  // Iniciar todas as animações
  breatheAnimation.start();
  smoothWave1.start();
  smoothWave2.start();
  smoothWave3.start();
  orbitAnimation.start();

  return () => {
    breatheAnimation.stop();
    smoothWave1.stop();
    smoothWave2.stop();
    smoothWave3.stop();
    orbitAnimation.stop();
  };
}, []);

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

const shareInventoryStats = async () => {
  try {
    const statsText = `📊 Estatísticas do Meu Inventário:
    
📦 Total de Produtos: ${inventoryStats.totalItems}
📂 Categorias: ${inventoryStats.totalCategories}
⚠️ Stock Baixo: ${inventoryStats.lowStockItems}
❌ Sem Stock: ${inventoryStats.outOfStockItems}

Principais categorias: ${inventoryStats.categories.slice(0, 3).join(', ')}

Gerado pela app My Inventory 📱`;

    await Share.share({
      message: statsText,
      title: 'Estatísticas do Inventário'
    });
  } catch (error) {
    console.error('Erro ao partilhar:', error);
    showAlert("Erro", "Não foi possível partilhar as estatísticas.", [
      { text: "OK", onPress: () => {} }
    ]);
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
          : ['#0f4c75', '#3282b8']}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          {/* Adicionar botão de perfil */}
    <TouchableOpacity 
      style={styles.profileButton}
      onPress={() => router.push("/profile" as any)}
    >
      {(currentUser?.user_metadata?.avatar_url || currentUser?.user_metadata?.picture) ? (
        <Image 
          source={{ uri: currentUser.user_metadata.avatar_url || currentUser.user_metadata.picture }} 
          style={styles.profileImage} 
        />
      ) : (
        <View style={[
          styles.profileImagePlaceholder,
          { backgroundColor: currentTheme === "dark" ? "#34495e" : "#bdc3c7" }
        ]}>
          <Text style={styles.profileInitial}>
            {(currentUser?.user_metadata?.display_name || currentUser?.user_metadata?.full_name) 
              ? (currentUser.user_metadata.display_name || currentUser.user_metadata.full_name)[0].toUpperCase() 
              : currentUser?.email ? currentUser.email[0].toUpperCase() : "?"}
          </Text>
        </View>
      )}
    </TouchableOpacity>
    <TouchableOpacity
  style={{
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    marginVertical: 10,
  }}
  onPress={() => router.push('/supplements')}
>
  <Text style={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>
    Abrir VitaStreak
  </Text>
</TouchableOpacity>

<TouchableOpacity
  style={{
    backgroundColor: '#7c3aed',
    padding: 16,
    borderRadius: 12,
    marginVertical: 10,
  }}
  onPress={() => router.push('/today' as any)}
>
  <Text style={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>
    Hoje - VitaStreak
  </Text>
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
  <View style={styles.sectionHeader}>
    <Text style={[styles.sectionTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
      Visão Geral
    </Text>
    {inventoryStats.totalItems > 0 && (
      <TouchableOpacity
        style={styles.shareButton}
        onPress={shareInventoryStats}
      >
        <Ionicons name="share-outline" size={20} color="#3498db" />
      </TouchableOpacity>
    )}
  </View>
        
        {loading ? (
          <ActivityIndicator size="large" color="#3498db" style={styles.loader} />
       ) : inventoryStats.totalItems === 0 ? (
    // ADICIONAR AQUI: Mensagem de boas-vindas para utilizadores novos
    <View style={[styles.welcomeContainer, currentTheme === "dark" ? styles.darkCard : styles.lightCard]}>
      <MaterialIcons name="inventory" size={64} color="#3498db" style={styles.welcomeIcon} />
      <Text style={[styles.welcomeTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
        Bem-vindo ao My Inventory!
      </Text>
      <Text style={[styles.welcomeText, currentTheme === "dark" ? styles.darkTextSecondary : styles.lightTextSecondary]}>
        Comece a organizar o seu inventário adicionando o seu primeiro produto. 
        Use a câmera para identificação automática ou adicione manualmente.
      </Text>
      
      <View style={styles.welcomeActions}>
        <TouchableOpacity
          style={styles.welcomePrimaryButton}
          onPress={() => handleButtonPress("/add")}
        >
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.welcomePrimaryButtonText}>Adicionar Primeiro Produto</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.welcomeSecondaryButton}
          onPress={() => {
            showAlert(
              "Como começar",
              "1. Toque em 'Adicionar Produto' para começar\n2. Use a câmera para identificação automática\n3. Organize por categorias\n4. Defina alertas de stock baixo\n5. Acompanhe as estatísticas",
              [{ text: "Entendi", onPress: () => {} }]
            );
          }}
        >
          <MaterialIcons name="help-outline" size={20} color="#3498db" />
          <Text style={styles.welcomeSecondaryButtonText}>Como começar</Text>
        </TouchableOpacity>
      </View>
    </View>
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
        Produtos com Stock Baixo
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
        Produtos Sem Stock
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
      style={[styles.actionButton, { backgroundColor: "#9b59b6" }]}
      onPress={() => handleButtonPress("/quick-edit")}
    >
      <MaterialCommunityIcons name="pencil-plus" size={32} color="#fff" />
      <Text style={styles.actionButtonText}>Edição Rápida</Text>
    </TouchableOpacity>
             
    <TouchableOpacity
      style={[styles.actionButton, { backgroundColor: "#7f8c8d" }]}
      onPress={() => handleButtonPress("/settings")}
    >
      <Ionicons name="settings-outline" size={32} color="#fff" />
      <Text style={styles.actionButtonText}>Definições</Text>
    </TouchableOpacity>
  </View>

{/* Botão de Estatísticas com animação contínua */}
<View style={styles.actionButtonsRow}>
  <TouchableOpacity
    style={[styles.statisticsButton, { backgroundColor: "#ff5722" }]}
    onPress={() => handleButtonPress("/statistics")}
  >
    {/* Lado esquerdo - Texto e ícone */}
    <View style={styles.statisticsContent}>
      <Ionicons name="bar-chart" size={44} color="#fff" style={styles.statisticsIcon} />
      <View style={styles.statisticsTextContainer}>
        <Text style={styles.statisticsButtonText}>Estatísticas</Text>
        <Text style={styles.statisticsSubtext}>
          {inventoryStats.totalItems} produtos • {inventoryStats.lowStockItems} alertas
        </Text>
      </View>
    </View>
    
{/* Lado direito - Animação elegante */}
<View style={styles.animatedChart}>
  {/* Círculo principal com respiração suave */}
  <Animated.View 
    style={[
      styles.breathingCircle,
      {
        transform: [{ scale: pulseAnim }],
        opacity: pulseAnim.interpolate({
          inputRange: [1, 1.2],
          outputRange: [0.6, 0.3],
        }),
      }
    ]} 
  />
  
  {/* Centro brilhante fixo */}
  <View style={styles.centerGlow} />
  
  {/* Ondas concêntricas elegantes */}
  <Animated.View 
    style={[
      styles.concentricWave,
      styles.wave1Style,
      {
        transform: [
          { 
            scale: waveAnim1.interpolate({
              inputRange: [0, 1],
              outputRange: [0.5, 1.5],
            })
          }
        ],
        opacity: waveAnim1.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.8, 0.4, 0],
        }),
      }
    ]} 
  />
  
  <Animated.View 
    style={[
      styles.concentricWave,
      styles.wave2Style,
      {
        transform: [
          { 
            scale: waveAnim2.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 1.3],
            })
          }
        ],
        opacity: waveAnim2.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.6, 0.3, 0],
        }),
      }
    ]} 
  />
  
  <Animated.View 
    style={[
      styles.concentricWave,
      styles.wave3Style,
      {
        transform: [
          { 
            scale: waveAnim3.interpolate({
              inputRange: [0, 1],
              outputRange: [0.4, 1.4],
            })
          }
        ],
        opacity: waveAnim3.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.7, 0.35, 0],
        }),
      }
    ]} 
  />
  
  {/* Partículas orbitais */}
  <Animated.View 
    style={[
      styles.orbitalParticle,
      styles.particle1,
      {
        transform: [
          {
            rotate: floatAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '360deg'],
            }),
          },
        ],
      }
    ]} 
  >
    <View style={styles.particleDot} />
  </Animated.View>
  
  <Animated.View 
    style={[
      styles.orbitalParticle,
      styles.particle2,
      {
        transform: [
          {
            rotate: floatAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['180deg', '540deg'],
            }),
          },
        ],
      }
    ]} 
  >
    <View style={[styles.particleDot, { backgroundColor: 'rgba(255, 255, 255, 0.6)' }]} />
  </Animated.View>
  
  {/* Sparkles flutuantes */}
  <Animated.View 
    style={[
      styles.sparkle,
      styles.sparkle1,
      {
        opacity: floatAnim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, 1, 0],
        }),
        transform: [
          {
            translateY: floatAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [10, -10],
            }),
          },
        ],
      }
    ]} 
  />
  
  <Animated.View 
    style={[
      styles.sparkle,
      styles.sparkle2,
      {
        opacity: floatAnim.interpolate({
          inputRange: [0, 0.3, 0.7, 1],
          outputRange: [1, 0, 1, 0],
        }),
        transform: [
          {
            translateX: floatAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-5, 5],
            }),
          },
        ],
      }
    ]} 
  />
</View>
  </TouchableOpacity>
</View>
</View>

{/* Dica do dia */}

{/* Insight Inteligente */}
{dailyInsight && (
  <View style={styles.recentItemsContainer}>
    <View style={styles.insightHeader}>
      <Text style={[styles.sectionTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
        Análise Inteligente
      </Text>
      <TouchableOpacity
        style={styles.insightButton}
        onPress={() => setShowInsightModal(true)}
      >
        <MaterialIcons name="psychology" size={24} color="#fff" />
        <Text style={styles.insightButtonText}>Ver Análise</Text>
      </TouchableOpacity>
    </View>
    
    <TouchableOpacity
      style={[styles.insightPreview, currentTheme === "dark" ? styles.darkCard : styles.lightCard]}
      onPress={() => setShowInsightModal(true)}
    >
      <MaterialIcons name="auto-awesome" size={20} color="#9b59b6" />
      <Text style={[styles.insightPreviewText, currentTheme === "dark" ? styles.darkText : styles.lightText]} numberOfLines={2}>
        {dailyInsight.substring(0, 80)}...
      </Text>
      <Ionicons name="chevron-forward" size={16} color="#9b59b6" />
    </TouchableOpacity>
  </View>
)}

{/* Modal de Insight Detalhado */}
<Modal
  visible={showInsightModal}
  animationType="slide"
  transparent={true}
  onRequestClose={() => setShowInsightModal(false)}
>
  <View style={styles.modalOverlay}>
    <View style={[styles.modalContent, currentTheme === "dark" ? styles.darkCard : styles.lightCard]}>
      <View style={styles.modalHeader}>
        <MaterialIcons name="psychology" size={28} color="#9b59b6" />
        <Text style={[styles.modalTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
          Análise Inteligente do Inventário
        </Text>
        <TouchableOpacity onPress={() => setShowInsightModal(false)}>
          <Ionicons name="close" size={24} color={currentTheme === "dark" ? "#fff" : "#333"} />
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.modalBody}>
        <Text style={[styles.insightFullText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
          {dailyInsight}
        </Text>
        
        <View style={styles.insightStats}>
          <View style={styles.insightStatItem}>
            <Text style={styles.insightStatValue}>{inventoryStats.totalItems}</Text>
            <Text style={[styles.insightStatLabel, currentTheme === "dark" ? styles.darkTextSecondary : styles.lightTextSecondary]}>
              Total de Produtos
            </Text>
          </View>
          <View style={styles.insightStatItem}>
            <Text style={[styles.insightStatValue, {color: "#f39c12"}]}>{inventoryStats.lowStockItems}</Text>
            <Text style={[styles.insightStatLabel, currentTheme === "dark" ? styles.darkTextSecondary : styles.lightTextSecondary]}>
              Stock Baixo
            </Text>
          </View>
          <View style={styles.insightStatItem}>
            <Text style={[styles.insightStatValue, {color: "#e74c3c"}]}>{inventoryStats.outOfStockItems}</Text>
            <Text style={[styles.insightStatLabel, currentTheme === "dark" ? styles.darkTextSecondary : styles.lightTextSecondary]}>
              Sem Stock
            </Text>
          </View>
        </View>
      </ScrollView>
      
      <TouchableOpacity
        style={styles.modalCloseButton}
        onPress={() => setShowInsightModal(false)}
      >
        <Text style={styles.modalCloseButtonText}>Fechar</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>

{/* Itens recentes */}
{!loading && inventoryStats.recentlyAdded && inventoryStats.recentlyAdded.length > 0 ? (
  <View style={styles.recentItemsContainer}>
    <View style={styles.sectionHeader}>
  <Text style={[styles.sectionTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
    Adicionados Recentemente ({inventoryStats.recentlyAdded.length})
  </Text>
  
</View>
    
    {/* Filter out duplicate items by ID before mapping */}
    {(() => {
      // Create a Set to track seen IDs
      const seenIds = new Set();
      
      // Filter out duplicates
      return inventoryStats.recentlyAdded
        .filter((item, index) => {
          // If no ID, use index as unique identifier
          if (!item.id) return true;
          
          // If we've seen this ID before, filter it out
          if (seenIds.has(item.id)) {
            console.log(`Filtering out duplicate recent item with ID: ${item.id}`);
            return false;
          }
          
          // Otherwise, add to seen IDs and keep the item
          seenIds.add(item.id);
          return true;
        })
        .map((item, index) => {
          console.log(
            `DEBUG RENDER HomeScreen: Item ${index} - Name: ${item.name}, ID: ${item.id}, Has photoUrl: ${!!item.photoUrl}, Has photo base64: ${!!item.photo}, Base64 Length: ${item.photo?.length || 0}, Category: ${item.category}`
          );

          return (
            <TouchableOpacity
              // Use a combination of ID and index for the key to ensure uniqueness
              key={`${item.id || 'no-id'}-${index}`} 
              style={[styles.recentItemCard, currentTheme === "dark" ? styles.darkCard : styles.lightCard]}
              onPress={() => {
                if (item.id) {
                  router.push({
                    pathname: "/item-details",
                    params: { id: item.id }
                  } as any);
                } else {
                  console.warn("Tentativa de navegar para detalhes de item sem ID:", item);
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
        });
    })()}
    
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
        Nenhum produto adicionado recentemente
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
        2025 © My Inventory - Todos os direitos reservados
        </Text>
      </View>
    </ScrollView>
    <AlertComponent />
    </>
  );
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
 breathingCircle: {
  width: 45, // Era 35, agora é 45
  height: 45, // Era 35, agora é 45
  borderRadius: 22.5, // Metade da largura
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  position: 'absolute',
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.3)',
},
centerGlow: {
  width: 8,
  height: 8,
  borderRadius: 4,
  backgroundColor: '#fff',
  position: 'absolute',
  shadowColor: '#fff',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.8,
  shadowRadius: 4,
  elevation: 5,
},
concentricWave: {
  position: 'absolute',
  borderRadius: 50,
  borderWidth: 1,
},
wave1Style: {
  width: 25,
  height: 25,
  borderColor: 'rgba(255, 255, 255, 0.4)',
},
wave2Style: {
  width: 30,
  height: 30,
  borderColor: 'rgba(255, 255, 255, 0.3)',
},
wave3Style: {
  width: 35,
  height: 35,
  borderColor: 'rgba(255, 255, 255, 0.2)',
},
orbitalParticle: {
  position: 'absolute',
  width: 20,
  height: 20,
  justifyContent: 'center',
  alignItems: 'flex-end',
},
particle1: {
  width: 25,
  height: 25,
},
particle2: {
  width: 30,
  height: 30,
},
particleDot: {
  width: 3,
  height: 3,
  borderRadius: 1.5,
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  shadowColor: '#fff',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.6,
  shadowRadius: 2,
},
sparkle: {
  position: 'absolute',
  width: 2,
  height: 2,
  borderRadius: 1,
  backgroundColor: '#fff',
},
sparkle1: {
  top: 15,
  right: 10,
},
sparkle2: {
  bottom: 15,
  right: 25,
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
  statisticsButton: {
  width: "100%",
  padding: 15,
  borderRadius: 15,
  flexDirection: "row",
  alignItems: "center",
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.2,
  shadowRadius: 5,
  elevation: 5,
  minHeight: 90,
  overflow: 'visible',
},
statisticsChart: {
  flex: 1,
  marginRight: 15,
},

statisticsContent: {
  flex: 2,
  flexDirection: "row",
  alignItems: "center",
  paddingLeft: 24,
},
statisticsIcon: {
  marginRight: 10,
},
statisticsTextContainer: {
  flex: 1,
},
statisticsButtonText: {
  color: "#fff",
  fontSize: 18,
  fontWeight: "bold",
},
statisticsSubtext: {
  color: "rgba(255, 255, 255, 0.8)",
  fontSize: 12,
  marginTop: 2,
},
animatedChart: {
  flex: 1,
  height: 80, // Era 60, agora é 80 para dar mais espaço
  width: 80,  // Adiciona largura fixa
  position: 'relative',
  justifyContent: 'center',
  alignItems: 'center',
  overflow: 'visible', // Era 'hidden', agora é 'visible' para mostrar as partículas
},
pulsingCircles: {
  position: 'absolute',
  width: '100%',
  height: '100%',
  justifyContent: 'center',
  alignItems: 'center',
},
pulsingCircle: {
  position: 'absolute',
  borderRadius: 50,
  backgroundColor: 'rgba(255, 255, 255, 0.3)',
},
circle1: {
  width: 20,
  height: 20,
  // Animação de pulso lento
},
circle2: {
  width: 30,
  height: 30,
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  // Animação de pulso médio
},
circle3: {
  width: 40,
  height: 40,
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  // Animação de pulso rápido
},
waveContainer: {
  position: 'absolute',
  width: '100%',
  height: '100%',
  justifyContent: 'center',
  alignItems: 'flex-end',
  flexDirection: 'row',
  paddingRight: 10,
},
wave: {
  width: 3,
  backgroundColor: 'rgba(255, 255, 255, 0.6)',
  marginHorizontal: 1,
  borderRadius: 2,
},
wave1: {
  height: 15,
  // Animação de altura variável
},
wave2: {
  height: 25,
  backgroundColor: 'rgba(255, 255, 255, 0.4)',
  // Animação de altura variável com delay
},
wave3: {
  height: 20,
  backgroundColor: 'rgba(255, 255, 255, 0.5)',
  // Animação de altura variável com delay maior
},
floatingDots: {
  position: 'absolute',
  width: '100%',
  height: '100%',
},
floatingDot: {
  position: 'absolute',
  width: 4,
  height: 4,
  borderRadius: 2,
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
},
dot1: {
  top: 10,
  right: 20,
  // Animação de movimento vertical
},
dot2: {
  top: 30,
  right: 35,
  backgroundColor: 'rgba(255, 255, 255, 0.6)',
  // Animação de movimento vertical com delay
},
dot3: {
  top: 20,
  right: 50,
  backgroundColor: 'rgba(255, 255, 255, 0.4)',
  // Animação de movimento vertical com delay maior
},
dot4: {
  top: 40,
  right: 15,
  backgroundColor: 'rgba(255, 255, 255, 0.7)',
  // Animação de movimento vertical com delay diferente
},
chartContainer: {
  flexDirection: "row",
  alignItems: "flex-end",
  justifyContent: "space-between",
  height: 50,
},
chartBars: {
  flexDirection: "row",
  alignItems: "flex-end",
  gap: 3,
  flex: 1,
},
chartBar: {
  width: 6,
  borderRadius: 3,
  minHeight: 4,
},
chartIndicators: {
  flexDirection: "column",
  justifyContent: "center",
  marginLeft: 10,
  gap: 4,
},
chartIndicator: {
  flexDirection: "row",
  alignItems: "center",
  gap: 4,
},
indicatorDot: {
  width: 6,
  height: 6,
  borderRadius: 3,
},
indicatorText: {
  color: "#fff",
  fontSize: 10,
  fontWeight: "600",
},
mainPulse: {
  width: 30,
  height: 30,
  borderRadius: 15,
  backgroundColor: 'rgba(255, 255, 255, 0.3)',
  position: 'absolute',
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
  welcomeContainer: {
  padding: 30,
  borderRadius: 20,
  alignItems: "center",
  marginBottom: 20,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 4,
},
welcomeIcon: {
  marginBottom: 20,
  opacity: 0.8,
},
welcomeTitle: {
  fontSize: 24,
  fontWeight: "bold",
  marginBottom: 15,
  textAlign: "center",
},
welcomeText: {
  fontSize: 16,
  lineHeight: 24,
  textAlign: "center",
  marginBottom: 30,
  paddingHorizontal: 10,
},
welcomeActions: {
  width: "100%",
  gap: 15,
},
welcomePrimaryButton: {
  backgroundColor: "#2ecc71",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: 15,
  paddingHorizontal: 20,
  borderRadius: 12,
  gap: 10,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 4,
  elevation: 3,
},
welcomePrimaryButtonText: {
  color: "#fff",
  fontSize: 16,
  fontWeight: "bold",
},
welcomeSecondaryButton: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: 12,
  paddingHorizontal: 20,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: "#3498db",
  gap: 8,
},
welcomeSecondaryButtonText: {
  color: "#3498db",
  fontSize: 14,
  fontWeight: "600",
},
sectionHeader: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 15,
},
shareButton: {
  padding: 8,
  borderRadius: 20,
  backgroundColor: "rgba(52, 152, 219, 0.1)",
},
refreshButton: {
  padding: 8,
  borderRadius: 20,
  backgroundColor: "rgba(52, 152, 219, 0.1)",
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
  insightHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  insightButton: {
    backgroundColor: "#00bfff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  insightButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  insightPreview: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 12,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  insightPreviewText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxHeight: "80%",
    borderRadius: 20,
    padding: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.1)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
    marginLeft: 10,
  },
  modalBody: {
    padding: 20,
    maxHeight: 400,
  },
  insightFullText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  insightStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "rgba(155, 89, 182, 0.1)",
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  insightStatItem: {
    alignItems: "center",
  },
  insightStatValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#9b59b6",
  },
  insightStatLabel: {
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  modalCloseButton: {
    backgroundColor: "#9b59b6",
    margin: 20,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  modalCloseButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
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
