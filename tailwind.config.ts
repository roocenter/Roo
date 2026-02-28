import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        panel: '#111111',
        border: '#1a1a1a',
        accent: '#7c3aed',
        text: '#f4f4f5',
        muted: '#71717a',
      },
    },
  },
  plugins: [],
};

export default config;
