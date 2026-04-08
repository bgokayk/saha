const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Web'de native-only paketleri boş modülle değiştir
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    const webStubs = ['expo-image-picker', 'expo-haptics', 'expo-av'];
    if (webStubs.includes(moduleName)) {
      return { type: 'empty' };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
