import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Switch,
  Keyboard,
  Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../auth-context';
import { useTheme } from './theme-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useCustomAlert from '../hooks/useCustomAlert';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { showAlert, AlertComponent } = useCustomAlert();
  const { login, resetPassword } = useAuth();
  const router = useRouter();
  const { currentTheme } = useTheme();

  // Carregar preferência de "lembrar-me" ao iniciar
  useEffect(() => {
    const loadRememberMe = async () => {
      try {
        const savedRememberMe = await AsyncStorage.getItem('rememberMe');
        if (savedRememberMe === 'true') {
          setRememberMe(true);
          
          // Opcionalmente, carregar o email salvo
          const savedEmail = await AsyncStorage.getItem('savedEmail');
          if (savedEmail) {
            setEmail(savedEmail);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar preferências:', error);
      }
    };
    
    loadRememberMe();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert('Erro', 'Por favor, preencha todos os campos', [
        { text: 'OK', onPress: () => {} }
      ]);
      return;
    }
    setIsLoading(true);
    try {
      // Salvar email se "lembrar-me" estiver ativado
      if (rememberMe) {
        await AsyncStorage.setItem('savedEmail', email);
      } else {
        await AsyncStorage.removeItem('savedEmail');
      }
      
      await login(email, password, rememberMe);
      router.replace('/home' as any);
    } catch (error: any) {
      console.log('Erro de login:', error.code, error.message);
      
      let errorMessage = 'Falha ao fazer login. Verifique suas credenciais e tente novamente.';
      
      // Verificar o código de erro do Firebase
      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
            errorMessage = 'Utilizador não encontrado. Verifique o email ou registe-se.';
            break;
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            errorMessage = 'Email ou password incorretos. Tente novamente.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Email inválido. Por favor, verifique o formato do email.';
            break;
          case 'auth/user-disabled':
            errorMessage = 'Esta conta foi desativada. Contacte o suporte.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Muitas tentativas de login. Tente novamente mais tarde.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Erro de conexão. Verifique a sua ligação à internet e tente novamente.';
            break;
          // Não incluir o error.message no caso padrão
        }
      }
      
      showAlert('Erro de Login', errorMessage, [
        { text: 'OK', onPress: () => {} }
      ]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail) {
      showAlert('Erro', 'Por favor, insira o seu email para redefinir a password', [
        { text: 'OK', onPress: () => {} }
      ]);
      return;
    }
    
    setIsLoading(true);
    try {
      await resetPassword(forgotPasswordEmail);
      showAlert(
        'Email Enviado',
        'Verifique o seu email para instruções de redefinição de password',
        [{ text: 'OK', onPress: () => setShowForgotPassword(false) }]
      );
    } catch (error: any) {
      showAlert(
        'Erro',
        'Não foi possível enviar o email de redefinição. Verifique se o email está correto.',
        [{ text: 'OK', onPress: () => {} }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, currentTheme === 'dark' ? styles.darkContainer : styles.lightContainer]}
      enabled={Platform.OS === 'ios'}
    >
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={20}
        extraHeight={120}
        resetScrollToCoords={{ x: 0, y: 0 }}
        enableResetScrollToCoords={true}
      >
        {/* Logo da aplicação */}
        <View style={styles.logoContainer}>
          <Image 
            source={require('../assets/images/logo.png')} 
            style={styles.logo} 
            resizeMode="contain"
          />
        </View>

        <Text style={[styles.title, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
          My Inventory
        </Text>
        
        {showForgotPassword ? (
          <View style={styles.formContainer}>
            <Text style={[styles.subtitle, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
              Recuperar Password
            </Text>
            
            <TextInput
              style={[
                styles.input,
                currentTheme === 'dark' ? styles.darkInput : styles.lightInput
              ]}
              placeholder="Email"
              placeholderTextColor={currentTheme === 'dark' ? '#bdc3c7' : '#7f8c8d'}
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
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Enviar Email</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => setShowForgotPassword(false)}
            >
              <Text style={[styles.linkText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
                Voltar ao Login
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.formContainer}>
            <TextInput
              style={[
                styles.input,
                currentTheme === 'dark' ? styles.darkInput : styles.lightInput
              ]}
              placeholder="Email"
              placeholderTextColor={currentTheme === 'dark' ? '#bdc3c7' : '#7f8c8d'}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <View style={styles.passwordContainer}>
              <TextInput
                style={[
                  styles.passwordInput,
                  currentTheme === 'dark' ? styles.darkInput : styles.lightInput
                ]}
                placeholder="Password"
                placeholderTextColor={currentTheme === 'dark' ? '#bdc3c7' : '#7f8c8d'}
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
                  size={24}
                  color={currentTheme === 'dark' ? '#bdc3c7' : '#7f8c8d'}
                />
              </TouchableOpacity>
            </View>
            
            <View style={styles.optionsContainer}>
              <View style={styles.rememberContainer}>
                <Switch
                  value={rememberMe}
                  onValueChange={setRememberMe}
                  trackColor={{ false: '#767577', true: '#81b0ff' }}
                  thumbColor={rememberMe ? '#3498db' : '#f4f3f4'}
                />
                <Text style={[styles.rememberText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
                  Lembrar-me
                </Text>
              </View>
              
              <TouchableOpacity
                style={styles.forgotButton}
                onPress={() => {
                  setForgotPasswordEmail(email);
                  setShowForgotPassword(true);
                }}
              >
                <Text style={[styles.forgotText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
                  Esqueceu-se da password?
                </Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={[styles.button, isLoading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Entrar</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.registerLink}
              onPress={() => router.push('/register' as any)}
            >
              <Text style={[styles.registerText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
                Não tem uma conta? Registe-se
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAwareScrollView>
      <AlertComponent />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  darkContainer: {
    backgroundColor: '#121212',
  },
  lightContainer: {
    backgroundColor: '#f9f9f9',
  },
  // Novos estilos para o logo
  logoContainer: {
    alignItems: 'center',
    marginBottom: 5,
  },
  logo: {
    width: 99,
    height: 99,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  darkText: {
    color: '#ffffff',
  },
  lightText: {
    color: '#2c3e50',
  },
  formContainer: {
    width: '100%',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  passwordInput: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    paddingRight: 50, // Espaço para o ícone
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: 13,
  },
  darkInput: {
    backgroundColor: '#2c3e50',
    borderColor: '#34495e',
    color: '#ffffff',
  },
  lightInput: {
    backgroundColor: '#ffffff',
    borderColor: '#ddd',
    color: '#333',
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  rememberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rememberText: {
    marginLeft: 8,
    fontSize: 14,
  },
  forgotButton: {
    padding: 5,
  },
  forgotText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  button: {
    backgroundColor: '#3498db',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: '#7f8c8d',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  registerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  registerText: {
    fontSize: 16,
  },
  linkButton: {
    marginTop: 15,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});
