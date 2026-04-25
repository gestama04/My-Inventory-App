import { supabase } from '../../supabase-config'
import { uploadImageToCloudinary } from '../../cloudinary-service'
import { Supplement } from '../../types/supplements/supplement'
import {
  cancelSupplementNotifications,
  scheduleSupplementNotifications,
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
  taken_today?: boolean
  log_id?: string | null
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10)
}

export async function getTodaySupplements() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Utilizador não autenticado')

  const today = getTodayDateString()
  const day = new Date().getDay()

  const { data: supplements, error: supplementsError } = await supabase
    .from('supplements')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .contains('days_of_week', [day])
    .order('reminder_time', { ascending: true })

  if (supplementsError) throw supplementsError

  const { data: logs, error: logsError } = await supabase
    .from('supplement_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('taken_date', today)

  if (logsError) throw logsError

  return (supplements || []).map((supplement: Supplement) => {
    const log = (logs || []).find((l: any) => l.supplement_id === supplement.id)

    return {
      ...supplement,
      taken_today: !!log,
      log_id: log?.id ?? null,
    }
  }) as TodaySupplement[]
}

export async function markSupplementTaken(supplementId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Utilizador não autenticado')

  const today = getTodayDateString()

  const { data, error } = await supabase
    .from('supplement_logs')
    .upsert(
      {
        user_id: user.id,
        supplement_id: supplementId,
        taken_date: today,
        status: 'taken',
        taken_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,supplement_id,taken_date',
      }
    )
    .select()
    .single()

  if (error) throw error

  return data
}

export async function unmarkSupplementTaken(supplementId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Utilizador não autenticado')

  const today = getTodayDateString()

  const { error } = await supabase
    .from('supplement_logs')
    .delete()
    .eq('user_id', user.id)
    .eq('supplement_id', supplementId)
    .eq('taken_date', today)

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

  await cancelSupplementNotifications(existing?.notification_ids)

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
    .select('id, days_of_week')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (supplementsError) throw supplementsError
  if (!supplements || supplements.length === 0) return 0

  const { data: logs, error: logsError } = await supabase
    .from('supplement_logs')
    .select('supplement_id, taken_date')
    .eq('user_id', user.id)

  if (logsError) throw logsError

  const logsByDate = new Map<string, Set<string>>()

  for (const log of logs || []) {
    if (!logsByDate.has(log.taken_date)) {
      logsByDate.set(log.taken_date, new Set())
    }

    logsByDate.get(log.taken_date)?.add(log.supplement_id)
  }

  const isDayComplete = (date: Date) => {
    const dateString = date.toISOString().slice(0, 10)
    const dayOfWeek = date.getDay()

    const scheduled = supplements.filter((supplement: any) =>
      Array.isArray(supplement.days_of_week)
        ? supplement.days_of_week.includes(dayOfWeek)
        : false
    )

    if (scheduled.length === 0) return null

    const taken = logsByDate.get(dateString) ?? new Set()

    return scheduled.every((supplement: any) => taken.has(supplement.id))
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

    if (complete === null) {
      continue
    }

    if (complete) {
      streak++
    } else {
      break
    }
  }

  return streak
}