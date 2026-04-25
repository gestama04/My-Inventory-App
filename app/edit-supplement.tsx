import React, { useEffect, useState } from 'react'
import {
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  View,
  StatusBar,
  Platform
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'

import {
  getSupplementById,
  updateSupplement,
} from '../services/supplements/supplement-service'
import { analyzeSupplementLabel } from '../services/supplements/gemini-supplement-service'
import { getSupplementSuggestion } from '../services/supplements/supplement-suggestions'
import useCustomAlert from '../hooks/useCustomAlert'

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

export default function EditSupplementScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { showAlert, AlertComponent } = useCustomAlert()

  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [mainIngredient, setMainIngredient] = useState('')
  const [dosageAmount, setDosageAmount] = useState('')
  const [dosageUnit, setDosageUnit] = useState('mg')
  const [servingSize, setServingSize] = useState('')
  const [instructions, setInstructions] = useState('')
  const [reminderTime, setReminderTime] = useState('09:00')
  const [containerQuantity, setContainerQuantity] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoBase64, setPhotoBase64] = useState('')
  const [confidence, setConfidence] = useState<number | null>(null)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [activeIngredients, setActiveIngredients] = useState<
    { name: string; amount: number | null; unit: string | null }[]
  >([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const handleTimeChange = (_event: any, selectedDate?: Date) => {
  if (Platform.OS === 'android') {
    setShowTimePicker(false)
  }

  if (!selectedDate) return

  const hours = String(selectedDate.getHours()).padStart(2, '0')
  const minutes = String(selectedDate.getMinutes()).padStart(2, '0')

  setReminderTime(`${hours}:${minutes}`)
}

  useEffect(() => {
    const loadSupplement = async () => {
      if (!id) return

      try {
        setLoading(true)

        const supplement = await getSupplementById(id)

        setName(supplement.name ?? '')
        setBrand(supplement.brand ?? '')
        setMainIngredient(supplement.main_ingredient ?? '')

        setDosageAmount(
          supplement.dosage_amount !== null &&
            supplement.dosage_amount !== undefined
            ? String(supplement.dosage_amount)
            : ''
        )

        setDosageUnit(
          supplement.dosage_unit ? String(supplement.dosage_unit) : 'mg'
        )

        setServingSize(supplement.serving_size ?? '')
        setInstructions(supplement.instructions_from_label ?? '')

        setReminderTime(
          supplement.reminder_time
            ? supplement.reminder_time.slice(0, 5)
            : '09:00'
        )

        setContainerQuantity(
          supplement.container_quantity !== null &&
            supplement.container_quantity !== undefined
            ? String(supplement.container_quantity)
            : ''
        )

        setPhotoUrl(supplement.photo_url ?? null)
        setActiveIngredients(supplement.active_ingredients ?? [])
      } catch (error) {
        console.error('Erro ao carregar suplemento:', error)
        showAlert('Erro', 'Não foi possível carregar o suplemento.', [
          { text: 'OK', onPress: () => router.back() },
        ])
      } finally {
        setLoading(false)
      }
    }

    loadSupplement()
  }, [id])

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
      setPhotoUrl(null)

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

      setReminderTime(suggestion.reminderTime)

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

  const handleSave = async () => {
    if (!id) return

    if (!name.trim()) {
      showAlert('Nome em falta', 'Insere pelo menos o nome do suplemento.', [
        { text: 'OK', onPress: () => {} },
      ])
      return
    }

    try {
      setSaving(true)

      await updateSupplement(
        id,
        {
          name: name.trim(),
          brand: brand.trim() || null,
          main_ingredient: mainIngredient.trim() || null,
          dosage_amount: dosageAmount ? Number(dosageAmount) : null,
          dosage_unit: dosageUnit || null,
          active_ingredients: activeIngredients,
          serving_size: servingSize.trim() || null,
          container_quantity: containerQuantity
            ? Number(containerQuantity)
            : null,
          instructions_from_label: instructions.trim() || null,
          reminder_time: reminderTime,
          days_of_week: [1, 2, 3, 4, 5, 6, 0],
          is_active: true,
        },
        photoBase64 || undefined
      )

      router.replace('/supplements' as any)
    } catch (error) {
      console.error('Erro ao atualizar suplemento:', error)
      showAlert('Erro', 'Não foi possível atualizar o suplemento.', [
        { text: 'OK', onPress: () => {} },
      ])
    } finally {
      setSaving(false)
    }
  }

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
          <Text style={styles.loadingText}>A carregar suplemento...</Text>
          <AlertComponent />
        </LinearGradient>
      </>
    )
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
              <Text style={styles.title}>Editar suplemento</Text>
              <Text style={styles.subtitle}>
                Atualiza os dados, muda a foto ou volta a analisar o rótulo.
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
                <Text style={styles.aiTitle}>Nova análise inteligente</Text>
                <Text style={styles.aiSubtitle}>
                  Tira uma nova foto ao rótulo para substituir os dados atuais.
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
                  <Text style={styles.aiButtonText}>Tirar nova foto e analisar</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handlePickAndAnalyzeImage}
              disabled={analyzing}
            >
              <Ionicons name="image-outline" size={22} color="white" />
              <Text style={styles.secondaryButtonText}>Escolher nova imagem</Text>
            </TouchableOpacity>
          </View>

          {photoBase64 ? (
            <Image
              source={{ uri: `data:image/jpeg;base64,${photoBase64}` }}
              style={styles.previewImage}
            />
          ) : photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.previewImage} />
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

            <TouchableOpacity
  style={styles.timeInput}
  onPress={() => setShowTimePicker(true)}
>
  <Text style={reminderTime ? styles.timeText : styles.timePlaceholder}>
    {reminderTime || 'Escolher hora'}
  </Text>
  <Ionicons name="time-outline" size={22} color="#94a3b8" />
</TouchableOpacity>

{showTimePicker ? (
  <DateTimePicker
    value={(() => {
      const [hours, minutes] = (reminderTime || '09:00').split(':').map(Number)
      const date = new Date()
      date.setHours(hours || 9)
      date.setMinutes(minutes || 0)
      return date
    })()}
    mode="time"
    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
    is24Hour
    onChange={handleTimeChange}
    themeVariant="dark"
  />
) : null}

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
              style={[styles.saveButton, saving && styles.disabledButton]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.saveButtonText}>Guardar alterações</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#cbd5e1',
    marginTop: 14,
    fontSize: 15,
    fontWeight: '700',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 58,
    paddingBottom: 36,
  },
  timeInput: {
  backgroundColor: 'rgba(30, 41, 59, 0.95)',
  borderWidth: 1,
  borderColor: '#334155',
  borderRadius: 16,
  paddingHorizontal: 16,
  paddingVertical: 14,
  marginBottom: 12,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},
timeText: {
  color: 'white',
  fontSize: 16,
},
timePlaceholder: {
  color: '#94a3b8',
  fontSize: 16,
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