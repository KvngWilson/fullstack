const LANGUAGE_STORAGE_KEY = "app.language";
const CURRENCY_STORAGE_KEY = "app.currency";

export const SUPPORTED_LANGUAGES = ["en", "fr", "es", "de"];
export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "CAD"];

export const DEFAULT_LANGUAGE = "en";
export const DEFAULT_CURRENCY = "USD";

const LANGUAGE_TO_LOCALE = {
  en: "en-US",
  fr: "fr-FR",
  es: "es-ES",
  de: "de-DE",
};

export function getLanguageLocale(language) {
  return LANGUAGE_TO_LOCALE[language] || LANGUAGE_TO_LOCALE[DEFAULT_LANGUAGE];
}

export function getStoredLanguage() {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
      return stored;
    }
  } catch {
    // Ignore storage errors.
  }

  return DEFAULT_LANGUAGE;
}

export function setStoredLanguage(language) {
  if (!SUPPORTED_LANGUAGES.includes(language)) return;

  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Ignore storage errors.
  }
}

export function getStoredCurrency() {
  try {
    const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (stored && SUPPORTED_CURRENCIES.includes(stored)) {
      return stored;
    }
  } catch {
    // Ignore storage errors.
  }

  return DEFAULT_CURRENCY;
}

export function setStoredCurrency(currency) {
  if (!SUPPORTED_CURRENCIES.includes(currency)) return;

  try {
    localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
  } catch {
    // Ignore storage errors.
  }
}

export function getRequestPreferenceHeaders() {
  const language = getStoredLanguage();
  const currency = getStoredCurrency();

  return {
    "Accept-Language": language,
    "X-Currency": currency,
  };
}
