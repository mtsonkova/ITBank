/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          deep: '#0077B6',
          primary: '#0096C7',
          bright: '#00B4D8',
          light: '#90E0EF',
        },
        avatar: {
          bg: '#90E0EF',
          text: '#024E73',
        },
        nav: {
          activeBg: '#E6F4F9',
          hoverBg: '#F4FAFC',
          activeText: '#0077B6',
          inactiveText: '#4A5A67',
        },
        tint: {
          100: '#F4FAFC',
          200: '#F1F7FA',
          300: '#E6F4F9',
        },
        border: {
          DEFAULT: '#E3EEF3',
          light: '#EEF4F7',
          input: '#CFE4ED',
          outline: '#BFE6F2',
        },
        status: {
          successText: '#2E7D5B',
          successBg: '#E7F3EC',
          warningText: '#9A6B12',
          warningBg: '#FBF1E0',
          dangerText: '#B0463C',
          dangerBg: '#F6E9E8',
          errorBg: '#FCEDEB',
          errorText: '#9C342C',
        },
        overdraft: '#FFB4A8',
      },
      fontFamily: {
        display: ['Bitter', 'Georgia', 'serif'],
        ui: ['Libre Franklin', 'system-ui', 'sans-serif'],
      },
      spacing: {
        sidebar: '252px',
        header: '62px',
      },
      borderRadius: {
        DEFAULT: '6px',
        lg: '10px',
        xl: '14px',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.07), 0 1px 2px -1px rgba(0,0,0,0.07)',
        modal: '0 8px 24px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
};
