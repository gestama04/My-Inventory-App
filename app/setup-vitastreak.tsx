import React, { useState } from 'react'
import { useRouter } from 'expo-router'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Switch,
  Platform,
  Linking,
  Image,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useTheme } from '../app/theme-context'
import useCustomAlert from '../hooks/useCustomAlert'

interface InitialSetupScreenProps {
  onComplete: () => void
}

export default function InitialSetupScreen({ onComplete }: InitialSetupScreenProps) {
  const { currentTheme } = useTheme()
  const { showAlert, AlertComponent } = useCustomAlert()
  const router = useRouter()
  const [acceptedLegal, setAcceptedLegal] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  const handleSaveSettings = async () => {
  if (!acceptedLegal) {
    showAlert(
      'Aceitação necessária',
      'Tens de aceitar a Política de Privacidade e os Termos de Utilização para continuar.',
      [{ text: 'OK', onPress: () => {} }]
    )
    return
  }

  setIsLoading(true)

  try {
      showAlert(
        'Configuração completa!',
        'O VitaStreak está pronto. Podes adicionar suplementos, definir horários e receber lembretes.',
        [{ text: 'Continuar', onPress: onComplete }]
      )
    } catch (error) {
      console.error('Erro no setup:', error)
      onComplete()
    } finally {
      setIsLoading(false)
    }
  }

  const renderWelcomeSlide = () => (
    <View style={styles.slideContainer}>
      <View style={styles.header}>
        <Image
          source={require('../assets/images/vitastreak-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={[styles.title, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
          Configurar VitaStreak
        </Text>

        <Text style={[styles.subtitle, currentTheme === 'dark' ? styles.darkTextSecondary : styles.lightTextSecondary]}>
          Vamos preparar a tua rotina em 2 passos simples.
        </Text>
      </View>

      <View style={styles.welcomeContent}>
        <MaterialCommunityIcons name="pill" size={78} color="#7c3aed" />

        <Text style={[styles.welcomeTitle, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
          Bem-vindo!
        </Text>

        <Text style={[styles.welcomeDescription, currentTheme === 'dark' ? styles.darkTextSecondary : styles.lightTextSecondary]}>
          Configura lembretes, acompanha as tomas diárias e mantém a tua rotina de suplementos em dia.
        </Text>

        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <MaterialCommunityIcons name="calendar-check" size={24} color="#22c55e" />
            <Text style={[styles.featureText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
              Rotina diária
            </Text>
          </View>

          <View style={styles.featureItem}>
            <MaterialCommunityIcons name="bell-ring" size={24} color="#f59e0b" />
            <Text style={[styles.featureText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
              Lembretes personalizados
            </Text>
          </View>

          <View style={styles.featureItem}>
            <MaterialCommunityIcons name="robot-outline" size={24} color="#38bdf8" />
            <Text style={[styles.featureText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
              Análise por IA
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.nextButton} onPress={() => setCurrentStep(2)}>
        <Text style={styles.nextButtonText}>Começar configuração</Text>
        <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  )

const openBatterySettings = async () => {
  if (Platform.OS !== 'android') return

  try {
    await Linking.openSettings()
  } catch (error) {
    console.error('Erro ao abrir definições:', error)
  }
}

const renderNotificationSettings = () => (
  <View style={styles.slideContainer}>
    <View>
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={styles.progressFill} />
        </View>
        <Text style={[styles.progressText, currentTheme === 'dark' ? styles.darkTextSecondary : styles.lightTextSecondary]}>
          Passo 2 de 2
        </Text>
      </View>

      <View style={styles.stepHeader}>
        <MaterialCommunityIcons name="bell-ring" size={70} color="#7c3aed" />

        <Text style={[styles.stepTitle, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
          Notificações
        </Text>

        <Text style={[styles.stepDescription, currentTheme === 'dark' ? styles.darkTextSecondary : styles.lightTextSecondary]}>
          Recebe lembretes à hora definida em cada suplemento.
        </Text>
      </View>

      <View style={[styles.settingCard, currentTheme === 'dark' ? styles.darkCard : styles.lightCard]}>
        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingLabel, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
              Ativar lembretes
            </Text>
            <Text style={[styles.settingHelper, currentTheme === 'dark' ? styles.darkTextSecondary : styles.lightTextSecondary]}>
              Podes alterar isto mais tarde nas definições.
            </Text>
          </View>

          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#64748b', true: '#7c3aed' }}
            thumbColor={notificationsEnabled ? '#22c55e' : '#f4f3f4'}
          />
        </View>

        <View style={styles.legalBox}>
          <TouchableOpacity onPress={() => router.push('/legal-vitastreak' as any)}>
            <Text style={styles.legalLink}>Ver Política de Privacidade e Termos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.legalRow}
            onPress={() => setAcceptedLegal(!acceptedLegal)}
          >
            <View style={[styles.checkbox, acceptedLegal && styles.checkboxActive]}>
              {acceptedLegal ? (
                <MaterialCommunityIcons name="check" size={16} color="white" />
              ) : null}
            </View>

            <Text style={[styles.legalText, currentTheme === 'dark' ? styles.darkTextSecondary : styles.lightTextSecondary]}>
              Li e aceito a Política de Privacidade e os Termos de Utilização.
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <MaterialCommunityIcons name="clock-outline" size={22} color="#38bdf8" />
          <Text style={styles.infoText}>
            Ao adicionares um suplemento, escolhes a hora e os dias da semana.
          </Text>
        </View>
        {Platform.OS === 'android' ? (
  <View style={styles.infoBox}>
    <MaterialCommunityIcons name="battery-heart" size={22} color="#facc15" />
    <View style={{ flex: 1 }}>
      <Text style={styles.infoText}>
        Para lembretes mais fiáveis, recomendamos definir a bateria como “Sem restrições”.
      </Text>

      <TouchableOpacity style={styles.batteryButton} onPress={openBatterySettings}>
        <Text style={styles.batteryButtonText}>Melhorar notificações</Text>
      </TouchableOpacity>
    </View>
  </View>
) : null}
      </View>
    </View>
    <View>
      <View style={styles.stepButtons}>
        <TouchableOpacity style={styles.backButton} onPress={() => setCurrentStep(1)}>
          <MaterialCommunityIcons name="arrow-left" size={20} color="#7c3aed" />
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.finishButton, isLoading && styles.disabledButton]}
          onPress={handleSaveSettings}
          disabled={isLoading}
        >
          <Text style={styles.finishButtonText}>
            {isLoading ? 'A guardar...' : 'Concluir'}
          </Text>
          <MaterialCommunityIcons name="check" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  </View>
)


  return (
    <SafeAreaView style={[styles.container, currentTheme === 'dark' ? styles.darkContainer : styles.lightContainer]}>
      <StatusBar barStyle={currentTheme === 'dark' ? 'light-content' : 'dark-content'} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {currentStep === 1 ? renderWelcomeSlide() : renderNotificationSettings()}
      </ScrollView>

      <AlertComponent />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  darkContainer: { backgroundColor: '#0f172a' },
  lightContainer: { backgroundColor: '#f8fafc' },
  scrollContent: {
  flexGrow: 1,
  padding: 20,
  paddingTop: 22,
  paddingBottom: 24,
},
  slideContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  legalBox: {
  marginTop: 16,
  marginBottom: 0,
},
legalRow: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  gap: 10,
  marginBottom: 10,
},
checkbox: {
  width: 24,
  height: 24,
  borderRadius: 7,
  borderWidth: 2,
  borderColor: '#7c3aed',
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 1,
},
checkboxActive: {
  backgroundColor: '#7c3aed',
},
batteryButton: {
  marginTop: 10,
  backgroundColor: 'rgba(255, 0, 0, 0.18)',
  borderWidth: 1,
  borderColor: 'rgba(255, 0, 0, 0.45)',
  borderRadius: 14,
  paddingVertical: 10,
  paddingHorizontal: 12,
  alignSelf: 'flex-start',
},
batteryButtonText: {
  color: '#ff0000',
  fontSize: 13,
  fontWeight: '900',
},
legalText: {
  flex: 1,
  fontSize: 14,
  lineHeight: 20,
},
legalLink: {
  color: '#67e8f9',
  fontSize: 14,
  fontWeight: '800',
  textDecorationLine: 'underline',
  marginBottom: 14
},
  logo: {
    width: 120,
    height: 120,
    marginBottom: 18,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 24,
  },
  welcomeContent: {
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 20,
    marginBottom: 12,
  },
  welcomeDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 34,
  },
  featuresList: {
    width: '100%',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 14,
  },
  progressContainer: {
  marginBottom: 20,
},
  progressBar: {
    height: 5,
    backgroundColor: 'rgba(124, 58, 237, 0.18)',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    width: '100%',
    backgroundColor: '#7c3aed',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    textAlign: 'center',
  },
  stepHeader: {
  alignItems: 'center',
  marginBottom: 22,
},
  stepTitle: {
  fontSize: 30,
  fontWeight: '900',
  marginTop: 12,
  marginBottom: 8,
  textAlign: 'center',
},
stepDescription: {
  fontSize: 15,
  textAlign: 'center',
  lineHeight: 22,
},
settingCard: {
  borderRadius: 22,
  padding: 18,
  marginBottom: 18,
},
  darkCard: { backgroundColor: '#1e293b' },
  lightCard: { backgroundColor: '#ffffff' },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  settingHelper: {
    fontSize: 14,
    lineHeight: 20,
  },
  infoBox: {
  flexDirection: 'row',
  backgroundColor: 'rgba(56, 189, 248, 0.12)',
  borderRadius: 16,
  padding: 12,
  marginTop: 12,
  gap: 10,
},
  infoText: {
    flex: 1,
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },
  nextButton: {
    backgroundColor: '#7c3aed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 18,
    gap: 8,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  stepButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#7c3aed',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  backButtonText: {
    color: '#7c3aed',
    fontSize: 16,
    fontWeight: '800',
  },
  finishButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.6,
  },
  skipButton: {
    alignItems: 'center',
    padding: 16,
    marginTop: 12,
  },
  skipText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  darkText: { color: '#ffffff' },
  lightText: { color: '#0f172a' },
  darkTextSecondary: { color: '#cbd5e1' },
  lightTextSecondary: { color: '#475569' },
})