import React, { useEffect, useState } from 'react'
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  View,
  StatusBar,
} from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'

import { useAuth } from '../auth-context'
import useCustomAlert from '../hooks/useCustomAlert'

const DEFAULT_BIRTH_DATE = new Date(1990, 0, 1)
const MIN_BIRTH_DATE = new Date(1900, 0, 1)

export default function RegisterScreen() {
  const router = useRouter()
  const { register, checkEmailExists } = useAuth()
  const { showAlert, AlertComponent } = useCustomAlert()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [birthDate, setBirthDate] = useState<Date | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false)

  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    hasMinLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
  })

  useEffect(() => {
    const hasMinLength = password.length >= 8
    const hasUpperCase = /[A-Z]/.test(password)
    const hasLowerCase = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    const hasSpecialChar = /[!@#€£$%^&*(),.?":{}|<>]/.test(password)

    let score = 0
    if (hasMinLength) score++
    if (hasUpperCase) score++
    if (hasLowerCase) score++
    if (hasNumber) score++
    if (hasSpecialChar) score++

    setPasswordStrength({
      score,
      hasMinLength,
      hasUpperCase,
      hasLowerCase,
      hasNumber,
      hasSpecialChar,
    })
  }, [password])

  const formatDate = (date: Date | null) => {
    if (!date) return ''
    return `${date.getDate().toString().padStart(2, '0')}/${(
      date.getMonth() + 1
    )
      .toString()
      .padStart(2, '0')}/${date.getFullYear()}`
  }

  const getPasswordStrengthLabel = () => {
    const score = passwordStrength.score
    if (score <= 1) return { label: 'Fraca', color: '#ef4444' }
    if (score === 2) return { label: 'Razoável', color: '#f59e0b' }
    if (score === 3) return { label: 'Boa', color: '#eab308' }
    if (score === 4) return { label: 'Forte', color: '#22c55e' }
    return { label: 'Muito forte', color: '#10b981' }
  }

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !confirmPassword) {
      showAlert('Erro', 'Por favor, preenche todos os campos obrigatórios.', [
        { text: 'OK', onPress: () => {} },
      ])
      return
    }

    if (password !== confirmPassword) {
      showAlert('Erro', 'As passwords não coincidem.', [
        { text: 'OK', onPress: () => {} },
      ])
      return
    }

    if (passwordStrength.score < 5) {
      showAlert(
        'Password incompleta',
        'A password deve ter pelo menos 8 caracteres, maiúscula, minúscula, número e caractere especial.',
        [{ text: 'OK', onPress: () => {} }]
      )
      return
    }

    setIsLoading(true)

    try {
      const emailExists = await checkEmailExists(email.trim())

      if (emailExists) {
        showAlert('Email já registado', 'Este email já está em uso. Queres fazer login?', [
          { text: 'Não', style: 'cancel', onPress: () => {} },
          { text: 'Sim', onPress: () => router.replace('/login-vitastreak' as any) },
        ])
        return
      }

      await register(email.trim(), password, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        birthDate: birthDate ? formatDate(birthDate) : undefined,
      })

      showAlert(
  'Conta criada',
  'Enviámos um email de confirmação. Confirma o email antes de iniciar sessão.',
  [{ text: 'OK', onPress: () => router.replace('/login-vitastreak' as any) }]
)
    } catch (error: any) {
      console.error('Erro de registo:', error)

      let errorMessage = 'Não foi possível criar a conta.'

      if (error?.message?.includes('email-already-in-use')) {
        errorMessage = 'Este email já está em uso.'
      } else if (error?.message?.includes('invalid-email')) {
        errorMessage = 'Email inválido.'
      } else if (error?.message?.includes('weak-password')) {
        errorMessage = 'A password é muito fraca.'
      }

      showAlert('Erro de registo', errorMessage, [{ text: 'OK', onPress: () => {} }])
    } finally {
      setIsLoading(false)
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          <KeyboardAwareScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            enableOnAndroid
            extraScrollHeight={30}
          >
            <View style={styles.logoContainer}>
              <Image
                source={require('../assets/images/vitastreak-logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />

              <Text style={styles.title}>Criar conta</Text>
              <Text style={styles.subtitle}>
                Começa a acompanhar a tua rotina VitaStreak.
              </Text>
            </View>

            <View style={styles.card}>
              <TextInput
                style={styles.input}
                placeholder="Nome"
                placeholderTextColor="#94a3b8"
                value={firstName}
                onChangeText={setFirstName}
              />

              <TextInput
                style={styles.input}
                placeholder="Sobrenome"
                placeholderTextColor="#94a3b8"
                value={lastName}
                onChangeText={setLastName}
              />

              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={birthDate ? styles.dateText : styles.placeholderText}>
                  {birthDate ? formatDate(birthDate) : 'Data de nascimento (opcional)'}
                </Text>
                <Ionicons name="calendar-outline" size={22} color="#94a3b8" />
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
  value={birthDate || DEFAULT_BIRTH_DATE}
  mode="date"
  display="default"
  minimumDate={MIN_BIRTH_DATE}
  maximumDate={new Date()}
  onChange={(event, selectedDate) => {
    setShowDatePicker(false)
    if (selectedDate) setBirthDate(selectedDate)
  }}
/>
              )}

              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Password"
                  placeholderTextColor="#94a3b8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  onFocus={() => setShowPasswordRequirements(true)}
                />

                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={23}
                    color="#94a3b8"
                  />
                </TouchableOpacity>
              </View>

              {password.length > 0 && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBar}>
                    {[1, 2, 3, 4, 5].map((level) => (
                      <View
                        key={level}
                        style={[
                          styles.strengthSegment,
                          {
                            backgroundColor:
                              level <= passwordStrength.score
                                ? getPasswordStrengthLabel().color
                                : '#334155',
                          },
                        ]}
                      />
                    ))}
                  </View>

                  <Text
                    style={[
                      styles.strengthText,
                      { color: getPasswordStrengthLabel().color },
                    ]}
                  >
                    {getPasswordStrengthLabel().label}
                  </Text>
                </View>
              )}

              {showPasswordRequirements && (
                <View style={styles.requirementsContainer}>
                  <Text style={styles.requirementsTitle}>A password deve conter:</Text>

                  <Requirement ok={passwordStrength.hasMinLength} text="Pelo menos 8 caracteres" />
                  <Requirement ok={passwordStrength.hasUpperCase} text="Uma letra maiúscula" />
                  <Requirement ok={passwordStrength.hasLowerCase} text="Uma letra minúscula" />
                  <Requirement ok={passwordStrength.hasNumber} text="Um número" />
                  <Requirement ok={passwordStrength.hasSpecialChar} text="Um caractere especial" />
                </View>
              )}

              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Confirmar password"
                  placeholderTextColor="#94a3b8"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                />

                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off' : 'eye'}
                    size={23}
                    color="#94a3b8"
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.button, isLoading && styles.disabledButton]}
                onPress={handleRegister}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.buttonText}>Registar</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.loginLink}
                onPress={() => router.push('/login-vitastreak' as any)}
              >
                <Text style={styles.loginText}>Já tens conta? Fazer login</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAwareScrollView>

          <AlertComponent />
        </KeyboardAvoidingView>
      </LinearGradient>
    </>
  )
}

function Requirement({ ok, text }: { ok: boolean; text: string }) {
  return (
    <View style={styles.requirementItem}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'close-circle'}
        size={16}
        color={ok ? '#22c55e' : '#ef4444'}
      />
      <Text style={styles.requirementText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 22,
    paddingVertical: 50,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 104,
    height: 104,
    marginBottom: 12,
  },
  title: {
    color: 'white',
    fontSize: 34,
    fontWeight: '900',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 26,
    padding: 22,
  },
  input: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderWidth: 1,
    borderColor: '#334155',
    color: 'white',
    height: 54,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 14,
  },
  datePickerButton: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderWidth: 1,
    borderColor: '#334155',
    height: 54,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    color: 'white',
    fontSize: 16,
  },
  placeholderText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 14,
  },
  passwordInput: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderWidth: 1,
    borderColor: '#334155',
    color: 'white',
    height: 54,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingRight: 52,
    fontSize: 16,
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 15,
  },
  strengthContainer: {
    marginBottom: 14,
  },
  strengthBar: {
    flexDirection: 'row',
    height: 5,
    marginBottom: 7,
  },
  strengthSegment: {
    flex: 1,
    marginHorizontal: 2,
    borderRadius: 10,
  },
  strengthText: {
    fontSize: 12,
    textAlign: 'right',
    fontWeight: '800',
  },
  requirementsContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.72)',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },
  requirementsTitle: {
    color: 'white',
    fontWeight: '800',
    marginBottom: 8,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  requirementText: {
    color: '#cbd5e1',
    marginLeft: 7,
    fontSize: 13,
  },
  button: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  disabledButton: {
    opacity: 0.65,
  },
  buttonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '900',
  },
  loginLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  loginText: {
    color: '#cbd5e1',
    fontSize: 15,
    fontWeight: '700',
  },
})