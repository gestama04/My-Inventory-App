import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Animated,
  Image,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface WelcomeScreenProps {
  onContinue: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onContinue }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const aiGlowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animação principal
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Animação pulsante para o destaque da IA
    Animated.loop(
      Animated.sequence([
        Animated.timing(aiGlowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(aiGlowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const aiGlowOpacity = aiGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3498db" />
      
      <LinearGradient
        colors={['#3498db', '#2980b9', '#1e3a8a']}
        style={styles.gradient}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          <Animated.View 
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Logo Section */}
            <View style={styles.logoSection}>
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../assets/images/logo.png')} 
                  style={styles.logo} 
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.appName}>My Inventory</Text>
              <Text style={styles.tagline}>
                Gestão inteligente com IA
              </Text>
            </View>

            {/* AI Highlight Section */}
            <Animated.View 
              style={[
                styles.aiHighlight,
                { opacity: aiGlowOpacity }
              ]}
            >
              <View style={styles.aiContainer}>
                <MaterialCommunityIcons name="robot" size={40} color="#ffffff" />
                <View style={styles.aiTextContainer}>
                  <Text style={styles.aiTitle}>Inteligência Artificial</Text>
                  <Text style={styles.aiDescription}>
                    Categorização automática com sugestões precisas e inteligentes
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* Welcome Message */}
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeTitle}>Bem-vindo!</Text>
              <Text style={styles.welcomeDescription}>
                Revolucione a gestão do seu inventário com tecnologia de IA
              </Text>
            </View>

            {/* Features com ícones específicos */}
            <View style={styles.featuresSection}>
              <View style={styles.featureRow}>
                <View style={styles.iconContainer}>
                  <MaterialCommunityIcons name="package-variant" size={28} color="#ffffff" />
                </View>
                <View style={styles.featureTextContainer}>
                  <Text style={styles.featureTitle}>Gestão de Produtos</Text>
                  <Text style={styles.featureSubtitle}>Adicione e organize facilmente</Text>
                </View>
              </View>
              
              <View style={styles.featureRow}>
                <View style={styles.iconContainer}>
                  <MaterialCommunityIcons name="cube-outline" size={28} color="#ffffff" />
                </View>
                <View style={styles.featureTextContainer}>
                  <Text style={styles.featureTitle}>Controlo de Stock</Text>
                  <Text style={styles.featureSubtitle}>Monitorização em tempo real</Text>
                </View>
              </View>
              
              <View style={styles.featureRow}>
                <View style={styles.iconContainer}>
                  <MaterialCommunityIcons name="bell-ring" size={28} color="#ffffff" />
                </View>
                <View style={styles.featureTextContainer}>
                  <Text style={styles.featureTitle}>Alertas Inteligentes</Text>
                  <Text style={styles.featureSubtitle}>Notificações personalizadas</Text>
                </View>
              </View>
              
              <View style={styles.featureRow}>
                <View style={styles.iconContainer}>
                  <MaterialCommunityIcons name="chart-line" size={28} color="#ffffff" />
                </View>
                <View style={styles.featureTextContainer}>
                  <Text style={styles.featureTitle}>Estatísticas Avançadas</Text>
                  <Text style={styles.featureSubtitle}>Relatórios e análises detalhadas</Text>
                </View>
              </View>

              <View style={styles.featureRow}>
                <View style={styles.iconContainer}>
                  <MaterialCommunityIcons name="cloud-sync" size={28} color="#ffffff" />
                </View>
                <View style={styles.featureTextContainer}>
                  <Text style={styles.featureTitle}>Sincronização em vários dispositivos</Text>
                  <Text style={styles.featureSubtitle}>Dados seguros e acessíveis</Text>
                </View>
              </View>
            </View>

            {/* Botão de continuar */}
            <View style={styles.buttonSection}>
              <TouchableOpacity
                style={styles.continueButton}
                onPress={onContinue}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#ffffff', '#f8f9fa']}
                  style={styles.buttonGradient}
                >
                  <MaterialCommunityIcons
                    name="rocket-launch"
                    size={24}
                    color="#3498db"
                    style={styles.buttonIconLeft}
                  />
                  <Text style={styles.continueButtonText}>Começar</Text>
                  <MaterialCommunityIcons
                    name="arrow-right"
                    size={20}
                    color="#3498db"
                    style={styles.buttonIcon}
                  />
                </LinearGradient>
              </TouchableOpacity>
              
              <Text style={styles.skipText}>
                Descubra o futuro da gestão de inventário
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  content: {
    alignItems: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 120,
    height: 120,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  // Destaque da IA
  aiHighlight: {
    width: '100%',
    marginBottom: 30,
  },
  aiContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  aiTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  aiTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  aiDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  welcomeDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresSection: {
    width: '100%',
    marginBottom: 40,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  featureSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 18,
  },
  buttonSection: {
    alignItems: 'center',
    width: '100%',
  },
  continueButton: {
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    marginBottom: 16,
  },
  buttonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3498db',
    marginHorizontal: 12,
  },
  buttonIconLeft: {
    marginRight: 4,
  },
  buttonIcon: {
    marginLeft: 4,
  },
  skipText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
  },
});

export default WelcomeScreen;
