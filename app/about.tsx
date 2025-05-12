import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Linking
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useTheme } from './theme-context';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Asset } from 'expo-asset';

export default function AboutScreen() {
  const router = useRouter();
  const { currentTheme } = useTheme();

  const openWebsite = () => {
    Linking.openURL('https://github.com/gestama04/CURRICULO-DIGITAL-BOOTSTRAPP/tree/main/bernardo');
  };

  // Corrigido com tipos explícitos
  const ensureFileExists = async (assetModule: any, filename: string): Promise<string> => {
    const fileUri = `${FileSystem.documentDirectory}${filename}`;
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    
    if (!fileInfo.exists) {
      // O arquivo não existe no diretório de documentos, precisamos copiá-lo
      console.log(`Copiando ${filename} para o diretório de documentos...`);
      
      try {
        // Carregar o asset
        const asset = Asset.fromModule(assetModule);
        await asset.downloadAsync();
        
        // Verificar se localUri existe antes de usar
        if (!asset.localUri) {
          throw new Error(`Não foi possível obter o URI local para ${filename}`);
        }
        
        // Copiar do bundle para o diretório de documentos
        await FileSystem.copyAsync({
          from: asset.localUri, // Agora TypeScript sabe que não é null
          to: fileUri
        });
        
        console.log(`Arquivo ${filename} copiado com sucesso`);
        return fileUri;
      } catch (error) {
        console.error(`Erro ao copiar arquivo ${filename}:`, error);
        throw error;
      }
    }
    
    return fileUri;
  };

  // Função para abrir PDF da política de privacidade
  const openPrivacyPolicy = async () => {
    try {
      // Importar o arquivo PDF do bundle
      const privacyPolicyAsset = require('../assets/documents/privacy-policy.pdf');
      
      // Garantir que o arquivo exista no sistema de arquivos
      const fileUri = await ensureFileExists(privacyPolicyAsset, 'privacy-policy.pdf');
      
      if (Platform.OS === 'ios') {
        // No iOS, podemos usar WebBrowser para abrir o PDF
        await WebBrowser.openBrowserAsync('file://' + fileUri);
      } else if (Platform.OS === 'android') {
        // No Android, usamos o IntentLauncher para abrir o PDF com um visualizador de PDF
        const contentUri = await FileSystem.getContentUriAsync(fileUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: 'application/pdf'
        });
      }
    } catch (error) {
      console.error('Erro ao abrir o PDF da política de privacidade:', error);
      alert('Erro ao abrir o documento');
    }
  };

  // Função para abrir PDF dos termos de uso
  const openTerms = async () => {
    try {
      // Importar o arquivo PDF do bundle
      const termsAsset = require('../assets/documents/terms-of-use.pdf');
      
      // Garantir que o arquivo exista no sistema de arquivos
      const fileUri = await ensureFileExists(termsAsset, 'terms-of-use.pdf');
      
      if (Platform.OS === 'ios') {
        // No iOS, podemos usar WebBrowser para abrir o PDF
        await WebBrowser.openBrowserAsync('file://' + fileUri);
      } else if (Platform.OS === 'android') {
        // No Android, usamos o IntentLauncher para abrir o PDF com um visualizador de PDF
        const contentUri = await FileSystem.getContentUriAsync(fileUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: 'application/pdf'
        });
      }
    } catch (error) {
      console.error('Erro ao abrir o PDF dos termos de uso:', error);
      alert('Erro ao abrir o documento');
    }
  };

  return (
    <View style={[
      styles.container,
      currentTheme === 'dark' ? styles.darkContainer : styles.lightContainer
    ]}>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          title: 'Sobre a App',
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
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[
            styles.appName,
            currentTheme === 'dark' ? styles.darkText : styles.lightText
          ]}>
            My Inventory
          </Text>
          <Text style={styles.appVersion}>Versão 1.0.0</Text>
        </View>
        
        <View style={[
          styles.card,
          currentTheme === 'dark' ? styles.darkCard : styles.lightCard
        ]}>
          <Text style={[
            styles.cardTitle,
            currentTheme === 'dark' ? styles.darkText : styles.lightText
          ]}>
            Sobre
          </Text>
          <Text style={[
            styles.cardText,
            currentTheme === 'dark' ? styles.darkSecondaryText : styles.lightSecondaryText
          ]}>
            My Inventory é uma aplicação de gestão de inventário pessoal que permite organizar e acompanhar os seus produtos de forma simples e eficaz. Com recursos de inteligência artificial para identificação automática de produtos, categorização inteligente e estatísticas detalhadas, a app ajuda-o a manter o seu inventário sempre organizado.
          </Text>
        </View>
        
        <View style={[
          styles.card,
          currentTheme === 'dark' ? styles.darkCard : styles.lightCard
        ]}>
          <Text style={[
            styles.cardTitle,
            currentTheme === 'dark' ? styles.darkText : styles.lightText
          ]}>
            Recursos
          </Text>
          
          <View style={styles.featureItem}>
            <Ionicons name="camera-outline" size={24} color="#3498db" style={styles.featureIcon} />
            <Text style={[
              styles.featureText,
              currentTheme === 'dark' ? styles.darkSecondaryText : styles.lightSecondaryText
            ]}>
              Identificação automática de produtos com IA
            </Text>
          </View>
          
          <View style={styles.featureItem}>
            <Ionicons name="apps-outline" size={24} color="#3498db" style={styles.featureIcon} />
            <Text style={[
              styles.featureText,
              currentTheme === 'dark' ? styles.darkSecondaryText : styles.lightSecondaryText
            ]}>
              Organização por categorias
            </Text>
          </View>
          
          <View style={styles.featureItem}>
            <Ionicons name="bar-chart-outline" size={24} color="#3498db" style={styles.featureIcon} />
            <Text style={[
              styles.featureText,
              currentTheme === 'dark' ? styles.darkSecondaryText : styles.lightSecondaryText
            ]}>
              Estatísticas detalhadas do inventário
            </Text>
          </View>
          
          <View style={styles.featureItem}>
            <Ionicons name="alert-circle-outline" size={24} color="#3498db" style={styles.featureIcon} />
            <Text style={[
              styles.featureText,
              currentTheme === 'dark' ? styles.darkSecondaryText : styles.lightSecondaryText
            ]}>
              Alertas de stock baixo
            </Text>
          </View>
          
          <View style={styles.featureItem}>
            <Ionicons name="cloud-outline" size={24} color="#3498db" style={styles.featureIcon} />
            <Text style={[
              styles.featureText,
              currentTheme === 'dark' ? styles.darkSecondaryText : styles.lightSecondaryText
            ]}>
              Sincronização na nuvem
            </Text>
          </View>
        </View>
        
        <View style={styles.linksContainer}>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={openWebsite}
          >
            <Ionicons name="globe-outline" size={20} color="#3498db" />
            <Text style={styles.linkText}>Website</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.linkButton}
            onPress={openPrivacyPolicy}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color="#3498db" />
            <Text style={styles.linkText}>Política de Privacidade</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.linkButton}
            onPress={openTerms}
          >
            <Ionicons name="document-text-outline" size={20} color="#3498db" />
            <Text style={styles.linkText}>Termos de Uso</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.footer}>
          <Text style={[
            styles.footerText,
            currentTheme === 'dark' ? styles.darkSecondaryText : styles.lightSecondaryText
          ]}>
            © 2025 My Inventory. Todos os direitos reservados.
          </Text>
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
    alignItems: 'center',
  },
  backButton: {
    marginLeft: 10,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  card: {
    width: '100%',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  darkCard: {
    backgroundColor: '#1e1e1e',
  },
  lightCard: {
    backgroundColor: '#fff',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  cardText: {
    fontSize: 15,
    lineHeight: 22,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureIcon: {
    marginRight: 12,
  },
  featureText: {
    fontSize: 15,
    flex: 1,
  },
  linksContainer: {
    width: '100%',
    marginBottom: 30,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  linkText: {
    fontSize: 16,
    color: '#3498db',
    marginLeft: 12,
  },
  footer: {
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
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
