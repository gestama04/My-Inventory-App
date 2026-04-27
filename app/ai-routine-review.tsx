import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'

import { getSupplements } from '../services/supplements/supplement-service'
import {
  AIRoutineReview,
  reviewSupplementRoutine,
} from '../services/supplements/ai-routine-review-service'
import useCustomAlert from '../hooks/useCustomAlert'

export default function AIRoutineReviewScreen() {
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()

  const [loading, setLoading] = useState(false)
  const [review, setReview] = useState<AIRoutineReview | null>(null)

  const handleAnalyze = async () => {
    try {
      setLoading(true)

      const supplements = await getSupplements()

      if (supplements.length === 0) {
        showAlert(
          'Sem suplementos',
          'Adiciona suplementos antes de gerar uma análise da rotina.',
          [{ text: 'OK', onPress: () => {} }]
        )
        return
      }

      const result = await reviewSupplementRoutine(supplements)
      setReview(result)
    } catch (error) {
      console.error('Erro na análise IA da rotina:', error)
      showAlert('Erro', 'Não foi possível gerar a análise IA.', [
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
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="white" />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Análise IA</Text>
              <Text style={styles.subtitle}>
                Um resumo geral da tua rotina de suplementos.
              </Text>
            </View>
          </View>

          <View style={styles.heroCard}>
            <MaterialCommunityIcons name="robot-happy-outline" size={38} color="#c4b5fd" />
            <Text style={styles.heroTitle}>Revisão inteligente da rotina</Text>
            <Text style={styles.heroText}>
              A IA analisa os suplementos guardados, horários, ingredientes e possíveis
              pontos a confirmar.
            </Text>

            <Text style={styles.warningText}>
              Informação geral. Não substitui aconselhamento médico.
            </Text>

            <TouchableOpacity
              style={[styles.analyzeButton, loading && styles.disabledButton]}
              onPress={handleAnalyze}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="sparkles-outline" size={22} color="white" />
                  <Text style={styles.analyzeButtonText}>Analisar rotina</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {review ? (
            <>
              <Section title="Resumo" items={[review.summary]} />

              <Section title="Pontos positivos" items={review.positives} />

              <Section title="A confirmar" items={review.pointsToCheck} danger />

              <Section title="Horários e rotina" items={review.timingNotes} />

              <Section
                title="Perguntas para o profissional de saúde"
                items={review.professionalQuestions}
              />

              <View style={styles.disclaimerBox}>
                <Text style={styles.disclaimerText}>{review.disclaimer}</Text>
              </View>
            </>
          ) : null}
        </ScrollView>

        <AlertComponent />
      </LinearGradient>
    </>
  )
}

function Section({
  title,
  items,
  danger,
}: {
  title: string
  items: string[]
  danger?: boolean
}) {
  if (!items || items.length === 0) return null

  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>

      {items.map((item, index) => (
        <Text key={index} style={[styles.sectionText, danger && styles.dangerText]}>
          • {item}
        </Text>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  content: {
    padding: 20,
    paddingTop: 58,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: 'white',
    fontSize: 34,
    fontWeight: '900',
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  heroCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 26,
    padding: 20,
    marginBottom: 18,
  },
  heroTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 12,
  },
  heroText: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  warningText: {
    color: '#fef3c7',
    fontSize: 13,
    marginTop: 12,
    fontWeight: '700',
  },
  analyzeButton: {
    marginTop: 18,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#7c3aed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  analyzeButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.65,
  },
  sectionCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 19,
    fontWeight: '900',
    marginBottom: 10,
  },
  sectionText: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 6,
  },
  dangerText: {
    color: '#fecaca',
  },
  disclaimerBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderRadius: 18,
    padding: 14,
  },
  disclaimerText: {
    color: '#fde68a',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
})