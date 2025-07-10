import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  Switch,
  Image
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../app/theme-context';
import { useAuth } from '../auth-context';
import { NotificationService } from '../services/notification-service';
import { saveUserSettings } from '../inventory-service';
import useCustomAlert from '../hooks/useCustomAlert';

interface InitialSetupScreenProps {
  onComplete: () => void;
}

interface NotificationSettings {
  enabled: boolean;
  interval: number;
  lowStockEnabled: boolean;
  outOfStockEnabled: boolean;
}

const InitialSetupScreen: React.FC<InitialSetupScreenProps> = ({ onComplete }) => {
  const { currentTheme } = useTheme();
  const { currentUser } = useAuth();
  const { showAlert, AlertComponent } = useCustomAlert();
  
  // Estados para configurações
  const [globalThreshold, setGlobalThreshold] = useState("5");
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    enabled: true,
    interval: 60,
    lowStockEnabled: true,
    outOfStockEnabled: true
  });
  const [currentStep, setCurrentStep] = useState(1); // Agora vai de 1 a 3
  const [isLoading, setIsLoading] = useState(false);

  const validatePositiveInteger = (value: string): string => {
    if (value === '') return '';
    const cleanedValue = value.replace(/[^0-9]/g, '');
    if (cleanedValue === '') return '';
    const numValue = parseInt(cleanedValue, 10);
    return numValue.toString();
  };

  const intervalOptions = [
    { label: '15 minutos', value: 15 },
    { label: '30 minutos', value: 30 },
    { label: '1 hora', value: 60 },
    { label: '2 horas', value: 120 },
    { label: '4 horas', value: 240 },
    { label: '8 horas', value: 480 },
    { label: '12 horas', value: 720 },
    { label: '24 horas', value: 1440 },
  ];

  const showIntervalPicker = () => {
    const options = intervalOptions.map(option => ({
      text: option.label,
      onPress: () => {
        setNotificationSettings({
          ...notificationSettings,
          interval: option.value
        });
      },
      style: "default" as const
    }));

    showAlert(
      'Intervalo de Notificações',
      'Escolha de quanto em quanto tempo quer receber notificações:',
      [
        ...options,
        { text: 'Cancelar', onPress: () => {}, style: "destructive" as const }
      ]
    );
  };

  const handleSaveSettings = async () => {
    if (!currentUser) return;
    
    setIsLoading(true);
    try {
      // Salvar configurações de stock
      const validatedThreshold = validatePositiveInteger(globalThreshold);
      await saveUserSettings({
        globalLowStockThreshold: validatedThreshold || "5"
      });

      // Salvar configurações de notificação
      await NotificationService.saveNotificationSettings(notificationSettings);
      
      // Registrar para notificações se habilitado
      if (notificationSettings.enabled) {
        await NotificationService.registerForPushNotificationsAsync();
        await NotificationService.setupPeriodicStockCheck();
      }

      showAlert(
        'Configuração Completa!',
        'As suas preferências foram guardadas com sucesso.',
        [{ text: 'Continuar', onPress: onComplete }]
      );
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      showAlert(
        'Erro',
        'Não foi possível salvar as configurações. Pode configurá-las mais tarde nas definições.',
        [{ text: 'Continuar Mesmo Assim', onPress: onComplete }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  // SLIDE 1: Ecrã de boas-vindas
  const renderWelcomeSlide = () => (
    <View style={styles.slideContainer}>
      {/* Header apenas no primeiro slide */}
      <View style={styles.header}>
        <Image 
          source={require('../assets/images/logo.png')} 
          style={styles.logo} 
          resizeMode="contain"
        />
        <Text style={[styles.title, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
          Configuração Inicial
        </Text>
        <Text style={[styles.subtitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
          Vamos configurar a sua app em 3 passos simples
        </Text>
      </View>

      {/* Conteúdo do slide de boas-vindas */}
      <View style={styles.welcomeContent}>
        <MaterialCommunityIcons name="rocket-launch" size={80} color="#3498db" />
        <Text style={[styles.welcomeTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
          Bem-vindo!
        </Text>
        <Text style={[styles.welcomeDescription, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
          Vamos personalizar a sua experiência para que possa gerir o seu inventário da melhor forma.
        </Text>
        
        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <MaterialCommunityIcons name="cube-outline" size={24} color="#3498db" />
            <Text style={[styles.featureText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
              Configurar alertas de stock
            </Text>
          </View>
          <View style={styles.featureItem}>
            <MaterialCommunityIcons name="bell-ring" size={24} color="#3498db" />
            <Text style={[styles.featureText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
              Personalizar notificações
            </Text>
          </View>
          <View style={styles.featureItem}>
            <MaterialCommunityIcons name="check-circle" size={24} color="#27ae60" />
            <Text style={[styles.featureText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
              Começar a usar a app
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.singleButtonContainer}>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={() => setCurrentStep(2)}
        >
          <Text style={styles.nextButtonText}>Começar Configuração</Text>
          <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // SLIDE 2: Configuração de stock
  const renderStockSettings = () => (
    <View style={styles.slideContainer}>
      <View style={styles.stepHeader}>
        <MaterialCommunityIcons name="cube-outline" size={64} color="#3498db" />
        <Text style={[styles.stepTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
          Configurar Alertas de Stock
        </Text>
        <Text style={[styles.stepDescription, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
          Defina quando quer ser alertado sobre stock baixo
        </Text>
      </View>

      <View style={[styles.settingCard, currentTheme === "dark" ? styles.darkCard : styles.lightCard]}>
        <Text style={[styles.settingLabel, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
          Valor global para stock baixo:
        </Text>
        <Text style={[styles.settingHelper, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
          Será alertado quando a quantidade for igual ou inferior a este valor
        </Text>
        <TextInput
          style={[
            styles.thresholdInput,
            currentTheme === "dark" ? styles.darkInput : styles.lightInput
          ]}
          value={globalThreshold}
          onChangeText={(text) => setGlobalThreshold(validatePositiveInteger(text))}
          keyboardType="numeric"
          placeholder="5"
          placeholderTextColor={currentTheme === "dark" ? "#aaa" : "#999"}
        />
      </View>

      <View style={styles.stepButtons}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setCurrentStep(1)}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color="#3498db" />
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.nextButton}
          onPress={() => setCurrentStep(3)}
        >
          <Text style={styles.nextButtonText}>Próximo</Text>
          <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // SLIDE 3: Configuração de notificações
  const renderNotificationSettings = () => (
    <View style={styles.slideContainer}>
      <View style={styles.stepHeader}>
        <MaterialCommunityIcons name="bell-ring" size={64} color="#3498db" />
        <Text style={[styles.stepTitle, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
          Configurar Notificações
        </Text>
        <Text style={[styles.stepDescription, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
          Personalize como quer receber alertas
        </Text>
      </View>

      <View style={[styles.settingCard, currentTheme === "dark" ? styles.darkCard : styles.lightCard]}>
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
            Ativar Notificações
          </Text>
          <Switch
            value={notificationSettings.enabled}
            onValueChange={(value) => setNotificationSettings({
              ...notificationSettings,
              enabled: value
            })}
            trackColor={{ false: "#767577", true: "#3498db" }}
            thumbColor={notificationSettings.enabled ? "#2980b9" : "#f4f3f4"}
          />
        </View>

        {notificationSettings.enabled && (
          <>
            <TouchableOpacity style={styles.settingRow} onPress={showIntervalPicker}>
              <Text style={[styles.settingLabel, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                Intervalo de Verificação
              </Text>
              <View style={styles.settingValueContainer}>
                <Text style={[styles.settingValue, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                  {intervalOptions.find(opt => opt.value === notificationSettings.interval)?.label || 'Personalizado'}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color="#3498db" />
              </View>
            </TouchableOpacity>

            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                Alertas de Stock Baixo
              </Text>
              <Switch
                value={notificationSettings.lowStockEnabled}
                onValueChange={(value) => setNotificationSettings({
                  ...notificationSettings,
                  lowStockEnabled: value
                })}
                trackColor={{ false: "#767577", true: "#f39c12" }}
                thumbColor={notificationSettings.lowStockEnabled ? "#e67e22" : "#f4f3f4"}
              />
            </View>

            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
                Alertas de Falta de Stock
              </Text>
              <Switch
                value={notificationSettings.outOfStockEnabled}
                onValueChange={(value) => setNotificationSettings({
                  ...notificationSettings,
                  outOfStockEnabled: value
                })}
                trackColor={{ false: "#767577", true: "#e74c3c" }}
                thumbColor={notificationSettings.outOfStockEnabled ? "#c0392b" : "#f4f3f4"}
              />
            </View>
          </>
        )}
      </View>

      <View style={styles.stepButtons}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setCurrentStep(2)}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color="#3498db" />
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.finishButton, isLoading && styles.disabledButton]}
          onPress={handleSaveSettings}
          disabled={isLoading}
        >
          <Text style={styles.finishButtonText}>
            {isLoading ? 'A Guardar...' : 'Concluir'}
          </Text>
          <MaterialCommunityIcons name="check" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, currentTheme === "dark" ? styles.darkContainer : styles.lightContainer]}>
      <StatusBar barStyle={currentTheme === "dark" ? "light-content" : "dark-content"} />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Progress Indicator - apenas nos slides 2 e 3 */}
        {currentStep > 1 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${((currentStep - 1) / 2) * 100}%` }]} />
            </View>
            <Text style={[styles.progressText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
              Passo {currentStep - 1} de 2
            </Text>
          </View>
        )}

        {/* Renderizar slide atual */}
        {currentStep === 1 && renderWelcomeSlide()}
        {currentStep === 2 && renderStockSettings()}
        {currentStep === 3 && renderNotificationSettings()}

        {/* Skip Option - apenas nos slides 2 e 3 */}
        {currentStep > 1 && (
          <TouchableOpacity style={styles.skipButton} onPress={onComplete}>
            <Text style={[styles.skipText, currentTheme === "dark" ? styles.darkText : styles.lightText]}>
              Saltar configuração (pode configurar depois nas definições)
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <AlertComponent />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  darkContainer: {
    backgroundColor: '#121212',
  },
  lightContainer: {
    backgroundColor: '#f9f9f9',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  slideContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 24,
  },
  welcomeContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  welcomeDescription: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 24,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  featuresList: {
    width: '100%',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  featureText: {
    fontSize: 16,
    marginLeft: 16,
    flex: 1,
  },
  progressContainer: {
    marginBottom: 30,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3498db',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  stepDescription: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  settingCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  darkCard: {
    backgroundColor: '#2c3e50',
  },
  lightCard: {
    backgroundColor: '#ffffff',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  settingHelper: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 16,
    lineHeight: 20,
  },
  settingValue: {
    fontSize: 14,
    opacity: 0.8,
  },
  settingValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thresholdInput: {
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 20,
    fontSize: 18,
    textAlign: 'center',
    marginTop: 12,
  },
  darkInput: {
    backgroundColor: '#34495e',
    borderColor: '#4a5f7a',
    color: '#ffffff',
  },
  lightInput: {
    backgroundColor: '#f8f9fa',
    borderColor: '#ddd',
    color: '#333',
  },
  singleButtonContainer: {
    marginTop: 40,
  },
  stepButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
    gap: 12,
  },
  nextButton: {
    backgroundColor: '#3498db',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3498db',
    flex: 1,
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#3498db',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  finishButton: {
    backgroundColor: '#27ae60',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  disabledButton: {
    backgroundColor: '#95a5a6',
  },
  skipButton: {
    marginTop: 30,
    padding: 16,
  },
  skipText: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
    textDecorationLine: 'underline',
  },
  darkText: {
    color: '#ffffff',
  },
  lightText: {
    color: '#2c3e50',
  },
});

export default InitialSetupScreen
