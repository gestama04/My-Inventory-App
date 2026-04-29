import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Linking,
} from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { rescheduleAllSupplementNotifications } from '../services/supplements/supplement-service'
import { supabase } from '../supabase-config'
import useCustomAlert from '../hooks/useCustomAlert'

export default function SettingsScreen() {
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()

  const deleteAccount = () => {
  showAlert(
    'Apagar conta',
    'Tens a certeza? Esta ação é irreversível e vai apagar a tua conta.',
    [
      { text: 'Cancelar', onPress: () => {} },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.functions.invoke('delete-user')

            if (error) throw error

            await supabase.auth.signOut()
            router.replace('/login-vitastreak' as any)
          } catch (error: any) {
  console.error('Erro ao apagar conta:', error)

  if (error?.context) {
    const body = await error.context.text()
    console.error('DELETE USER FUNCTION BODY:', body)
  }

  showAlert('Erro', 'Não foi possível apagar a conta.', [
    { text: 'OK', onPress: () => {} },
  ])
}
        },
      },
    ]
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
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="white" />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Definições</Text>
              <Text style={styles.subtitle}>Preferências e dados da app.</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Rotina</Text>

            <SettingItem
              icon="notifications-outline"
              title="Notificações"
              subtitle="Geridas automaticamente por suplemento"
            />

            <SettingItem
              icon="time-outline"
              title="Tomas por dia"
              subtitle="Configuras isto ao adicionar ou editar suplementos"
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Conta</Text>

            <SettingItem
              icon="person-outline"
              title="Perfil"
              subtitle="Ver dados da tua conta"
              onPress={() => router.push('/profile-vitastreak' as any)}
            />

            <SettingItem
              icon="trash-outline"
              title="Apagar conta"
              subtitle="Remove dados da VitaStreak"
              danger
              onPress={deleteAccount}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Sobre</Text>

            <SettingItem
              icon="mail-outline"
              title="Contactar suporte"
              subtitle="Enviar email"
              onPress={() => Linking.openURL('mailto:benigestama@gmail.com')}
            />
            <SettingItem
  icon="document-text-outline"
  title="Privacidade e Termos"
  subtitle="Ver Política de Privacidade e Termos de Utilização"
  onPress={() => router.push('/legal-vitastreak' as any)}
/>
            <SettingItem
              icon="information-circle-outline"
              title="Versão"
              subtitle="VitaStreak 1.0.0"
            />
          </View>
<View style={styles.card}>
  <Text style={styles.sectionTitle}>Ajuda</Text>

  <SettingItem
    icon="build-outline"
    title="Reparar notificações"
    subtitle="Usa isto se editares tomas e as notificações deixarem de aparecer. A app limpa e volta a agendar todos os lembretes."
    onPress={async () => {
      try {
        await rescheduleAllSupplementNotifications()
        showAlert('Notificações reparadas', 'Os lembretes foram limpos e reagendados.', [
          { text: 'OK', onPress: () => {} },
        ])
      } catch (error) {
        console.error('Erro ao reagendar notificações:', error)
        showAlert('Erro', 'Não foi possível reparar as notificações.', [
          { text: 'OK', onPress: () => {} },
        ])
      }
    }}
  />

  <Text style={styles.helpText}>
    Em alguns telemóveis Android, o sistema pode atrasar ou bloquear lembretes em segundo plano. Se isso acontecer, abre a app e usa esta opção.
  </Text>
</View>
          <Text style={styles.footer}>2026 © VitaStreak</Text>
        </ScrollView>

        <AlertComponent />
      </LinearGradient>
    </>
  )
}

function SettingItem({
  icon,
  title,
  subtitle,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle: string
  onPress?: () => void
  danger?: boolean
}) {
  return (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.8 : 1}
    >
      <View style={[styles.iconBox, danger && styles.dangerIconBox]}>
        <Ionicons name={icon} size={22} color={danger ? '#fecaca' : '#c4b5fd'} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.settingTitle, danger && styles.dangerText]}>
          {title}
        </Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>

      {onPress ? (
        <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
      ) : null}
    </TouchableOpacity>
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
    marginBottom: 26,
  },
  helpText: {
  color: '#94a3b8',
  fontSize: 12,
  lineHeight: 18,
  marginTop: 6,
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
  },
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 19,
    fontWeight: '900',
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(124,58,237,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dangerIconBox: {
    backgroundColor: 'rgba(239,68,68,0.18)',
  },
  settingTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
  },
  settingSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  dangerText: {
    color: '#fecaca',
  },
  footer: {
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
  },
})