import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isAppLocale } from './routing';

const namespaces = [
  'common',
  'landing',
  'auth',
  'sos',
  'supporter',
  'errors',
  'system',
  'sdgs',
  'legal',
] as const;

async function loadMessages(locale: string) {
  const entries = await Promise.all(
    namespaces.map(async (namespace) => {
      const messages = (await import(`../../messages/${locale}/${namespace}.json`)).default;
      return [namespace, messages] as const;
    })
  );

  return Object.fromEntries(entries);
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requestedLocale = await requestLocale;
  const locale = isAppLocale(requestedLocale) ? requestedLocale : defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
