import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image
} from 'react-native'
import { useRouter } from 'expo-router'
import { addSupplement } from '../services/supplements/supplement-service'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import { analyzeSupplementLabel } from '../services/supplements/gemini-supplement-service'
import { getSupplementSuggestion } from '../services/supplements/supplement-suggestions'

export default function AddSupplementScreen() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [mainIngredient, setMainIngredient] = useState('')
  const [dosageAmount, setDosageAmount] = useState('')
  const [dosageUnit, setDosageUnit] = useState('mg')
  const [servingSize, setServingSize] = useState('')
  const [instructions, setInstructions] = useState('')
  const [reminderTime, setReminderTime] = useState('09:00')
  const [loading, setLoading] = useState(false)
  const [photoBase64, setPhotoBase64] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [confidence, setConfidence] = useState<number | null>(null)

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
    setInstructions(analysis.instructionsFromLabel ?? '')
    setConfidence(analysis.confidence)

    const suggestion = getSupplementSuggestion({
  name: analysis.name ?? '',
  mainIngredient: analysis.mainIngredient ?? '',
  dosageAmount: analysis.dosageAmount,
  dosageUnit: analysis.dosageUnit,
})

setReminderTime(suggestion.reminderTime)

if (suggestion.caution) {
  alert(`${suggestion.note}\n\n${suggestion.caution}`)
} else {
  alert(suggestion.note)
}

    if (analysis.confidence < 0.7) {
      alert('A IA não teve muita confiança. Confirma os campos manualmente.')
    }
  } catch (error) {
    console.error('Erro ao analisar imagem:', error)
    alert('Não foi possível analisar a imagem.')
  } finally {
    setAnalyzing(false)
  }
}

const handlePickAndAnalyzeImage = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()

  if (status !== 'granted') {
    alert('É necessário acesso à galeria.')
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
    alert('É necessário acesso à câmara.')
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
    if (!name.trim()) return

    try {
      setLoading(true)

      await addSupplement(
  {
        name: name.trim(),
        brand: brand.trim() || null,
        main_ingredient: mainIngredient.trim() || null,
        dosage_amount: dosageAmount ? Number(dosageAmount) : null,
        dosage_unit: dosageUnit || null,
        serving_size: servingSize.trim() || null,
        container_quantity: null,
        instructions_from_label: instructions.trim() || null,
        reminder_time: reminderTime,
        days_of_week: [1, 2, 3, 4, 5, 6, 0],
        is_active: true,
      },
  photoBase64
)

      router.replace('/supplements')
    } catch (error) {
      console.error('Erro ao guardar suplemento:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Adicionar suplemento</Text>

      <TouchableOpacity
  style={styles.aiButton}
  onPress={handleTakeAndAnalyzePhoto}
  disabled={analyzing}
>
  <Text style={styles.aiButtonText}>
    {analyzing ? 'A analisar...' : 'Tirar foto e analisar'}
  </Text>
</TouchableOpacity>

<TouchableOpacity
  style={styles.secondaryButton}
  onPress={handlePickAndAnalyzeImage}
  disabled={analyzing}
>
  <Text style={styles.secondaryButtonText}>
    Escolher da galeria
  </Text>
</TouchableOpacity>

{photoBase64 ? (
  <Image
    source={{ uri: `data:image/jpeg;base64,${photoBase64}` }}
    style={styles.previewImage}
  />
) : null}

{confidence !== null ? (
  <Text style={styles.confidenceText}>
    Confiança IA: {Math.round(confidence * 100)}%
  </Text>
) : null}

      <TextInput style={styles.input} placeholder="Nome" placeholderTextColor="#64748b" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Marca" placeholderTextColor="#64748b" value={brand} onChangeText={setBrand} />
      <TextInput style={styles.input} placeholder="Ingrediente principal" placeholderTextColor="#64748b" value={mainIngredient} onChangeText={setMainIngredient} />
      <TextInput style={styles.input} placeholder="Dosagem" placeholderTextColor="#64748b" value={dosageAmount} onChangeText={setDosageAmount} keyboardType="numeric" />
      <TextInput style={styles.input} placeholder="Unidade: mg, mcg, IU..." placeholderTextColor="#64748b" value={dosageUnit} onChangeText={setDosageUnit} />
      <TextInput style={styles.input} placeholder="Tamanho da toma" placeholderTextColor="#64748b" value={servingSize} onChangeText={setServingSize} />
      <TextInput style={styles.input} placeholder="Hora: 09:00" placeholderTextColor="#64748b" value={reminderTime} onChangeText={setReminderTime} />
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Instruções do rótulo"
        placeholderTextColor="#64748b"
        value={instructions}
        onChangeText={setInstructions}
        multiline
      />

      <TouchableOpacity style={styles.button} onPress={handleSave} disabled={loading}>
        {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Guardar</Text>}
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    color: 'white',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    color: 'white',
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 17,
  },
  secondaryButton: {
  backgroundColor: '#334155',
  padding: 16,
  borderRadius: 16,
  alignItems: 'center',
  marginBottom: 16,
},
secondaryButtonText: {
  color: 'white',
  fontWeight: '800',
  fontSize: 16,
},
  aiButton: {
  backgroundColor: '#7c3aed',
  padding: 16,
  borderRadius: 16,
  alignItems: 'center',
  marginBottom: 16,
},
aiButtonText: {
  color: 'white',
  fontWeight: '800',
  fontSize: 16,
},
previewImage: {
  width: '100%',
  height: 200,
  borderRadius: 16,
  marginBottom: 16,
  backgroundColor: '#1e293b',
},
confidenceText: {
  color: '#cbd5e1',
  marginBottom: 16,
  fontSize: 14,
}
})