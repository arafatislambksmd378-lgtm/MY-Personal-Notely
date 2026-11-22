// Metro configuration for Notely.
// - adds .wasm to asset extensions so the browser SQLite engine can be served
// - keeps the default Expo transformer settings
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts = Array.from(new Set([...config.resolver.assetExts, 'wasm']));

module.exports = config;
