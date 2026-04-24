import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getSupplements } from '../services/supplements/supplement-service'
import { Supplement } from '../types/supplements/supplement'

export default function SupplementsScreen() {
  const router = useRouter()
  const [supplements, setSupplements] = useState<Supplement[]>([])
  const [loading, setLoading] = useState(true)

  const loadSupplements = async () => {
    try {
      setLoading(true)
      const data = await getSupplements()
      setSupplements(data)
    } catch (error) {
      console.error('Erro ao carregar suplementos:', error)
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadSupplements()
    }, [])
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>VitaStreak</Text>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/add-supplement')}
        >
          <Ionicons name="add" size={26} color="white" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#22c55e" size="large" />
      ) : supplements.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Sem suplementos ainda</Text>
          <Text style={styles.emptyText}>
            Adiciona a tua primeira vitamina por foto ou manualmente.
          </Text>
        </View>
      ) : (
        <FlatList
          data={supplements}
          keyExtractor={(item) => item.id ?? item.name}
          contentContainerStyle={{ paddingBottom: 30 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {item.photo_url ? (
                <Image source={{ uri: item.photo_url }} style={styles.image} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="nutrition-outline" size={28} color="#94a3b8" />
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                {!!item.brand && <Text style={styles.brand}>{item.brand}</Text>}
                <Text style={styles.meta}>
                  {item.dosage_amount ?? ''} {item.dosage_unit ?? ''}
                  {item.reminder_time ? ` • ${item.reminder_time}` : ''}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    color: 'white',
    fontSize: 30,
    fontWeight: '800',
  },
  addButton: {
    backgroundColor: '#22c55e',
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    marginTop: 80,
    alignItems: 'center',
  },
  emptyTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    gap: 14,
  },
  image: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#334155',
  },
  imagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
  },
  brand: {
    color: '#cbd5e1',
    marginTop: 2,
  },
  meta: {
    color: '#94a3b8',
    marginTop: 4,
  },
})