import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from './theme-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { VictoryPie } from 'victory-native';
import { useAuth } from '../auth-context';

// Firebase imports
import { 
  collection, 
  query, 
  where, 
  getDocs,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase-config';

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

export default function StatisticsScreen() {
  const [totalItems, setTotalItems] = useState(0);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [topItems, setTopItems] = useState<InventoryItem[]>([]);
  const [leastUsedItems, setLeastUsedItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentTheme } = useTheme();
  const router = useRouter();
  const { currentUser } = useAuth();

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
      const inventory: InventoryItem[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        inventory.push({
          id: doc.id,
          category: data.category || 'Sem Categoria',
          name: data.name,
          quantity: parseInt(data.quantity.toString()) || 0
        });
      });
      
      // Calcular total de itens corretamente
      const totalQuantity = inventory.reduce((sum: number, item: InventoryItem) =>
        sum + (parseInt(item.quantity.toString()) || 0), 0
      );
      setTotalItems(totalQuantity);

      // Calcular estatísticas de categoria com contagens corretas
      const categoryCount = inventory.reduce((acc: Record<string, number>, item: InventoryItem) => {
        const itemQuantity = parseInt(item.quantity.toString()) || 0;
        const category = item.category || 'Sem Categoria';
        
        if (!acc[category]) {
          acc[category] = 0;
        }
        acc[category] += itemQuantity;
        return acc;
      }, {});

      // Converter para formato de array para VictoryPie
      const stats = Object.entries(categoryCount)
        .map(([category, count]) => ({
          category,
          count: count as number,
          percentage: totalQuantity > 0 ? ((count as number) / totalQuantity) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count);

      setCategoryStats(stats);

      // Ordenar itens por quantidade
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
          Carregando estatísticas...
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
            sortKey="count"
            sortOrder="descending"
            colorScale={categoryStats
              .sort((a, b) => b.count - a.count)
              .map((_, index) => getUniqueColor(index))
            }
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
                <View style={[styles.colorBox, { backgroundColor: getUniqueColor(index) }]} />
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

      {topItems.length > 0 && (
        <View style={[styles.topCategories, currentTheme === 'dark' ? styles.darkCard : styles.lightCard]}>
          <Text style={[styles.subtitle, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
            Top 5 Produtos com Maior Quantidade
          </Text>
          {topItems.map((item, index) => (
            <View key={index} style={styles.categoryRow}>
              <Text style={[styles.rankingNumber, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
                {index + 1}.
              </Text>
              <MaterialIcons
                name="inventory"
                size={20}
                color={getUniqueColor(categoryStats.findIndex(stat => stat.category === item.category) >= 0 
                  ? categoryStats.findIndex(stat => stat.category === item.category) 
                  : index)}
              />
              <Text style={[styles.categoryText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
                {item.name}: {item.quantity} unidades
              </Text>
            </View>
          ))}
        </View>
      )}

      {leastUsedItems.length > 0 && (
        <View style={[styles.topCategories, currentTheme === 'dark' ? styles.darkCard : styles.lightCard]}>
          <Text style={[styles.subtitle, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
            Top 5 Produtos com Menor Quantidade
          </Text>
          {leastUsedItems.map((item, index) => (
            <View key={index} style={styles.categoryRow}>
              <Text style={[styles.rankingNumber, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
                {index + 1}.
              </Text>
              <MaterialIcons
                name="trending-down"
                size={20}
                color={getUniqueColor(categoryStats.findIndex(stat => stat.category === item.category) >= 0 
                  ? categoryStats.findIndex(stat => stat.category === item.category) 
                  : index)}
              />
              <Text style={[styles.categoryText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
                {item.name}: {item.quantity} unidades
              </Text>
            </View>
          ))}
        </View>
      )}

      {categoryStats.length > 0 && (
        <View style={[styles.topCategories, currentTheme === 'dark' ? styles.darkCard : styles.lightCard]}>
          <Text style={[styles.subtitle, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
            Top 5 Categorias Mais Usadas
          </Text>
          {categoryStats
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map((stat, index) => (
              <View key={index} style={styles.categoryRow}>
                <Text style={[styles.rankingNumber, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
                  {index + 1}.
                </Text>
                <MaterialIcons
                  name="star"
                  size={20}
                  color={getUniqueColor(index)}
                />
                <Text style={[styles.categoryText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
                  {stat.category}: {stat.count} itens
                </Text>
              </View>
            ))}
        </View>
      )}

      {categoryStats.length > 0 && (
        <View style={[styles.topCategories, currentTheme === 'dark' ? styles.darkCard : styles.lightCard]}>
          <Text style={[styles.subtitle, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
            Top 5 Categorias Menos Usadas
          </Text>
          {categoryStats
            .sort((a, b) => a.count - b.count)
            .slice(0, 5)
            .map((stat, index) => (
              <View key={index} style={styles.categoryRow}>
                <Text style={[styles.rankingNumber, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
                  {index + 1}.
                </Text>
                <MaterialIcons
                  name="trending-down"
                  size={20}
                  color={getUniqueColor(index)}
                />
                <Text style={[styles.categoryText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
                  {stat.category}: {stat.count} itens
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
