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
import { withTimeout } from '../utils/withTimeout'
import { Stack, useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import * as Linking from 'expo-linking'
import { supabase } from '../supabase-config'
import useCustomAlert from '../hooks/useCustomAlert'

export default function ResetPasswordScreen() {
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false)
  const [recoveryReady, setRecoveryReady] = useState(false)
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

  const getPasswordStrengthLabel = () => {
    const score = passwordStrength.score
    if (score <= 1) return { label: 'Fraca', color: '#ef4444' }
    if (score === 2) return { label: 'Razoável', color: '#f59e0b' }
    if (score === 3) return { label: 'Boa', color: '#eab308' }
    if (score === 4) return { label: 'Forte', color: '#22c55e' }
    return { label: 'Muito forte', color: '#10b981' }
  }

useEffect(() => {
  const handleUrl = async (url: string | null) => {
    try {
      console.log('RESET URL:', url)

      if (!url) return

      const parsed = Linking.parse(url)
      
      console.log('RESET PARSED:', JSON.stringify(parsed, null, 2))
      console.log('RESET QUERY PARAMS:', parsed.queryParams)
      console.log('RESET PATH:', parsed.path)
      console.log('RESET HOSTNAME:', parsed.hostname)
      
      const code = parsed.queryParams?.code

      if (typeof code === 'string') {
        console.log('RESET CODE FOUND')

        console.log('RESET EXCHANGE START')

const { data, error } = await supabase.auth.exchangeCodeForSession(code)

console.log('RESET EXCHANGE RESULT:', {
  hasSession: !!data?.session,
  hasUser: !!data?.user,
  error,
})

        if (error) {
          console.error('RESET EXCHANGE ERROR:', error)
          showAlert('Erro', 'O link de recuperação expirou ou é inválido.', [
            { text: 'OK', onPress: () => router.replace('/login-vitastreak' as any) },
          ])
          return
        }

        setRecoveryReady(true)
        return
      }

      const currentSession = await supabase.auth.getSession()

      if (currentSession.data.session) {
        console.log('RESET SESSION ALREADY EXISTS')
        setRecoveryReady(true)
        return
      }

      console.log('RESET NO CODE AND NO SESSION')
    } catch (error) {
      console.error('Erro ao processar link reset:', error)
    }
  }

  Linking.getInitialURL().then(handleUrl)

  const subscription = Linking.addEventListener('url', ({ url }) => {
    handleUrl(url)
  })

  return () => subscription.remove()
}, [])

const handleReset = async () => {
  if (!password || !confirmPassword) {
    showAlert('Erro', 'Preenche todos os campos.', [{ text: 'OK', onPress: () => {} }])
    return
  }

  if (password !== confirmPassword) {
    showAlert('Erro', 'As passwords não coincidem.', [{ text: 'OK', onPress: () => {} }])
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

const { data: sessionData } = await supabase.auth.getSession()

if (!recoveryReady && !sessionData.session) {
  showAlert(
    'Link ainda não preparado',
    'Abre novamente o link do email ou pede um novo email de recuperação.',
    [{ text: 'OK', onPress: () => {} }]
  )
  return
}

  try {
  setIsLoading(true)
console.log('RESET SUBMIT START', {
  recoveryReady,
  passwordLength: password.length,
})
console.log('RESET SESSION CHECK:', {
  hasSession: !!sessionData.session,
  hasUser: !!sessionData.session?.user,
})
  if (!sessionData.session) {
    showAlert(
      'Sessão expirada',
      'O link de recuperação expirou. Pede um novo email para alterar a password.',
      [{ text: 'OK', onPress: () => router.replace('/login-vitastreak' as any) }]
    )
    return
  }
console.log('RESET UPDATE USER START')
  const { error } = await withTimeout(
  supabase.auth.updateUser({ password }),
  12000
)
console.log('RESET UPDATE USER RESULT:', error)
  if (error) throw error

  await supabase.auth.signOut({ scope: 'global' })

  showAlert(
    'Password atualizada',
    'A tua palavra-passe foi alterada com sucesso. Faz login com a nova password.',
    [
      {
        text: 'OK',
        onPress: () => router.replace('/login-vitastreak' as any),
      },
    ]
  )
} catch (error) {
    console.error('Erro ao atualizar password:', error)
    showAlert('Erro', 'Não foi possível atualizar a palavra-passe.', [
      { text: 'OK', onPress: () => {} },
    ])
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

              <Text style={styles.title}>Nova password</Text>
              <Text style={styles.subtitle}>
                Cria uma nova palavra-passe segura para a tua conta.
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Nova password"
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
                  placeholder="Confirmar nova password"
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
                onPress={handleReset}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.buttonText}>Guardar nova password</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.loginLink}
                onPress={() => router.replace('/login-vitastreak' as any)}
              >
                <Text style={styles.loginText}>Voltar ao login</Text>
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
  gradient: { flex: 1 },
  container: { flex: 1 },
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
    color: 'rgba(255,255,255,0.82)',
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 26,
    padding: 22,
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 14,
  },
  passwordInput: {
    backgroundColor: 'rgba(30,41,59,0.95)',
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
    backgroundColor: 'rgba(30,41,59,0.72)',
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