import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { Supplement } from '../../types/supplements/supplement'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export async function setupSupplementNotifications() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('[SupplementNotifications] Permissão negada')
    return false
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('supplements', {
      name: 'Suplementos',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#22c55e',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    })
    const channel = await Notifications.getNotificationChannelAsync('supplements')
console.log('[SUPP_NOTIF] ANDROID_CHANNEL', channel)
  }

  return true
}

function parseReminderTime(time?: string | null) {
  if (!time) return null

  const [hourRaw, minuteRaw] = String(time).slice(0, 5).split(':')
  const hour = Number(hourRaw)
  const minute = Number(minuteRaw)

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null
  }

  return { hour, minute }
}

function getReminderTimes(supplement: Partial<Supplement>) {
  if (Array.isArray(supplement.reminder_times) && supplement.reminder_times.length > 0) {
    return supplement.reminder_times
      .map((time) => String(time).slice(0, 5))
      .filter(Boolean)
  }

  if (supplement.reminder_time) {
    return [String(supplement.reminder_time).slice(0, 5)]
  }

  return []
}

function getDaysOfWeek(supplement: Partial<Supplement>) {
  if (supplement.frequency_type === 'specific_days') {
    return supplement.days_of_week?.length ? supplement.days_of_week : []
  }

  return [1, 2, 3, 4, 5, 6, 0]
}

export async function cancelSupplementNotifications(notificationIds?: string[] | null) {
  if (!notificationIds || notificationIds.length === 0) {
    console.log('[SUPP_NOTIF] CANCEL_SKIP no ids')
    return
  }

  console.log('[SUPP_NOTIF] CANCEL_START', notificationIds)

  await Promise.all(
    notificationIds.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id)
        .then(() => console.log('[SUPP_NOTIF] CANCEL_OK', id))
        .catch((error) => console.log('[SUPP_NOTIF] CANCEL_ERROR', id, error))
    )
  )

  const remaining = await Notifications.getAllScheduledNotificationsAsync()
  console.log('[SUPP_NOTIF] AFTER_CANCEL_COUNT', remaining.length)
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
    | 'reminder_times'
    | 'frequency_type'
    | 'days_of_week'
    | 'is_active'
  >
) {
  const hasPermission = await setupSupplementNotifications()
  console.log('[SUPP_NOTIF] PERMISSION_RESULT', { hasPermission })
  if (!hasPermission || !supplement.id || supplement.is_active === false) {
    console.log('[SupplementNotifications] Não agendado:', {
      hasPermission,
      id: supplement.id,
      isActive: supplement.is_active,
    })
    return []
  }

  const times = getReminderTimes(supplement)
  const days = getDaysOfWeek(supplement)

  if (times.length === 0 || days.length === 0) {
    console.log('[SupplementNotifications] Sem horas ou dias válidos')
    return []
  }

  const dosage =
    supplement.dosage_amount && supplement.dosage_unit
      ? `${supplement.dosage_amount} ${supplement.dosage_unit}`
      : null

  const body = [supplement.brand, dosage].filter(Boolean).join(' • ')
  const ids: string[] = []

  for (const time of times) {
    const parsedTime = parseReminderTime(time)
    if (!parsedTime) continue

    for (const day of days) {
      const id = await Notifications.scheduleNotificationAsync({
        
        content: {
          title: `Hora de tomar ${supplement.name}`,
          body: body || 'Marca como tomado no VitaStreak.',
          sound: 'default',
          data: {
            type: 'supplement-reminder',
            supplementId: supplement.id,
            screen: 'today',
            
          },
          
        },
        
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day === 0 ? 1 : day + 1,
          hour: parsedTime.hour,
          minute: parsedTime.minute,
          channelId: 'supplements',
        },
      })

      ids.push(id)
      console.log('[SUPP_NOTIF] SCHEDULE_ONE', {
  id,
  supplement: supplement.name,
  time,
  day,
  weekday: day === 0 ? 1 : day + 1,
  hour: parsedTime.hour,
  minute: parsedTime.minute,
})
    }
  }

  console.log('[SupplementNotifications] Agendadas:', {
    supplement: supplement.name,
    times,
    days,
    count: ids.length,
  })
const scheduled = await Notifications.getAllScheduledNotificationsAsync()

console.log('[SUPP_NOTIF] FINAL_IDS', ids)

console.log(
  '[SUPP_NOTIF] FINAL_SCHEDULED',
  scheduled.map((item) => ({
    id: item.identifier,
    title: item.content.title,
    trigger: item.trigger,
    data: item.content.data,
  }))
)
  return ids
}

export async function debugScheduledSupplementNotifications() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync()

  console.log(
    '[SupplementNotifications] Agendadas agora:',
    scheduled.map((item) => ({
      id: item.identifier,
      title: item.content.title,
      trigger: item.trigger,
      data: item.content.data,
    }))
  )

  return scheduled
}