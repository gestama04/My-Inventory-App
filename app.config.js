export default {
  expo: {
    name: 'VitaStreak',
    slug: 'vitastreak',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'vitastreak',
    userInterfaceStyle: 'automatic',

    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.gestama.vitastreak',
    },

    android: {
      versionCode: 7,
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#0f172a',
      },
      package: 'com.gestama.vitastreak',
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    },

    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },

    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/vitastreak-FUNDO.png',
          backgroundColor: '#010c24',
          imageWidth: 250,
          resizeMode: 'contain',
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/images/notification-icon.png',
          color: '#7c3aed',
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            buildToolsVersion: '35.0.0',
          },
        },
      ],
      'expo-web-browser',
      'expo-asset',
      'expo-localization',
    ],

    experiments: {
      typedRoutes: true,
    },

    extra: {
      router: {
        origin: false,
      },
      eas: {
        projectId: '42ade82a-b853-4ab2-b4e9-4c1a08bd7a91',
      },
    },
  },
}