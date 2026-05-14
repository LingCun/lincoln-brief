import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Lincoln Brief — Warm Charcoal & Bright Champagne Gold (v2)
        ink: {
          50:  '#f5edd9',  // ivory text
          100: '#dccfa8',
          200: '#c4b89e',  // muted text
          300: '#988e72',
          400: '#6a614c',
          500: '#48402f',
          600: '#3d3326',  // border (warmer, more visible)
          700: '#2b2218',  // section bg
          800: '#221b14',  // elevated bg
          900: '#1a1510',  // page bg (warm charcoal)
          950: '#0f0c08',  // deepest (for darker insets)
        },
        gold: {
          50:  '#fdf6e1',
          100: '#f7e8b8',
          200: '#f0d88c',
          300: '#e8c870',
          400: '#e0c074',  // highlight
          500: '#d8b878',  // primary bright champagne
          600: '#b89a5a',
          700: '#937845',
          800: '#705a33',
          900: '#4e3e22',
          950: '#2b2110',
        },
        bull: '#d96552',
        bear: '#5677b0',
      },
      fontFamily: {
        serif: ['"Playfair Display"', '"Cormorant Garamond"', 'Georgia', 'serif'],
        display: ['"Italiana"', '"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Pretendard"', '"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        content: '76rem',
        prose: '40rem',
      },
      letterSpacing: {
        'widest-2': '0.25em',
        'widest-3': '0.35em',
      },
      animation: {
        'ticker': 'ticker 40s linear infinite',
        'shimmer': 'shimmer 3s ease-in-out infinite',
        'fade-up': 'fadeUp 0.8s ease-out forwards',
      },
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        shimmer: {
          '0%, 100%': { opacity: '0.7' },
          '50%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      typography: ({ theme }) => ({
        invert: {
          css: {
            '--tw-prose-body': theme('colors.ink.100'),
            '--tw-prose-headings': theme('colors.ink.50'),
            '--tw-prose-lead': theme('colors.ink.200'),
            '--tw-prose-links': theme('colors.gold.400'),
            '--tw-prose-bold': theme('colors.ink.50'),
            '--tw-prose-counters': theme('colors.ink.200'),
            '--tw-prose-bullets': theme('colors.gold.700'),
            '--tw-prose-hr': theme('colors.ink.600'),
            '--tw-prose-quotes': theme('colors.ink.100'),
            '--tw-prose-quote-borders': theme('colors.gold.500'),
            '--tw-prose-captions': theme('colors.ink.300'),
            '--tw-prose-code': theme('colors.gold.300'),
            '--tw-prose-pre-code': theme('colors.ink.100'),
            '--tw-prose-pre-bg': theme('colors.ink.800'),
            '--tw-prose-th-borders': theme('colors.ink.600'),
            '--tw-prose-td-borders': theme('colors.ink.700'),
          },
        },
      }),
    },
  },
  plugins: [typography],
};
