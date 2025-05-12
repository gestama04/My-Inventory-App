import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MaterialCommunityIcons } from "@expo/vector-icons"; // Para tipagem e referência

// ATENÇÃO: Mova a sua API Key para um local mais seguro (ex: variáveis de ambiente)
const API_KEY = "AIzaSyDuUDSAfqwznlx9XMw-Xea4f0bU-sfe_4k"; // Sua API Key
const genAI = new GoogleGenerativeAI(API_KEY);

interface IconCache {
  [category: string]: string;
}

// Usar a mesma chave de cache que você tinha no CategoriesScreen para consistência
const CACHE_KEY = 'categoryIconCache'; 
let iconCacheInMemory: IconCache = {};
let isCacheLoadedFromStorage = false;

// Lista de ícones disponíveis do MaterialCommunityIcons (EXATAMENTE COMO NO CategoriesScreen)
// É importante que esta lista seja a mesma que a IA tem como opção.
const AVAILABLE_ICONS = [
  "package-variant", "food-apple", "cup", "shower", "tshirt-crew",
  "shoe-heel", "tools", "pencil", "cellphone", "television", "book",
  "car", "toy-brick", "medical-bag", "music", "basketball", "home",
  "silverware", "baby-carriage", "palette", "flower", "paw", "gift",
  "washing-machine", "fridge", "microwave", "lamp", "sofa", "bed",
  "briefcase", "wallet", "credit-card", "cash", "camera", "headphones",
  "speaker", "watch", "glasses", "sunglasses", "umbrella", "backpack"
];
const DEFAULT_ICON: keyof typeof MaterialCommunityIcons.glyphMap = "package-variant";

// Carrega o cache do AsyncStorage para a memória (apenas uma vez por sessão da app)
async function ensureCacheLoaded(): Promise<void> {
  if (isCacheLoadedFromStorage) {
    return;
  }
  try {
    const cachedIcons = await AsyncStorage.getItem(CACHE_KEY);
    if (cachedIcons) {
      iconCacheInMemory = JSON.parse(cachedIcons);
    }
    isCacheLoadedFromStorage = true;
    console.log('[CategoryIconService] Cache de ícones carregado do AsyncStorage:', iconCacheInMemory);
  } catch (error) {
    console.error("[CategoryIconService] Erro ao carregar cache de ícones do AsyncStorage:", error);
    iconCacheInMemory = {}; // Em caso de erro, começa com cache vazio
    isCacheLoadedFromStorage = true; // Evita tentativas repetidas
  }
}

// Salva o cache da memória no AsyncStorage
async function saveCacheToStorage(): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(iconCacheInMemory));
  } catch (error) {
    console.error("[CategoryIconService] Erro ao salvar cache de ícones no AsyncStorage:", error);
  }
}

// Função para obter ícone, espelhando a lógica do seu CategoriesScreen
async function getIconForCategory(category: string): Promise<string> {
  if (!category || category.trim() === "" || category === "Sem Categoria") {
    return DEFAULT_ICON;
  }

  await ensureCacheLoaded(); // Garante que o cache foi carregado do AsyncStorage

  // 1. Verifica o cache em memória (que foi populado pelo AsyncStorage)
  if (iconCacheInMemory[category]) {
    return iconCacheInMemory[category];
  }

  console.log(`[CategoryIconService] Buscando ícone por IA para: "${category}" (não encontrado no cache)`);
  try {
    // 2. Lista de ícones disponíveis (usando a constante do serviço)
    // 3. Modelo Gemini (usando a instância genAI do serviço)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // 4. Prompt (EXATAMENTE como no CategoriesScreen)
    const prompt = `
    Analise esta categoria de produto: "${category}"
    
    Escolha o ícone mais apropriado desta lista:
    ${AVAILABLE_ICONS.join(", ")}
    
    Responda APENAS com o nome do ícone, sem texto adicional.
    Por exemplo: "food-apple" ou "tshirt-crew"
    `;
    
    // 5. Chamada à API
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text().trim();
    
    // 6. Validação e ícone padrão (EXATAMENTE como no CategoriesScreen)
    const selectedIcon = AVAILABLE_ICONS.includes(text as any) ? text : DEFAULT_ICON;
    
    // 7. Atualiza o cache em memória E salva no AsyncStorage
    iconCacheInMemory[category] = selectedIcon;
    await saveCacheToStorage();
    
    return selectedIcon;
    
  } catch (error) {
    console.error(`[CategoryIconService] Erro ao obter ícone com IA para "${category}":`, error);
    
    // 8. Lógica de Fallback (EXATAMENTE como no CategoriesScreen)
    const categoryLower = category.toLowerCase();
    let fallbackIcon: keyof typeof MaterialCommunityIcons.glyphMap = DEFAULT_ICON; // Tipado para segurança
    
    if (categoryLower.includes("alimento") || categoryLower.includes("comida")) fallbackIcon = "food-apple";
    else if (categoryLower.includes("bebida")) fallbackIcon = "cup";
    else if (categoryLower.includes("higiene")) fallbackIcon = "shower";
    else if (categoryLower.includes("roupa")) fallbackIcon = "tshirt-crew";
    else if (categoryLower.includes("calçado")) fallbackIcon = "shoe-heel";
    else if (categoryLower.includes("ferramenta")) fallbackIcon = "tools";
    else if (categoryLower.includes("papelaria")) fallbackIcon = "pencil";
    else if (categoryLower.includes("eletrônico") || categoryLower.includes("eletronico")) fallbackIcon = "television";
    else if (categoryLower.includes("livro")) fallbackIcon = "book";
    // Adicione mais fallbacks se necessário, mantendo a consistência
    
    // 9. Atualiza o cache em memória com o fallback E salva no AsyncStorage
    iconCacheInMemory[category] = fallbackIcon;
    await saveCacheToStorage();
    
    return fallbackIcon;
  }
}

export const CategoryIconService = {
  getIconForCategory,
  DEFAULT_ICON,
  // Função para pré-carregar o cache, pode ser chamada no início da app (ex: no _layout.tsx)
  preloadIconCache: ensureCacheLoaded, 
};