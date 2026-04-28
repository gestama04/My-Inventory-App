import React, { useState } from 'react'
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  View,
  StatusBar,
} from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '../supabase-config'
import useCustomAlert from '../hooks/useCustomAlert'

export default function ResetPasswordCodeScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { showAlert, AlertComponent } = useCustomAlert()

  const [email, setEmail] = useState(String(params.email || ''))
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleReset = async () => {
    const cleanEmail = email.trim()
    const cleanToken = token.trim()

    if (!cleanEmail || !cleanToken || !password || !confirmPassword) {
      showAlert('Erro', 'Preenche todos os campos.', [{ text: 'OK', onPress: () => {} }])
      return
    }

    if (password !== confirmPassword) {
      showAlert('Erro', 'As passwords não coincidem.', [{ text: 'OK', onPress: () => {} }])
      return
    }

    if (password.length < 8) {
      showAlert('Erro', 'A password deve ter pelo menos 8 caracteres.', [
        { text: 'OK', onPress: () => {} },
      ])
      return
    }

    setIsLoading(true)

    try {
      console.log('RESET OTP VERIFY START')

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: 'recovery',
      })

      console.log('RESET OTP VERIFY RESULT:', {
        hasSession: !!data.session,
        hasUser: !!data.user,
        error: verifyError,
      })

      if (verifyError) throw verifyError

      console.log('RESET UPDATE USER START')

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      console.log('RESET UPDATE USER RESULT:', updateError)

      if (updateError) throw updateError

      await supabase.auth.signOut({ scope: 'global' })

      showAlert(
        'Password atualizada',
        'A tua password foi alterada com sucesso. Faz login com a nova password.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/login-vitastreak' as any),
          },
        ]
      )
    } catch (error) {
      console.error('RESET OTP ERROR:', error)
      showAlert(
        'Erro',
        'Código inválido ou expirado. Pede um novo email e tenta novamente.',
        [{ text: 'OK', onPress: () => {} }]
      )
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
          <View style={styles.card}>
            <Text style={styles.title}>Nova password</Text>
            <Text style={styles.subtitle}>
              Insere o código recebido por email e cria uma nova password.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TextInput
              style={styles.input}
              placeholder="Código do email"
              placeholderTextColor="#94a3b8"
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              placeholder="Nova password"
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TextInput
              style={styles.input}
              placeholder="Confirmar nova password"
              placeholderTextColor="#94a3b8"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />

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
              style={styles.linkButton}
              onPress={() => router.replace('/login-vitastreak' as any)}
            >
              <Text style={styles.linkText}>Voltar ao login</Text>
            </TouchableOpacity>
          </View>

          <AlertComponent />
        </KeyboardAvoidingView>
      </LinearGradient>
    </>
  )
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 22,
  },
  card: {
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 26,
    padding: 22,
  },
  title: {
    color: 'white',
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 8,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 22,
  },
  input: {
    backgroundColor: 'rgba(30,41,59,0.95)',
    borderWidth: 1,
    borderColor: '#334155',
    color: 'white',
    height: 54,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 14,
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