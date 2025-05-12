import 'expo-router';

declare module 'expo-router' {
  interface AppRoutes {
    '/login': undefined;
    '/register': undefined;
    '/inventory': undefined;
    '/add': undefined;
    '/edit': { id?: string; name?: string; category?: string; quantity?: string };
    '/statistics': undefined;
    '/settings': undefined;
    '/low-stock': undefined;
    '/out-of-stock': undefined;
    '/categories': undefined;
    '/notifications': undefined;
    '/item-details': { name: string; category: string };
  }
}
