import daisyui from 'daisyui';

export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#2563eb',
          accent: '#f97316'
        }
      }
    }
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        vetcare: {
          primary: '#2563eb',
          'primary-focus': '#1d4ed8',
          'primary-content': '#ffffff',
          secondary: '#f59e0b',
          'secondary-content': '#ffffff',
          accent: '#93c5fd',
          neutral: '#1e3a8a',
          'base-100': '#ffffff',
          'base-200': '#f8fafc',
          'base-300': '#e2e8f0',
          'base-content': '#1e293b',
          success: '#16a34a',
          warning: '#f97316',
          error: '#ef4444',
          info: '#0891b2'
        }
      },
      'light'
    ],
    darkTheme: 'light'
  }
};
