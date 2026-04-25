import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getSupplementById } from '../services/supplements/supplement-service'
import { Supplement } from '../types/supplements/supplement'

function formatDate(value?: string | null) {
  if (!value) return null

  return new Date(value).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTime(value?: string | null) {
  if (!value) return 'Sem hora definida'
  return value.slice(0, 5)
}

function formatTimes(supplement: Supplement) {
  const times =
    Array.isArray(supplement.reminder_times) && supplement.reminder_times.length > 0
      ? supplement.reminder_times
      : supplement.reminder_time
        ? [supplement.reminder_time]
        : []

  if (times.length === 0) return 'Sem hora definida'

  return times
    .map((time) => String(time).slice(0, 5))
    .sort()
    .join(', ')
}

function formatDays(days?: number[]) {
  if (!days || days.length === 0) return 'Sem dias definidos'

  const labels: Record<number, string> = {
    0: 'Dom',
    1: 'Seg',
    2: 'Ter',
    3: 'Qua',
    4: 'Qui',
    5: 'Sex',
    6: 'Sáb',
  }

  if (days.length === 7) return 'Todos os dias'

  return days.map((day) => labels[day] ?? String(day)).join(', ')
}

export default function SupplementDetailsScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [supplement, setSupplement] = useState<Supplement | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSupplement = async () => {
      if (!id) return

      try {
        setLoading(true)
        const data = await getSupplementById(id)
        setSupplement(data)
      } catch (error) {
        console.error('Erro ao carregar suplemento:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSupplement()
  }, [id])

  if (loading) {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <LinearGradient
        colors={['#0f172a', '#1e1b4b', '#312e81', '#155e75']}
        style={styles.loadingContainer}
      >
        <ActivityIndicator color="#22c55e" size="large" />
      </LinearGradient>
    </>
  )
}

  if (!supplement) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>Suplemento não encontrado</Text>
      </View>
    )
  }

  const createdAt = formatDate(supplement.created_at)
  const updatedAt = formatDate(supplement.updated_at)

  return (
    <>
  <Stack.Screen options={{ headerShown: false }} />
  <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

  <LinearGradient
    colors={['#0f172a', '#1e1b4b', '#312e81', '#155e75']}
    style={{ flex: 1 }}
  >
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        <View style={styles.imageContainer}>
          {supplement.photo_url ? (
            <Image
              source={{ uri: supplement.photo_url }}
              style={styles.image}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.noImage}>
              <Ionicons name="nutrition-outline" size={64} color="#94a3b8" />
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{supplement.name}</Text>
              {!!supplement.brand && (
                <Text style={styles.brand}>{supplement.brand}</Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.editButton}
              onPress={() =>
                router.push({
                  pathname: '/edit-supplement' as any,
                  params: { id: supplement.id },
                })
              }
            >
              <Ionicons name="pencil" size={20} color="white" />
            </TouchableOpacity>
          </View>

          <View style={styles.infoGrid}>
            <InfoBox
              icon="time-outline"
              label="Hora"
              value={formatTimes(supplement)}
            />
            <InfoBox
              icon="calendar-outline"
              label="Dias"
              value={formatDays(supplement.days_of_week)}
            />
            <InfoBox
              icon="flask-outline"
              label="Dosagem"
              value={
                supplement.dosage_amount && supplement.dosage_unit
                  ? `${supplement.dosage_amount} ${supplement.dosage_unit}`
                  : 'Sem dosagem'
              }
            />
            <InfoBox
              icon="cube-outline"
              label="Embalagem"
              value={
                supplement.container_quantity
                  ? `${supplement.container_quantity} unidades`
                  : 'Sem quantidade'
              }
            />
          </View>

          <Section title="Ingrediente principal">
            <Text style={styles.sectionText}>
              {supplement.main_ingredient || 'Sem ingrediente principal'}
            </Text>
          </Section>

          {Array.isArray(supplement.active_ingredients) &&
          supplement.active_ingredients.length > 0 ? (
            <Section title="Ingredientes detetados">
              {supplement.active_ingredients.map((ingredient: any, index: number) => (
                <Text key={`${ingredient.name}-${index}`} style={styles.sectionText}>
                  {ingredient.name}
                  {ingredient.amount ? ` • ${ingredient.amount}` : ''}
                  {ingredient.unit ? ` ${ingredient.unit}` : ''}
                </Text>
              ))}
            </Section>
          ) : null}

          <Section title="Tamanho da toma">
            <Text style={styles.sectionText}>
              {supplement.serving_size || 'Sem tamanho da toma'}
            </Text>
          </Section>

          <Section title="Instruções do rótulo">
            <Text style={styles.sectionText}>
              {supplement.instructions_from_label || 'Sem instruções guardadas'}
            </Text>
          </Section>

          <View style={styles.datesBox}>
            {createdAt ? (
              <Text style={styles.dateText}>Criado: {createdAt}</Text>
            ) : null}
            {updatedAt ? (
              <Text style={styles.dateText}>Atualizado: {updatedAt}</Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
      </LinearGradient>
    </>
  )
}

function InfoBox({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
}) {
  return (
    <View style={styles.infoBox}>
      <Ionicons name={icon} size={22} color="#22c55e" />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
  flex: 1,
  backgroundColor: 'transparent',
},
loadingContainer: {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
},
  emptyText: {
    color: '#cbd5e1',
    fontSize: 16,
  },
  backButton: {
    position: 'absolute',
    top: 56,
    left: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
  height: 320,
  backgroundColor: 'rgba(15, 23, 42, 0.7)',
},
  image: {
    width: '100%',
    height: '100%',
  },
  noImage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
  backgroundColor: 'rgba(15, 23, 42, 0.88)',
  marginTop: -26,
  borderTopLeftRadius: 28,
  borderTopRightRadius: 28,
  padding: 22,
  minHeight: 520,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.12)',
},
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  title: {
    color: 'white',
    fontSize: 30,
    fontWeight: '900',
  },
  brand: {
    color: '#cbd5e1',
    fontSize: 18,
    marginTop: 4,
  },
  editButton: {
  backgroundColor: '#7c3aed',
  width: 44,
  height: 44,
  borderRadius: 22,
  alignItems: 'center',
  justifyContent: 'center',
  marginLeft: 12,
},
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  infoBox: {
  width: '48%',
  backgroundColor: 'rgba(30, 41, 59, 0.95)',
  borderRadius: 18,
  padding: 14,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.12)',
},
  infoLabel: {
    color: '#94a3b8',
    marginTop: 8,
    fontSize: 13,
  },
  infoValue: {
    color: 'white',
    marginTop: 4,
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
  backgroundColor: 'rgba(30, 41, 59, 0.95)',
  borderRadius: 18,
  padding: 16,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.12)',
  marginBottom: 14,
},
  sectionTitle: {
    color: 'white',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  sectionText: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
  },
  datesBox: {
    marginTop: 8,
    marginBottom: 30,
  },
  dateText: {
    color: '#64748b',
    fontSize: 13,
    marginBottom: 4,
  },
})