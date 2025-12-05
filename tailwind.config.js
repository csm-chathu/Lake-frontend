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
          secondary: '#f97316',
          accent: '#22d3ee',
          neutral: '#1f2937',
          'base-100': '#f1f5f9',
          success: '#16a34a',
          warning: '#f97316',
          error: '#ef4444'
        }
      },
      'light'
    ],
    darkTheme: 'light'
  }
};
