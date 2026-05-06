import { supabase } from '../../supabase-config'
import { uploadImageToCloudinary } from '../../cloudinary-service'
import { Supplement } from '../../types/supplements/supplement'
import {
  cancelSupplementNotifications,
  scheduleSupplementNotifications,
  debugScheduledSupplementNotifications,
} from './supplement-notification-service'

export async function addSupplement(
  supplement: Omit<Supplement, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
  photoBase64?: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Utilizador não autenticado')
  }

  let photo_url: string | null = null
  let photo_public_id: string | null = null

  if (photoBase64) {
    const upload = await uploadImageToCloudinary(photoBase64, 'supplements')
    photo_url = upload.secure_url
    photo_public_id = upload.public_id
  }

  const { data, error } = await supabase
    .from('supplements')
    .insert({
      ...supplement,
      user_id: user.id,
      photo_url,
      photo_public_id,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    throw error
  }
const notificationIds = await scheduleSupplementNotifications(data as Supplement)
console.log('[SUPP_SERVICE] ADD_NOTIFICATION_IDS', notificationIds)

if (notificationIds.length > 0) {
  await supabase
    .from('supplements')
    .update({ notification_ids: notificationIds })
    .eq('id', data.id)

  data.notification_ids = notificationIds
}
  return data as Supplement
}

export async function getSupplements() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Utilizador não autenticado')
  }

  const { data, error } = await supabase
    .from('supplements')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return data as Supplement[]
}

export type TodaySupplement = Supplement & {
  take_id: string
  reminder_time: string
  taken_today?: boolean
  log_id?: string | null
}

function getDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function normalizeTime(time?: string | null) {
  if (!time) return ''
  return String(time).slice(0, 5)
}

function getReminderTimes(supplement: Supplement) {
  if (Array.isArray(supplement.reminder_times) && supplement.reminder_times.length > 0) {
    return supplement.reminder_times.map(normalizeTime).filter(Boolean)
  }

  if (supplement.reminder_time) {
    return [normalizeTime(supplement.reminder_time)]
  }

  return []
}

function isSupplementScheduledForDate(supplement: Supplement, date: Date) {
  const frequency = supplement.frequency_type ?? 'daily'
  const dayOfWeek = date.getDay()

  if (frequency === 'daily') return true

  if (frequency === 'specific_days') {
    return Array.isArray(supplement.days_of_week)
      ? supplement.days_of_week.includes(dayOfWeek)
      : false
  }

  const startDateString = supplement.start_date ?? getDateString()
  const startDate = new Date(`${startDateString}T00:00:00`)
  const currentDate = new Date(`${getDateString(date)}T00:00:00`)

  const diffDays = Math.floor(
    (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (diffDays < 0) return false

  if (frequency === 'every_other_day') {
    return diffDays % 2 === 0
  }

  if (frequency === 'custom_interval') {
    const interval = supplement.interval_days ?? 1
    return diffDays % interval === 0
  }

  return true
}

export async function getTodaySupplements() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Utilizador não autenticado')

  const today = getDateString()
  const now = new Date()

  const { data: supplements, error: supplementsError } = await supabase
    .from('supplements')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (supplementsError) throw supplementsError

  const { data: logs, error: logsError } = await supabase
    .from('supplement_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('taken_date', today)

  if (logsError) throw logsError


  return (supplements || [])
  .filter((supplement) =>
    isSupplementScheduledForDate(supplement as Supplement, now)
  )
  .flatMap((supplement: Supplement) => {
    const times = getReminderTimes(supplement)

    return times.map((time) => {
      const normalizedTime = String(time).slice(0, 5)

      const log = (logs || []).find(
        (l: any) =>
          l.supplement_id === supplement.id &&
          String(l.reminder_time).slice(0, 5) === normalizedTime
      )

      return {
        ...supplement,
        take_id: `${supplement.id}-${normalizedTime}`,
        reminder_time: normalizedTime,
        taken_today: !!log,
        log_id: log?.id ?? null,
      }
    })
  })
  .sort((a, b) => a.reminder_time.localeCompare(b.reminder_time)) as TodaySupplement[]
}

export async function markSupplementTaken(
  supplementId: string,
  reminderTime: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Utilizador não autenticado')

  const today = getDateString()

  const { data, error } = await supabase
    .from('supplement_logs')
    .upsert(
      {
        user_id: user.id,
        supplement_id: supplementId,
        taken_date: today,
        reminder_time: reminderTime,
        status: 'taken',
        taken_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,supplement_id,taken_date,reminder_time',
      }
    )
    .select()
    .single()

  if (error) throw error

  return data
}

export async function unmarkSupplementTaken(
  supplementId: string,
  reminderTime: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Utilizador não autenticado')

  const today = getDateString()

  const { error } = await supabase
    .from('supplement_logs')
    .delete()
    .eq('user_id', user.id)
    .eq('supplement_id', supplementId)
    .eq('taken_date', today)
    .eq('reminder_time', reminderTime)

  if (error) throw error
}

export async function deleteSupplement(supplementId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Utilizador não autenticado')
  }

  const { data: existing } = await supabase
    .from('supplements')
    .select('notification_ids')
    .eq('id', supplementId)
    .eq('user_id', user.id)
    .single()

  await cancelSupplementNotifications(existing?.notification_ids)

  const { error } = await supabase
    .from('supplements')
    .delete()
    .eq('id', supplementId)
    .eq('user_id', user.id)

  if (error) {
    throw error
  }
}

export async function getSupplementById(id: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Utilizador não autenticado')
  }

  const { data, error } = await supabase
    .from('supplements')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) {
    throw error
  }

  return data as Supplement
}

export async function updateSupplement(
  id: string,
  supplement: Partial<Supplement>,
  photoBase64?: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Utilizador não autenticado')
  }

  const { data: existing } = await supabase
    .from('supplements')
    .select('notification_ids')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  console.log('[SUPP_SERVICE] UPDATE_OLD_NOTIFICATION_IDS', existing?.notification_ids)

await cancelSupplementNotifications(existing?.notification_ids)

console.log('[SUPP_SERVICE] UPDATE_AFTER_CANCEL')

  let photoUpdate = {}

  if (photoBase64) {
    const upload = await uploadImageToCloudinary(photoBase64, 'supplements')

    photoUpdate = {
      photo_url: upload.secure_url,
      photo_public_id: upload.public_id,
    }
  }

  const { data, error } = await supabase
    .from('supplements')
    .update({
      ...supplement,
      ...photoUpdate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    throw error
  }

  const notificationIds = await scheduleSupplementNotifications(data as Supplement)
console.log('[SUPP_SERVICE] UPDATE_NEW_NOTIFICATION_IDS', notificationIds)
  await supabase
    .from('supplements')
    .update({ notification_ids: notificationIds })
    .eq('id', data.id)

  data.notification_ids = notificationIds

  return data as Supplement
}

export async function getSupplementStreak() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Utilizador não autenticado')

  const { data: supplements, error: supplementsError } = await supabase
    .from('supplements')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (supplementsError) throw supplementsError
  if (!supplements || supplements.length === 0) return 0

  const { data: logs, error: logsError } = await supabase
    .from('supplement_logs')
    .select('supplement_id, taken_date, reminder_time')
    .eq('user_id', user.id)

  if (logsError) throw logsError

  const logsSet = new Set(
  (logs || []).map(
    (log: any) =>
      `${log.taken_date}-${log.supplement_id}-${normalizeTime(log.reminder_time)}`
  )
)

  const isDayComplete = (date: Date) => {
    const dateString = getDateString(date)
    const scheduledTakes: string[] = []

    for (const supplement of supplements || []) {
      const supplementStartDate = supplement.start_date
  ? new Date(`${supplement.start_date}T00:00:00`)
  : null

const currentDay = new Date(`${getDateString(date)}T00:00:00`)

if (supplementStartDate && supplementStartDate > currentDay) {
  continue
}

if (!isSupplementScheduledForDate(supplement as Supplement, date)) continue

      const times = getReminderTimes(supplement as Supplement)

      for (const time of times) {
        scheduledTakes.push(`${dateString}-${supplement.id}-${normalizeTime(time)}`)
      }
    }

    if (scheduledTakes.length === 0) return null

    return scheduledTakes.every((take) => logsSet.has(take))
  }

  const today = new Date()
  const todayComplete = isDayComplete(today)
  const startDate = new Date(today)

  if (todayComplete !== true) {
    startDate.setDate(startDate.getDate() - 1)
  }

  let streak = 0

  for (let i = 0; i < 365; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() - i)

    const complete = isDayComplete(date)

    if (complete === null) continue

    if (complete) {
      streak++
    } else {
      break
    }
  }

  return streak
}

export async function rescheduleAllSupplementNotifications() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Utilizador não autenticado')

  const { data: supplements, error } = await supabase
    .from('supplements')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (error) throw error

  console.log('[SUPP_SERVICE] RESCHEDULE_ALL_START', supplements?.length ?? 0)

  await import('./supplement-notification-service').then(async (mod) => {
    const Notifications = await import('expo-notifications')
    await Notifications.cancelAllScheduledNotificationsAsync()
  })

  for (const supplement of supplements || []) {
    const ids = await scheduleSupplementNotifications(supplement as Supplement)

    await supabase
      .from('supplements')
      .update({ notification_ids: ids })
      .eq('id', supplement.id)
      .eq('user_id', user.id)

    console.log('[SUPP_SERVICE] RESCHEDULED_ONE', {
      name: supplement.name,
      ids: ids.length,
    })
  }

  await debugScheduledSupplementNotifications()
}
export type SupplementHistoryLog = {
  id: string
  supplement_id: string
  taken_date: string
  reminder_time: string
  status: string
  taken_at: string | null
  supplement?: {
    name: string
    brand?: string | null
    photo_url?: string | null
  } | null
}

export async function getSupplementHistory(days = 30) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Utilizador não autenticado')

  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - days)

  const from = getDateString(fromDate)

  const { data, error } = await supabase
    .from('supplement_logs')
    .select(`
      id,
      supplement_id,
      taken_date,
      reminder_time,
      status,
      taken_at,
      supplement:supplements (
        name,
        brand,
        photo_url
      )
    `)
    .eq('user_id', user.id)
    .gte('taken_date', from)
    .order('taken_date', { ascending: false })
    .order('reminder_time', { ascending: true })

  if (error) throw error

  return (data || []).map((log: any) => ({
    id: log.id,
    supplement_id: log.supplement_id,
    taken_date: log.taken_date,
    reminder_time: normalizeTime(log.reminder_time),
    status: log.status,
    taken_at: log.taken_at,
    supplement: Array.isArray(log.supplement)
      ? log.supplement[0] ?? null
      : log.supplement ?? null,
  })) as SupplementHistoryLog[]
}
export type SupplementHistoryTake = {
  id: string
  supplement_id: string
  taken_date: string
  reminder_time: string
  taken: boolean
  supplement: {
    name: string
    brand?: string | null
    photo_url?: string | null
  }
}

export type SupplementHistoryDay = {
  date: string
  takes: SupplementHistoryTake[]
}

export async function getSupplementHistoryDays(days = 30) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Utilizador não autenticado')

  const today = new Date()
  const fromDate = new Date()
  fromDate.setDate(today.getDate() - days + 1)

  const from = getDateString(fromDate)

  const { data: supplements, error: supplementsError } = await supabase
    .from('supplements')
    .select('*')
    .eq('user_id', user.id)

  if (supplementsError) throw supplementsError

  const { data: logs, error: logsError } = await supabase
    .from('supplement_logs')
    .select('supplement_id, taken_date, reminder_time')
    .eq('user_id', user.id)
    .gte('taken_date', from)

  if (logsError) throw logsError

  const logsSet = new Set(
    (logs || []).map(
      (log: any) =>
        `${log.taken_date}-${log.supplement_id}-${normalizeTime(log.reminder_time)}`
    )
  )

  const result: SupplementHistoryDay[] = []

  for (let i = 0; i < days; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)

    const dateString = getDateString(date)
    const takes: SupplementHistoryTake[] = []

    for (const supplement of supplements || []) {
      const createdAt = supplement.created_at
        ? new Date(supplement.created_at)
        : null

      const dayEnd = new Date(date)
      dayEnd.setHours(23, 59, 59, 999)

      if (createdAt && createdAt > dayEnd) continue
      if (!isSupplementScheduledForDate(supplement as Supplement, date)) continue

      const times = getReminderTimes(supplement as Supplement)

      for (const time of times) {
        const normalizedTime = normalizeTime(time)
        const key = `${dateString}-${supplement.id}-${normalizedTime}`

        takes.push({
          id: key,
          supplement_id: supplement.id,
          taken_date: dateString,
          reminder_time: normalizedTime,
          taken: logsSet.has(key),
          supplement: {
            name: supplement.name,
            brand: supplement.brand,
            photo_url: supplement.photo_url,
          },
        })
      }
    }

    if (takes.length > 0) {
      result.push({
        date: dateString,
        takes: takes.sort((a, b) => a.reminder_time.localeCompare(b.reminder_time)),
      })
    }
  }

  return result
}
export async function clearSupplementHistory() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Utilizador não autenticado')

  const today = getDateString()

  await supabase
    .from('supplement_logs')
    .delete()
    .eq('user_id', user.id)

  const { error } = await supabase
    .from('history_clear_state')
    .upsert(
      {
        user_id: user.id,
        cleared_before: today,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) throw error
}