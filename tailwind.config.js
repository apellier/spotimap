/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    // Add other paths if necessary
  ],
  darkMode: ['selector', '[data-theme="dark"]'], // Use the 'data-theme' attribute for dark mode
  theme: {
    extend: {
      colors: {
        'nb-bg': 'var(--bg-primary)',
        'nb-text': 'var(--text-primary)',
        'nb-accent': 'var(--accent-primary)',
        'nb-accent-destructive': 'var(--accent-destructive)',
        'nb-text-on-accent': 'var(--text-on-accent)',
        'nb-text-on-destructive': 'var(--text-on-destructive)',
        'nb-border': 'var(--border-primary)',
      },
      borderColor: { // Explicitly define border colors if needed, or rely on 'nb-border' with text color utilities
        DEFAULT: 'var(--border-primary)', // Makes border-nb-border work like border-gray-200
        'nb-primary': 'var(--border-primary)',
        'nb-accent': 'var(--accent-primary)',
        'nb-destructive': 'var(--accent-destructive)',
      },
      boxShadow: {
        'nb': 'var(--nb-shadow)',
        'nb-accent': 'var(--nb-shadow-accent)',
        'nb-destructive': 'var(--nb-shadow-destructive)',
        'nb-none': 'none', // Utility for removing shadow
      },
      borderRadius: {
        'nb': 'var(--nb-radius)', // Should be '0px'
      },
      borderWidth: {
        'nb': 'var(--nb-border-width)', // e.g., '2px'
        'nb-thick': 'var(--nb-border-width-thick)', // e.g., '3px'
      },
      fontFamily: {
        sans: ['Inter', 'Arial', 'Helvetica', 'sans-serif'], // Prioritize Inter
        // You can add 'mono' if you plan to use a monospace font
      },
      spacing: { // If you want to use your --spacing vars in Tailwind
        'nb-xs': 'var(--spacing-xs)',
        'nb-sm': 'var(--spacing-sm)',
        'nb-md': 'var(--spacing-md)',
        'nb-lg': 'var(--spacing-lg)',
        'nb-xl': 'var(--spacing-xl)',
      },
      letterSpacing: {
        'nb-wide': '0.05em', // For uppercase buttons
      }
    },
  },
  plugins: [
    // You can add Tailwind plugins here if needed, e.g., @tailwindcss/forms for better default form styles
    // require('@tailwindcss/forms'),
  ],
};