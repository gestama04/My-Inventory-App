import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_STORAGE_KEY = 'selectedLanguage';
const LANGUAGE_SETUP_COMPLETED_KEY = 'languageSetupCompleted';

export interface LanguageConfig {
  code: string;
  name: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

export class LanguageService {
  /**
   * Save the selected language to AsyncStorage
   */
  static async saveSelectedLanguage(languageCode: string): Promise<void> {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);
      await AsyncStorage.setItem(LANGUAGE_SETUP_COMPLETED_KEY, 'true');
      console.log(`Language saved: ${languageCode}`);
    } catch (error) {
      console.error('Error saving language:', error);
      throw error;
    }
  }

  /**
   * Get the saved language from AsyncStorage
   */
  static async getSavedLanguage(): Promise<string | null> {
    try {
      const language = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      return language;
    } catch (error) {
      console.error('Error getting saved language:', error);
      return null;
    }
  }

  /**
   * Check if language setup has been completed
   */
  static async isLanguageSetupCompleted(): Promise<boolean> {
    try {
      const completed = await AsyncStorage.getItem(LANGUAGE_SETUP_COMPLETED_KEY);
      return completed === 'true';
    } catch (error) {
      console.error('Error checking language setup status:', error);
      return false;
    }
  }

  /**
   * Reset language settings (useful for testing or settings reset)
   */
  static async resetLanguageSettings(): Promise<void> {
    try {
      await AsyncStorage.removeItem(LANGUAGE_STORAGE_KEY);
      await AsyncStorage.removeItem(LANGUAGE_SETUP_COMPLETED_KEY);
      console.log('Language settings reset');
    } catch (error) {
      console.error('Error resetting language settings:', error);
      throw error;
    }
  }

  /**
   * Get language configuration by code
   */
  static getLanguageConfig(languageCode: string): LanguageConfig | undefined {
    return SUPPORTED_LANGUAGES.find(lang => lang.code === languageCode);
  }

  /**
   * Get default language (Portuguese)
   */
  static getDefaultLanguage(): LanguageConfig {
    return SUPPORTED_LANGUAGES[0]; // Portuguese
  }

  /**
   * Validate if a language code is supported
   */
  static isLanguageSupported(languageCode: string): boolean {
    return SUPPORTED_LANGUAGES.some(lang => lang.code === languageCode);
  }
}
