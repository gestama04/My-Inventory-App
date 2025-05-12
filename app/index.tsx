import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../auth-context';

export default function Index() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (currentUser) {
        // Se o utilizador estiver autenticado, redirecione para a tela inicial
        router.replace('/home' as any);
      } else {
        // Se o utilizador não estiver autenticado, redirecione para a tela de login
        router.replace('/login' as any);
      }
    }
  }, [currentUser, loading, router]);

  // Retornar null para não mostrar nada enquanto carrega
  return null;
}