import React, { useCallback, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native'
import { useFocusEffect, useRouter, Stack } from 'expo-router'
import { useAuth } from '../auth-context'
import { Ionicons } from '@expo/vector-icons'
import {
  getSupplements,
  getTodaySupplements,
  getSupplementStreak,
} from '../services/supplements/supplement-service'

export default function VitaStreakHome() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
const [totalSupplements, setTotalSupplements] = useState(0)
const [todayTotal, setTodayTotal] = useState(0)
const [todayCompleted, setTodayCompleted] = useState(0)
const [streak, setStreak] = useState(0)
const { currentUser } = useAuth()
const todayRemaining = Math.max(todayTotal - todayCompleted, 0)
const avatarUrl =
  currentUser?.user_metadata?.avatar_url ||
  currentUser?.user_metadata?.picture ||
  null
const loadHomeData = async () => {
  try {
    setLoading(true)

    const [supplements, today, currentStreak] = await Promise.all([
      getSupplements(),
      getTodaySupplements(),
      getSupplementStreak(),
    ])

    setTotalSupplements(supplements.length)
    setTodayTotal(today.length)
    setTodayCompleted(today.filter((item) => item.taken_today).length)
    setStreak(currentStreak)
  } catch (error) {
    console.error('Erro ao carregar home:', error)
  } finally {
    setLoading(false)
  }
}

useFocusEffect(
  useCallback(() => {
    loadHomeData()
  }, [])
)


  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.headerRow}>
  <View style={{ flex: 1 }}>
    <Text style={styles.title}>VitaStreak</Text>
    <Text style={styles.subtitle}>
      Acompanha os teus suplementos e mantém a rotina em dia.
    </Text>
  </View>

  <TouchableOpacity
    style={styles.profileButton}
    onPress={() => router.push('/profile-vitastreak' as any)}
  >
    {avatarUrl ? (
  <Image source={{ uri: avatarUrl }} style={styles.profileImage} />
) : (
  <Ionicons name="person-outline" size={24} color="white" />
)}
  </TouchableOpacity>
</View>

      <View style={styles.summary}>
  {loading ? (
    <ActivityIndicator color="#22c55e" />
  ) : (
    <>
      <Text style={styles.summaryText}>
        🔥 {streak} dia{streak === 1 ? '' : 's'} seguido{streak === 1 ? '' : 's'}
      </Text>
      <Text style={styles.summarySub}>
  {todayTotal === 0
    ? 'Adiciona suplementos para começares a tua rotina'
    : `${todayCompleted}/${todayTotal} tomas feitas hoje`}
</Text>
    </>
  )}
</View>

      <TouchableOpacity
        style={[styles.card, styles.todayCard]}
        onPress={() => router.push('/today' as any)}
      >
        <Ionicons name="calendar-outline" size={32} color="white" />

<View style={styles.cardText}>
  <Text style={styles.cardTitle}>Hoje</Text>
  <Text style={styles.cardSubtitle}>
    {loading
  ? 'A carregar...'
  : todayTotal === 0
    ? 'Nada agendado para hoje'
    : todayRemaining === 0
      ? 'Todas as tomas de hoje feitas'
      : `Tens ${todayRemaining} toma${todayRemaining === 1 ? '' : 's'} por fazer`}
  </Text>
</View>

<Ionicons name="chevron-forward" size={24} color="white" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push('/supplements' as any)}
      >
        <Ionicons name="nutrition-outline" size={32} color="white" />

        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Suplementos</Text>
          <Text style={styles.cardSubtitle}>
  {loading
    ? 'A carregar...'
    : `${totalSupplements} suplemento${totalSupplements === 1 ? '' : 's'} guardado${totalSupplements === 1 ? '' : 's'}`}
</Text>
        </View>

        <Ionicons name="chevron-forward" size={24} color="white" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, styles.addCard]}
        onPress={() => router.push('/add-supplement' as any)}
      >
        <Ionicons name="add-circle-outline" size={32} color="white" />

        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Adicionar</Text>
          <Text style={styles.cardSubtitle}>Adicionar por foto, IA ou manualmente</Text>
        </View>

        <Ionicons name="chevron-forward" size={24} color="white" />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
    paddingTop: 70,
  },
  title: {
    color: 'white',
    fontSize: 38,
    fontWeight: '900',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 8,
    lineHeight: 22,
  },
  summary: {
    backgroundColor: '#1e293b',
    borderRadius: 22,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryText: {
    color: 'white',
    fontSize: 22,
    fontWeight: '900',
  },
  summarySub: {
    color: '#94a3b8',
    fontSize: 15,
    marginTop: 4,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  todayCard: {
    backgroundColor: '#7c3aed',
  },
  addCard: {
    backgroundColor: '#22c55e',
  },
  cardText: {
    flex: 1,
    marginLeft: 14,
  },
  headerRow: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  marginBottom: 24,
  gap: 14,
},
profileButton: {
  width: 48,
  height: 48,
  borderRadius: 24,
  backgroundColor: 'rgba(255,255,255,0.12)',
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.16)',
},
  cardTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '800',
  },
  profileImage: {
  width: 48,
  height: 48,
  borderRadius: 24,
},
  cardSubtitle: {
    color: '#dbeafe',
    fontSize: 14,
    marginTop: 4,
  },
  inventoryLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  inventoryLinkText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
})