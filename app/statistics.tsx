import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from './theme-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { VictoryPie } from 'victory-native';
import { useAuth } from '../auth-context';
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { GoogleGenerativeAI } from "@google/generative-ai";
// Firebase imports
import { 
  collection, 
  query, 
  where, 
  getDocs,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase-config';
import { CategoryIconService } from '../services/category-icon-service';

interface InventoryItem {
  id?: string;
  category: string;
  name: string;
  quantity: number;
  userId?: string;
}

interface CategoryStat {
  category: string;
  count: number;
  percentage: number;
}

interface AIInsight {
  title: string;
  description: string;
  type: 'info' | 'warning' | 'suggestion';
}

const genAI = new GoogleGenerativeAI("AIzaSyDuUDSAfqwznlx9XMw-Xea4f0bU-sfe_4k");

export default function StatisticsScreen() {
  const [totalItems, setTotalItems] = useState(0);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [topItems, setTopItems] = useState<InventoryItem[]>([]);
  const [leastUsedItems, setLeastUsedItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryIcons, setCategoryIcons] = useState<Record<string, string>>({});
  const { currentTheme } = useTheme();
  const router = useRouter();
  const { currentUser } = useAuth();
  const [categoryColorMap, setCategoryColorMap] = useState<Record<string, string>>({});
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);

const generateAIInsights = async () => {
  if (categoryStats.length === 0 || totalItems === 0) return;
  
  setLoadingInsights(true);
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const inventoryData = {
      totalItems,
      categories: categoryStats,
      topItems: topItems.slice(0, 3),
      leastUsedItems: leastUsedItems.slice(0, 3)
    };
    
    const prompt = `
      Analise estes dados de inventário e forneça exatamente 4 insights úteis em português de Portugal, tenta usar a palavra produto invés de item:
      
      Dados: ${JSON.stringify(inventoryData)}
      
      Para cada insight, forneça:
      1. Um título curto (máximo 6 palavras)
      2. Uma descrição útil (máximo 2 frases)
      3. Tipo: "info", "warning" ou "suggestion"
      
      Foque em:
      - Padrões interessantes nas categorias
      - Produtos com stock muito alto ou baixo
      - Sugestões de organização
      - Observações sobre diversidade do inventário
      
      Formato da resposta:
      INSIGHT 1:
      Título: [título]
      Descrição: [descrição]
      Tipo: [tipo]
      
      INSIGHT 2:
      Título: [título]
      Descrição: [descrição]
      Tipo: [tipo]
      
      (continue para 4 insights)
    `;
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Processar a resposta da IA
    const insights = parseAIInsights(responseText);
    setAiInsights(insights);
    
  } catch (error) {
    console.error('Erro ao gerar insights:', error);
    // Fallback com insights básicos
    setAiInsights(generateFallbackInsights());
  } finally {
    setLoadingInsights(false);
  }
};

// Função para processar a resposta da IA
const parseAIInsights = (responseText: string): AIInsight[] => {
  const insights: AIInsight[] = [];
  const insightBlocks = responseText.split(/INSIGHT \d+:/);
  
  insightBlocks.slice(1).forEach(block => {
    const titleMatch = block.match(/Título:\s*(.+)/);
    const descriptionMatch = block.match(/Descrição:\s*(.+?)(?=\nTipo:|$)/s);
    const typeMatch = block.match(/Tipo:\s*(info|warning|suggestion)/);
    
    if (titleMatch && descriptionMatch && typeMatch) {
      insights.push({
        title: titleMatch[1].trim(),
        description: descriptionMatch[1].trim().replace(/\n/g, ' '),
        type: typeMatch[1] as 'info' | 'warning' | 'suggestion'
      });
    }
  });
  
  return insights.slice(0, 4); // Máximo 4 insights
};

// Insights de fallback caso a IA falhe
const generateFallbackInsights = (): AIInsight[] => {
  const insights: AIInsight[] = [];
  
  if (categoryStats.length > 0) {
    const topCategory = categoryStats[0];
    insights.push({
      title: "Categoria Dominante",
      description: `${topCategory.category} representa ${topCategory.percentage.toFixed(1)}% do seu inventário.`,
      type: 'info'
    });
  }
  
  if (leastUsedItems.length > 0 && leastUsedItems[0].quantity === 0) {
    insights.push({
      title: "Produtos Esgotados",
      description: "Tem produtos sem stock. Considere reabastecer ou remover os que não são utilizados.",
      type: 'warning'
    });
  }
  
  if (categoryStats.length >= 5) {
    insights.push({
      title: "Inventário Diversificado",
      description: "Tem uma boa diversidade de categorias no seu inventário.",
      type: 'info'
    });
  }
  
  insights.push({
    title: "Organização Sugerida",
    description: "Considere agrupar produtos similares para facilitar a gestão.",
    type: 'suggestion'
  });
  
  return insights;
};

// Chamar a função quando os dados carregarem
useEffect(() => {
  if (categoryStats.length > 0 && !loading) {
    generateAIInsights();
  }
}, [categoryStats, loading]);

const getCategoryColorMap = (categories: string[]) => {
  const colorMap: Record<string, string> = {};
  categories.forEach((category, index) => {
    colorMap[category] = getUniqueColor(index);
  });
  return colorMap;
};

  useEffect(() => {
    if (currentUser) {
      loadStats();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

const loadStats = async () => {
  if (!currentUser) {
    console.log("Utilizador não autenticado");
    return;
  }
  setLoading(true);
  try {
    // Procurar itens do inventário do utilizador atual
    const inventoryRef = collection(db, 'inventory');
    const q = query(
      inventoryRef,
      where('userId', '==', currentUser.uid),
      orderBy('name')
    );
    
    const querySnapshot = await getDocs(q);
    const rawInventory: InventoryItem[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      rawInventory.push({
        id: doc.id,
        category: data.category || 'Sem Categoria',
        name: data.name,
        quantity: parseInt(data.quantity.toString()) || 0
      });
    });
    
    // Combinar itens com o mesmo nome e categoria
    const combinedInventoryMap: Record<string, InventoryItem> = {};
    
    rawInventory.forEach(item => {
      // Criar uma chave única baseada no nome e categoria
      const key = `${item.name.toLowerCase()}-${item.category.toLowerCase()}`;
      
      if (combinedInventoryMap[key]) {
        // Se já existe um item com este nome e categoria, somar as quantidades
        combinedInventoryMap[key].quantity += item.quantity;
      } else {
        // Caso contrário, adicionar o item ao mapa
        combinedInventoryMap[key] = { ...item };
      }
    });
    
    // Converter o mapa de volta para um array
    const inventory = Object.values(combinedInventoryMap);

    const totalQuantity = inventory.reduce((sum: number, item: InventoryItem) =>
      sum + (parseInt(item.quantity.toString()) || 0), 0
    );
    setTotalItems(totalQuantity);

    const categoryCount = inventory.reduce((acc: Record<string, number>, item: InventoryItem) => {
      const itemQuantity = parseInt(item.quantity.toString()) || 0;
      const category = item.category || 'Sem Categoria';

      if (!acc[category]) {
        acc[category] = 0;
      }
      acc[category] += itemQuantity;
      return acc;
    }, {});

    const currentStats = Object.entries(categoryCount)
      .map(([category, count]) => ({
        category,
        count: count as number,
        percentage: totalQuantity > 0 ? ((count as number) / totalQuantity) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count); // Ordena por contagem descendente

    setCategoryStats(currentStats);

    // Lógica para cores consistentes e corretas
    setCategoryColorMap(prevMap => {
      const newMap = { ...prevMap };
      // Começa a contar as cores já atribuídas para saber qual o próximo índice de cor a usar
      let assignedColorsCount = Object.keys(newMap).length;

      currentStats.forEach(stat => {
        // Se a categoria ainda não tem uma cor atribuída no nosso mapa persistente
        if (!newMap[stat.category]) { 
          newMap[stat.category] = getUniqueColor(assignedColorsCount); // Usa a tua função getUniqueColor
          assignedColorsCount++; // Incrementa para a próxima nova categoria
        }
      });
      return newMap;
    });

    // A lista de ícones deve usar as categorias de currentStats
    await loadCategoryIcons(currentStats.map(s => s.category));

    const sortedItems = [...inventory].sort((a, b) =>
      (parseInt(b.quantity.toString()) || 0) - (parseInt(a.quantity.toString()) || 0)
    );

    const sortedItemsLeast = [...inventory].sort((a, b) =>
      (parseInt(a.quantity.toString()) || 0) - (parseInt(b.quantity.toString()) || 0)
    );

    setTopItems(sortedItems.slice(0, 5));
    setLeastUsedItems(sortedItemsLeast.slice(0, 5));

  } catch (error) {
    console.error('Erro ao carregar estatísticas:', error);
  } finally {
    setLoading(false);
  }
};

const loadCategoryIcons = async (categories: string[]) => {
    const icons: Record<string, string> = {};
    
    for (const category of categories) {
      if (category) {
        const iconName = await CategoryIconService.getIconForCategory(category);
        icons[category] = iconName;
      }
    }
    
    setCategoryIcons(icons);
  };
  
  const getUniqueColor = (index: number) => {
    const allColors = [
'#FF0000', // Red
'#0000FF', // Blue
'#FFFF00', // Yellow
'#00FF00', // Green
'#FFA500', // Orange
'#800080', // Purple
'#FFC0CB', // Pink
'#A52A2A', // Brown
'#000000', // Black
'#FFFFFF', // White
'#808080', // Gray
'#00FFFF', // Cyan
'#FF00FF', // Magenta
'#C0C0C0', // Silver
'#008000', // Dark Green
'#800000', // Maroon
'#000080', // Navy
'#808000', // Olive
'#008080', // Teal
'#FF9F40', // Light Orange
'#2ECC71', // Emerald
'#E74C3C', // Alizarin
'#3498DB', // Peter River
'#F1C40F', // Sunflower
'#8E44AD', // Wisteria
'#16A085', // Green Sea
'#D35400', // Pumpkin
'#7F8C8D', // Asbestos
'#2C3E50', // Midnight Blue
'#E67E22', // Carrot
'#27AE60', // Nephritis
'#9B59B6', // Amethyst
'#2980B9', // Belize Hole
'#F39C12', // Orange
'#FF6384', // Raspberry
'#36A2EB', // Blue
'#FFCE56', // Yellow
'#4BC0C0', // Teal
'#9966FF', // Purple
'#C0392B', // Pomegranate
'#1ABC9C', // Turquoise
'#34495E', // Wet Asphalt
'#95A5A6', // Concrete
'#D35400', // Pumpkin
'#76448A', // Purple
'#5D6D7E', // Slate Gray
'#AF7AC5', // Medium Purple
'#48C9B0', // Medium Turquoise
'#52BE80', // Sea Green
'#FF5733', // Coral Red
'#DAF7A6', // Light Green
'#FFC300', // Vivid Yellow
'#581845', // Dark Purple
'#C70039', // Crimson
'#900C3F', // Burgundy
'#FFC0CB', // Pink
'#FF69B4', // Hot Pink
'#CD5C5C', // Indian Red
'#F08080', // Light Coral
'#E6E6FA', // Lavender
'#87CEFA', // Light Sky Blue
'#40E0D0', // Turquoise
'#7FFFD4', // Aquamarine
'#00FA9A', // Medium Spring Green
'#ADFF2F', // Green Yellow
'#32CD32', // Lime Green
'#FFD700', // Gold
'#FF8C00', // Dark Orange
'#FF4500', // Orange Red
'#DB7093', // Pale Violet Red
'#BC8F8F', // Rosy Brown
'#4682B4', // Steel Blue
'#6A5ACD', // Slate Blue
'#7B68EE', // Medium Slate Blue
'#9370DB', // Medium Purple
'#8A2BE2', // Blue Violet
'#4B0082', // Indigo
'#483D8B', // Dark Slate Blue
'#191970', // Midnight Blue
'#00CED1', // Dark Turquoise
'#20B2AA', // Light Sea Green
'#66CDAA', // Medium Aquamarine
'#3CB371', // Medium Sea Green
'#2E8B57', // Sea Green
'#228B22', // Forest Green
'#556B2F', // Dark Olive Green
'#BDB76B', // Dark Khaki
'#F0E68C', // Khaki
'#FFDAB9', // Peach Puff
'#DEB887', // Burlywood
'#D2B48C', // Tan
'#8B4513', // Saddle Brown
'#A0522D', // Sienna
'#CD853F', // Peru
'#DAA520', // Goldenrod
'#B8860B', // Dark Goldenrod
'#D2691E', // Chocolate
'#DC143C', // Crimson
'#B22222', // Firebrick
'#8B0000', // Dark Red
'#FA8072', // Salmon
'#FF7F50', // Coral
'#FF6347', // Tomato
'#FF1493', // Deep Pink
'#C71585', // Medium Violet Red
'#DB7093', // Pale Violet Red
'#FF00FF', // Fuchsia
'#EE82EE', // Violet
'#DDA0DD', // Plum
'#DA70D6', // Orchid
'#BA55D3', // Medium Orchid
'#9932CC', // Dark Orchid
'#8B008B', // Dark Magenta
'#9400D3', // Dark Violet
'#6B8E23', // Olive Drab
'#7CFC00', // Lawn Green
'#7FFF00', // Chartreuse
'#00FF7F', // Spring Green
'#00FA9A', // Medium Spring Green
'#90EE90', // Light Green
'#98FB98', // Pale Green
'#8FBC8F', // Dark Sea Green
'#00BFFF', // Deep Sky Blue
'#1E90FF', // Dodger Blue
'#6495ED', // Cornflower Blue
'#4169E1', // Royal Blue
'#0000CD', // Medium Blue
'#00008B', // Dark Blue
'#5F9EA0', // Cadet Blue
'#B0C4DE', // Light Steel Blue
'#ADD8E6', // Light Blue
'#B0E0E6', // Powder Blue
'#AFEEEE', // Pale Turquoise
'#E0FFFF', // Light Cyan
'#F0FFFF', // Azure
'#F5FFFA', // Mint Cream
'#F0FFF0', // Honeydew
'#FAFAD2', // Light Goldenrod Yellow
'#FFFACD', // Lemon Chiffon
'#FFF8DC', // Cornsilk
'#FFEBCD', // Blanched Almond
'#FFE4C4', // Bisque
'#FFDEAD', // Navajo White
'#F5DEB3', // Wheat
'#FFE4B5', // Moccasin
'#FFEFD5', // Papaya Whip
'#FAF0E6', // Linen
'#FDF5E6', // Old Lace
'#FAEBD7', // Antique White
'#FFE4E1', // Misty Rose
'#FFF0F5', // Lavender Blush
'#F5F5F5', // White Smoke
'#F8F8FF', // Ghost White
'#F0F8FF', // Alice Blue
'#708090', // Slate Gray
'#778899', // Light Slate Gray
'#696969', // Dim Gray
'#A9A9A9', // Dark Gray
'#D3D3D3', // Light Gray
'#DCDCDC', // Gainsboro
'#F5F5F5'  // White Smoke
    ];
    return allColors[index % allColors.length];
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, currentTheme === 'dark' ? styles.dark : styles.light]}>
        <ActivityIndicator size="large" color={currentTheme === 'dark' ? '#fff' : '#333'} />
        <Text style={[styles.loadingText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
          A carregar estatísticas...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, currentTheme === 'dark' ? styles.dark : styles.light]}>
      <View style={styles.header}>
        <Text style={[styles.title, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
          Os Meus Dados
        </Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadStats}
        >
          <MaterialIcons name="refresh" size={24} color={currentTheme === 'dark' ? '#fff' : '#333'} />
        </TouchableOpacity>
      </View>

      <View style={[styles.statsCard, currentTheme === 'dark' ? styles.darkCard : styles.lightCard]}>
        <MaterialIcons name="inventory" size={24} color={currentTheme === 'dark' ? '#fff' : '#333'} />
        <Text style={[styles.statText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
          Total de Produtos: {totalItems}
        </Text>
      </View>

      {categoryStats.length > 0 ? (
        <View style={[styles.chartContainer, currentTheme === 'dark' ? styles.darkCard : styles.lightCard]}>
          <Text style={[styles.subtitle, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
            Distribuição Visual
          </Text>
          <VictoryPie
            data={categoryStats}
            x="category"
            y="count"
            width={300}
            height={300}
            padding={60}
            radius={120}
            colorScale={categoryStats.map(stat => categoryColorMap[stat.category] || getUniqueColor(0))} 
            style={{
              labels: {
                fill: 'white',
                fontSize: 14,
                padding: 10,
              },
            }}
            labels={() => ""}
          />

          <View style={styles.legendContainer}>
            {categoryStats.map((stat, index) => (
              <View key={index} style={styles.legendItem}>
                <View style={[styles.colorBox, { backgroundColor: categoryColorMap[stat.category] }]} />
                <Text style={[styles.legendText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
                  {stat.category} ({stat.count})
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={[styles.emptyCard, currentTheme === 'dark' ? styles.darkCard : styles.lightCard]}>
          <MaterialIcons name="pie-chart" size={48} color={currentTheme === 'dark' ? '#555' : '#ccc'} />
          <Text style={[styles.emptyText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
            Sem dados suficientes para mostrar o gráfico
          </Text>
        </View>
      )}

<View style={[styles.insightsContainer, currentTheme === 'dark' ? styles.darkCard : styles.lightCard]}>
        <View style={styles.subtitleContainer}>
          <MaterialCommunityIcons
            name="brain"
            size={24}
            color={currentTheme === 'dark' ? '#fff' : '#333'}
          />
          <Text style={[styles.subtitle, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
            Insights da IA
          </Text>
          <TouchableOpacity
            style={styles.refreshInsightsButton}
            onPress={generateAIInsights}
            disabled={loadingInsights}
          >
            {loadingInsights ? (
              <ActivityIndicator size="small" color="#3498db" />
            ) : (
              <MaterialIcons name="refresh" size={20} color="#3498db" />
            )}
          </TouchableOpacity>
        </View>
        
        {aiInsights.length > 0 ? (
          aiInsights.map((insight, index) => (
            <View key={index} style={[
              styles.insightCard,
              currentTheme === 'dark' ? styles.darkInsightCard : styles.lightInsightCard
            ]}>
              <View style={styles.insightHeader}>
                <MaterialCommunityIcons
                  name={
                    insight.type === 'warning' ? 'alert-circle' :
                    insight.type === 'suggestion' ? 'lightbulb' : 'information'
                  }
                  size={20}
                  color={
                    insight.type === 'warning' ? '#f39c12' :
                    insight.type === 'suggestion' ? '#3498db' : '#27ae60'
                  }
                />
                <Text style={[
                  styles.insightTitle,
                  currentTheme === 'dark' ? styles.darkText : styles.lightText
                ]}>
                  {insight.title}
                </Text>
              </View>
              <Text style={[
                styles.insightDescription,
                currentTheme === 'dark' ? styles.darkSecondaryText : styles.lightSecondaryText
              ]}>
                {insight.description}
              </Text>
            </View>
          ))
        ) : (
          !loadingInsights && (
            <Text style={[
              styles.noInsightsText,
              currentTheme === 'dark' ? styles.darkSecondaryText : styles.lightSecondaryText
            ]}>
              Adicione mais produtos para obter insights personalizados.
            </Text>
          )
        )}
      </View>

{topItems.length > 0 && (
  <View style={[styles.topCategories, currentTheme === 'dark' ? styles.darkCard : styles.lightCard]}>
    <View style={styles.subtitleContainer}>
      <MaterialCommunityIcons 
        name="trending-up" 
        size={24} 
        color={currentTheme === 'dark' ? '#fff' : '#333'} 
      />
      <Text style={[styles.subtitle, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
        Top 5 Produtos com Maior Stock
      </Text>
    </View>
    {topItems.map((item, index) => (
      <View key={index} style={styles.categoryRow}>
        <Text style={[styles.rankingNumber, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
          {index + 1}.
        </Text>
        <MaterialCommunityIcons
          name={(categoryIcons[item.category] || CategoryIconService.DEFAULT_ICON) as keyof typeof MaterialCommunityIcons.glyphMap}
          size={20}
          color={categoryColorMap[item.category] || getUniqueColor(index)}
        />
        <Text style={[styles.categoryText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
          {item.name}: {item.quantity} unidade(s)
        </Text>
      </View>
    ))}
  </View>
)}

{leastUsedItems.length > 0 && (
  <View style={[styles.topCategories, currentTheme === 'dark' ? styles.darkCard : styles.lightCard]}>
    <View style={styles.subtitleContainer}>
      <MaterialCommunityIcons 
        name="trending-down" 
        size={24} 
        color={currentTheme === 'dark' ? '#fff' : '#333'} 
      />
      <Text style={[styles.subtitle, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
        Top 5 Produtos com Menor Stock
      </Text>
    </View>
    {leastUsedItems.map((item, index) => (
      <View key={index} style={styles.categoryRow}>
        <Text style={[styles.rankingNumber, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
          {index + 1}.
        </Text>
        <MaterialCommunityIcons
          name={(categoryIcons[item.category] || CategoryIconService.DEFAULT_ICON) as keyof typeof MaterialCommunityIcons.glyphMap}
          size={20}
          color={categoryColorMap[item.category] || getUniqueColor(index)}
        />
        <Text style={[styles.categoryText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
          {item.name}: {item.quantity} unidade(s)
        </Text>
      </View>
    ))}
  </View>
)}

{categoryStats.length > 0 && (
  <View style={[styles.topCategories, currentTheme === 'dark' ? styles.darkCard : styles.lightCard]}>
    <View style={styles.subtitleContainer}>
      <MaterialCommunityIcons 
        name="trophy" 
        size={24} 
        color={currentTheme === 'dark' ? '#fff' : '#333'} 
      />
      <Text style={[styles.subtitle, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
        Top 5 Categorias Mais Usadas
      </Text>
    </View>
    {categoryStats
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((stat, index) => (
        <View key={index} style={styles.categoryRow}>
          <Text style={[styles.rankingNumber, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
            {index + 1}.
          </Text>
          <MaterialCommunityIcons
            name={(categoryIcons[stat.category] || CategoryIconService.DEFAULT_ICON) as keyof typeof MaterialCommunityIcons.glyphMap}
            size={20}
            color={categoryColorMap[stat.category] || getUniqueColor(index)}
          />
          <Text style={[styles.categoryText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
            {stat.category}: {stat.count} produto(s)
          </Text>
        </View>
      ))}
  </View>
)}

{categoryStats.length > 0 && (
  <View style={[styles.topCategories, currentTheme === 'dark' ? styles.darkCard : styles.lightCard]}>
    <View style={styles.subtitleContainer}>
      <MaterialCommunityIcons 
        name="arrow-down-bold-circle" 
        size={24} 
        color={currentTheme === 'dark' ? '#fff' : '#333'} 
      />
      <Text style={[styles.subtitle, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
        Top 5 Categorias Menos Usadas
      </Text>
    </View>
    {categoryStats
      .sort((a, b) => a.count - b.count)
      .slice(0, 5)
      .map((stat, index) => (
        <View key={index} style={styles.categoryRow}>
          <Text style={[styles.rankingNumber, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
            {index + 1}.
          </Text>
          <MaterialCommunityIcons
            name={(categoryIcons[stat.category] || CategoryIconService.DEFAULT_ICON) as keyof typeof MaterialCommunityIcons.glyphMap}
            size={20}
            color={categoryColorMap[stat.category] || getUniqueColor(index)}
          />
          <Text style={[styles.categoryText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
            {stat.category}: {stat.count} produto(s)
          </Text>
        </View>
      ))}
  </View>
)}
</ScrollView>
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
  refreshButton: {
    padding: 8,
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
  darkCard: {
    backgroundColor: '#333',
  },
  lightCard: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 10,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 3,
  },
  statText: {
    fontSize: 16,
    marginLeft: 10,
  },
   subtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    gap: 8,
  },
  chartContainer: {
    alignItems: 'center',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    elevation: 3,
    width: '100%',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 8,
  },
  colorBox: {
    width: 16,
    height: 16,
    marginRight: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 14,
    fontWeight: '500',
  },
  topCategories: {
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    elevation: 3,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  categoryText: {
    fontSize: 16,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  insightsContainer: {
  borderRadius: 10,
  padding: 15,
  marginBottom: 20,
  elevation: 3,
},
refreshInsightsButton: {
  marginLeft: 'auto',
  padding: 4,
},
insightCard: {
  padding: 12,
  borderRadius: 8,
  marginBottom: 10,
  borderLeftWidth: 3,
  borderLeftColor: '#3498db',
},
darkInsightCard: {
  backgroundColor: '#2a2a2a',
},
lightInsightCard: {
  backgroundColor: '#f8f9fa',
},
insightHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 6,
},
insightTitle: {
  fontSize: 16,
  fontWeight: '600',
  marginLeft: 8,
},
insightDescription: {
  fontSize: 14,
  lineHeight: 20,
  marginLeft: 28,
},
noInsightsText: {
  textAlign: 'center',
  fontStyle: 'italic',
  padding: 20,
},
darkSecondaryText: {
  color: '#bbb',
},
lightSecondaryText: {
  color: '#666',
},
  emptyCard: {
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    elevation: 3,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    textAlign: 'center',
  },
  
  rankingNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    width: 25,
  }
});
