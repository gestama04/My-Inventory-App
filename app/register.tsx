import React, { useState, useEffect, useRef } from 'react';
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
  Modal,
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../auth-context';
import { useTheme } from './theme-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import useCustomAlert from '../hooks/useCustomAlert';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { showAlert, AlertComponent } = useCustomAlert();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    hasMinLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false
  });
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false);
  const { register, checkEmailExists } = useAuth();
  const router = useRouter();
  const { currentTheme } = useTheme();

  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        // Force layout update
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ x: 0, y: 0, animated: false });
          
          // Force re-render to update layout
          setForceUpdate(prev => !prev);
        }
      }
    );
  
    return () => {
      keyboardDidHideListener.remove();
    };
  }, []);
  
  useEffect(() => {
    // Reset scroll position when component mounts
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
      }, 100);
    }
  }, []);
  

  // Verificar força da senha quando ela muda
  useEffect(() => {
    checkPasswordStrength(password);
  }, [password]);

  const checkPasswordStrength = (pass: string) => {
    const hasMinLength = pass.length >= 8;
    const hasUpperCase = /[A-Z]/.test(pass);
    const hasLowerCase = /[a-z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
    
    // Calcular pontuação (0-5)
    let score = 0;
    if (hasMinLength) score++;
    if (hasUpperCase) score++;
    if (hasLowerCase) score++;
    if (hasNumber) score++;
    if (hasSpecialChar) score++;
    
    setPasswordStrength({
      score,
      hasMinLength,
      hasUpperCase,
      hasLowerCase,
      hasNumber,
      hasSpecialChar
    });
  };

  const getPasswordStrengthLabel = () => {
    const { score } = passwordStrength;
    if (score === 0) return { label: "Muito fraca", color: "#e74c3c" };
    if (score === 1) return { label: "Fraca", color: "#e74c3c" };
    if (score === 2) return { label: "Razoável", color: "#f39c12" };
    if (score === 3) return { label: "Boa", color: "#f1c40f" };
    if (score === 4) return { label: "Forte", color: "#2ecc71" };
    return { label: "Muito forte", color: "#27ae60" };
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setBirthDate(selectedDate);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  };

  const handleRegister = async () => {
    // Validar campos
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      showAlert('Erro', 'Por favor, preencha todos os campos obrigatórios', [
        { text: 'OK', onPress: () => {} }
      ]);
      return;
    }
     
    if (password !== confirmPassword) {
      showAlert('Erro', 'As passwords não coincidem', [
        { text: 'OK', onPress: () => {} }
      ]);
      return;
    }
     
// Verificar se todos os requisitos de senha foram atendidos
if (!passwordStrength.hasMinLength || 
  !passwordStrength.hasUpperCase || 
  !passwordStrength.hasLowerCase || 
  !passwordStrength.hasNumber || 
  !passwordStrength.hasSpecialChar) {

// Determinar qual requisito está faltando para uma mensagem mais específica
let mensagemErro = 'A sua password deve conter:';
if (!passwordStrength.hasMinLength) mensagemErro += '\n Pelo menos 8 caracteres';
if (!passwordStrength.hasUpperCase) mensagemErro += '\n Pelo menos uma letra maiúscula';
if (!passwordStrength.hasLowerCase) mensagemErro += '\n Pelo menos uma letra minúscula';
if (!passwordStrength.hasNumber) mensagemErro += '\n Pelo menos um número';
if (!passwordStrength.hasSpecialChar) mensagemErro += '\n Pelo menos um caractere especial';

showAlert(
  'Password incompleta',
  mensagemErro,
  [
    { text: 'OK', onPress: () => {} }
  ]
);
return;
}

     
    // Continuar com o registro apenas se a senha for forte o suficiente
    setIsLoading(true);
    
    try {
      // Verificar se o email já existe
      const emailExists = await checkEmailExists(email);
      
      if (emailExists) {
        showAlert(
          'Email já registado',
          'Este email já está em uso. Deseja fazer login?',
          [
            { text: 'Não', style: 'cancel', onPress: () => {} },
            {
              text: 'Sim',
              onPress: () => router.replace('/login')
            }
          ]
        );
        setIsLoading(false);
        return;
      }
      
      
      // Formatar data para string (se existir)
      const birthDateStr = birthDate ? formatDate(birthDate) : undefined;
      
      // Registrar utilizador
      await register(email, password, {
        firstName,
        lastName,
        birthDate: birthDateStr
      });
      
      showAlert(
        'Sucesso', 
        'Conta criada com sucesso!', 
        [
          { text: 'OK', onPress: () => router.replace('/home') }
        ]
      );
      
    } catch (error: any) {
      let errorMessage = 'Falha ao criar conta';
          
      // Mensagens de erro mais amigáveis
      if (error.message.includes('email-already-in-use')) {
        errorMessage = 'Este email já está em uso. Tente fazer login ou use outro email.';
      } else if (error.message.includes('invalid-email')) {
        errorMessage = 'Email inválido. Verifique se digitou corretamente.';
      } else if (error.message.includes('weak-password')) {
        errorMessage = 'A password é muito fraca. Use uma mais forte.';
      }
          
      showAlert('Erro de Registo', errorMessage, [
        { text: 'OK', onPress: () => {} }
      ]);
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
        <Text style={[styles.title, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
          Criar Conta
        </Text>
        
        
        <View style={styles.formContainer}>
          {/* Nome */}
          <TextInput
            style={[
              styles.input,
              currentTheme === 'dark' ? styles.darkInput : styles.lightInput
            ]}
            placeholder="Nome"
            placeholderTextColor={currentTheme === 'dark' ? '#bdc3c7' : '#7f8c8d'}
            value={firstName}
            onChangeText={setFirstName}
          />
          
          {/* Sobrenome */}
          <TextInput
            style={[
              styles.input,
              currentTheme === 'dark' ? styles.darkInput : styles.lightInput
            ]}
            placeholder="Sobrenome"
            placeholderTextColor={currentTheme === 'dark' ? '#bdc3c7' : '#7f8c8d'}
            value={lastName}
            onChangeText={setLastName}
          />
          
          {/* Data de Nascimento */}
          <TouchableOpacity
            style={[
              styles.datePickerButton,
              currentTheme === 'dark' ? styles.darkInput : styles.lightInput
            ]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text
              style={[
                styles.datePickerText,
                birthDate ? (currentTheme === 'dark' ? styles.darkText : styles.lightText) : styles.placeholderText
              ]}
            >
              {birthDate ? formatDate(birthDate) : 'Data de Nascimento (opcional)'}
            </Text>
            <Ionicons
              name="calendar"
              size={24}
              color={currentTheme === 'dark' ? '#bdc3c7' : '#7f8c8d'}
            />
          </TouchableOpacity>
          
          {showDatePicker && (
            <DateTimePicker
              value={birthDate || new Date()}
              mode="date"
              display="default"
              onChange={handleDateChange}
              maximumDate={new Date()}
            />
          )}
          
          {/* Email */}
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
          
          {/* Senha */}
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
              onFocus={() => setShowPasswordRequirements(true)}
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
          
          {/* Indicador de força da senha */}
          {password.length > 0 && (
            <View style={styles.strengthContainer}>
              <View style={styles.strengthBar}>
                {[1, 2, 3, 4, 5].map((level) => (
                                    <View
                                    key={level}
                                    style={[
                                      styles.strengthSegment,
                                      { backgroundColor: level <= passwordStrength.score ? getPasswordStrengthLabel().color : '#e0e0e0' }
                                    ]}
                                  />
                                ))}
                              </View>
                              <Text style={[styles.strengthText, { color: getPasswordStrengthLabel().color }]}>
                                {getPasswordStrengthLabel().label}
                              </Text>
                            </View>
                          )}
                          
                          {/* Requisitos de senha */}
                          {showPasswordRequirements && (
                            <View style={styles.requirementsContainer}>
                              <Text style={[styles.requirementsTitle, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
                                A password deve conter:
                              </Text>
                              <View style={styles.requirementItem}>
                                <Ionicons
                                  name={passwordStrength.hasMinLength ? 'checkmark-circle' : 'close-circle'}
                                  size={16}
                                  color={passwordStrength.hasMinLength ? '#2ecc71' : '#e74c3c'}
                                />
                                <Text style={[styles.requirementText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
                                  Pelo menos 8 caracteres
                                </Text>
                              </View>
                              <View style={styles.requirementItem}>
                                <Ionicons
                                  name={passwordStrength.hasUpperCase ? 'checkmark-circle' : 'close-circle'}
                                  size={16}
                                  color={passwordStrength.hasUpperCase ? '#2ecc71' : '#e74c3c'}
                                />
                                <Text style={[styles.requirementText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
                                  Pelo menos uma letra maiúscula
                                </Text>
                              </View>
                              <View style={styles.requirementItem}>
                                <Ionicons
                                  name={passwordStrength.hasLowerCase ? 'checkmark-circle' : 'close-circle'}
                                  size={16}
                                  color={passwordStrength.hasLowerCase ? '#2ecc71' : '#e74c3c'}
                                />
                                <Text style={[styles.requirementText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
                                  Pelo menos uma letra minúscula
                                </Text>
                              </View>
                              <View style={styles.requirementItem}>
                                <Ionicons
                                  name={passwordStrength.hasNumber ? 'checkmark-circle' : 'close-circle'}
                                  size={16}
                                  color={passwordStrength.hasNumber ? '#2ecc71' : '#e74c3c'}
                                />
                                <Text style={[styles.requirementText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
                                  Pelo menos um número
                                </Text>
                              </View>
                              <View style={styles.requirementItem}>
                                <Ionicons
                                  name={passwordStrength.hasSpecialChar ? 'checkmark-circle' : 'close-circle'}
                                  size={16}
                                  color={passwordStrength.hasSpecialChar ? '#2ecc71' : '#e74c3c'}
                                />
                                <Text style={[styles.requirementText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
                                  Pelo menos um caractere especial
                                </Text>
                              </View>
                            </View>
                          )}
                          
                          {/* Confirmar Senha */}
                          <View style={styles.passwordContainer}>
                            <TextInput
                              style={[
                                styles.passwordInput,
                                currentTheme === 'dark' ? styles.darkInput : styles.lightInput
                              ]}
                              placeholder="Confirmar Password"
                              placeholderTextColor={currentTheme === 'dark' ? '#bdc3c7' : '#7f8c8d'}
                              value={confirmPassword}
                              onChangeText={setConfirmPassword}
                              secureTextEntry={!showConfirmPassword}
                            />
                            <TouchableOpacity 
                              style={styles.eyeIcon}
                              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                              <Ionicons 
                                name={showConfirmPassword ? 'eye-off' : 'eye'} 
                                size={24} 
                                color={currentTheme === 'dark' ? '#bdc3c7' : '#7f8c8d'} 
                              />
                            </TouchableOpacity>
                          </View>
                          
                          {/* Botão de Registo */}
                          <TouchableOpacity
                            style={[styles.button, isLoading && styles.disabledButton]}
                            onPress={handleRegister}
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <ActivityIndicator color="#fff" />
                            ) : (
                              <Text style={styles.buttonText}>Registar</Text>
                            )}
                          </TouchableOpacity>
                          
                          {/* Link para Login */}
                          <TouchableOpacity
                            style={styles.loginLink}
                            onPress={() => router.push('/login' as any)}
                          >
                            <Text style={[styles.loginText, currentTheme === 'dark' ? styles.darkText : styles.lightText]}>
                              Já tem uma conta? Faça login
                            </Text>
                          </TouchableOpacity>
                        </View>
                      
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
                  title: {
                    fontSize: 28,
                    fontWeight: 'bold',
                    marginBottom: 30,
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
                  datePickerButton: {
                    height: 50,
                    borderWidth: 1,
                    borderRadius: 8,
                    marginBottom: 15,
                    paddingHorizontal: 15,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  },
                  datePickerText: {
                    fontSize: 16,
                  },
                  placeholderText: {
                    color: '#7f8c8d',
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
                  strengthContainer: {
                    marginBottom: 15,
                  },
                  strengthBar: {
                    flexDirection: 'row',
                    height: 5,
                    marginBottom: 5,
                  },
                  strengthSegment: {
                    flex: 1,
                    marginHorizontal: 2,
                    borderRadius: 5,
                  },
                  strengthText: {
                    fontSize: 12,
                    textAlign: 'right',
                  },
                  requirementsContainer: {
                    marginBottom: 15,
                    padding: 10,
                    backgroundColor: 'rgba(0,0,0,0.05)',
                    borderRadius: 8,
                  },
                  requirementsTitle: {
                    fontSize: 14,
                    fontWeight: 'bold',
                    marginBottom: 5,
                  },
                  requirementItem: {
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginVertical: 3,
                  },
                  requirementText: {
                    fontSize: 12,
                    marginLeft: 5,
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
                  loginLink: {
                    marginTop: 20,
                    alignItems: 'center',
                  },
                  loginText: {
                    fontSize: 16,
                  },
                  modalOverlay: {
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 20,
                  },
                  modalContent: {
                    width: '90%',
                    padding: 20,
                    borderRadius: 10,
                    alignItems: 'center',
                  },
                  darkModal: {
                    backgroundColor: '#2c3e50',
                  },
                  lightModal: {
                    backgroundColor: '#ffffff',
                  },
                  modalTitle: {
                    fontSize: 18,
                    fontWeight: 'bold',
                    marginBottom: 15,
                  },
                  modalText: {
                    fontSize: 14,
                    lineHeight: 22,
                    marginBottom: 20,
                    textAlign: 'left',
                    alignSelf: 'stretch',
                  },
                  modalButton: {
                    backgroundColor: '#3498db',
                    paddingVertical: 10,
                    paddingHorizontal: 20,
                    borderRadius: 5,
                  },
                  modalButtonText: {
                    color: '#ffffff',
                    fontWeight: 'bold',
                  },
                });
                