// Shared framer-motion stagger variants for the marketing slides.
// Kept in a plain .js file so component files stay fast-refresh clean
// (react-refresh/only-export-components).

// Stagger container + item variants — parent orchestrates children.
export const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
}
export const staggerItem = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
}
