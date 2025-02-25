import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from './theme-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { VictoryPie } from 'victory-native';

interface InventoryItem {
  category: string;
  name: string;
  quantity: number;
}

interface CategoryStat {
  category: string;
  count: number;
}

export default function StatisticsScreen() {
  const [totalItems, setTotalItems] = useState(0);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [topItems, setTopItems] = useState<InventoryItem[]>([]);
  const [leastUsedItems, setLeastUsedItems] = useState<InventoryItem[]>([]);
  const { currentTheme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await AsyncStorage.getItem('inventory');
      const inventory = JSON.parse(data || '[]');
      
      // Calculate total items correctly
      const totalQuantity = inventory.reduce((sum: number, item: InventoryItem) => 
        sum + (parseInt(item.quantity.toString()) || 0), 0
      );
      setTotalItems(totalQuantity);
  
      // Calculate category statistics with correct counts
      const categoryCount = inventory.reduce((acc: Record<string, number>, item: InventoryItem) => {
        const itemQuantity = parseInt(item.quantity.toString()) || 0;
        if (!acc[item.category]) {
          acc[item.category] = 0;
        }
        acc[item.category] += itemQuantity;
        return acc;
      }, {});
  
      // Convert to array format for VictoryPie
      const stats = Object.entries(categoryCount)
        .map(([category, count]) => ({
          category,
          count: count as number,
          percentage: ((count as number) / totalQuantity) * 100
        }))
        .sort((a, b) => b.count - a.count);
  
      setCategoryStats(stats);

      const sortedItems = [...inventory].sort((a, b) => b.quantity - a.quantity);
      const sortedItemsLeast = [...inventory].sort((a, b) => a.quantity - b.quantity);
      setTopItems(sortedItems.slice(0, 5));
      setLeastUsedItems(sortedItemsLeast.slice(0, 5));
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const getUniqueColor = (index: number) => {
    const allColors = [
      '#FF9F40', '#2ECC71', '#E74C3C', '#3498DB', '#F1C40F',
      '#8E44AD', '#16A085', '#D35400', '#7F8C8D', '#2C3E50',
      '#E67E22', '#27AE60', '#9B59B6', '#2980B9', '#F39C12',
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
      '#C0392B', '#1ABC9C', '#34495E', '#95A5A6', '#D35400',
      '#76448A', '#5D6D7E', '#AF7AC5', '#48C9B0', '#52BE80'
    ];
    return allColors[index % allColors.length];
  };

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
          Total de Itens: {totalItems}
        </Text>
      </View>

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

      <View style={[styles.topCategories, currentTheme === 'dark' ? styles.darkCard : styles.lightCard]}>
        <Text style={[styles.subtitle, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
          Top 5 Itens com Maior Quantidade
        </Text>
        {topItems.map((item, index) => (
          <View key={index} style={styles.categoryRow}>
            <Text style={[styles.rankingNumber, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
              {index + 1}.
            </Text>
            <MaterialIcons
              name="inventory"
              size={20}
              color={getUniqueColor(categoryStats.findIndex(stat => stat.category === item.category))}
            />
            <Text style={[styles.categoryText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
              {item.name}: {item.quantity} unidades
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.topCategories, currentTheme === 'dark' ? styles.darkCard : styles.lightCard]}>
        <Text style={[styles.subtitle, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
          Top 5 Itens com Menor Quantidade
        </Text>
        {leastUsedItems.map((item, index) => (
          <View key={index} style={styles.categoryRow}>
            <Text style={[styles.rankingNumber, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
              {index + 1}.
            </Text>
            <MaterialIcons
              name="trending-down"
              size={20}
              color={getUniqueColor(categoryStats.findIndex(stat => stat.category === item.category))}
            />
            <Text style={[styles.categoryText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
              {item.name}: {item.quantity} unidades
            </Text>
          </View>
        ))}
      </View>

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
  rankingNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    width: 25,
  }
});
