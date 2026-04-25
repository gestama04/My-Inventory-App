import React, { useEffect, useState } from 'react'
import { supabase } from '../supabase-config'
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Image,
  View,
  StatusBar,
} from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'

import { useAuth } from '../auth-context'
import useCustomAlert from '../hooks/useCustomAlert'

export default function LoginScreen() {
  const router = useRouter()
  const { login, resetPassword } = useAuth()
  const { showAlert, AlertComponent } = useCustomAlert()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  useEffect(() => {
    const loadRememberMe = async () => {
      try {
        const savedRememberMe = await AsyncStorage.getItem('rememberMe')
        const savedEmail = await AsyncStorage.getItem('savedEmail')

        if (savedRememberMe === 'true') {
          setRememberMe(true)
          if (savedEmail) setEmail(savedEmail)
        }
      } catch (error) {
        console.error('Erro ao carregar preferências:', error)
      }
    }

    loadRememberMe()
  }, [])

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      showAlert('Erro', 'Por favor, preenche todos os campos.', [
        { text: 'OK', onPress: () => {} },
      ])
      return
    }

    setIsLoading(true)

    try {
      if (rememberMe) {
        await AsyncStorage.setItem('rememberMe', 'true')
        await AsyncStorage.setItem('savedEmail', email.trim())
      } else {
        await AsyncStorage.removeItem('rememberMe')
        await AsyncStorage.removeItem('savedEmail')
      }

      await login(email.trim(), password, rememberMe)
      router.replace('/' as any)
    } catch (error: any) {
      console.log('Erro de login:', error?.code, error?.message)

      if (
  error?.message === 'email-not-verified' ||
  error?.message?.includes('email-not-verified') ||
  error?.message?.toLowerCase?.().includes('email not confirmed')
) {
  showAlert(
    'Confirma o email',
    'Precisas de confirmar o email antes de entrar. Queres reenviar o email de confirmação?',
    [
      { text: 'Cancelar', onPress: () => {} },
      { text: 'Reenviar', onPress: handleResendConfirmation },
    ]
  )
  return
}

      showAlert(
        'Erro de login',
        'Email ou password incorretos. Verifica os dados e tenta novamente.',
        [{ text: 'OK', onPress: () => {} }]
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail.trim()) {
      showAlert('Erro', 'Insere o teu email para redefinir a password.', [
        { text: 'OK', onPress: () => {} },
      ])
      return
    }

    setIsLoading(true)

    try {
      await resetPassword(forgotPasswordEmail.trim())

      showAlert(
        'Email enviado',
        'Verifica o teu email para redefinir a password.',
        [{ text: 'OK', onPress: () => setShowForgotPassword(false) }]
      )
    } catch (error) {
      showAlert(
        'Erro',
        'Não foi possível enviar o email. Confirma se o email está correto.',
        [{ text: 'OK', onPress: () => {} }]
      )
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleResendConfirmation = async () => {
  if (!email.trim()) {
    showAlert('Email em falta', 'Insere o teu email para reenviar a confirmação.', [
      { text: 'OK', onPress: () => {} },
    ])
    return
  }

  try {
    setIsLoading(true)

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: {
        emailRedirectTo: 'vitastreak://',
      },
    })

    if (error) throw error

    showAlert(
      'Email enviado',
      'Enviámos novamente o email de confirmação. Verifica também o spam.',
      [{ text: 'OK', onPress: () => {} }]
    )
  } catch (error) {
    console.error('Erro ao reenviar confirmação:', error)
    showAlert('Erro', 'Não foi possível reenviar o email de confirmação.', [
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

              <Text style={styles.title}>VitaStreak</Text>
              <Text style={styles.subtitle}>
                Acompanha suplementos, tomas e lembretes.
              </Text>
            </View>

            <View style={styles.card}>
              {showForgotPassword ? (
                <>
                  <Text style={styles.cardTitle}>Recuperar password</Text>
                  <Text style={styles.cardSubtitle}>
                    Enviaremos instruções para o teu email.
                  </Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#94a3b8"
                    value={forgotPasswordEmail}
                    onChangeText={setForgotPasswordEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <TouchableOpacity
                    style={[styles.button, isLoading && styles.disabledButton]}
                    onPress={handleForgotPassword}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.buttonText}>Enviar email</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => setShowForgotPassword(false)}
                  >
                    <Text style={styles.linkText}>Voltar ao login</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.cardTitle}>Login</Text>

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

                  <View style={styles.optionsContainer}>
                    <View style={styles.rememberContainer}>
                      <Switch
                        value={rememberMe}
                        onValueChange={setRememberMe}
                        trackColor={{ false: '#475569', true: '#7c3aed' }}
                        thumbColor={rememberMe ? '#ffffff' : '#cbd5e1'}
                      />
                      <Text style={styles.rememberText}>Lembrar-me</Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => {
                        setForgotPasswordEmail(email)
                        setShowForgotPassword(true)
                      }}
                    >
                      <Text style={styles.forgotText}>
                        Esqueceste-te?
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.button, isLoading && styles.disabledButton]}
                    onPress={handleLogin}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.buttonText}>Entrar</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.registerLink}
                    onPress={() => router.push('/register-vitastreak' as any)}
                  >
                    <Text style={styles.registerText}>
                      Ainda não tens conta? Regista-te
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </KeyboardAwareScrollView>

          <AlertComponent />
        </KeyboardAvoidingView>
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
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 22,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    width: 118,
    height: 118,
    marginBottom: 14,
  },
  title: {
    color: 'white',
    fontSize: 36,
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
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
cardTitle: {
  color: 'white',
  fontSize: 26,
  fontWeight: '900',
  marginBottom: 18,
},
cardSubtitle: {
  color: '#cbd5e1',
  fontSize: 14,
  lineHeight: 20,
  marginBottom: 24,
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
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  rememberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rememberText: {
    color: '#e2e8f0',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  forgotText: {
    color: '#67e8f9',
    fontSize: 14,
    fontWeight: '700',
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
  registerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  registerText: {
    color: '#cbd5e1',
    fontSize: 15,
    fontWeight: '700',
  },
  linkButton: {
    marginTop: 18,
    alignItems: 'center',
  },
  linkText: {
    color: '#67e8f9',
    fontSize: 15,
    fontWeight: '800',
  },
})