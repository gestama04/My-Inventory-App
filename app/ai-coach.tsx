import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'

import {
  getAICoachReview,
  AICoachResult,
  AICoachMessage,
} from '../services/supplements/ai-coach-service'

function getIcon(type: AICoachMessage['type']): keyof typeof Ionicons.glyphMap {
  if (type === 'positive') return 'checkmark-circle-outline'
  if (type === 'warning') return 'warning-outline'
  if (type === 'timing') return 'time-outline'
  if (type === 'question') return 'help-circle-outline'
  return 'information-circle-outline'
}

export default function AICoachScreen() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [review, setReview] = useState<AICoachResult | null>(null)

  const handleGenerate = async () => {
    try {
      setLoading(true)
      const result = await getAICoachReview()
      setReview(result)
    } catch (error) {
      console.error('Erro no Coach IA:', error)
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
              <Text style={styles.title}>Coach IA</Text>
              <Text style={styles.subtitle}>
                Sugestões simples para melhorares a tua rotina.
              </Text>
            </View>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.logoCircle}>
              <Ionicons name="sparkles-outline" size={34} color="#071124" />
            </View>

            <Text style={styles.heroTitle}>Assistente VitaStreak</Text>
            <Text style={styles.heroText}>
              Analisa suplementos, horários, duplicações e pontos a confirmar.
            </Text>

            <Text style={styles.warningText}>
              Informação geral. Não substitui aconselhamento médico.
            </Text>

            <TouchableOpacity
              style={[styles.button, loading && styles.disabledButton]}
              onPress={handleGenerate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="chatbubble-ellipses-outline" size={22} color="white" />
                  <Text style={styles.buttonText}>Gerar sugestões</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {review ? (
            <>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Resumo</Text>
                <Text style={styles.summaryText}>{review.summary}</Text>
              </View>

              <View style={styles.resultsBox}>
                {review.messages.map((item, index) => (
                  <View key={`${item.title}-${index}`} style={styles.suggestionCard}>
                    <View style={styles.suggestionIcon}>
                      <Ionicons name={getIcon(item.type)} size={22} color="#c4b5fd" />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggestionTitle}>{item.title}</Text>
                      <Text style={styles.suggestionText}>{item.message}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <Text style={styles.disclaimer}>{review.disclaimer}</Text>
            </>
          ) : null}
        </ScrollView>
      </LinearGradient>
    </>
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
    borderRadius: 28,
    padding: 22,
    marginBottom: 18,
  },
  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#7dd3fc',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: '900',
  },
  heroText: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  warningText: {
    color: '#fde68a',
    fontSize: 13,
    marginTop: 12,
    fontWeight: '700',
    lineHeight: 19,
  },
  button: {
    marginTop: 18,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#7c3aed',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.65,
  },
  summaryCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
  },
  summaryTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  summaryText: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 21,
  },
  resultsBox: {
    gap: 12,
  },
  suggestionCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
  },
  suggestionIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(196,181,253,0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionTitle: {
    color: 'white',
    fontSize: 17,
    fontWeight: '900',
  },
  suggestionText: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  disclaimer: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 16,
    textAlign: 'center',
  },
})