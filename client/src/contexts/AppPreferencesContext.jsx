import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_CURRENCY,
  DEFAULT_LANGUAGE,
  getLanguageLocale,
  getStoredCurrency,
  getStoredLanguage,
  setStoredCurrency,
  setStoredLanguage,
  SUPPORTED_CURRENCIES,
  SUPPORTED_LANGUAGES,
} from "@/preferences";

const AppPreferencesContext = createContext(null);

export function AppPreferencesProvider({ children }) {
  const { t: i18nextT, i18n } = useTranslation();
  const [language, setLanguageState] = useState(getStoredLanguage());
  const [currency, setCurrencyState] = useState(getStoredCurrency());

  const locale = getLanguageLocale(language);

  useEffect(() => {
    const storedLanguage = getStoredLanguage();
    const normalized = SUPPORTED_LANGUAGES.includes(storedLanguage)
      ? storedLanguage
      : DEFAULT_LANGUAGE;

    setLanguageState(normalized);
    if (i18n.language !== normalized) {
      i18n.changeLanguage(normalized);
    }
  }, [i18n]);

  const setLanguage = useCallback(
    (nextLanguage) => {
      const normalized = SUPPORTED_LANGUAGES.includes(nextLanguage)
        ? nextLanguage
        : DEFAULT_LANGUAGE;

      setLanguageState(normalized);
      setStoredLanguage(normalized);
      i18n.changeLanguage(normalized);
    },
    [i18n],
  );

  const setCurrency = useCallback((nextCurrency) => {
    const normalized = SUPPORTED_CURRENCIES.includes(nextCurrency)
      ? nextCurrency
      : DEFAULT_CURRENCY;

    setCurrencyState(normalized);
    setStoredCurrency(normalized);
  }, []);

  const t = useCallback(
    (key, values) => {
      return i18nextT(key, values);
    },
    [i18nextT],
  );

  const formatCurrency = useCallback(
    (amount) => {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(Number(amount || 0));
    },
    [locale, currency],
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      supportedLanguages: SUPPORTED_LANGUAGES,
      currency,
      setCurrency,
      supportedCurrencies: SUPPORTED_CURRENCIES,
      locale,
      t,
      formatCurrency,
    }),
    [language, currency, locale, setLanguage, setCurrency, t, formatCurrency],
  );

  return (
    <AppPreferencesContext.Provider value={value}>
      {children}
    </AppPreferencesContext.Provider>
  );
}

export function useAppPreferences() {
  const context = useContext(AppPreferencesContext);

  if (!context) {
    throw new Error(
      "useAppPreferences must be used within AppPreferencesProvider",
    );
  }

  return context;
}
