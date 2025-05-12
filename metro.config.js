// metro.config.js
const { getDefaultConfig } = require('@expo/metro-config'); // Certifique-se que é @expo/metro-config

const config = getDefaultConfig(__dirname);

// Habilitar a funcionalidade experimental require.context
// Se o seu projeto ou alguma dependência usa require.context, esta linha é necessária.
config.transformer = {
  ...config.transformer,
  unstable_allowRequireContext: true,
};

// Adicionar 'cjs' às extensões de source se você tiver módulos CommonJS com essa extensão.
config.resolver.sourceExts.push('cjs');

// Esta linha desativa o suporte para "package exports".
// Mantenha-a se você a adicionou para resolver um problema específico com alguma dependência.
// Se não tiver certeza, pode ser seguro removê-la, mas como você pediu "igualzinho", aqui está.
config.resolver.unstable_enablePackageExports = false; 

module.exports = config;
