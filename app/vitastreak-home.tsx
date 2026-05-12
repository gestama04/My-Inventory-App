import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  StatusBar,
  Dimensions,
} from 'react-native'
import { useFocusEffect, useRouter, Stack } from 'expo-router'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import Svg, { Circle } from 'react-native-svg'
import { useAuth } from '../auth-context'
import {
  getSupplements,
  getTodaySupplements,
  getSupplementStreak,
  markSupplementTaken,
  unmarkSupplementTaken,
  TodaySupplement,
  getSupplementDayStatusDays,
  SupplementDayStatus,
  freezeSupplementDay,
  syncFreezeRewards
} from '../services/supplements/supplement-service'
import ConfettiCannon from 'react-native-confetti-cannon'

const RING_SIZE = 108
const RING_STROKE = 10
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

const { width } = Dimensions.get('window')

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export default function VitaStreakHome() {
  const router = useRouter()
  const { currentUser } = useAuth()

  const [loading, setLoading] = useState(true)
  const [totalSupplements, setTotalSupplements] = useState(0)
  const [todayItems, setTodayItems] = useState<TodaySupplement[]>([])
  const [streak, setStreak] = useState(0)
  const [confettiKey, setConfettiKey] = useState(0)
  const [freezeBalance, setFreezeBalance] = useState(0)
  const [weekDays, setWeekDays] = useState<SupplementDayStatus[]>([])
  const avatarUrl =
    currentUser?.user_metadata?.avatar_url ||
    currentUser?.user_metadata?.picture ||
    null

  const firstName =
    currentUser?.user_metadata?.first_name ||
    currentUser?.user_metadata?.name?.split?.(' ')?.[0] ||
    'Bernardo'

  const todayTotal = todayItems.length
  const todayCompleted = todayItems.filter((item) => item.taken_today).length
  const todayRemaining = Math.max(todayTotal - todayCompleted, 0)
  const progress = todayTotal > 0 ? todayCompleted / todayTotal : 0

  const safeTime = (t?: string | null) => t ?? ''
const freezeYesterday = async () => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  const dateString = getLocalDateString(yesterday)

  try {
    await freezeSupplementDay(dateString)
await loadHomeData()
  } catch (error) {
    console.error('Erro ao usar gelo:', error)
  }
}
  const getGreetingData = () => {
  const hour = new Date().getHours()

  if (hour >= 6 && hour < 12) {
    return {
      text: 'Bom dia',
      emoji: '☀️',
      sub: 'Começa forte hoje 💪',
    }
  }

  if (hour >= 12 && hour < 20) {
    return {
      text: 'Boa tarde',
      emoji: '🌤️',
      sub: 'Continua consistente 🔥',
    }
  }

  return {
    text: 'Boa noite',
    emoji: '🌙',
    sub: 'Fecha o dia em grande ✨',
  }
}

  const getStreakBadge = (days: number) => {
    if (days <= 0) return '❄️'
    if (days < 3) return '🔥'
    if (days < 7) return '🔥🔥'
    if (days < 14) return '🔥🔥🔥'
    if (days < 30) return '🥉'
    if (days < 60) return '🥈'
    if (days < 90) return '🥇'
    if (days < 180) return '💎'
    if (days < 365) return '🏆'
    return '👑'
  }

  const getStreakColor = (emoji: string) => {
    if (emoji.includes('❄️')) return '#67e8f9'
    if (emoji.includes('🔥')) return '#f97316'
    if (emoji.includes('🥉')) return '#cd7f32'
    if (emoji.includes('🥈')) return '#cbd5e1'
    if (emoji.includes('🥇')) return '#facc15'
    if (emoji.includes('💎')) return '#38bdf8'
    if (emoji.includes('🏆')) return '#f59e0b'
    if (emoji.includes('👑')) return '#eab308'
    return '#22c55e'
  }

  const getStreakTheme = (emoji: string) => {
  if (emoji.includes('❄️')) {
    return {
      glow: '#67e8f9',
      card: '#0b2433',
      soft: 'rgba(103,232,249,0.16)',
      border: 'rgba(103,232,249,0.42)',
    }
  }

  if (emoji.includes('🔥')) {
  return {
    glow: '#fb923c',
    card: '#41200a',
    soft: 'rgba(249,115,22,0.18)',
    border: 'rgba(251,146,60,0.55)',
  }
}

  if (emoji.includes('💎')) {
    return {
      glow: '#38bdf8',
      card: '#082f49',
      soft: 'rgba(56,189,248,0.18)',
      border: 'rgba(56,189,248,0.48)',
    }
  }

  if (emoji.includes('🏆') || emoji.includes('👑') || emoji.includes('🥇')) {
    return {
      glow: '#facc15',
      card: '#2a2108',
      soft: 'rgba(250,204,21,0.18)',
      border: 'rgba(250,204,21,0.48)',
    }
  }

  return {
    glow: '#7dd3fc',
    card: '#101c34',
    soft: 'rgba(125,211,252,0.16)',
    border: 'rgba(125,211,252,0.42)',
  }
}

  const greeting = getGreetingData()
  const streakEmoji = getStreakBadge(streak)
  const ringColor = getStreakColor(streakEmoji)
  const streakTheme = getStreakTheme(streakEmoji)
  const ringOffset = RING_CIRCUMFERENCE * (1 - progress)

  const triggerConfetti = () => {
    setConfettiKey((current) => current + 1)
  }

  const loadHomeData = async () => {
    try {
      setLoading(true)

      const [supplements, today, currentStreak, historyDays] = await Promise.all([
  getSupplements(),
  getTodaySupplements(),
  getSupplementStreak(),
  getSupplementDayStatusDays(7),
])

setTotalSupplements(supplements.length)
setTodayItems(today)
setStreak(currentStreak)
setWeekDays(historyDays)
const freezeData = await syncFreezeRewards(currentStreak)
setFreezeBalance(freezeData.available)
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

const refreshStreak = async () => {
  try {
    const currentStreak = await getSupplementStreak()
    const freezeData = await syncFreezeRewards(currentStreak)

    setStreak(currentStreak)
    setFreezeBalance(freezeData.available)
  } catch (error) {
    console.error('Erro ao atualizar streak:', error)
  }
}

  const toggleTaken = async (item: TodaySupplement) => {
    if (!item.id) return

    const previous = todayItems
    const wasCompleted = todayCompleted === todayTotal && todayTotal > 0

    const updatedItems = todayItems.map((supplement) =>
      supplement.take_id === item.take_id
        ? { ...supplement, taken_today: !supplement.taken_today }
        : supplement
    )

    setTodayItems(updatedItems)

    const isCompletedNow =
      updatedItems.length > 0 &&
      updatedItems.every((supplement) => supplement.taken_today)

    if (!wasCompleted && isCompletedNow) {
      triggerConfetti()
    }

    try {
      if (item.taken_today) {
        await unmarkSupplementTaken(item.id, safeTime(item.reminder_time))
      } else {
        await markSupplementTaken(item.id, safeTime(item.reminder_time))
      }

      await refreshStreak()
      const dayStatusDays = await getSupplementDayStatusDays(7)
setWeekDays(dayStatusDays)
    } catch (error) {
      console.error('Erro ao atualizar toma:', error)
      setTodayItems(previous)
    }
  }

  const markAllToday = async () => {
    const pendingItems = todayItems.filter(
      (item): item is TodaySupplement & { id: string } =>
        !item.taken_today && typeof item.id === 'string'
    )

    if (pendingItems.length === 0) return

    const previous = todayItems

    setTodayItems((current) =>
      current.map((item) => ({
        ...item,
        taken_today: true,
      }))
    )

    triggerConfetti()

    try {
      await Promise.all(
        pendingItems.map((item) =>
          markSupplementTaken(item.id, safeTime(item.reminder_time))
        )
      )

      await refreshStreak()
      const dayStatusDays = await getSupplementDayStatusDays(7)
setWeekDays(dayStatusDays)
    } catch (error) {
      console.error('Erro ao marcar todas as tomas:', error)
      setTodayItems(previous)
    }
  }
const yesterday = new Date()
yesterday.setDate(yesterday.getDate() - 1)
const yesterdayString = getLocalDateString(yesterday)
const yesterdayStatus = weekDays.find((day) => day.date === yesterdayString)

const canUseFreeze =
  freezeBalance > 0 &&
  (!yesterdayStatus || (!yesterdayStatus.completed && !yesterdayStatus.frozen))
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#071124" />


      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.appNameBox}>
          <Text style={styles.appName}>VitaStreak</Text>
        </View>

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={styles.greetingRow}>
              <Text style={styles.greeting}>
                {greeting.text}, {firstName}!
              </Text>
              <Text style={styles.greetingEmoji}>{greeting.emoji}</Text>
            </View>

            <Text style={styles.subtitle}>{greeting.sub}</Text>
          </View>

          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('/profile-vitastreak' as any)}
            activeOpacity={0.85}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.profileImage} />
            ) : (
              <Ionicons name="person-outline" size={24} color="white" />
            )}
          </TouchableOpacity>
        </View>

<View
  style={[
    styles.heroCard,
    {
      backgroundColor: streakTheme.card,
      borderColor: streakTheme.border,
      shadowColor: streakTheme.glow,
    },
  ]}
>
  <View style={styles.heroTop}>
    <View style={{ flex: 1 }}>
      <Text style={styles.heroLabel}>{streakEmoji} Streak Atual</Text>

      {loading ? (
        <ActivityIndicator color="#7dd3fc" style={{ marginTop: 18 }} />
      ) : (
        <>
          <Text style={styles.streakNumber}>{streak}</Text>
          <Text style={styles.streakText}>
            dia{streak === 1 ? '' : 's'} seguido{streak === 1 ? '' : 's'}
          </Text>
        </>
      )}
    </View>

    <View style={styles.ringBox}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={RING_STROKE}
          fill="transparent"
        />

        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={ringColor}
          strokeWidth={RING_STROKE}
          fill="transparent"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={ringOffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
      </Svg>

      <View style={styles.ringCenter}>
  <Text style={styles.ringPercentLarge}>
    {Math.round(progress * 100)}%
  </Text>
</View>
    </View>
  </View>

  <WeeklyStatusWidget days={weekDays} />
</View>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Hoje</Text>
            <Text style={styles.todayStatus}>
              {loading
                ? 'A carregar...'
                : todayTotal === 0
                  ? 'Nada agendado para hoje'
                  : todayRemaining === 0
                    ? 'Todas as tomas feitas hoje'
                    : `${todayCompleted} de ${todayTotal} concluídas`}
            </Text>
          </View>

          {todayTotal > 0 && todayRemaining > 0 ? (
            <TouchableOpacity style={styles.markAllButton} onPress={markAllToday}>
              <Text style={styles.markAllText}>Marcar todas</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => router.push('/today' as any)}>
              <Text style={styles.sectionAction}>Ver tudo</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#7dd3fc" />
          </View>
        ) : todayItems.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyCard}
            onPress={() => router.push('/add-supplement' as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle-outline" size={28} color="#7dd3fc" />
            <Text style={styles.emptyTitle}>Adicionar primeiro suplemento</Text>
            <Text style={styles.emptyText}>
              Cria uma rotina e os lembretes aparecem aqui.
            </Text>
          </TouchableOpacity>
        ) : (
          todayItems.slice(0, 5).map((item) => {
            const time = item.reminder_time ? item.reminder_time.slice(0, 5) : null

            return (
              <TouchableOpacity
                key={item.take_id}
                style={[styles.todayItem, item.taken_today && styles.todayItemDone]}
                onPress={() => toggleTaken(item)}
                activeOpacity={0.85}
              >
                {item.photo_url ? (
                  <Image source={{ uri: item.photo_url }} style={styles.supplementImage} />
                ) : (
                  <View style={styles.supplementIcon}>
                    <MaterialCommunityIcons name="pill" size={22} color="#7dd3fc" />
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <Text style={styles.todayName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.todayTime}>{time || 'Sem hora'}</Text>
                </View>

                <View style={[styles.checkCircle, item.taken_today && styles.checkCircleDone]}>
                  <Ionicons
                    name={item.taken_today ? 'checkmark' : 'ellipse-outline'}
                    size={23}
                    color={item.taken_today ? '#04111f' : '#64748b'}
                  />
                </View>
              </TouchableOpacity>
            )
          })
        )}

        <View style={styles.quickActionsHeader}>
  <Text style={styles.quickActionsTitle}>Ações rápidas</Text>
</View>

        <View style={styles.quickActions}>
          {canUseFreeze ? (
  <QuickAction
    icon={<Ionicons name="snow-outline" size={24} color="#67e8f9" />}
    title={`Usar gelo (${freezeBalance})`}
    text="Protege o streak de ontem"
    onPress={freezeYesterday}
  />
) : null}
  <QuickAction
    icon={<MaterialCommunityIcons name="pill" size={24} color="#7dd3fc" />}
    title="Ver suplementos"
    text={`${totalSupplements} guardados`}
    onPress={() => router.push('/supplements' as any)}
  />

  <QuickAction
  highlighted
  icon={<Ionicons name="add" size={26} color="#071124" />}
  title="Adicionar suplemento"
  text="Nova toma, com foto por IA"
  onPress={() => router.push('/add-supplement' as any)}
/>

  <QuickAction
    icon={<Ionicons name="sparkles-outline" size={24} color="#c4b5fd" />}
    title="Análise IA"
    text="Rever rotina e pontos a confirmar"
    onPress={() => router.push('/ai-routine-review' as any)}
  />
</View>
      </ScrollView>
      {confettiKey > 0 ? (
  <View pointerEvents="none" style={styles.confettiOverlay}>
    <ConfettiCannon
      key={confettiKey}
      count={120}
      origin={{ x: width / 2, y: 0 }}
      fadeOut
      autoStart
      onAnimationEnd={() => setConfettiKey(0)}
    />
  </View>
) : null}
    </View>
  )
}
function WeeklyStatusWidget({ days }: { days: SupplementDayStatus[] }) {
  const last7Days = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))

    const dateString = getLocalDateString(date)
    const found = days.find((day) => day.date === dateString)

    const label = date
      .toLocaleDateString('pt-PT', { weekday: 'short' })
      .replace('.', '')
      .slice(0, 3)

    const hasTakes = !!found
    const completed = !!found?.completed
const frozen = !!found?.frozen

return { date: dateString, label, hasTakes, completed, frozen }
  })

  return (
    <View style={styles.weekDaysRow}>
      {last7Days.map((day) => (
        <View key={day.date} style={styles.weekDayItem}>
          <Text style={styles.weekDayLabel}>{day.label}</Text>

          <View
  style={[
    styles.weekDot,
    !day.hasTakes
      ? styles.weekDotEmpty
      : day.completed
        ? styles.weekDotDone
        : day.frozen
          ? styles.weekDotFrozen
          : styles.weekDotMissed,
  ]}
/>
        </View>
      ))}
    </View>
  )
}
function QuickAction({
  icon,
  title,
  text,
  onPress,
  highlighted,
}: {
  icon: React.ReactNode
  title: string
  text: string
  onPress: () => void
  highlighted?: boolean
}) {
  return (
    <TouchableOpacity
      style={[styles.quickActionRow, highlighted && styles.quickActionRowHighlighted]}
      onPress={onPress}
      activeOpacity={0.86}
    >
      <View style={[styles.quickActionRowIcon, highlighted && styles.quickActionRowIconHighlighted]}>
        {icon}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.quickActionRowTitle}>{title}</Text>
        <Text style={styles.quickActionRowText}>{text}</Text>
      </View>

      <Ionicons
  name="chevron-forward"
  size={22}
  color={highlighted ? '#bae6fd' : '#64748b'}
/>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#071124',
  },
  scrollContent: {
  padding: 20,
  paddingTop: 58,
  paddingBottom: 50,
},
quickActions: {
  gap: 12,
  marginTop: 8,
  marginBottom: 10,
},
quickActionRow: {
  minHeight: 74,
  borderRadius: 22,
  backgroundColor: '#101c34',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.08)',
  padding: 14,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 14,
},
weekDotFrozen: {
  backgroundColor: 'rgba(103, 232, 249, 0.85)',
},
confettiOverlay: {
  ...StyleSheet.absoluteFillObject,
  zIndex: 999,
  elevation: 999,
},
ringPercentLarge: {
  color: 'white',
  fontSize: 20,
  fontWeight: '900',
},
weekDot: {
  width: 10,
  height: 10,
  borderRadius: 5,
},

weekDotDone: {
  backgroundColor: 'rgba(74, 222, 128, 0.72)',
},

weekDotMissed: {
  backgroundColor: 'rgba(248, 113, 113, 0.45)',
},

weekDotEmpty: {
  backgroundColor: 'rgba(148, 163, 184, 0.14)',
},

weekDaysRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginTop: 10,
},

weekDayItem: {
  alignItems: 'center',
  gap: 7,
},

weekDayLabel: {
  color: 'rgba(203, 213, 225, 0.75)',
  fontSize: 11,
  opacity: 0.72,
  fontWeight: '900',
  textTransform: 'uppercase',
},
quickActionRowHighlighted: {
  backgroundColor: 'rgba(125,211,252,0.16)',
  borderColor: 'rgba(125,211,252,0.42)',
},
quickActionRowIcon: {
  width: 48,
  height: 48,
  borderRadius: 16,
  backgroundColor: 'rgba(125,211,252,0.14)',
  justifyContent: 'center',
  alignItems: 'center',
},
quickActionRowIconHighlighted: {
  borderRadius: 24,
  backgroundColor: '#7dd3fc',
},
quickActionRowTitle: {
  color: 'white',
  fontSize: 17,
  fontWeight: '900',
},
quickActionRowText: {
  color: '#94a3b8',
  fontSize: 13,
  fontWeight: '700',
  marginTop: 3,
},
  appNameBox: {
    marginBottom: 18,
  },
  appName: {
    color: 'white',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
    gap: 14,
  },
  quickActionsHeader: {
  marginTop: 20,
  marginBottom: 10,
},
quickActionsTitle: {
  color: 'white',
  fontSize: 18,
  fontWeight: '900',
},
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  greeting: {
    color: 'white',
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 30,
  },
  heroTop: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
  greetingEmoji: {
    fontSize: 22,
    lineHeight: 28,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 15,
    marginTop: 4,
    fontWeight: '700',
  },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  heroCard: {
    backgroundColor: '#101c34',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 26,
  },
  
  heroLabel: {
  color: '#f8fafc',
  fontSize: 15,
  fontWeight: '900',
  marginBottom: 10,
},
  streakNumber: {
    color: 'white',
    fontSize: 46,
    fontWeight: '900',
  },
  streakText: {
    color: '#cbd5e1',
    fontSize: 15,
    fontWeight: '800',
  },
  ringBox: {
    width: RING_SIZE,
    height: RING_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  ringEmoji: {
    fontSize: 24,
  },
  ringPercent: {
    color: 'white',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 23,
    fontWeight: '900',
  },
  sectionAction: {
  color: '#7dd3fc',
  fontSize: 14,
  fontWeight: '900',
  marginTop: 5,
},
  todayStatus: {
    color: '#cbd5e1',
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
  },
  markAllButton: {
  backgroundColor: 'rgba(125,211,252,0.16)',
  borderWidth: 1,
  borderColor: 'rgba(125,211,252,0.42)',
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 999,
},
  markAllText: {
  color: '#bae6fd',
  fontSize: 13,
  fontWeight: '900',
},

  loadingCard: {
    backgroundColor: '#101c34',
    borderRadius: 20,
    padding: 24,
    marginBottom: 18,
  },
  emptyCard: {
    backgroundColor: '#101c34',
    borderRadius: 22,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 10,
  },
  emptyText: {
    color: '#94a3b8',
    marginTop: 5,
    fontSize: 14,
    lineHeight: 20,
  },
  todayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101c34',
    borderRadius: 18,
    padding: 12,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  todayItemDone: {
  backgroundColor: 'rgba(14,116,144,0.28)',
  borderColor: 'rgba(125,211,252,0.50)',
},
  supplementImage: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#1e293b',
  },
  supplementIcon: {
  width: 46,
  height: 46,
  borderRadius: 14,
  backgroundColor: 'rgba(125,211,252,0.14)',
  justifyContent: 'center',
  alignItems: 'center',
},
  todayName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
  },
  todayTime: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 3,
    fontWeight: '700',
  },
  checkCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15,23,42,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkCircleDone: {
  backgroundColor: '#7dd3fc',
}
})