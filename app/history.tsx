import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StatusBar,
} from 'react-native'
import { Stack, useRouter, useFocusEffect } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import useCustomAlert from '../hooks/useCustomAlert'
import {
  getSupplementHistoryDays,
  SupplementHistoryDay,
} from '../services/supplements/supplement-service'

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
}

export default function HistoryScreen() {
  const router = useRouter()
  const [days, setDays] = useState<SupplementHistoryDay[]>([])
  const [loading, setLoading] = useState(true)
  const { showAlert, AlertComponent } = useCustomAlert()
const loadHistory = async () => {
  try {
    setLoading(true)
    const data = await getSupplementHistoryDays(30)
    setDays(data)
  } catch (error) {
    console.error('Erro ao carregar histórico:', error)
  } finally {
    setLoading(false)
  }
}

  useFocusEffect(
    useCallback(() => {
      loadHistory()
    }, [])
  )

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      <LinearGradient
        colors={['#0f172a', '#1e1b4b', '#312e81', '#155e75']}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="white" />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Histórico</Text>
              <Text style={styles.subtitle}>
                Vê as tomas dos últimos 30 dias.
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#22c55e" size="large" />
              <Text style={styles.loadingText}>A carregar histórico...</Text>
            </View>
          ) : days.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={42} color="#c4b5fd" />
              <Text style={styles.emptyTitle}>Sem histórico ainda</Text>
              <Text style={styles.emptyText}>
                Quando marcares tomas como feitas, elas aparecem aqui.
              </Text>
            </View>
          ) : (
            days.map((day) => (
  <View key={day.date} style={styles.dayCard}>
    <Text style={styles.dayTitle}>{formatDate(day.date)}</Text>

    {day.takes.map((item) => (
      <View key={item.id} style={styles.logRow}>
        {item.supplement?.photo_url ? (
          <Image
            source={{ uri: item.supplement.photo_url }}
            style={styles.image}
          />
        ) : (
          <View style={styles.iconBox}>
            <MaterialCommunityIcons
              name="pill"
              size={22}
              color="#7dd3fc"
            />
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text style={styles.name}>
            {item.supplement?.name ?? 'Suplemento'}
          </Text>

          <Text style={styles.meta}>
            {String(item.reminder_time).slice(0, 5)} ·{' '}
            {item.taken ? 'Tomado' : 'Não tomado'}
          </Text>
        </View>

        <View style={[styles.checkBox, !item.taken && styles.missedBox]}>
          <Ionicons
            name={item.taken ? 'checkmark' : 'close'}
            size={20}
            color={item.taken ? '#052e16' : 'white'}
          />
        </View>
      </View>
    ))}
  </View>
))
          )}
        </ScrollView>
        <AlertComponent />
      </LinearGradient>
    </>
  )
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 58,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  missedBox: {
  backgroundColor: '#ef4444',
},

disabledButton: {
  opacity: 0.55,
},
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: 'white',
    fontSize: 34,
    fontWeight: '900',
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  loadingBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    color: '#cbd5e1',
    marginTop: 12,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
  },
  emptyTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 12,
  },
  emptyText: {
    color: '#cbd5e1',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  dayCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
  },
  dayTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
    textTransform: 'capitalize',
    marginBottom: 12,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  image: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#1e293b',
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(125, 211, 252, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
  },
  meta: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 3,
  },
  checkBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
  },
})