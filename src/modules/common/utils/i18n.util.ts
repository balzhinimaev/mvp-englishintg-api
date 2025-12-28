// Language support constants and utilities

export const SUPPORTED_LANGUAGES = {
  RU: 'ru',
  EN: 'en',
} as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[keyof typeof SUPPORTED_LANGUAGES];

export const DEFAULT_LANGUAGE: SupportedLanguage = SUPPORTED_LANGUAGES.RU;

// Type for multilingual text fields
export interface MultilingualText {
  ru: string;
  en: string;
}

// Type for optional multilingual text fields
export interface OptionalMultilingualText {
  ru?: string;
  en?: string;
}

/**
 * Extract text for specified language with fallback logic
 * @param textObj - Multilingual text object
 * @param lang - Requested language
 * @param fallbackLang - Fallback language (default: 'en')
 * @returns Text in requested language or fallback
 */
export function getLocalizedText(
  textObj: MultilingualText | OptionalMultilingualText | string | undefined,
  lang: SupportedLanguage = DEFAULT_LANGUAGE,
  fallbackLang: SupportedLanguage = SUPPORTED_LANGUAGES.EN,
): string {
  // Handle legacy string format
  if (typeof textObj === 'string') {
    return textObj;
  }

  // Handle undefined/null
  if (!textObj) {
    return '';
  }

  // Try requested language first
  if (textObj[lang]) {
    return textObj[lang];
  }

  // Try fallback language
  if (textObj[fallbackLang]) {
    return textObj[fallbackLang];
  }

  // Return any available language
  const availableText = textObj.ru || textObj.en;
  return availableText || '';
}

/**
 * Validate that all required languages are present
 * @param textObj - Multilingual text object
 * @param requiredLangs - Array of required languages
 * @returns true if all required languages are present
 */
export function validateMultilingualText(
  textObj: MultilingualText | OptionalMultilingualText,
  requiredLangs: SupportedLanguage[] = [SUPPORTED_LANGUAGES.RU, SUPPORTED_LANGUAGES.EN],
): boolean {
  if (!textObj || typeof textObj === 'string') {
    return false;
  }

  return requiredLangs.every(lang => {
    if (!Object.prototype.hasOwnProperty.call(textObj, lang)) {
      return false;
    }

    const value = textObj[lang];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

/**
 * Parse language from query parameter or header
 * @param langParam - Language parameter from request
 * @returns Valid supported language
 */
export function parseLanguage(langParam?: string): SupportedLanguage {
  if (!langParam) {
    return DEFAULT_LANGUAGE;
  }

  const lang = langParam.toLowerCase();
  const supportedValues = Object.values(SUPPORTED_LANGUAGES);
  
  if (supportedValues.includes(lang as SupportedLanguage)) {
    return lang as SupportedLanguage;
  }

  return DEFAULT_LANGUAGE;
}
