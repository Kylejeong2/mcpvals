import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}','./content/**/*.{md,mdx}'],
  theme: { extend: {} },
  plugins: [typography]
} satisfies Config