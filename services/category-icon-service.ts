import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY as string);
const CACHE_KEY = 'categoryIconCache';
let iconCacheInMemory: Record<string, string> = {};

// Obtemos a lista de nomes válidos uma única vez
const VALID_ICON_NAMES = Object.keys(MaterialCommunityIcons.glyphMap);

export const CategoryIconService = {
  
  async getIconForCategory(category: string, itemName: string = ""): Promise<string> {
    const searchKey = `${category}-${itemName}`.toLowerCase().trim();

    // 1. Tentar Cache
    if (iconCacheInMemory[searchKey]) return iconCacheInMemory[searchKey];

    try {
      // Usamos o flash-lite que é mais rápido e direto
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `
        Identifica o nome de um ícone do Material Design (MaterialCommunityIcons) para:
        Produto: "${itemName}"
        Categoria: "${category}"

        REGRAS:
        - Responde APENAS com o nome do ícone em inglês.
        - Exemplo de resposta: laptop
        - NÃO escrevas frases, NÃO uses pontuação, NÃO uses maiúsculas.
        - Prioriza ícones simples (notebook, cup, food, cellphone, tshirt-crew).
      `;

      const result = await model.generateContent(prompt);
      // Limpeza profunda: remove espaços, quebras de linha e caracteres especiais
      let suggestedIcon = result.response.text().trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

      console.log(`IA sugeriu: ${suggestedIcon} para ${itemName}`);

      // 2. Validação contra a biblioteca real
      if (VALID_ICON_NAMES.includes(suggestedIcon)) {
        this.saveToCache(searchKey, suggestedIcon);
        return suggestedIcon;
      }

      // 3. Mini-mapeamento de segurança (se a IA disser algo próximo mas errado)
      const smartCorrection: Record<string, string> = {
        'playstation': 'sony-playstation',
        'ps5': 'sony-playstation',
        'xbox': 'microsoft-xbox',
        'iphone': 'cellphone',
        'smartphone': 'cellphone',
        'tv': 'television',
        'camera': 'camera',
        'tshirt': 'tshirt-crew',
        'camisola': 'tshirt-crew',
        'plant': 'flower'
      };

      if (smartCorrection[suggestedIcon]) {
        const corrected = smartCorrection[suggestedIcon];
        this.saveToCache(searchKey, corrected);
        return corrected;
      }

      // 4. Se tudo falhar, usa o fallback inteligente baseado no texto
      const fallback = this.getSmartFallback(category, itemName);
      this.saveToCache(searchKey, fallback);
      return fallback;

    } catch (error) {
      console.error("Erro no serviço de ícones:", error);
      return this.getSmartFallback(category, itemName);
    }
  },

  async saveToCache(key: string, icon: string) {
    iconCacheInMemory[key] = icon;
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(iconCacheInMemory));
    } catch (e) {}
  },

  // Fallback que nunca falha e é mais variado que apenas "caixas"
  getSmartFallback(category: string, itemName: string): string {
    const text = (category + itemName).toLowerCase();
    if (text.includes("comida") || text.includes("alimento")) return "food-apple";
    if (text.includes("bebi") || text.includes("copo") || text.includes("água")) return "cup";
    if (text.includes("roupa") || text.includes("vestu")) return "tshirt-crew";
    if (text.includes("eletr") || text.includes("tech") || text.includes("smart")) return "cellphone";
    if (text.includes("ferram") || text.includes("obra")) return "tools";
    if (text.includes("livro") || text.includes("ler")) return "book-open-variant";
    if (text.includes("escola") || text.includes("papel")) return "pencil";
    if (text.includes("casa") || text.includes("móvel")) return "home";
    
    return "package-variant"; 
  }
};