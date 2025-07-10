import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../auth-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WelcomeScreen from './welcome';
import InitialSetupScreen from './setup';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  console.log('🚀 INDEX.TSX RENDERIZADO!');
  
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const [showWelcome, setShowWelcome] = useState<boolean | null>(null);
  const [showInitialSetup, setShowInitialSetup] = useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  console.log('🔍 Estados atuais:', {
    currentUser: !!currentUser,
    loading,
    showWelcome,
    showInitialSetup,
    isProcessing
  });

  // 1️⃣ Handler para quando termina o Welcome (primeira vez na app)
  const handleWelcomeContinue = async () => {
    console.log('📝 Welcome concluído - indo para login');
    try {
      await AsyncStorage.setItem('hasSeenWelcome', 'true');
      setShowWelcome(false);
      setIsProcessing(false);
      // Sempre vai para login após o welcome
      router.replace('/login' as any);
    } catch (error) {
      console.error('Erro ao salvar welcome:', error);
      router.replace('/login' as any);
    }
  };

  // 2️⃣ Handler para quando termina o Setup (primeira vez após login)
  const handleSetupComplete = async () => {
    console.log('📝 Setup concluído - indo para home');
    try {
      if (currentUser) {
        await AsyncStorage.setItem(`hasCompletedSetup_${currentUser.uid}`, 'true');
        console.log(`✅ Setup marcado como completo para ${currentUser.uid}`);
      }
      setShowInitialSetup(false);
      setIsProcessing(false);
      router.replace('/home' as any);
    } catch (error) {
      console.error('Erro ao salvar setup:', error);
      router.replace('/home' as any);
    }
  };

  // 3️⃣ Lógica principal de navegação
  useEffect(() => {
    const determineNavigation = async () => {
      console.log('🔄 === DETERMINANDO NAVEGAÇÃO ===');
      
      // Aguardar autenticação terminar
      if (loading) {
        console.log('⏳ Aguardando autenticação...');
        return;
      }

      setIsProcessing(true);

      try {
        // PASSO 1: Verificar se é a primeira vez na app
        const hasSeenWelcome = await AsyncStorage.getItem('hasSeenWelcome');
        console.log('👋 Primeira vez na app?', !hasSeenWelcome);
        
        if (!hasSeenWelcome) {
          console.log('🎯 MOSTRAR WELCOME (primeira vez)');
          setShowWelcome(true);
          setShowInitialSetup(false);
          setIsProcessing(false);
          return;
        }

        // PASSO 2: Se já viu welcome mas não está logado → Login
        if (!currentUser) {
          console.log('🎯 IR PARA LOGIN (não autenticado)');
          setShowWelcome(false);
          setShowInitialSetup(false);
          setIsProcessing(false);
          router.replace('/login' as any);
          return;
        }

        // PASSO 3: Se está logado, verificar se já fez setup
        const setupKey = `hasCompletedSetup_${currentUser.uid}`;
        const hasCompletedSetup = await AsyncStorage.getItem(setupKey);
        console.log('🔧 Já fez setup?', !!hasCompletedSetup, 'para user:', currentUser.uid);

        if (!hasCompletedSetup) {
          console.log('🎯 MOSTRAR SETUP (primeira vez após login)');
          setShowWelcome(false);
          setShowInitialSetup(true);
          setIsProcessing(false);
          return;
        }

        // PASSO 4: Tudo feito → Home
        console.log('🎯 IR PARA HOME (tudo configurado)');
        setShowWelcome(false);
        setShowInitialSetup(false);
        setIsProcessing(false);
        router.replace('/home' as any);

      } catch (error) {
        console.error('❌ Erro na navegação:', error);
        // Em caso de erro, ir para login
        setShowWelcome(false);
        setShowInitialSetup(false);
        setIsProcessing(false);
        router.replace('/login' as any);
      }
    };

    determineNavigation();
  }, [currentUser, loading]); // Só reexecuta quando user ou loading mudam

  // 4️⃣ Renderização baseada no estado
  console.log('🎨 Renderizando baseado em:', { showWelcome, showInitialSetup, isProcessing });

  // Welcome Screen (primeira vez na app)
  if (showWelcome === true) {
    console.log('🎨 → WELCOME SCREEN');
    return <WelcomeScreen onContinue={handleWelcomeContinue} />;
  }

  // Setup Screen (primeira vez após login)
  if (currentUser && showInitialSetup === true) {
    console.log('🎨 → SETUP SCREEN');
    return <InitialSetupScreen onComplete={handleSetupComplete} />;
  }

  // Loading (enquanto processa ou aguarda)
  if (loading || isProcessing || showWelcome === null || showInitialSetup === null) {
    console.log('🎨 → LOADING');
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#3498db'
      }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  // Fallback (não deveria acontecer)
  console.log('🎨 → FALLBACK LOADING');
  return (
    <View style={{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#3498db'
    }}>
      <ActivityIndicator size="large" color="#FFFFFF" />
    </View>
  );
}
