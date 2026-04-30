import React, { useCallback, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  StatusBar,
  Animated,
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
} from '../services/supplements/supplement-service'

const RING_SIZE = 108
const RING_STROKE = 10
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

const { width } = Dimensions.get('window')

export default function VitaStreakHome() {
  const router = useRouter()
  const { currentUser } = useAuth()

  const [loading, setLoading] = useState(true)
  const [totalSupplements, setTotalSupplements] = useState(0)
  const [todayItems, setTodayItems] = useState<TodaySupplement[]>([])
  const [streak, setStreak] = useState(0)
  const [confettiKey, setConfettiKey] = useState(0)

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

  const getGreetingData = () => {
    const hour = new Date().getHours()

    if (hour < 12) {
      return {
        text: 'Bom dia',
        emoji: '☀️',
        sub: 'Começa forte hoje 💪',
      }
    }

    if (hour < 20) {
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

  const greeting = getGreetingData()
  const streakEmoji = getStreakBadge(streak)
  const ringColor = getStreakColor(streakEmoji)
  const ringOffset = RING_CIRCUMFERENCE * (1 - progress)

  const triggerConfetti = () => {
    setConfettiKey((current) => current + 1)
  }

  const loadHomeData = async () => {
    try {
      setLoading(true)

      const [supplements, today, currentStreak] = await Promise.all([
        getSupplements(),
        getTodaySupplements(),
        getSupplementStreak(),
      ])

      setTotalSupplements(supplements.length)
      setTodayItems(today)
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

  const refreshStreak = async () => {
    try {
      const currentStreak = await getSupplementStreak()
      setStreak(currentStreak)
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
    } catch (error) {
      console.error('Erro ao marcar todas as tomas:', error)
      setTodayItems(previous)
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#071124" />

      {confettiKey > 0 && <Confetti key={confettiKey} />}

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

        <View style={styles.heroCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroLabel}>{streakEmoji} Streak Atual</Text>

            {loading ? (
              <ActivityIndicator color="#22c55e" style={{ marginTop: 18 }} />
            ) : (
              <>
                <Text style={styles.streakNumber}>{streak}</Text>
                <Text style={styles.streakText}>
                  dia{streak === 1 ? '' : 's'} seguido
                  {streak === 1 ? '' : 's'}
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
              <Text style={styles.ringEmoji}>{streakEmoji}</Text>
              <Text style={styles.ringPercent}>{Math.round(progress * 100)}%</Text>
            </View>
          </View>
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
            <ActivityIndicator color="#22c55e" />
          </View>
        ) : todayItems.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyCard}
            onPress={() => router.push('/add-supplement' as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle-outline" size={28} color="#22c55e" />
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
                    <MaterialCommunityIcons name="pill" size={22} color="#86efac" />
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
  <QuickAction
    icon={<MaterialCommunityIcons name="pill" size={24} color="#86efac" />}
    title="Ver suplementos"
    text={`${totalSupplements} guardados`}
    onPress={() => router.push('/supplements' as any)}
  />

  <QuickAction
    highlighted
    icon={<Ionicons name="add" size={26} color="white" />}
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
  color={highlighted ? '#86efac' : '#64748b'}
/>
    </TouchableOpacity>
  )
}
function Confetti() {
  const pieces = Array.from({ length: 24 })

  return (
    <View pointerEvents="none" style={styles.confettiLayer}>
      {pieces.map((_, index) => (
        <ConfettiPiece key={index} index={index} />
      ))}
    </View>
  )
}

function ConfettiPiece({ index }: { index: number }) {
  const translateY = useRef(new Animated.Value(-20)).current
  const translateX = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(1)).current
  const rotate = useRef(new Animated.Value(0)).current

  const startX = (width / 24) * index + Math.random() * 14
  const drift = Math.random() * 120 - 60
  const duration = 1100 + Math.random() * 500

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 360,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: drift,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(rotate, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  const colors = ['#22c55e', '#f97316', '#38bdf8', '#a78bfa', '#facc15']

  return (
    <Animated.View
      style={[
        styles.confettiPiece,
        {
          left: startX,
          backgroundColor: colors[index % colors.length],
          opacity,
          transform: [
            { translateY },
            { translateX },
            {
              rotate: rotate.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              }),
            },
          ],
        },
      ]}
    />
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
quickActionRowHighlighted: {
  backgroundColor: 'rgba(34,197,94,0.16)',
  borderColor: 'rgba(34,197,94,0.42)',
},
quickActionRowIcon: {
  width: 48,
  height: 48,
  borderRadius: 16,
  backgroundColor: 'rgba(34,197,94,0.14)',
  justifyContent: 'center',
  alignItems: 'center',
},
quickActionRowIconHighlighted: {
  borderRadius: 24,
  backgroundColor: '#22c55e',
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
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    color: '#22c55e',
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
    backgroundColor: 'rgba(34,197,94,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.42)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  markAllText: {
    color: '#86efac',
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
  backgroundColor: '#12382f',
  borderColor: 'rgba(34,197,94,0.55)',
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
    backgroundColor: 'rgba(34,197,94,0.14)',
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
    backgroundColor: '#22c55e',
  },
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  },
  confettiPiece: {
    position: 'absolute',
    top: 70,
    width: 8,
    height: 14,
    borderRadius: 3,
  },
})