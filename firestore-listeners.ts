// Crie um novo arquivo: firestore-listeners.ts

// Armazenar todas as funções de cancelamento de listeners
let firestoreListeners: (() => void)[] = [];

// Adicionar um novo listener
export const addListener = (unsubscribe: () => void) => {
  firestoreListeners.push(unsubscribe);
  return unsubscribe;
};

// Remover um listener específico
export const removeListener = (unsubscribe: () => void) => {
  firestoreListeners = firestoreListeners.filter(listener => listener !== unsubscribe);
};

// Cancelar todos os listeners
export const clearAllListeners = () => {
  firestoreListeners.forEach(unsubscribe => {
    try {
      unsubscribe();
    } catch (error) {
      console.error('Erro ao cancelar listener:', error);
    }
  });
  firestoreListeners = [];
};
