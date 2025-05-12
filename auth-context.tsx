import React, { createContext, useState, useEffect, useContext } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  User
} from 'firebase/auth';
import { auth, db } from './firebase-config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc } from 'firebase/firestore';
import { clearAllListeners } from './firestore-listeners';
interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  register: (email: string, password: string, userData: UserData) => Promise<User | null>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  checkEmailExists: (email: string) => Promise<boolean>;
}

interface UserData {
  firstName: string;
  lastName: string;
  birthDate?: string;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  login: async () => {},
  register: async () => null,
  logout: async () => {},
  resetPassword: async () => {},
  checkEmailExists: async () => false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
        // Verificar se o auth está disponível
        if (!auth) {
          console.error("Firebase Auth não está disponível");
          setLoading(false);
          return;
        }
  
        const rememberMe = await AsyncStorage.getItem('rememberMe');
        if (rememberMe !== 'true') {
          // Se não estiver marcado para lembrar, não carrega o utilizador persistido
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
      // Verificar se o auth está disponível
      if (!auth) {
        console.error("Firebase Auth não está disponível");
        setLoading(false);
        return () => {};
      }
  
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
        setLoading(false);
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
      await persistUser(userCredential.user, rememberMe);
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
        
        // Salvar dados adicionais no Firestore
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          firstName: userData.firstName,
          lastName: userData.lastName,
          birthDate: userData.birthDate || null,
          email: email,
          createdAt: new Date()
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
      // Parar a verificação periódica de stock
      const { NotificationService } = await import('./services/notification-service');
      await NotificationService.clearStockCheck();
      
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
    checkEmailExists
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
