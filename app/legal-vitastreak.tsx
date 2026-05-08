import React from 'react'
import {
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  View,
} from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'

export default function LegalVitaStreakScreen() {
  const router = useRouter()

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
              <Text style={styles.title}>Privacidade/Termos</Text>
              <Text style={styles.subtitle}>Última atualização: 2026</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Política de Privacidade</Text>

            <Text style={styles.text}>
              A VitaStreak ajuda-te a acompanhar suplementos, lembretes e tomas diárias.
              Recolhemos apenas os dados necessários para criar a tua conta e guardar a
              tua rotina.
            </Text>

            <Text style={styles.heading}>Dados que podemos guardar</Text>
            <Text style={styles.text}>
              Nome, email, foto de perfil, data de nascimento se fornecida,
              suplementos adicionados, horários, dias de toma, histórico de tomas e
              imagens de rótulos quando usas a análise por IA.
            </Text>

            <Text style={styles.heading}>Como usamos os dados</Text>
            <Text style={styles.text}>
              Usamos os dados para mostrar a tua rotina, calcular progresso e streaks,
              enviar notificações e melhorar a experiência dentro da app.
            </Text>

            <Text style={styles.heading}>IA e imagens</Text>
            <Text style={styles.text}>
              Quando envias uma foto de um rótulo, a imagem pode ser processada por
              serviços externos para identificar informações do suplemento. Deves
              confirmar manualmente os dados antes de guardar.
            </Text>

            <Text style={styles.heading}>Serviços externos</Text>
            <Text style={styles.text}>
              A app pode usar serviços como Supabase para autenticação/base de dados,
              Cloudinary para imagens e serviços de IA para análise de rótulos.
            </Text>

            <Text style={styles.text}>
  As informações geradas por IA são apenas informativas e podem conter erros.
  Não devem ser usadas para decidir doses, tratamentos ou combinações de suplementos.
</Text>

            <Text style={styles.heading}>Eliminação de conta</Text>
<Text style={styles.text}>
  Podes apagar a tua conta e os dados associados nas definições da app.
  Também podes contactar-nos através de benigestama@gmail.com.
</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Termos de Utilização</Text>

            <Text style={styles.text}>
              A VitaStreak é uma app de organização pessoal e lembretes. A app não fornece
              aconselhamento médico, diagnóstico ou tratamento.
            </Text>

            <Text style={styles.heading}>Responsabilidade do utilizador</Text>
            <Text style={styles.text}>
              Deves confirmar sempre as informações dos suplementos, seguir as instruções
              do fabricante e consultar um profissional de saúde antes de iniciar,
              alterar ou combinar suplementos.
            </Text>

            <Text style={styles.heading}>Lembretes</Text>
            <Text style={styles.text}>
              As notificações são apenas lembretes. Podem falhar devido a definições do
              dispositivo, bateria, permissões ou sistema operativo.
            </Text>

            <Text style={styles.heading}>Uso adequado</Text>
            <Text style={styles.text}>
              Não deves usar a app para fins ilegais, abusivos ou para substituir
              acompanhamento médico profissional.
            </Text>

            <Text style={styles.heading}>Alterações</Text>
            <Text style={styles.text}>
              Estes termos podem ser atualizados no futuro. A utilização contínua da app
              significa aceitação da versão mais recente.
            </Text>
          </View>
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
    fontSize: 30,
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
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 14,
  },
  heading: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 14,
    marginBottom: 6,
  },
  text: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 21,
  },
})