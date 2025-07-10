const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onRequest} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

initializeApp();

/**
 * Função que verifica stock levels baseada nas configurações do usuário
 */
exports.checkStockLevels = onSchedule("every 5 minutes", async (event) => {
  console.log("🔍 Iniciando verificação de stock...");

  try {
    const db = getFirestore();
    const now = new Date();
    const usersSnapshot = await db.collection("users").get();

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();

      if (!userData.expoPushToken) {
        console.log(`Sem Expo Push Token para utilizador ${userId}`);
        continue;
      }

      // 🆕 BUSCAR CONFIGURAÇÕES DO NOTIFICATION SERVICE
      let userSettings;
      try {
        const settingsDoc = await db.collection("userNotificationSettings")
            .doc(userId).get();
        if (settingsDoc.exists) {
          userSettings = settingsDoc.data();
        } else {
          // Configurações padrão se não existir
          userSettings = {
            enabled: true,
            interval: 60,
            lowStockEnabled: true,
            outOfStockEnabled: true,
          };
        }
      } catch (error) {
        console.error(`Erro ao buscar configurações para ${userId}:`, error);
        continue;
      }

      // 🆕 VERIFICAR SE NOTIFICAÇÕES ESTÃO HABILITADAS
      if (!userSettings.enabled) {
        console.log(`Notificações desativadas para utilizador ${userId}`);
        continue;
      }

      // 🆕 USAR INTERVALO CONFIGURADO PELO USUÁRIO
      const lastNotificationTime = userData.lastStockNotification ?
        userData.lastStockNotification.toDate() :
        new Date(0);

      const intervalMs = userSettings.interval * 60 * 1000;
      const timeSinceLastCheck = now.getTime() -
        lastNotificationTime.getTime();

      if (timeSinceLastCheck < intervalMs) {
        const minutesWaited = Math.round(timeSinceLastCheck / (60 * 1000));
        console.log(`Ainda não é hora para utilizador ${userId} ` +
          `(${minutesWaited} min de ${userSettings.interval} min)`);
        continue;
      }

      console.log(`⏰ Verificando stock para utilizador ${userId} ` +
        `(intervalo: ${userSettings.interval} min)`);

      await checkUserStock(userId, userData.expoPushToken, userSettings);
    }

    console.log("✅ Verificação concluída");
  } catch (error) {
    console.error("❌ Erro na verificação:", error);
  }
});

/**
 * Verificar stock de um utilizador específico
 * @param {string} userId - ID do utilizador
 * @param {string} expoPushToken - Token Expo do utilizador
 * @param {Object} userSettings - Configurações de notificação do utilizador
 */
async function checkUserStock(userId, expoPushToken, userSettings) {
  try {
    const db = getFirestore();

    const inventorySnapshot = await db.collection("inventory")
        .where("userId", "==", userId)
        .get();

    if (inventorySnapshot.empty) {
      console.log(`Sem inventário para utilizador ${userId}`);
      return;
    }

    const userSettingsDoc = await db.collection("userSettings")
        .doc(userId).get();
    const globalSettings = userSettingsDoc.data() || {};
    const globalThreshold = parseInt(
        globalSettings.globalLowStockThreshold || "5",
    );

    const lowStockItems = [];
    const outOfStockItems = [];

    inventorySnapshot.forEach((doc) => {
      const item = {id: doc.id, ...doc.data()};
      const quantity = parseInt(item.quantity) || 0;

      if (quantity === 0) {
        outOfStockItems.push(item);
      } else {
        const threshold = parseInt(item.lowStockThreshold) ||
          globalThreshold;
        if (quantity <= threshold) {
          lowStockItems.push(item);
        }
      }
    });

    // 🆕 VERIFICAR CONFIGURAÇÕES ESPECÍFICAS ANTES DE ENVIAR
    const shouldSendLowStock = userSettings.lowStockEnabled &&
      lowStockItems.length > 0;
    const shouldSendOutOfStock = userSettings.outOfStockEnabled &&
      outOfStockItems.length > 0;

    if (shouldSendLowStock || shouldSendOutOfStock) {
      await sendExpoPushNotification(
          userId,
          expoPushToken,
          shouldSendLowStock ? lowStockItems : [],
          shouldSendOutOfStock ? outOfStockItems : [],
          userSettings,
      );
    } else {
      console.log(`✅ Stock OK para utilizador ${userId} ou ` +
        `notificações desabilitadas`);
    }
  } catch (error) {
    console.error(`❌ Erro ao verificar stock do utilizador ${userId}:`,
        error);
  }
}

/**
 * Enviar notificação via Expo Push API
 * @param {string} userId - ID do utilizador
 * @param {string} expoPushToken - Token Expo
 * @param {Array} lowStockItems - Items com stock baixo
 * @param {Array} outOfStockItems - Items sem stock
 * @param {Object} userSettings - Configurações do utilizador
 */
async function sendExpoPushNotification(
    userId,
    expoPushToken,
    lowStockItems,
    outOfStockItems,
    userSettings,
) {
  try {
    const db = getFirestore();
    const fetch = require("node-fetch");
    const messages = [];

    if (userSettings.outOfStockEnabled && outOfStockItems.length > 0) {
      const count = outOfStockItems.length;
      const itemNames = outOfStockItems.slice(0, 2)
          .map((item) => item.name).join(", ");

      const body = count === 1 ?
        `${itemNames} está sem stock` :
        `${count} produtos sem stock: ${itemNames}${count > 2 ?
          "..." : ""}`;

      messages.push({
        to: expoPushToken,
        title: "🚨 Alerta: Sem Stock",
        body: body,
        data: {
          type: "out-of-stock",
          userId: userId,
          count: count.toString(),
        },
        sound: "default",
        priority: "high",
      });
    }

    if (userSettings.lowStockEnabled && lowStockItems.length > 0) {
      const count = lowStockItems.length;
      const itemNames = lowStockItems.slice(0, 2)
          .map((item) => item.name).join(", ");

      const body = count === 1 ?
        `${itemNames} está com stock baixo` :
        `${count} produtos com stock baixo: ${itemNames}${count > 2 ?
          "..." : ""}`;

      messages.push({
        to: expoPushToken,
        title: "⚠️ Alerta: Stock Baixo",
        body: body,
        data: {
          type: "low-stock",
          userId: userId,
          count: count.toString(),
        },
        sound: "default",
        priority: "normal",
      });
    }

    for (const message of messages) {
      try {
        const response = await fetch(
            "https://exp.host/--/api/v2/push/send",
            {
              method: "POST",
              headers: {
                "Accept": "application/json",
                "Accept-encoding": "gzip, deflate",
                "Content-Type": "application/json",
              },
              body: JSON.stringify(message),
            },
        );

        const result = await response.json();

        if (result.data && result.data.status === "ok") {
          console.log(`📤 Notificação "${message.title}" enviada para ` +
            `${userId}`);

          await db.collection("notifications").add({
            userId: userId,
            title: message.title,
            message: message.body,
            timestamp: new Date(),
            read: false,
            type: message.data.type,
            itemIds: [],
          });
        } else {
          console.error(`❌ Erro ao enviar "${message.title}" para ` +
            `${userId}:`, result);
        }
      } catch (error) {
        console.error(`❌ Erro de rede ao enviar para ${userId}:`, error);
      }
    }

    await db.collection("users").doc(userId).update({
      lastStockNotification: new Date(),
    });
  } catch (error) {
    console.error(`❌ Erro geral ao enviar notificações para ${userId}:`,
        error);
  }
}

/**
 * Função para teste manual
 */
exports.testStockCheckNow = onRequest(async (req, res) => {
  console.log("🧪 Teste manual de verificação de stock iniciado...");

  try {
    const db = getFirestore();
    const usersSnapshot = await db.collection("users").get();
    let processedUsers = 0;
    let usersWithTokens = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      processedUsers++;

      if (userData.expoPushToken) {
        usersWithTokens++;
        const userSettings = userData.notificationSettings || {
          enabled: true,
          lowStockEnabled: true,
          outOfStockEnabled: true,
        };

        await checkUserStock(userId, userData.expoPushToken, userSettings);
      }
    }

    res.json({
      success: true,
      message: "Teste concluído!",
      stats: {
        totalUsers: processedUsers,
        usersWithTokens: usersWithTokens,
        usersWithoutTokens: processedUsers - usersWithTokens,
      },
    });
  } catch (error) {
    console.error("❌ Erro no teste:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
