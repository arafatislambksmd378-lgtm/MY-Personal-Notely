// Flat ESLint config (ESLint 9) using Expo's shared rules.
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*', 'web-build/*', 'scripts/*', 'public/*', 'coverage/*', 'node_modules/*'],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    rules: {
      // React Compiler lint rules flag two patterns this app relies on:
      // roles that React Native's Animated API requires (`useRef(new Animated.Value())`
      // and imperative `Animated.timing` bridges), and async bootstrap effects that
      // set state after an await. Both are intentional, so they stay warnings.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];
