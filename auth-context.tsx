import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from './supabase-config';
import { 
  upsertUserProfile, 
  updateExpoPushToken,
  getUserProfile 
} from './supabase-service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { User, Session } from '@supabase/supabase-js';
import { clearAllListeners } from './supabase-listeners';

interface AuthContextType {
  currentUser: User | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe: boolean) => Promise<User>;
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

// Converter DD/MM/YYYY para YYYY-MM-DD (formato PostgreSQL)
const formatDateForDB = (dateStr?: string): string | undefined => {
  if (!dateStr) return undefined;
  
  // Se já está em formato ISO (YYYY-MM-DD), retorna como está
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Converter de DD/MM/YYYY para YYYY-MM-DD
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return undefined;
};

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  session: null,
  loading: true,
  login: async () => { return null as unknown as User },
  register: async () => null,
  logout: async () => {},
  resetPassword: async () => {},
  checkEmailExists: async () => false,
  reloadUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const reloadUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('🔄 Recarregando dados do usuário...');
        setCurrentUser(user);
        console.log('✅ Usuário recarregado com sucesso');
      }
    } catch (error) {
      console.error('❌ Erro ao recarregar usuário:', error);
    }
  };

  const persistUser = async (user: User | null, rememberMe: boolean = false) => {
    try {
      if (user && rememberMe) {
        const userData = {
          uid: user.id,
          email: user.email,
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
    const initializeAuth = async () => {
      try {
        const rememberMe = await AsyncStorage.getItem('rememberMe');
        
        // Verificar sessão existente
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession) {
          setSession(currentSession);
          setCurrentUser(currentSession.user);
          
          // Configurar notificações se o email estiver verificado
          if (currentSession.user.email_confirmed_at) {
            await setupNotifications(currentSession.user.id);
          }
        } else if (rememberMe !== 'true') {
          // Se não tem sessão e não é para lembrar, limpar
          await AsyncStorage.removeItem('user');
        }
      } catch (error) {
        console.error('Erro ao inicializar auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('Auth state changed:', event);
      
      if (event === 'INITIAL_SESSION') {
        // Já tratado no initializeAuth, ignorar para evitar duplicação
        return;
      }
      
      setSession(newSession);
      setCurrentUser(newSession?.user ?? null);
      setLoading(false);
      
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && newSession?.user) {
        if (newSession.user.email_confirmed_at) {
          await setupNotifications(newSession.user.id);
        }
      }
      
      if (event === 'SIGNED_OUT') {
        clearAllListeners();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const setupNotifications = async (userId: string) => {
    try {
      console.log('🔔 Configurando notificações para usuário logado...');
      
      const { NotificationService } = await import('./services/notification-service');
      await NotificationService.initialize();
      
      // Verificar se já tem token salvo
      const profile = await getUserProfile(userId);
      
      if (!profile?.expo_push_token) {
        console.log('📱 Solicitando permissões de notificação...');
        
        const { status } = await Notifications.requestPermissionsAsync();
        console.log('Permission status:', status);
        
        if (status === 'granted') {
          const token = await Notifications.getExpoPushTokenAsync({
            projectId: '3abf848f-326e-4719-a3c6-9c4c60605aa7'
          });
          
          if (token) {
            await updateExpoPushToken(userId, token.data);
            console.log('✅ Expo Push Token salvo:', token.data);
          }
        } else {
          console.log('❌ Permissão de notificação negada');
        }
      } else {
        console.log('✅ Token já existe:', profile.expo_push_token);
      }
    } catch (tokenError) {
      console.error('❌ Erro ao configurar notificações:', tokenError);
    }
  };

  const login = async (email: string, password: string, rememberMe: boolean = false) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        // Mapear erros do Supabase para mensagens compatíveis
        if (error.message.includes('Invalid login credentials')) {
          throw { code: 'auth/invalid-credential', message: error.message };
        }
        if (error.message.includes('Email not confirmed')) {
          // Reenviar email de confirmação
          await supabase.auth.resend({
            type: 'signup',
            email,
          });
          throw new Error('email-not-verified');
        }
        throw error;
      }
      
      if (!data.user) {
        throw new Error('Utilizador não encontrado');
      }
      
      // Verificar se o email foi verificado
      if (!data.user.email_confirmed_at) {
        await supabase.auth.resend({
          type: 'signup',
          email,
        });
        await supabase.auth.signOut();
        throw new Error('email-not-verified');
      }
      
      await persistUser(data.user, rememberMe);
      
      // Salvar email se "lembrar-me" estiver ativado
      if (rememberMe) {
        await AsyncStorage.setItem('savedEmail', email);
      } else {
        await AsyncStorage.removeItem('savedEmail');
      }
      
      // Configurar notificações
      await setupNotifications(data.user.id);
      
      return data.user;
    } catch (error) {
      throw error;
    }
  };

  const register = async (email: string, password: string, userData: UserData) => {
    try {
      console.log('[Register] Iniciando registo para:', email);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: userData.firstName,
            last_name: userData.lastName,
          },
        },
      });
      
      console.log('[Register] Resposta do signUp:', { 
        user: data?.user?.id, 
        session: !!data?.session,
        error: error?.message 
      });
      
      if (error) {
        console.error('[Register] Erro no signUp:', error);
        if (error.message.includes('already registered')) {
          throw { code: 'auth/email-already-in-use', message: error.message };
        }
        throw error;
      }
      
      if (!data.user) {
        console.error('[Register] Utilizador não retornado');
        throw new Error('Erro ao criar utilizador');
      }
      
      console.log('[Register] Utilizador criado, a guardar perfil...');
      
      // Criar perfil do utilizador
      if (data.session) {
      await upsertUserProfile({
        user_id: data.user.id,
        first_name: userData.firstName,
        last_name: userData.lastName,
        birth_date: formatDateForDB(userData.birthDate),
      });}
      
      console.log('[Register] Perfil guardado com sucesso');
      
      setCurrentUser(data.user);
      
      return data.user;
    } catch (error) {
      console.error('[Register] Erro geral:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      clearAllListeners();
      
      const { NotificationService } = await import('./services/notification-service');
      NotificationService.stopPeriodicStockCheck();
      
      // Limpar AsyncStorage
      await AsyncStorage.removeItem("cachedInventory");
      await AsyncStorage.removeItem("cachedItemHistory");
      await AsyncStorage.removeItem("userSettings");
      await AsyncStorage.removeItem("syncQueue");
      await AsyncStorage.removeItem("localItemHistory");
      await AsyncStorage.removeItem("lastStockNotificationTime");
      
      if (currentUser) {
        await AsyncStorage.removeItem("inventory_stats_" + currentUser.id);
      }
      
      await supabase.auth.signOut();
      await persistUser(null);
      
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error: any) {
      console.error('Erro ao fazer logout:', error);
      throw new Error(error.message);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'vitastreak://reset-password-vitastreak',
      });
      
      if (error) throw error;
    } catch (error) {
      throw error;
    }
  };

  const checkEmailExists = async (email: string): Promise<boolean> => {
    // Supabase não tem uma forma direta de verificar se email existe
    // Retornamos false para não bloquear o fluxo de registo
    return false;
  };

  const value = {
    currentUser,
    session,
    loading,
    login,
    register,
    logout,
    resetPassword,
    checkEmailExists,
    reloadUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
