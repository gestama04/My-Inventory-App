import React, { createContext, useState, useEffect, useContext } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  User,
   sendEmailVerification
} from 'firebase/auth';
import { auth, db } from './firebase-config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { clearAllListeners } from './firestore-listeners';
import * as Notifications from 'expo-notifications';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe: boolean) => Promise<User>; // Alterado para Promise<User>
  register: (email: string, password: string, userData: UserData) => Promise<User | null>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  checkEmailExists: (email: string) => Promise<boolean>;
  reloadUser: () => Promise<void>;
}

interface UserData {
  firstName: string;
  lastName: string;
  birthDate?: string;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  login: async () => { return null as unknown as User },
  register: async () => null,
  logout: async () => {},
  resetPassword: async () => {},
  checkEmailExists: async () => false,
  reloadUser: async () => {}, // 🆕 NOVA FUNÇÃO
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 🆕 FUNÇÃO PARA RECARREGAR O USUÁRIO
  const reloadUser = async () => {
    try {
      if (auth.currentUser) {
        console.log('🔄 Recarregando dados do usuário...');
        await auth.currentUser.reload();
        
        // Forçar atualização do estado
        setCurrentUser({...auth.currentUser});
        console.log('✅ Usuário recarregado com sucesso');
      }
    } catch (error) {
      console.error('❌ Erro ao recarregar usuário:', error);
    }
  };

  // Função para persistir o utilizador no AsyncStorage
  const persistUser = async (user: User | null, rememberMe: boolean = false) => {
    try {
      if (user && rememberMe) {
        // Armazenar apenas os dados necessários do utilizador
        const userData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        };
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        await AsyncStorage.setItem('rememberMe', 'true');
      } else {
        await AsyncStorage.removeItem('user');
        await AsyncStorage.removeItem('rememberMe');
      }
    } catch (error) {
      console.error('Erro ao persistir utilizador:', error);
    }
  };

useEffect(() => {
  const loadPersistedUser = async () => {
    try {
      if (!auth) {
        console.error("Firebase Auth não está disponível");
        setLoading(false);
        return;
      }

      const rememberMe = await AsyncStorage.getItem('rememberMe');
      if (rememberMe !== 'true') {
        setLoading(false);
        return;
      }
    } catch (error) {
      console.error('Erro ao verificar rememberMe:', error);
      setLoading(false);
    }
  };

  loadPersistedUser();

  try {
    if (!auth) {
      console.error("Firebase Auth não está disponível");
      setLoading(false);
      return () => {};
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoading(false);
      
      // 🆕 SALVAR TOKEN SEMPRE QUE O USUÁRIO ESTIVER LOGADO
      if (user && user.emailVerified) {
        try {
          console.log('🔔 Configurando notificações para usuário logado...');
          
          const { NotificationService } = await import('./services/notification-service');
          await NotificationService.initialize();
          
          // Verificar se já tem token salvo
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const userData = userDoc.data();
          
          if (!userData?.expoPushToken) {
            console.log('📱 Solicitando permissões de notificação...');
            
            const { status } = await Notifications.requestPermissionsAsync();
            console.log('Permission status:', status);
            
            if (status === 'granted') {
              const token = await Notifications.getExpoPushTokenAsync({
                projectId: '3abf848f-326e-4719-a3c6-9c4c60605aa7'
              });
              
              if (token) {
                await setDoc(doc(db, 'users', user.uid), {
                  expoPushToken: token.data,
                  lastTokenUpdate: new Date()
                }, { merge: true });
                
                console.log('✅ Expo Push Token salvo:', token.data);
              }
            } else {
              console.log('❌ Permissão de notificação negada');
            }
          } else {
            console.log('✅ Token já existe:', userData.expoPushToken);
          }
        } catch (tokenError) {
          console.error('❌ Erro ao configurar notificações:', tokenError);
        }
      }
    });

    return unsubscribe;
  } catch (error) {
    console.error("Erro ao configurar listener de autenticação:", error);
    setLoading(false);
    return () => {};
  }
}, []);

const login = async (email: string, password: string, rememberMe: boolean = false) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Verificar se o email foi verificado
    if (!user.emailVerified) {
      // Enviar novo email de verificação
      await sendEmailVerification(user);
      
      // Fazer logout do usuário
      await signOut(auth);
      
      // Lançar um erro específico para email não verificado
      throw new Error('email-not-verified');
    }
    
    // Se o email estiver verificado, continuar com o login normal
    await persistUser(user, rememberMe);
    
    // 🆕 SALVAR EXPO PUSH TOKEN
    try {
      const { NotificationService } = await import('./services/notification-service');
      await NotificationService.initialize();
      
      // Salvar Expo Push Token no Firestore
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        const token = await Notifications.getExpoPushTokenAsync({
          projectId: '3abf848f-326e-4719-a3c6-9c4c60605aa7'
        });
        
        if (token) {
          await setDoc(doc(db, 'users', user.uid), {
            expoPushToken: token.data,
            lastTokenUpdate: new Date()
          }, { merge: true });
          
          console.log('✅ Expo Push Token salvo:', token.data);
        }
      }
    } catch (tokenError) {
      console.error('❌ Erro ao salvar push token:', tokenError);
      // Não falhar o login por causa do token
    }
    
    return user;
  } catch (error) {
    // Propagar o erro original completo, mantendo o código de erro
    throw error;
  }
};

  

const register = async (email: string, password: string, userData: UserData) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
    // Atualizar o perfil do utilizador com o nome completo
    const displayName = `${userData.firstName} ${userData.lastName}`;
    if (userCredential.user) {
      await updateProfile(userCredential.user, {
        displayName: displayName
      });
        
      // Enviar email de verificação
      await sendEmailVerification(userCredential.user);
        
      // Salvar dados adicionais no Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        firstName: userData.firstName,
        lastName: userData.lastName,
        birthDate: userData.birthDate || null,
        email: email,
        createdAt: new Date(),
        emailVerified: false // Adicionar campo para rastrear status de verificação
      });
        
      // Atualizar o utilizador atual para refletir as mudanças
      setCurrentUser({...userCredential.user});
    }
      
    return userCredential.user;
  } catch (error) {
    throw error; // Propagar o erro original
  }
};

const logout = async () => {
  try {
    // 🆕 LIMPAR LISTENERS ANTES DO LOGOUT
    clearAllListeners();
    
    // Parar a verificação periódica de stock
    const { NotificationService } = await import('./services/notification-service');
    NotificationService.stopPeriodicStockCheck();
    
    // Limpar AsyncStorage items que podem ser usados para requisições do Firestore
    await AsyncStorage.removeItem("cachedInventory");
    await AsyncStorage.removeItem("cachedItemHistory");
    await AsyncStorage.removeItem("inventory_stats_" + auth.currentUser?.uid);
    await AsyncStorage.removeItem("userSettings");
    await AsyncStorage.removeItem("syncQueue");
    await AsyncStorage.removeItem("localItemHistory");
    await AsyncStorage.removeItem("lastStockNotificationTime");
    
    // Fazer logout do Firebase Auth
    await signOut(auth);
    
    // Limpar dados do utilizador do AsyncStorage
    await persistUser(null);
    
    // Adicionar um pequeno atraso para garantir que todas as operações sejam concluídas
    await new Promise(resolve => setTimeout(resolve, 300));
  } catch (error: any) {
    console.error('Erro ao fazer logout:', error);
    throw new Error(error.message);
  }
};

  

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw error; // Propagar o erro original
    }
  };

  const checkEmailExists = async (email: string): Promise<boolean> => {
    try {
      // Tenta fazer login com uma senha inválida para verificar se o email existe
      await signInWithEmailAndPassword(auth, email, "checkonly");
      return true;
    } catch (error: any) {
      // Se o erro for "auth/wrong-password", o email existe
      if (error.code === "auth/wrong-password") {
        return true;
      }
      // Se o erro for "auth/user-not-found", o email não existe
      if (error.code === "auth/user-not-found") {
        return false;
      }
      // Para outros erros, assumimos que o email não existe
      return false;
    }
  };

  const value = {
    currentUser,
    loading,
    login,
    register,
    logout,
    resetPassword,
    checkEmailExists,
    reloadUser // 🆕 ADICIONAR À INTERFACE
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};