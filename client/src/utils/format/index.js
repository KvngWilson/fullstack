import { getLanguageLocale, getStoredLanguage } from "@/preferences";

export function formatPrice(price, currency = "USD") {
  const language = getStoredLanguage();
  const locale = getLanguageLocale(language);

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(price);
}

export function formatDate(date, format = "en-US") {
  return new Intl.DateTimeFormat(format, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function truncateText(text, maxLength = 100) {
  if (!text) return "";
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
}

export function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function pluralize(word, count) {
  return count === 1 ? word : `${word}s`;
}
