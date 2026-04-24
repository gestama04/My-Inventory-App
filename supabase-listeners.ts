// Gerenciador de listeners do Supabase (equivalente ao firestore-listeners.ts)

import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase-config';

// Armazenar todos os canais/subscriptions ativos
let activeChannels: RealtimeChannel[] = [];
let unsubscribeFunctions: (() => void)[] = [];

// Adicionar um novo canal
export const addChannel = (channel: RealtimeChannel): RealtimeChannel => {
  activeChannels.push(channel);
  return channel;
};

// Adicionar uma função de unsubscribe
export const addListener = (unsubscribe: () => void): (() => void) => {
  unsubscribeFunctions.push(unsubscribe);
  return unsubscribe;
};

// Remover um listener específico
export const removeListener = (unsubscribe: () => void) => {
  unsubscribeFunctions = unsubscribeFunctions.filter(listener => listener !== unsubscribe);
};

// Cancelar todos os listeners e canais
export const clearAllListeners = () => {
  // Cancelar funções de unsubscribe
  unsubscribeFunctions.forEach(unsubscribe => {
    try {
      unsubscribe();
    } catch (error) {
      console.error('Erro ao cancelar listener:', error);
    }
  });
  unsubscribeFunctions = [];
  
  // Remover canais do Supabase
  activeChannels.forEach(channel => {
    try {
      supabase.removeChannel(channel);
    } catch (error) {
      console.error('Erro ao remover canal:', error);
    }
  });
  activeChannels = [];
};

// Remover um canal específico
export const removeChannel = (channel: RealtimeChannel) => {
  try {
    supabase.removeChannel(channel);
    activeChannels = activeChannels.filter(c => c !== channel);
  } catch (error) {
    console.error('Erro ao remover canal:', error);
  }
};
