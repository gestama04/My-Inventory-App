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
  // Ícones existentes
  "package-variant", "food-apple", "cup", "shower", "tshirt-crew",
  "shoe-heel", "tools", "pencil", "cellphone", "television", "book",
  "car", "toy-brick", "medical-bag", "music", "basketball", "home",
  "silverware", "baby-carriage", "palette", "flower", "paw", "gift",
  "washing-machine", "fridge", "microwave", "lamp", "sofa", "bed",
  "briefcase", "wallet", "credit-card", "cash", "camera", "headphones",
  "speaker", "watch", "glasses", "sunglasses", "umbrella", "backpack",
  
  // Novos ícones mais específicos
  // Alimentos e bebidas
  "food", "food-variant", "food-fork-drink", "food-drumstick", "food-steak", 
  "fruit-grapes", "fruit-cherries", "fruit-watermelon", "fruit-pineapple",
  "bottle-wine", "beer", "coffee", "tea", "water", "bottle-soda", "bottle-tonic",
  "pizza", "hamburger", "pasta", "noodles", "rice", "bread-slice", "cheese",
  "candy", "cookie", "cake", "ice-cream", "chocolate",
  
  // Roupas e acessórios
  "hanger", "bow-tie", "tie", "hat-fedora", "scarf", "shoe-formal", "shoe-sneaker",
  "socks", "belt", "glasses", "sunglasses", "purse", "bag-personal", "necklace",
  "ring", "watch-variant", "crown", "diamond-stone", "earrings",
  
  // Eletrónica
  "laptop", "desktop-tower", "desktop-classic", "printer", "keyboard", "mouse",
  "router-wireless", "tablet", "gamepad-variant", "controller", "playstation",
  "xbox", "nintendo-switch", "remote", "power-plug", "battery", "usb", "bluetooth",
  "wifi", "antenna", "satellite", "radio", "cast", "chromecast",
  
  // Casa e decoração
  "lightbulb", "candle", "ceiling-light", "floor-lamp", "desk-lamp", "chandelier",
  "curtains", "window-closed", "door", "door-closed", "gate", "fence", "mailbox",
  "broom", "vacuum", "dishwasher", "washing-machine", "tumble-dryer", "iron",
  "air-conditioner", "fan", "thermometer", "water-boiler", "smoke-detector",
  "security-camera", "doorbell", "lock", "key", "key-variant",
  
  // Ferramentas e construção
  "hammer", "wrench", "screwdriver", "saw", "axe", "shovel", "ladder", "tape-measure",
  "ruler", "level", "drill", "nail", "screw", "bolt", "nut", "pipe", "pipe-wrench",
  "paint", "paint-roller", "brush", "palette", "bucket", "trowel", "concrete",
  
  // Saúde e beleza
  "pill", "bandage", "toothbrush", "razor", "lotion", "spray", "perfume", "lipstick",
  "hair-dryer", "comb", "mirror", "scale-bathroom", "dumbbell", "weight", "yoga",
  "run", "bike", "swim", "heart-pulse", "thermometer", "stethoscope", "hospital-box",
  
  // Papelaria e escritório
  "notebook", "notebook-outline", "clipboard", "clipboard-text", "file", "folder",
  "printer", "stapler", "paperclip", "scissors", "ruler", "eraser", "marker",
  "highlighter", "stamp", "tape", "calculator", "calendar", "clock", "alarm",
  
  // Jardim e exterior
  "flower", "flower-tulip", "flower-poppy", "tree", "pine-tree", "grass", "leaf",
  "pot", "shovel", "rake", "watering-can", "sprinkler", "hose", "wheelbarrow",
  "grill", "campfire", "tent", "umbrella-beach", "pool", "fountain", "fence",
  
  // Animais e pets
  "dog", "cat", "bird", "fish", "rabbit", "horse", "cow", "sheep", "pig", "chicken",
  "duck", "paw", "bone", "dog-side", "cat-side", "fish-bowl", "bird-house",
  
  // Transporte
  "car-side", "car-sports", "truck", "van", "bus", "train", "tram", "subway",
  "airplane", "helicopter", "ferry", "bike", "motorbike", "scooter", "skateboard",
  "roller-skate", "snowboard", "ski", "sail-boat", "speedboat", "ship", "rocket",
  
  // Entretenimento
  "movie", "movie-open", "film", "camera-movie", "television-classic", "youtube",
  "netflix", "spotify", "music-note", "guitar", "piano", "drum", "microphone",
  "headphones", "speaker", "radio", "podcast", "book-open", "book-open-page-variant",
  "newspaper", "magazine", "cards", "dice-multiple", "chess-knight", "puzzle",
  
  // Tecnologia
  "memory", "chip", "database", "server", "cloud", "web", "code-braces", "code-tags",
  "language-javascript", "language-python", "language-html5", "language-css3",
  "github", "gitlab", "google", "microsoft", "apple", "android", "linux", "windows",
  
  // Diversos
  "gift", "balloon", "party-popper", "cake-variant", "candle", "firework",
  "trophy", "medal", "crown", "star", "heart", "emoticon", "emoticon-happy",
  "emoticon-sad", "emoticon-cool", "emoticon-kiss", "emoticon-wink",
  "map-marker", "compass", "earth", "globe", "flag", "language", "translate"
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
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
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