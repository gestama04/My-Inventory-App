import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useTheme } from './theme-context';
import { Ionicons } from '@expo/vector-icons';

export default function HelpScreen() {
  const router = useRouter();
  const { currentTheme } = useTheme();

  const faqItems = [
    {
      question: 'Como adicionar um novo produto ao inventário?',
      answer: 'Toque no botão "Adicionar" no ecrã inicial ou no botão "+" dentro do inventário. Preencha os detalhes do produto e carregue em "Guardar".'
    },
    {
      question: 'Como editar um produto existente?',
      answer: 'Toque no produto que deseja editar na lista de inventário para ver os seus detalhes. Em seguida, toque no ícone de lápis para editar as informações.'
    },
    {
      question: 'Como excluir um produto?',
      answer: 'No Inventário, pressione no produto que quer eliminar e carregue no botão "Remover".'
    },
    {
      question: 'Como exportar o meu inventário?',
      answer: 'Vá para o ecrã de Definições e toque em "Exportar Dados". Escolha o formato desejado (PDF, CSV ou JSON).'
    },
    {
      question: 'Como funciona o sistema de categorias?',
      answer: 'As categorias ajudam a organizar os seus produtos. Ao adicionar um produto, você pode escolher uma categoria existente ou criar uma nova. A AI também pode sugerir categorias automaticamente.'
    },
    {
      question: 'O que significa "Stock Baixo"?',
      answer: 'Produtos com quantidade abaixo do limite definido por si são marcados como "Stock Baixo". Você pode definir um limite global nas configurações ou personalizar para cada produto.'
    }
  ];

  const contactSupport = () => {
    Linking.openURL('mailto:pv26632@estgl.ipv.pt?subject=Suporte%20ao%20Utilizador');
  };

  return (
    <View style={[
      styles.container,
      currentTheme === 'dark' ? styles.darkContainer : styles.lightContainer
    ]}>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          title: 'Ajuda e Suporte',
          headerStyle: {
            backgroundColor: currentTheme === 'dark' ? '#1a1a1a' : '#3498db',
          },
          headerTintColor: '#fff',
          headerLeft: () => (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          ),
        }} 
      />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={[
            styles.sectionTitle,
            currentTheme === 'dark' ? styles.darkText : styles.lightText
          ]}>
            Perguntas Frequentes
          </Text>
          
          {faqItems.map((item, index) => (
            <View 
              key={index} 
              style={[
                styles.faqItem,
                currentTheme === 'dark' ? styles.darkCard : styles.lightCard
              ]}
            >
              <Text style={[
                styles.faqQuestion,
                currentTheme === 'dark' ? styles.darkText : styles.lightText
              ]}>
                {item.question}
              </Text>
              <Text style={[
                styles.faqAnswer,
                currentTheme === 'dark' ? styles.darkSecondaryText : styles.lightSecondaryText
              ]}>
                {item.answer}
              </Text>
            </View>
          ))}
        </View>
        
        <View style={styles.section}>
          <Text style={[
            styles.sectionTitle,
            currentTheme === 'dark' ? styles.darkText : styles.lightText
          ]}>
            Contacto
          </Text>
          
          <View style={[
            styles.contactCard,
            currentTheme === 'dark' ? styles.darkCard : styles.lightCard
          ]}>
            <Text style={[
              styles.contactText,
              currentTheme === 'dark' ? styles.darkSecondaryText : styles.lightSecondaryText
            ]}>
              Não encontrou o que procurava? Entre em contacto com a nossa equipa de suporte.
            </Text>
            
            <TouchableOpacity
              style={styles.contactButton}
              onPress={contactSupport}
            >
              <Ionicons name="mail-outline" size={20} color="#fff" />
              <Text style={styles.contactButtonText}>Enviar Email</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  darkContainer: {
    backgroundColor: '#121212',
  },
  lightContainer: {
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  backButton: {
    marginLeft: 10,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  faqItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 15,
    lineHeight: 22,
  },
  contactCard: {
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    alignItems: 'center',
  },
  contactText: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  contactButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  darkCard: {
    backgroundColor: '#1e1e1e',
  },
  lightCard: {
    backgroundColor: '#fff',
  },
  darkText: {
    color: '#fff',
  },
  lightText: {
    color: '#2c3e50',
  },
  darkSecondaryText: {
    color: '#bdc3c7',
  },
  lightSecondaryText: {
    color: '#7f8c8d',
  },
});
