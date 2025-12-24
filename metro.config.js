// Ensure non-standard assets (like .COF) are bundled correctly by Metro.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts = Array.from(new Set([...(config.resolver.assetExts ?? []), 'cof', 'COF']));

module.exports = config;
