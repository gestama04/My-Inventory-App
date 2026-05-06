import React, { useState } from 'react'
import { SupplementAIInsights, SupplementFrequencyType } from '../types/supplements/supplement'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  StatusBar,
} from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'

import { addSupplement } from '../services/supplements/supplement-service'
import { analyzeSupplementLabel } from '../services/supplements/gemini-supplement-service'
import { getSupplementSuggestion } from '../services/supplements/supplement-suggestions'
import useCustomAlert from '../hooks/useCustomAlert'
import DateTimePicker from '@react-native-community/datetimepicker'

function cleanInstructions(text: string | null) {
  if (!text) return ''

  const lower = text.toLowerCase()

  if (
    lower.includes('dietary supplement') ||
    lower.includes('suplemento alimentar')
  ) {
    return ''
  }

  return text
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export default function AddSupplementScreen() {
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()

  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [mainIngredient, setMainIngredient] = useState('')
  const [dosageAmount, setDosageAmount] = useState('')
  const [dosageUnit, setDosageUnit] = useState('mg')
  const [servingSize, setServingSize] = useState('')
  const [instructions, setInstructions] = useState('')
  const [reminderTime, setReminderTime] = useState('')
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [containerQuantity, setContainerQuantity] = useState('')
  const [photoBase64, setPhotoBase64] = useState('')
  const [confidence, setConfidence] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [frequencyType, setFrequencyType] =
    useState<SupplementFrequencyType>('daily')

  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5, 6, 0])
  const [reminderTimes, setReminderTimes] = useState<string[]>([])
  const [editingTimeIndex, setEditingTimeIndex] = useState<number | null>(null)
  const [intervalDays, setIntervalDays] = useState('2')
  const [aiInsights, setAiInsights] = useState<SupplementAIInsights | null>(null)
  const [activeIngredients, setActiveIngredients] = useState<
    { name: string; amount: number | null; unit: string | null }[]
  >([])

  const analyzeImageUri = async (uri: string) => {
    try {
      setAnalyzing(true)

      const manipResult = await manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.9, format: SaveFormat.JPEG }
      )

      const base64 = await FileSystem.readAsStringAsync(manipResult.uri, {
        encoding: 'base64',
      })

      setPhotoBase64(base64)

      const analysis = await analyzeSupplementLabel(base64)

      setName(analysis.name ?? '')
      setBrand(analysis.brand ?? '')
      setMainIngredient(analysis.mainIngredient ?? '')
      setDosageAmount(
        analysis.dosageAmount !== null && analysis.dosageAmount !== undefined
          ? String(analysis.dosageAmount)
          : ''
      )
      setDosageUnit(analysis.dosageUnit ?? 'mg')
      setServingSize(analysis.servingSize ?? '')
      setAiInsights(analysis.aiInsights ?? null)
      setContainerQuantity(
        analysis.containerQuantity !== null &&
          analysis.containerQuantity !== undefined
          ? String(analysis.containerQuantity)
          : ''
      )
      setInstructions(cleanInstructions(analysis.instructionsFromLabel))
      setConfidence(analysis.confidence)
      setActiveIngredients(analysis.activeIngredients ?? [])

      const suggestion = getSupplementSuggestion({
        name: analysis.name ?? '',
        mainIngredient: analysis.mainIngredient ?? '',
        dosageAmount: analysis.dosageAmount,
        dosageUnit: analysis.dosageUnit,
      })

      if (reminderTimes.length === 0 && suggestion.reminderTime) {
  setReminderTimes([suggestion.reminderTime])
  setReminderTime(suggestion.reminderTime)
}

      showAlert(
        'Sugestão de rotina',
        suggestion.caution
          ? `${suggestion.note}\n\n${suggestion.caution}`
          : suggestion.note,
        [{ text: 'OK', onPress: () => {} }]
      )

      if (analysis.confidence < 0.7) {
        showAlert(
          'Confirmação recomendada',
          'A IA não teve muita confiança. Confirma os campos manualmente.',
          [{ text: 'OK', onPress: () => {} }]
        )
      }
    } catch (error) {
      console.error('Erro ao analisar imagem:', error)
      showAlert('Erro', 'Não foi possível analisar a imagem.', [
        { text: 'OK', onPress: () => {} },
      ])
    } finally {
      setAnalyzing(false)
    }
  }

  const handlePickAndAnalyzeImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (status !== 'granted') {
      showAlert('Permissão necessária', 'É necessário acesso à galeria.', [
        { text: 'OK', onPress: () => {} },
      ])
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    })

    if (!result.canceled && result.assets[0]) {
      await analyzeImageUri(result.assets[0].uri)
    }
  }

  const handleTakeAndAnalyzePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()

    if (status !== 'granted') {
      showAlert('Permissão necessária', 'É necessário acesso à câmara.', [
        { text: 'OK', onPress: () => {} },
      ])
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    })

    if (!result.canceled && result.assets[0]) {
      await analyzeImageUri(result.assets[0].uri)
    }
  }

const handleTimeChange = (_event: any, selectedDate?: Date) => {
  setShowTimePicker(false)

  if (editingTimeIndex === null) return
  if (!selectedDate) return

  const hours = selectedDate.getHours().toString().padStart(2, '0')
  const minutes = selectedDate.getMinutes().toString().padStart(2, '0')
  const time = `${hours}:${minutes}`

  setReminderTimes((current) => {
    const next = [...current]
    next[editingTimeIndex] = time
    return next
  })

  if (editingTimeIndex === 0) {
    setReminderTime(time)
  }

  setEditingTimeIndex(null)
}

const addReminderTime = () => {
  setReminderTimes((current) => [...current, ''])
}

const removeReminderTime = (index: number) => {
  setReminderTimes((current) => current.filter((_, i) => i !== index))
}

const toggleDay = (day: number) => {
  setDaysOfWeek((current) =>
    current.includes(day)
      ? current.filter((item) => item !== day)
      : [...current, day]
  )
}

  const handleSave = async () => {
    if (!name.trim()) {
      showAlert('Nome em falta', 'Insere pelo menos o nome do suplemento.', [
        { text: 'OK', onPress: () => {} },
      ])
      return
    }
  const cleanedReminderTimes = reminderTimes.filter(Boolean)

if (cleanedReminderTimes.length === 0) {
  showAlert('Hora em falta', 'Escolhe pelo menos uma hora de lembrete.', [
    { text: 'OK', onPress: () => {} },
  ])
  return
}

if (frequencyType === 'specific_days' && daysOfWeek.length === 0) {
  showAlert('Dias em falta', 'Escolhe pelo menos um dia da semana.', [
    { text: 'OK', onPress: () => {} },
  ])
  return
}
    try {
      setLoading(true)

await addSupplement(
  {
    name: name.trim(),
    brand: brand.trim() || null,
    main_ingredient: mainIngredient.trim() || null,
    dosage_amount: dosageAmount ? Number(dosageAmount) : null,
    dosage_unit: dosageUnit || null,
    active_ingredients: activeIngredients,
    serving_size: servingSize.trim() || null,
    ai_insights: aiInsights || null,
    container_quantity: containerQuantity ? Number(containerQuantity) : null,
    instructions_from_label: instructions.trim() || null,
    reminder_time: cleanedReminderTimes[0],
    reminder_times: cleanedReminderTimes,
    frequency_type: frequencyType,
    times_per_day: cleanedReminderTimes.length,
    days_of_week:
      frequencyType === 'specific_days'
        ? daysOfWeek
        : [1, 2, 3, 4, 5, 6, 0],
    start_date: getLocalDateString(),
    interval_days:
  frequencyType === 'custom_interval'
    ? Number(intervalDays || 1)
    : frequencyType === 'every_other_day'
      ? 2
      : null,
    is_active: true,
  },
  photoBase64
)

if (router.canGoBack()) {
  router.back()
} else {
  router.replace('/supplements' as any)
}
    } catch (error) {
      console.error('Erro ao guardar suplemento:', error)
      showAlert('Erro', 'Não foi possível guardar o suplemento.', [
        { text: 'OK', onPress: () => {} },
      ])
    } finally {
      setLoading(false)
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
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={22} color="white" />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Novo Suplemento</Text>
              <Text style={styles.subtitle}>
                Usa IA para ler o rótulo ou preenche manualmente.
              </Text>
            </View>
          </View>

          <View style={styles.aiCard}>
            <View style={styles.aiHeader}>
              <MaterialCommunityIcons
                name="robot-outline"
                size={28}
                color="#c4b5fd"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.aiTitle}>Análise inteligente</Text>
                <Text style={styles.aiSubtitle}>
                  Tira uma foto ao rótulo e a IA preenche os dados.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.aiButton, analyzing && styles.disabledButton]}
              onPress={handleTakeAndAnalyzePhoto}
              disabled={analyzing}
            >
              {analyzing ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={22} color="white" />
                  <Text style={styles.aiButtonText}>Tirar foto e analisar</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handlePickAndAnalyzeImage}
              disabled={analyzing}
            >
              <Ionicons name="image-outline" size={22} color="white" />
              <Text style={styles.secondaryButtonText}>Escolher da galeria</Text>
            </TouchableOpacity>
          </View>

          {photoBase64 ? (
            <Image
              source={{ uri: `data:image/jpeg;base64,${photoBase64}` }}
              style={styles.previewImage}
            />
          ) : null}

          {confidence !== null ? (
            <View style={styles.confidenceBox}>
              <Text style={styles.confidenceText}>
                Confiança IA: {Math.round(confidence * 100)}%
              </Text>
            </View>
          ) : null}

          {activeIngredients.length > 0 ? (
            <View style={styles.ingredientsBox}>
              <Text style={styles.ingredientsTitle}>Ingredientes detetados</Text>

              {activeIngredients.map((ingredient, index) => (
                <Text
                  key={`${ingredient.name}-${index}`}
                  style={styles.ingredientText}
                >
                  {ingredient.name}
                  {ingredient.amount ? ` • ${ingredient.amount}` : ''}
                  {ingredient.unit ? ` ${ingredient.unit}` : ''}
                </Text>
              ))}
            </View>
          ) : null}
{aiInsights && (
  <View style={styles.ingredientsBox}>
    <Text style={styles.ingredientsTitle}>Resumo IA</Text>

    {aiInsights.summary ? (
      <Text style={styles.ingredientText}>{aiInsights.summary}</Text>
    ) : null}

    {aiInsights.benefits?.length > 0 && (
      <>
        <Text style={styles.ingredientsTitle}>Benefícios</Text>
        {aiInsights.benefits.map((b: string, i: number) => (
          <Text key={i} style={styles.ingredientText}>• {b}</Text>
        ))}
      </>
    )}

    {aiInsights.cautions?.length > 0 && (
      <>
        <Text style={styles.ingredientsTitle}>Atenção</Text>
        {aiInsights.cautions.map((c: string, i: number) => (
          <Text key={i} style={styles.ingredientText}>• {c}</Text>
        ))}
      </>
    )}

    <Text style={{ color: '#94a3b8', marginTop: 10, fontSize: 12 }}>
      Informação geral. Não substitui aconselhamento médico.
    </Text>
  </View>
)}
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Dados do suplemento</Text>

            <TextInput
              style={styles.input}
              placeholder="Nome"
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
            />

            <TextInput
              style={styles.input}
              placeholder="Marca"
              placeholderTextColor="#94a3b8"
              value={brand}
              onChangeText={setBrand}
            />

            <TextInput
              style={styles.input}
              placeholder="Ingrediente principal"
              placeholderTextColor="#94a3b8"
              value={mainIngredient}
              onChangeText={setMainIngredient}
            />

            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.rowInput]}
                placeholder="Dosagem"
                placeholderTextColor="#94a3b8"
                value={dosageAmount}
                onChangeText={setDosageAmount}
                keyboardType="numeric"
              />

              <TextInput
                style={[styles.input, styles.rowInput]}
                placeholder="Unidade"
                placeholderTextColor="#94a3b8"
                value={dosageUnit}
                onChangeText={setDosageUnit}
              />
            </View>

            <TextInput
              style={styles.input}
              placeholder="Tamanho da toma"
              placeholderTextColor="#94a3b8"
              value={servingSize}
              onChangeText={setServingSize}
            />

            <View style={styles.routineBox}>
  <Text style={styles.routineTitle}>Rotina</Text>

  <View style={styles.optionGrid}>
    {[
  { label: 'Todos os dias', value: 'daily' },
  { label: 'Dias específicos', value: 'specific_days' },
  { label: 'Dia sim / dia não', value: 'every_other_day' },
  { label: 'Personalizado', value: 'custom_interval' },
].map((option) => (
      <TouchableOpacity
        key={option.value}
        style={[
          styles.optionChip,
          frequencyType === option.value && styles.optionChipActive,
        ]}
        onPress={() => setFrequencyType(option.value as SupplementFrequencyType)}
      >
        <Text
          style={[
            styles.optionChipText,
            frequencyType === option.value && styles.optionChipTextActive,
          ]}
        >
          {option.label}
        </Text>
      </TouchableOpacity>
    ))}
  </View>

  {frequencyType === 'specific_days' ? (
    <View style={styles.daysRow}>
      {[
        { label: 'D', value: 0 },
        { label: 'S', value: 1 },
        { label: 'T', value: 2 },
        { label: 'Q', value: 3 },
        { label: 'Q', value: 4 },
        { label: 'S', value: 5 },
        { label: 'S', value: 6 },
      ].map((day) => (
        <TouchableOpacity
          key={day.value}
          style={[
            styles.dayButton,
            daysOfWeek.includes(day.value) && styles.dayButtonActive,
          ]}
          onPress={() => toggleDay(day.value)}
        >
          <Text
            style={[
              styles.dayButtonText,
              daysOfWeek.includes(day.value) && styles.dayButtonTextActive,
            ]}
          >
            {day.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  ) : null}

  {frequencyType === 'custom_interval' ? (
    <TextInput
      style={styles.input}
      placeholder="Intervalo em dias. Ex: 3"
      placeholderTextColor="#94a3b8"
      value={intervalDays}
      onChangeText={setIntervalDays}
      keyboardType="numeric"
    />
  ) : null}

  <View style={styles.timesHeader}>
    <Text style={styles.timesTitle}>Horas das tomas</Text>

    <TouchableOpacity style={styles.smallAddButton} onPress={addReminderTime}>
      <Ionicons name="add" size={18} color="white" />
      <Text style={styles.smallAddButtonText}>Adicionar</Text>
    </TouchableOpacity>
  </View>

  {reminderTimes.length === 0 ? (
    <Text style={styles.emptyTimesText}>Adiciona pelo menos uma hora.</Text>
  ) : null}

  {reminderTimes.map((time, index) => (
    <View key={index} style={styles.timeRow}>
      <TouchableOpacity
        style={styles.timeButton}
        onPress={() => {
          setEditingTimeIndex(index)
          setShowTimePicker(true)
        }}
      >
        <Ionicons name="time-outline" size={20} color="#94a3b8" />
        <Text style={[styles.timeButtonText, !time && styles.timePlaceholder]}>
          {time || `Escolher hora ${index + 1}`}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.removeTimeButton}
        onPress={() => removeReminderTime(index)}
      >
        <Ionicons name="trash-outline" size={20} color="#fecaca" />
      </TouchableOpacity>
    </View>
  ))}

  {showTimePicker ? (
    <DateTimePicker
  value={(() => {
    const [h, m] = (reminderTimes[editingTimeIndex ?? 0] || '09:00')
      .split(':')
      .map(Number)

    const d = new Date()
    d.setHours(h || 9)
    d.setMinutes(m || 0)

    return d
  })()}
      mode="time"
      display="default"
      is24Hour
      onChange={handleTimeChange}
    />
  ) : null}
</View>

            <TextInput
              style={styles.input}
              placeholder="Quantidade na embalagem"
              placeholderTextColor="#94a3b8"
              value={containerQuantity}
              onChangeText={setContainerQuantity}
              keyboardType="numeric"
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Instruções do rótulo"
              placeholderTextColor="#94a3b8"
              value={instructions}
              onChangeText={setInstructions}
              multiline
            />

            <TouchableOpacity
              style={[styles.saveButton, loading && styles.disabledButton]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.saveButtonText}>Guardar suplemento</Text>
              )}
            </TouchableOpacity>
          </View>
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
  container: {
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
    marginBottom: 24,
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
    fontSize: 30,
    fontWeight: '900',
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  routineBox: {
  backgroundColor: 'rgba(30, 41, 59, 0.55)',
  borderWidth: 1,
  borderColor: '#334155',
  borderRadius: 20,
  padding: 14,
  marginBottom: 12,
},
routineTitle: {
  color: 'white',
  fontSize: 18,
  fontWeight: '900',
  marginBottom: 12,
},
optionGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
  marginBottom: 12,
},
optionChip: {
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderRadius: 14,
  backgroundColor: 'rgba(15, 23, 42, 0.85)',
  borderWidth: 1,
  borderColor: '#334155',
},
optionChipActive: {
  backgroundColor: '#7c3aed',
  borderColor: '#a78bfa',
},
optionChipText: {
  color: '#cbd5e1',
  fontSize: 13,
  fontWeight: '800',
},
optionChipTextActive: {
  color: 'white',
},
daysRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginBottom: 12,
},
dayButton: {
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: 'rgba(15, 23, 42, 0.85)',
  borderWidth: 1,
  borderColor: '#334155',
  justifyContent: 'center',
  alignItems: 'center',
},
dayButtonActive: {
  backgroundColor: '#22c55e',
  borderColor: '#86efac',
},
dayButtonText: {
  color: '#cbd5e1',
  fontWeight: '900',
},
dayButtonTextActive: {
  color: 'white',
},
timesHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 10,
},
timesTitle: {
  color: 'white',
  fontSize: 15,
  fontWeight: '900',
},
smallAddButton: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
  backgroundColor: '#22c55e',
  paddingHorizontal: 10,
  paddingVertical: 8,
  borderRadius: 12,
},
smallAddButtonText: {
  color: 'white',
  fontSize: 13,
  fontWeight: '900',
},
emptyTimesText: {
  color: '#94a3b8',
  fontSize: 14,
  marginBottom: 10,
},
timeRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
},
removeTimeButton: {
  width: 48,
  height: 50,
  borderRadius: 16,
  backgroundColor: 'rgba(239, 68, 68, 0.18)',
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: 12,
},
  timeButton: {
  backgroundColor: 'rgba(30, 41, 59, 0.95)',
  borderWidth: 1,
  borderColor: '#334155',
  borderRadius: 16,
  paddingHorizontal: 16,
  paddingVertical: 14,
  marginBottom: 12,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
},
timeButtonText: {
  color: 'white',
  fontSize: 16,
  fontWeight: '700',
},
timePlaceholder: {
  color: '#94a3b8',
  fontWeight: '500',
},
  aiCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 26,
    padding: 18,
    marginBottom: 18,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  aiTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
  },
  aiSubtitle: {
    color: '#cbd5e1',
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  aiButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: '#7c3aed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  aiButtonText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 16,
  },
  secondaryButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(51, 65, 85, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 16,
  },
  previewImage: {
    width: '100%',
    height: 210,
    borderRadius: 22,
    marginBottom: 16,
    backgroundColor: '#1e293b',
  },
  confidenceBox: {
    backgroundColor: 'rgba(34, 197, 94, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  confidenceText: {
    color: '#bbf7d0',
    fontSize: 14,
    fontWeight: '800',
  },
  ingredientsBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  ingredientsTitle: {
    color: 'white',
    fontWeight: '900',
    fontSize: 17,
    marginBottom: 10,
  },
  ingredientText: {
    color: '#cbd5e1',
    fontSize: 15,
    marginBottom: 5,
  },
  formCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 26,
    padding: 18,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 16,
  },
  input: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderWidth: 1,
    borderColor: '#334155',
    color: 'white',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowInput: {
    flex: 1,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#22c55e',
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 17,
  },
  disabledButton: {
    opacity: 0.65,
  },
})