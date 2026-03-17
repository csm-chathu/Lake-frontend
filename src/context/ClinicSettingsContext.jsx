import { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client.js';
import {
  CLINIC_ADDRESS,
  CLINIC_CURRENCY_CODE,
  CLINIC_LOGO_URL,
  CLINIC_NAME,
  CLINIC_PHONE,
  CLINIC_TAGLINE
} from '../constants/branding.js';

// convert an incoming logo URL to something the renderer can load
function normalizeLogo(url) {
  if (typeof url !== 'string' || url.length === 0) {
    return url;
  }
  // drop leading slash so relative paths work under file://
  if (url.startsWith('/')) {
    url = url.slice(1);
  }
  // when running from file:// use relative reference
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return url;
  }
  return url;
}

const defaultSettings = {
  name: CLINIC_NAME,
  tagline: CLINIC_TAGLINE,
  description: 'Your trusted partner in pet healthcare. Manage appointments, medical records, and care for your beloved pets with confidence.',
  pos_description: 'POS System for billing, sales, and day-end operations.',
  logo_url: normalizeLogo(CLINIC_LOGO_URL),
  hero_image_url: normalizeLogo('vet-clinic-hero.jpg'),
  phone: CLINIC_PHONE,
  address: CLINIC_ADDRESS,
  currency_code: CLINIC_CURRENCY_CODE
};

const ClinicSettingsContext = createContext({
  settings: defaultSettings,
  loading: false,
  error: '',
  refresh: () => {}
});

export const ClinicSettingsProvider = ({ children }) => {
  const query = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: async () => {
      const response = await client.get('/clinic-settings');
      return response.data || {};
    },
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  const settings = useMemo(() => {
    const apiSettings = query.data || {};
    const combined = {
      ...defaultSettings,
      ...apiSettings,
      tagline: apiSettings.tagline || defaultSettings.tagline,
      description: apiSettings.description || defaultSettings.description,
      pos_description: apiSettings.pos_description || defaultSettings.pos_description,
      currency_code: apiSettings.currency_code || defaultSettings.currency_code
    };
    // normalize any logo_url we received from the API as well
    combined.logo_url = normalizeLogo(combined.logo_url);
    combined.hero_image_url = normalizeLogo(combined.hero_image_url);
    return combined;
  }, [query.data]);

  const value = useMemo(
    () => ({
      settings,
      loading: query.isLoading || query.isFetching,
      error: query.error ? query.error.message || 'Failed to load clinic settings' : '',
      refresh: query.refetch
    }),
    [settings, query.isLoading, query.isFetching, query.error, query.refetch]
  );

  return <ClinicSettingsContext.Provider value={value}>{children}</ClinicSettingsContext.Provider>;
};

export const useClinicSettings = () => useContext(ClinicSettingsContext);

export default ClinicSettingsContext;
