import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { Supplement } from '../../types/supplements/supplement'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export async function setupSupplementNotifications() {
  const { status } = await Notifications.requestPermissionsAsync()

  if (status !== 'granted') {
    return false
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('supplements', {
      name: 'Suplementos',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#22c55e',
    })
  }

  return true
}

function parseReminderTime(time?: string | null) {
  const fallback = { hour: 9, minute: 0 }

  if (!time) return fallback

  const [hourRaw, minuteRaw] = time.split(':')
  const hour = Number(hourRaw)
  const minute = Number(minuteRaw)

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return fallback
  }

  return { hour, minute }
}

export async function cancelSupplementNotifications(notificationIds?: string[] | null) {
  if (!notificationIds || notificationIds.length === 0) return

  await Promise.all(
    notificationIds.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => null)
    )
  )
}

export async function scheduleSupplementNotifications(
  supplement: Pick<
    Supplement,
    | 'id'
    | 'name'
    | 'brand'
    | 'dosage_amount'
    | 'dosage_unit'
    | 'reminder_time'
    | 'days_of_week'
    | 'is_active'
  >
) {
  const hasPermission = await setupSupplementNotifications()

  if (!hasPermission || !supplement.id || supplement.is_active === false) {
    return []
  }

  const { hour, minute } = parseReminderTime(supplement.reminder_time)
  const days = supplement.days_of_week?.length
    ? supplement.days_of_week
    : [1, 2, 3, 4, 5, 6, 0]

  const dosage =
    supplement.dosage_amount && supplement.dosage_unit
      ? `${supplement.dosage_amount} ${supplement.dosage_unit}`
      : null

  const body = [supplement.brand, dosage].filter(Boolean).join(' • ')

  const ids: string[] = []

  for (const day of days) {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Hora de tomar ${supplement.name}`,
        body: body || 'Marca como tomado no VitaStreak.',
        sound: 'default',
        data: {
          supplementId: supplement.id,
          screen: 'today',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: day === 0 ? 1 : day + 1,
        hour,
        minute,
        channelId: 'supplements',
      },
    })

    ids.push(id)
  }

  return ids
}