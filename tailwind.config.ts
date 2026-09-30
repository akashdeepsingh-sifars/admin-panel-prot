import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    borderRadius: { none: '0', DEFAULT: '0', sm: '0', md: '0', lg: '0', xl: '0', full: '0' },
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        'divider-row': 'var(--divider-row)',
        navy: 'var(--navy)',
        'navy-dark': 'var(--navy-dark)',
        'navy-tint': 'var(--navy-tint)',
        'lime-brand': 'var(--lime)',
        'lime-dark': 'var(--lime-dark)',
        'lime-tint': 'var(--lime-tint)',
        destructive: 'var(--destructive)',
        'destructive-tint': 'var(--destructive-tint)',
        'destructive-ink': 'var(--destructive-ink)',
        warning: 'var(--warning)',
        'warning-tint': 'var(--warning-tint)',
        'warning-ink': 'var(--warning-ink)',
      },
      boxShadow: {
        card: 'var(--elevation-1)',
        'card-md': 'var(--elevation-2)',
      },
    },
  },
  plugins: [],
} satisfies Config;
