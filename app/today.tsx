import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  StatusBar,
} from 'react-native'
import { Stack, useFocusEffect, useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'

import {
  getTodaySupplements,
  markSupplementTaken,
  TodaySupplement,
  unmarkSupplementTaken,
} from '../services/supplements/supplement-service'
import useCustomAlert from '../hooks/useCustomAlert'

export default function TodayScreen() {
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()

  const [items, setItems] = useState<TodaySupplement[]>([])
  const [loading, setLoading] = useState(true)

  const loadToday = async () => {
    try {
      setLoading(true)
      const data = await getTodaySupplements()
      setItems(data)
    } catch (error) {
      console.error('Erro ao carregar Hoje:', error)
      showAlert('Erro', 'Não foi possível carregar os suplementos de hoje.', [
        { text: 'OK', onPress: () => {} },
      ])
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadToday()
    }, [])
  )

  const completed = items.filter((item) => item.taken_today).length
  const total = items.length
  const progress = total > 0 ? (completed / total) * 100 : 0

  const toggleTaken = async (item: TodaySupplement) => {
    if (!item.id) return

    const previous = items

    setItems((current) =>
  current.map((supplement) =>
    supplement.take_id === item.take_id
      ? { ...supplement, taken_today: !supplement.taken_today }
      : supplement
  )
)

    try {
      if (item.taken_today) {
        await unmarkSupplementTaken(item.id, item.reminder_time)
      } else {
        await markSupplementTaken(item.id, item.reminder_time)
      }
    } catch (error) {
      console.error('Erro ao atualizar toma:', error)
      setItems(previous)

      showAlert('Erro', 'Não foi possível atualizar esta toma.', [
        { text: 'OK', onPress: () => {} },
      ])
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      <LinearGradient
        colors={['#0f172a', '#1e1b4b', '#312e81', '#155e75']}
        style={styles.gradient}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={22} color="white" />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Hoje</Text>
              <Text style={styles.subtitle}>
                {loading
                  ? 'A carregar rotina...'
                  : total === 0
                    ? 'Nada agendado para hoje'
                    : `${completed}/${total} tomas feitas`}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.inventoryButton}
              onPress={() => router.push('/supplements' as any)}
            >
              <Ionicons name="albums-outline" size={24} color="white" />
            </TouchableOpacity>
          </View>

          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>
                {total === 0
                  ? 'Sem tomas'
                  : completed === total
                    ? 'Rotina completa'
                    : 'Progresso de hoje'}
              </Text>

              <Text style={styles.progressValue}>
                {total > 0 ? `${Math.round(progress)}%` : '0%'}
              </Text>
            </View>

            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#22c55e" size="large" />
              <Text style={styles.loadingText}>A preparar o teu dia...</Text>
            </View>
          ) : total === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="calendar-outline" size={42} color="#c4b5fd" />
              </View>

              <Text style={styles.emptyTitle}>Nada para hoje</Text>
              <Text style={styles.emptyText}>
                Adiciona suplementos e define os dias da semana para aparecerem aqui.
              </Text>

              <TouchableOpacity
                style={styles.addButton}
                onPress={() => router.push('/add-supplement' as any)}
              >
                <Ionicons name="add-circle-outline" size={22} color="white" />
                <Text style={styles.addButtonText}>Adicionar suplemento</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.take_id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 36 }}
              renderItem={({ item }) => {
                const time = item.reminder_time
                  ? item.reminder_time.slice(0, 5)
                  : null

                const dosage =
                  item.dosage_amount && item.dosage_unit
                    ? `${item.dosage_amount} ${item.dosage_unit}`
                    : null

                const metaText = [time ? `Toma das ${time}` : null, dosage]
  .filter(Boolean)
  .join(' • ')

                return (
                  <TouchableOpacity
                    style={[styles.card, item.taken_today && styles.cardDone]}
                    activeOpacity={0.85}
                    onPress={() => toggleTaken(item)}
                  >
                    {item.photo_url ? (
                      <Image source={{ uri: item.photo_url }} style={styles.image} />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Ionicons
                          name="nutrition-outline"
                          size={28}
                          color="#c4b5fd"
                        />
                      </View>
                    )}

                    <View style={styles.cardText}>
                      <Text style={styles.name} numberOfLines={1}>
                        {item.name}
                      </Text>

                      {!!metaText && <Text style={styles.meta}>{metaText}</Text>}
                    </View>

                    <View style={[styles.check, item.taken_today && styles.checkDone]}>
                      <Ionicons
                        name={item.taken_today ? 'checkmark' : 'ellipse-outline'}
                        size={25}
                        color={item.taken_today ? 'white' : '#94a3b8'}
                      />
                    </View>
                  </TouchableOpacity>
                )
              }}
            />
          )}

          <AlertComponent />
        </View>
      </LinearGradient>
    </>
  )
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 58,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
    gap: 14,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: 'white',
    fontSize: 36,
    fontWeight: '900',
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 15,
    marginTop: 4,
    fontWeight: '600',
  },
  inventoryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 24,
    padding: 18,
    marginBottom: 22,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
  },
  progressValue: {
    color: '#67e8f9',
    fontSize: 16,
    fontWeight: '900',
  },
  progressBar: {
    backgroundColor: '#1e293b',
    height: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 8,
  },
  loadingBox: {
    marginTop: 80,
    alignItems: 'center',
  },
  loadingText: {
    color: '#cbd5e1',
    marginTop: 14,
    fontSize: 15,
    fontWeight: '600',
  },
  empty: {
    marginTop: 58,
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 26,
    padding: 24,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(124, 58, 237, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  emptyText: {
    color: '#cbd5e1',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: '#22c55e',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 15,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderRadius: 22,
    padding: 14,
    marginBottom: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  cardDone: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
  },
  image: {
    width: 58,
    height: 58,
    borderRadius: 17,
    backgroundColor: '#334155',
  },
  imagePlaceholder: {
    width: 58,
    height: 58,
    borderRadius: 17,
    backgroundColor: 'rgba(124, 58, 237, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardText: {
    flex: 1,
  },
  name: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
  },
  meta: {
    color: '#94a3b8',
    marginTop: 5,
    fontSize: 14,
    fontWeight: '600',
  },
  check: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
  },
  checkDone: {
    backgroundColor: '#22c55e',
  },
})