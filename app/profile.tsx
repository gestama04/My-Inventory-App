import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useTheme } from './theme-context';
import { useAuth } from '../auth-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { updateProfile } from 'firebase/auth';
import { auth, storage } from '../firebase-config';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import useCustomAlert from '../hooks/useCustomAlert';
import { uploadImage } from '../firebase-service';

export default function ProfileScreen() {
  const router = useRouter();
  const { currentTheme } = useTheme();
  const { currentUser, logout, reloadUser } = useAuth();
  const { showAlert, AlertComponent } = useCustomAlert();
  
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || '');
      setEmail(currentUser.email || '');
      setPhotoURL(currentUser.photoURL);
    }
  }, [currentUser]);

  const handleLogout = async () => {
    showAlert(
        'Terminar Sessão',
        'Tem a certeza de que deseja sair da sua conta?',
        [
          {
            text: 'Cancelar',
            style: 'cancel',
            onPress: () => {} // Adicionar função vazia
          },
          {
            text: 'Sair',
            style: 'destructive',
            onPress: async () => {
              try {
                await logout();
                router.replace('/login');
              } catch (error) {
                console.error('Erro ao fazer logout:', error);
              }
            }
          }
        ]
      );
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        showAlert('Permissão negada', 'Precisamos de permissão para acessar suas fotos.', [
          { text: 'OK', onPress: () => {} }  // Adicionar onPress
        ]);
        return;
      }
      
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsLoading(true);
        const selectedAsset = result.assets[0];
        
        // Redimensionar e comprimir a imagem
        const manipResult = await manipulateAsync(
          selectedAsset.uri,
          [{ resize: { width: 300, height: 300 } }],
          { compress: 0.7, format: SaveFormat.JPEG }
        );
        
        // Converter para base64
        const base64 = await FileSystem.readAsStringAsync(manipResult.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Atualizar a UI imediatamente com a imagem local
        setPhotoURL(`data:image/jpeg;base64,${base64}`);
        setIsLoading(false);
      }
    } catch (error) {
        console.error('Erro ao selecionar imagem:', error);
        setIsLoading(false);
        showAlert('Erro', 'Não foi possível selecionar a imagem.', [
          { text: 'OK', onPress: () => {} }  // Adicionar onPress
        ]);
      }
      
  };

  const deleteAccount = async () => {
    showAlert(
      'Apagar Conta',
      'Tem a certeza de que deseja apagar a sua conta? Esta ação é irreversível. Todos os seus dados serão perdidos, se não os quiser perder faça um backup.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => {}
        },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              
              // Obter o utilizador atual
              const user = auth.currentUser;
              if (!user) {
                throw new Error('Nenhum utilizador autenticado');
              }
              
              // Deletar o utilizador
              await user.delete();
              
              showAlert(
                'Conta Apagada',
                'A sua conta foi apagada com sucesso.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Redirecionar para a tela de login
                      router.replace('/login');
                    }
                  }
                ]
              );
            } catch (error: any) {
              console.error('Erro ao apagar conta:', error);
              
              // Verificar se o erro é devido à necessidade de reautenticação
              if (error.code === 'auth/requires-recent-login') {
                showAlert(
                  'Sessão Expirada',
                  'Por motivos de segurança, você precisa fazer login novamente antes de apagar sua conta.',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        // Fazer logout e redirecionar para login
                        logout();
                        router.replace('/login');
                      }
                    }
                  ]
                );
              } else {
                showAlert(
                  'Erro',
                  'Não foi possível apagar sua conta. Tente novamente mais tarde.',
                  [{ text: 'OK', onPress: () => {} }]
                );
              }
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };
  

  const saveProfile = async () => {
    if (!currentUser) return;
    
    try {
      setIsSaving(true);
      
      // Preparar dados para atualização
      const updateData: { displayName?: string; photoURL?: string } = {};
      
      // Atualizar nome se foi alterado
      if (displayName !== currentUser.displayName) {
        updateData.displayName = displayName;
      }
      
      // Fazer upload da foto se foi alterada e é uma string base64
      if (photoURL && photoURL !== currentUser.photoURL && photoURL.startsWith('data:image')) {
        try {
          console.log("Iniciando upload da imagem de perfil...");
          
          // Extrair a parte base64 da string
          let base64Data = photoURL;
          if (base64Data.includes('base64,')) {
            base64Data = base64Data.split('base64,')[1];
          }
          
          // Usar a função uploadImage do firebase-service.ts
          const path = `profile/${currentUser.uid}/profile.jpg`;
          const downloadURL = await uploadImage(base64Data, path);
          
          console.log("Upload da imagem de perfil concluído, URL:", downloadURL);
          
          // Adicionar URL ao objeto de atualização
          updateData.photoURL = downloadURL;
        } catch (error) {
          console.error('Erro ao fazer upload da imagem:', error);
          throw new Error('Falha ao fazer upload da imagem de perfil');
        }
      }
      
      // Se há dados para atualizar
      if (Object.keys(updateData).length > 0) {
        console.log('🔄 Atualizando perfil com dados:', updateData);
        
        // 🆕 USAR auth.currentUser DIRETAMENTE
        if (!auth.currentUser) {
          throw new Error('Usuário não autenticado');
        }
        
        await updateProfile(auth.currentUser, updateData);
        console.log('✅ updateProfile concluído');
        
        // 🆕 RECARREGAR O USUÁRIO NO CONTEXTO
        await reloadUser();
        console.log('✅ Contexto do usuário atualizado');
        
        showAlert(
          'Sucesso',
          'Perfil atualizado com sucesso!',
          [
            {
              text: 'OK',
              onPress: () => {} 
            }
          ]
        );
      }
      
      setIsEditing(false);
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      
      let errorMessage = 'Não foi possível atualizar o perfil. Tente novamente.';
      
      if (error instanceof Error) {
        if (error.message.includes('upload')) {
          errorMessage = 'Erro ao fazer upload da imagem. Verifique sua conexão e tente novamente.';
        } else if (error.message.includes('não autenticado')) {
          errorMessage = 'Sessão expirada. Por favor, faça login novamente.';
        }
      }
      
      showAlert('Erro', errorMessage, [
        { text: 'OK', onPress: () => {} }
      ]);
      
    } finally {
      setIsSaving(false);
    }
  };
  

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[
        styles.container,
        currentTheme === 'dark' ? styles.darkContainer : styles.lightContainer
      ]}
    >
      <Stack.Screen 
        options={{ 
          headerShown: true,
          title: 'Perfil',
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
        <View style={styles.profileHeader}>
          <TouchableOpacity 
            style={styles.profileImageContainer}
            onPress={isEditing ? pickImage : undefined}
            disabled={!isEditing || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="large" color="#3498db" />
            ) : photoURL ? (
              <Image 
                source={{ uri: photoURL }} 
                style={styles.profileImage} 
              />
            ) : (
              <View style={[
                styles.profileImagePlaceholder,
                { backgroundColor: currentTheme === 'dark' ? '#34495e' : '#bdc3c7' }
              ]}>
                <Text style={styles.profileInitial}>
                  {displayName ? displayName[0].toUpperCase() : 
                   email ? email[0].toUpperCase() : "?"}
                </Text>
              </View>
            )}
            
            {isEditing && (
              <View style={styles.editImageBadge}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          
          <Text style={[
            styles.profileName,
            currentTheme === 'dark' ? styles.darkText : styles.lightText
          ]}>
            {displayName || 'Utilizador'}
          </Text>
          
          <Text style={styles.profileEmail}>
            {email}
          </Text>
        </View>
        
        <View style={[
  styles.profileCard,
  currentTheme === 'dark' ? styles.darkCard : styles.lightCard
]}>
  <View style={styles.cardHeader}>
    <Text style={[
      styles.cardTitle,
      currentTheme === 'dark' ? styles.darkText : styles.lightText
    ]}>
      Informações Pessoais
    </Text>
    
    {!isEditing ? (
      <TouchableOpacity
        style={styles.editButton}
        onPress={() => setIsEditing(true)}
      >
        <Ionicons name="pencil" size={18} color="#3498db" />
        <Text style={styles.editButtonText}>Editar</Text>
      </TouchableOpacity>
    ) : null}
  </View>
  
  {/* Botões de ação quando estiver editando */}
  {isEditing && (
    <View style={styles.editActionsContainer}>
      <TouchableOpacity
        style={[styles.actionButton, styles.cancelButton]}
        onPress={() => {
          setIsEditing(false);
          // Restaurar valores originais
          if (currentUser) {
            setDisplayName(currentUser.displayName || '');
            setPhotoURL(currentUser.photoURL);
          }
        }}
        disabled={isSaving}
      >
        <Text style={styles.actionButtonText}>Cancelar</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.actionButton, styles.saveButton]}
        onPress={saveProfile}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.actionButtonText}>Guardar</Text>
        )}
      </TouchableOpacity>
    </View>
  )}
  
  <View style={styles.formGroup}>
    <Text style={[
      styles.inputLabel,
      currentTheme === 'dark' ? styles.darkText : styles.lightText
    ]}>
      Nome
    </Text>
    <TextInput
      style={[
        styles.input,
        currentTheme === 'dark' ? styles.darkInput : styles.lightInput,
        !isEditing && styles.disabledInput
      ]}
      value={displayName}
      onChangeText={setDisplayName}
      placeholder="Seu nome"
      placeholderTextColor={currentTheme === 'dark' ? '#666' : '#999'}
      editable={isEditing}
    />
  </View>
  
  <View style={styles.formGroup}>
    <Text style={[
      styles.inputLabel,
      currentTheme === 'dark' ? styles.darkText : styles.lightText
    ]}>
      Email
    </Text>
    <TextInput
      style={[
        styles.input,
        currentTheme === 'dark' ? styles.darkInput : styles.lightInput,
        styles.disabledInput
      ]}
      value={email}
      placeholder="Seu email"
      placeholderTextColor={currentTheme === 'dark' ? '#666' : '#999'}
      editable={false}
    />
    <Text style={styles.helperText}>
      O email não pode ser alterado
    </Text>
  </View>
</View>

        
        <View style={[
                    styles.profileCard,
                    currentTheme === 'dark' ? styles.darkCard : styles.lightCard
                  ]}>
                    <View style={styles.cardHeader}>
                      <Text style={[
                        styles.cardTitle,
                        currentTheme === 'dark' ? styles.darkText : styles.lightText
                      ]}>
                        Conta
                      </Text>
                    </View>
                    
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => router.push('/settings')}
                    >
                      <Ionicons name="settings-outline" size={24} color={currentTheme === 'dark' ? '#bdc3c7' : '#7f8c8d'} />
                      <Text style={[
                        styles.menuItemText,
                        currentTheme === 'dark' ? styles.darkText : styles.lightText
                      ]}>
                        Definições
                      </Text>
                      <Ionicons name="chevron-forward" size={20} color={currentTheme === 'dark' ? '#bdc3c7' : '#7f8c8d'} />
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => router.push('/help')}
                    >
                      <Ionicons name="help-circle-outline" size={24} color={currentTheme === 'dark' ? '#bdc3c7' : '#7f8c8d'} />
                      <Text style={[
                        styles.menuItemText,
                        currentTheme === 'dark' ? styles.darkText : styles.lightText
                      ]}>
                        Ajuda e Suporte
                      </Text>
                      <Ionicons name="chevron-forward" size={20} color={currentTheme === 'dark' ? '#bdc3c7' : '#7f8c8d'} />
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => router.push('/about')}
                    >
                      <Ionicons name="information-circle-outline" size={24} color={currentTheme === 'dark' ? '#bdc3c7' : '#7f8c8d'} />
                      <Text style={[
                        styles.menuItemText,
                        currentTheme === 'dark' ? styles.darkText : styles.lightText
                      ]}>
                        Sobre a App
                      </Text>
                      <Ionicons name="chevron-forward" size={20} color={currentTheme === 'dark' ? '#bdc3c7' : '#7f8c8d'} />
                    </TouchableOpacity>

                    <TouchableOpacity
  style={[styles.menuItem, styles.deleteAccountItem]}
  onPress={deleteAccount}
>
  <Ionicons name="trash-outline" size={24} color="#e74c3c" />
  <Text style={[
    styles.menuItemText,
    styles.deleteAccountText
  ]}>
    Apagar Conta
  </Text>
  <Ionicons name="chevron-forward" size={20} color="#e74c3c" />
</TouchableOpacity>

                  </View>
                  
                  <TouchableOpacity
                    style={[
                      styles.logoutButton,
                      currentTheme === 'dark' ? styles.darkLogoutButton : styles.lightLogoutButton
                    ]}
                    onPress={handleLogout}
                  >
                    <Ionicons name="log-out-outline" size={20} color="#e74c3c" />
                    <Text style={styles.logoutText}>Terminar Sessão</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.versionContainer}>
                    <Text style={[
                      styles.versionText,
                      currentTheme === 'dark' ? styles.darkSecondaryText : styles.lightSecondaryText
                    ]}>
                      2025 © My Inventory - Todos os direitos reservados
                    </Text>
                  </View>
                </ScrollView>
                
                <AlertComponent />
              </KeyboardAvoidingView>
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
            profileHeader: {
              alignItems: 'center',
              marginBottom: 30,
            },
            profileImageContainer: {
              width: 120,
              height: 120,
              borderRadius: 60,
              marginBottom: 16,
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
              overflow: 'visible',
            },
            profileImage: {
              width: 120,
              height: 120,
              borderRadius: 60,
              borderWidth: 3,
              borderColor: '#3498db',
            },
            profileImagePlaceholder: {
              width: 120,
              height: 120,
              borderRadius: 60,
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 3,
              borderColor: '#3498db',
            },
            profileInitial: {
              fontSize: 48,
              fontWeight: 'bold',
              color: '#fff',
            },
            editImageBadge: {
              position: 'absolute',
              bottom: 0,
              right: 0,
              backgroundColor: '#3498db',
              width: 36,
              height: 36,
              borderRadius: 18,
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 2,
              borderColor: '#fff',
            },
            profileName: {
              fontSize: 24,
              fontWeight: 'bold',
              marginBottom: 4,
            },
            profileEmail: {
              fontSize: 16,
              color: '#7f8c8d',
            },
            profileCard: {
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            },
            darkCard: {
              backgroundColor: '#1e1e1e',
            },
            lightCard: {
              backgroundColor: '#fff',
            },
            cardHeader: {
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
            },
            cardTitle: {
              fontSize: 18,
              fontWeight: 'bold',
            },
            editButton: {
              flexDirection: 'row',
              alignItems: 'center',
            },
            editButtonText: {
              color: '#3498db',
              marginLeft: 5,
              fontWeight: '500',
            },
            editActions: {
              flexDirection: 'row',
            },
            actionButton: {
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 8,
              marginLeft: 10,
            },
            cancelButton: {
              backgroundColor: '#95a5a6',
            },
            saveButton: {
              backgroundColor: '#3498db',
            },
            actionButtonText: {
              color: '#fff',
              fontWeight: '500',
            },
            formGroup: {
              marginBottom: 20,
            },
            inputLabel: {
              fontSize: 16,
              marginBottom: 8,
              fontWeight: '500',
            },
            input: {
              height: 50,
              borderRadius: 8,
              paddingHorizontal: 16,
              fontSize: 16,
              borderWidth: 1,
            },
            darkInput: {
              backgroundColor: '#2c3e50',
              borderColor: '#34495e',
              color: '#fff',
            },
            lightInput: {
              backgroundColor: '#f9f9f9',
              borderColor: '#ddd',
              color: '#333',
            },
            disabledInput: {
              opacity: 0.7,
            },
            helperText: {
              fontSize: 12,
              color: '#7f8c8d',
              marginTop: 4,
              marginLeft: 4,
            },
            editActionsContainer: {
                flexDirection: 'row',
                justifyContent: 'center',
                marginBottom: 16,
              },
              deleteAccountItem: {
                borderBottomWidth: 0,
              },
              deleteAccountText: {
                color: '#e74c3c',
              },
              
            menuItem: {
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(150, 150, 150, 0.2)',
            },
            menuItemText: {
              flex: 1,
              fontSize: 16,
              marginLeft: 16,
            },
            logoutButton: {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              borderRadius: 12,
              marginVertical: 10,
            },
            darkLogoutButton: {
              backgroundColor: 'rgba(231, 76, 60, 0.2)',
            },
            lightLogoutButton: {
              backgroundColor: 'rgba(231, 76, 60, 0.1)',
            },
            logoutText: {
              color: '#e74c3c',
              fontSize: 16,
              fontWeight: '600',
              marginLeft: 8,
            },
            versionContainer: {
              alignItems: 'center',
              marginTop: 20,
            },
            versionText: {
              fontSize: 14,
            },
            darkText: {
              color: '#fff',
            },
            lightText: {
              color: '#2c3e50',
            },
            darkSecondaryText: {
              color: '#95a5a6',
            },
            lightSecondaryText: {
              color: '#7f8c8d',
            },
          });
          
