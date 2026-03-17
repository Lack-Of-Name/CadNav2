const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

config.resolver.assetExts = Array.from(new Set([...(config.resolver.assetExts ?? []), 'cof', 'COF']));

module.exports = config;