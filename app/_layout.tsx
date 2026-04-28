import { Stack } from 'expo-router'
import { ThemeProvider, useTheme } from './theme-context'
import { View, StyleSheet, StatusBar, Platform } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect, useState } from 'react'
import { AuthProvider } from '../auth-context'
import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'

SplashScreen.preventAutoHideAsync()

function AppLayout() {
  const { currentTheme } = useTheme()
  const router = useRouter()
  const [appIsReady, setAppIsReady] = useState(false)

  useEffect(() => {
    const prepare = async () => {
      try {
        console.log('APP LAYOUT PREPARE')
      } catch (error) {
        console.warn('Erro ao inicializar:', error)
      } finally {
        setAppIsReady(true)
      }
    }

    prepare()
  }, [])

  useEffect(() => {
    if (!appIsReady) return

    const timer = setTimeout(() => {
      SplashScreen.hideAsync()
    }, 500)

    return () => clearTimeout(timer)
  }, [appIsReady])

  useEffect(() => {
    if (!appIsReady) return

    const foregroundSubscription =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log('Notificação recebida:', notification)
      })

    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log('Resposta de notificação:', response)

        const data = response.notification.request.content.data

        if (data?.screen === 'today') {
          router.push('/today' as any)
        }

        if (data?.type === 'supplement-reminder' || data?.screen === 'today') {
  router.push('/today' as any)
}

        if (data?.screen === 'supplement-details' && data?.supplementId) {
          router.push({
            pathname: '/supplement-details',
            params: { id: String(data.supplementId) },
          } as any)
        }
      })

    return () => {
      foregroundSubscription.remove()
      responseSubscription.remove()
    }
  }, [router, appIsReady])

  StatusBar.setBarStyle(currentTheme === 'dark' ? 'light-content' : 'dark-content')

  if (Platform.OS === 'android') {
    StatusBar.setBackgroundColor(currentTheme === 'dark' ? '#0f172a' : '#f9fafb')
  }

  if (!appIsReady) return null

  return (
    <View style={[styles.container, currentTheme === 'dark' ? styles.dark : styles.light]}>
      <Stack
        initialRouteName="index"
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: currentTheme === 'dark' ? '#0f172a' : '#f9fafb',
          },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="welcome-vitastreak" />
        <Stack.Screen name="setup-vitastreak" />
        <Stack.Screen name="login-vitastreak" />
        <Stack.Screen name="register-vitastreak" />
        <Stack.Screen name="reset-password-vitastreak" />
        <Stack.Screen name="vitastreak-home" />
        <Stack.Screen name="profile-vitastreak" />
        <Stack.Screen name="settings-vitastreak" />
        <Stack.Screen name="legal-vitastreak" />
        <Stack.Screen name="add-supplement" />
        <Stack.Screen name="edit-supplement" />
        <Stack.Screen name="supplements" />
        <Stack.Screen name="supplement-details" />
        <Stack.Screen name="today" />
        <Stack.Screen name="ai-routine-review" />
      </Stack>
    </View>
  )
}

export default function Layout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </ThemeProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  light: {
    backgroundColor: '#f9fafb',
  },
  dark: {
    backgroundColor: '#0f172a',
  },
})