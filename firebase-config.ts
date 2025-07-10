import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getReactNativePersistence,
  initializeAuth,
  Auth 
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "*os seus dados*",
  authDomain: "*os seus dados*",
  databaseURL: "*os seus dados*",
  projectId: "*os seus dados*",
  storageBucket: "*os seus dados*",
  messagingSenderId: "*os seus dados*",
  appId: "*os seus dados*"
};

// --- Inicialização ---
let app;
let auth: Auth; // Declara a variável auth com o tipo Auth

// 1. Inicializa o Firebase App (como já tinhas)
if (!getApps().length) {
  console.log("Inicializando Firebase pela primeira vez");
  app = initializeApp(firebaseConfig);
} else {
  console.log("Firebase já inicializado");
  app = getApp();
}

// 2. Inicializa o Firebase Auth COM persistência (Lógica Corrigida)
try {
  // Chama initializeAuth DIRETAMENTE e passa a persistência
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage) // Usa a persistência correta
  });
  console.log("Firebase Auth inicializado COM persistência.");

} catch (error: any) { // Captura qualquer erro durante a inicialização
  console.error("Erro CRÍTICO ao inicializar Firebase Auth com persistência:", error);
  // Neste ponto, a persistência falhou.
  // Opção A: Parar a app (mais seguro se a persistência for essencial)
  throw new Error("Falha ao inicializar Auth com persistência. A app não pode continuar.");
  // Opção B: Tentar inicializar sem persistência (menos ideal, login não persiste)
  // console.warn("A tentar inicializar Auth SEM persistência como fallback...");
  // try {
  //   auth = getAuth(app); // Nota: precisarias de importar getAuth neste caso
  // } catch (fallbackError) {
  //   console.error("Falha total ao inicializar Auth:", fallbackError);
  //   throw new Error("Falha total ao inicializar Auth.");
  // }
}

// 3. Inicializa outros serviços
const db = getFirestore(app);
const storage = getStorage(app);

// 4. Exporta as instâncias
export { app, auth, db, storage };
