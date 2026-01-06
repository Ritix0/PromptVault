/* src/services/storage.js */

const DB_NAME = "PromptVaultDB";
const DB_VERSION = 1;
const STORE_PROMPTS = "prompts";
const STORE_SETTINGS = "settings";
const DELETED_LOG_KEY = "pv_deleted_ids_log"; // Лог удаленных ID (Tombstones)

/**
 * Внутренний хелпер для работы с IndexedDB API (Promise-wrapper)
 */
const dbHelper = {
  open: () => {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined") {
        reject(new Error("Browser environment required"));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Хранилище промптов (ключ = id)
        if (!db.objectStoreNames.contains(STORE_PROMPTS)) {
          const store = db.createObjectStore(STORE_PROMPTS, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
          store.createIndex("isDeleted", "isDeleted", { unique: false });
        }

        // Хранилище настроек и ключей (ключ = setting_key)
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: "key" });
        }
      };

      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  },

  // Универсальный метод для транзакций
  transaction: (storeName, mode, callback) => {
    return dbHelper.open().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const request = callback(store);

        tx.oncomplete = () => resolve(request?.result);
        tx.onerror = () => reject(tx.error);
        
        if (request && request instanceof IDBRequest) {
            request.onsuccess = () => {}; 
        }
      });
    });
  },

  getAll: (storeName) => {
    return dbHelper.open().then(db => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    });
  },

  get: (storeName, key) => {
    return dbHelper.open().then(db => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    });
  },

  put: (storeName, data) => {
    return dbHelper.open().then(db => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(data);
            tx.oncomplete = () => resolve(data);
            tx.onerror = () => reject(tx.error);
        });
    });
  },

  delete: (storeName, key) => {
    return dbHelper.open().then(db => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            store.delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    });
  },
  
  clear: (storeName) => {
      return dbHelper.open().then(db => {
          return new Promise((resolve, reject) => {
              const tx = db.transaction(storeName, 'readwrite');
              const store = tx.objectStore(storeName);
              store.clear();
              tx.oncomplete = () => resolve();
              tx.onerror = () => reject(tx.error);
          });
      });
  }
};

export const storageService = {
  // --- PROMPTS MANAGEMENT ---

  getAllPrompts: async () => {
    try {
      const prompts = await dbHelper.getAll(STORE_PROMPTS);
      return prompts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } catch (e) {
      console.error("Failed to load prompts form IDB:", e);
      return [];
    }
  },

  savePrompt: async (promptData) => {
    const now = new Date().toISOString();
    
    let existing = null;
    if (promptData.id) {
        existing = await dbHelper.get(STORE_PROMPTS, promptData.id);
    }

    let payload = {
      ...promptData,
      updatedAt: now,
      testInput: promptData.testInput || "",
      lastResult: promptData.lastResult || "",
      tags: promptData.tags || [],
      isFavorite: promptData.isFavorite || false,
      isDeleted: promptData.isDeleted || false
    };

    if (existing) {
      // Версионирование
      const isTitleSame = existing.title === payload.title;
      const isContentSame = existing.content === payload.content;
      const isTestInputSame = (existing.testInput || "") === (payload.testInput || "");
      const isTagsSame = JSON.stringify(existing.tags || []) === JSON.stringify(payload.tags || []);

      const isContentIdentical = isTitleSame && isContentSame && isTestInputSame && isTagsSame;

      if (isContentIdentical) {
        const updatedNoVersionChange = {
            ...existing,
            updatedAt: now,
            lastResult: payload.lastResult,
            isFavorite: payload.isFavorite,
            isDeleted: payload.isDeleted,
            tags: payload.tags 
        };
        return await dbHelper.put(STORE_PROMPTS, updatedNoVersionChange);
      } else {
        const historySnapshot = {
            version: existing.version || 1, 
            timestamp: existing.updatedAt || existing.createdAt || now,
            title: existing.title,
            content: existing.content,
            testInput: existing.testInput || "",
            tags: existing.tags || []
        };

        payload.createdAt = existing.createdAt;
        payload.version = (existing.version || 1) + 1;
        
        if (payload.isFavorite === undefined) payload.isFavorite = existing.isFavorite;
        if (payload.isDeleted === undefined) payload.isDeleted = existing.isDeleted;

        payload.history = [
            ...(existing.history || []), 
            historySnapshot
        ];

        return await dbHelper.put(STORE_PROMPTS, payload);
      }
    } else {
      payload.id = payload.id || crypto.randomUUID();
      payload.createdAt = now;
      payload.version = 1;
      payload.history = [];
      
      return await dbHelper.put(STORE_PROMPTS, payload);
    }
  },

  deletePrompt: async (id) => {
    const prompt = await dbHelper.get(STORE_PROMPTS, id);
    if (prompt) {
        prompt.isDeleted = true;
        prompt.updatedAt = new Date().toISOString();
        await dbHelper.put(STORE_PROMPTS, prompt);
    }
  },

  restorePrompt: async (id) => {
    const prompt = await dbHelper.get(STORE_PROMPTS, id);
    if (prompt) {
        prompt.isDeleted = false;
        await dbHelper.put(STORE_PROMPTS, prompt);
    }
  },

  // Полное удаление с добавлением в Черный список
  permanentDelete: async (id) => {
    // 1. Удаляем из базы
    await dbHelper.delete(STORE_PROMPTS, id);
    
    // 2. Добавляем ID в "Черный список", чтобы он не вернулся из облака
    try {
        const deletedLog = JSON.parse(localStorage.getItem(DELETED_LOG_KEY) || "[]");
        if (!deletedLog.includes(id)) {
            deletedLog.push(id);
            localStorage.setItem(DELETED_LOG_KEY, JSON.stringify(deletedLog));
        }
    } catch (e) {
        console.error("Failed to update deleted log", e);
    }
  },

  toggleFavorite: async (id) => {
    const prompt = await dbHelper.get(STORE_PROMPTS, id);
    if (prompt) {
        prompt.isFavorite = !prompt.isFavorite;
        await dbHelper.put(STORE_PROMPTS, prompt);
    }
  },

  // --- DATA EXPORT/IMPORT & SYNC ---

  // Получаем JSON для экспорта/бэкапа (с ЛИЦЕНЗИЕЙ и DEVICE ID)
  getRawData: async () => {
    const allPrompts = await dbHelper.getAll(STORE_PROMPTS);
    const usageCount = await storageService.getUsageCount(); 
    
    // Достаем ключ лицензии для сохранения
    const licenseKey = await storageService.getSetting("license_key");
    
    // НОВОЕ: Достаем ID устройства, чтобы сохранить его
    const deviceIdRecord = await dbHelper.get(STORE_SETTINGS, "device_installation_id");
    const deviceId = deviceIdRecord ? deviceIdRecord.value : null;
    
    const exportData = {
        prompts: allPrompts,
        meta: {
            exportedAt: new Date().toISOString(),
            usageCount: usageCount,
            licenseKey: licenseKey || null, // Сохраняем ключ
            deviceId: deviceId || null // <--- СОХРАНЯЕМ ID
        }
    };
    
    return JSON.stringify(exportData, null, 2);
  },

  importData: async (jsonString) => {
    try {
      const data = JSON.parse(jsonString);
      
      let promptsToImport = [];
      let importedUsage = 0;
      let importedLicense = null;
      let importedDeviceId = null;

      if (Array.isArray(data)) {
          promptsToImport = data;
      } else if (data.prompts) {
          promptsToImport = data.prompts;
          importedUsage = data.meta?.usageCount || 0;
          importedLicense = data.meta?.licenseKey || null; // Читаем ключ
          importedDeviceId = data.meta?.deviceId || null; // <--- ЧИТАЕМ ID
      }
      
      await dbHelper.clear(STORE_PROMPTS);

      for (const item of promptsToImport) {
          if (item.title) {
              await dbHelper.put(STORE_PROMPTS, item);
          }
      }

      // Синхронизация счетчика
      const currentUsage = await storageService.getUsageCount();
      if (importedUsage > currentUsage) {
          await storageService.setUsageCount(importedUsage);
      }

      // Восстановление лицензии
      if (importedLicense) {
          await storageService.saveSetting("license_key", importedLicense);
      }
      
      // НОВОЕ: Восстанавливаем ID устройства
      if (importedDeviceId) {
          await dbHelper.put(STORE_SETTINGS, { 
              key: "device_installation_id", 
              value: importedDeviceId, 
              type: "system" 
          });
      }

      return true;
    } catch (e) {
      console.error("Import failed", e);
      return false;
    }
  },

  // Слияние с проверкой "Черного списка" и синхронизацией
  mergeData: async (cloudJson) => {
      let cloudPrompts = [];
      let cloudUsage = 0;
      let cloudLicense = null;
      let cloudDeviceId = null;

      if (Array.isArray(cloudJson)) {
          cloudPrompts = cloudJson;
      } else if (cloudJson && cloudJson.prompts) {
          cloudPrompts = cloudJson.prompts;
          cloudUsage = cloudJson.meta?.usageCount || 0;
          cloudLicense = cloudJson.meta?.licenseKey || null; // Читаем ключ
          cloudDeviceId = cloudJson.meta?.deviceId || null; // <--- ЧИТАЕМ ID
      } else {
          return 0; // Нечего мержить
      }
      
      let deletedLog = [];
      try { deletedLog = JSON.parse(localStorage.getItem(DELETED_LOG_KEY) || "[]"); } catch (e) {}

      let updatedCount = 0;
      for (const p of cloudPrompts) {
          // Если ID есть в черном списке — ПРОПУСКАЕМ
          if (p.id && deletedLog.includes(p.id)) continue; 
          
          if (p.title) {
              await storageService.savePrompt(p);
              updatedCount++;
          }
      }

      // Синхронизация счетчика
      const currentUsage = await storageService.getUsageCount();
      if (cloudUsage > currentUsage) {
          await storageService.setUsageCount(cloudUsage);
      }

      // Если в облаке есть лицензия, берем её
      const currentLicense = await storageService.getSetting("license_key");
      if (!currentLicense && cloudLicense) {
          await storageService.saveSetting("license_key", cloudLicense);
      }
      
      // НОВОЕ: Восстанавливаем ID устройства, если у нас его нет или он новый
      // Это предотвращает накрутку счетчика при переустановке
      const currentDeviceRec = await dbHelper.get(STORE_SETTINGS, "device_installation_id");
      if (!currentDeviceRec && cloudDeviceId) {
          await dbHelper.put(STORE_SETTINGS, { 
              key: "device_installation_id", 
              value: cloudDeviceId, 
              type: "system" 
          });
      }

      return updatedCount;
  },

  clearAll: async () => {
    await dbHelper.clear(STORE_PROMPTS);
    localStorage.removeItem(DELETED_LOG_KEY);
  },

  clearDeletedLog: () => {
      localStorage.removeItem(DELETED_LOG_KEY);
  },

  // --- API KEYS & SETTINGS ---

  getAllApiKeys: async () => {
    const settings = await dbHelper.getAll(STORE_SETTINGS);
    const keysMap = {};
    settings.forEach(s => {
        if (s.type === 'apikey') {
            keysMap[s.key] = s.value;
        }
    });
    return keysMap;
  },

  getApiKey: async (providerId) => {
    const record = await dbHelper.get(STORE_SETTINGS, providerId);
    return record ? record.value : "";
  },

  setApiKey: async (providerId, keyValue) => {
    await dbHelper.put(STORE_SETTINGS, {
        key: providerId,
        value: keyValue,
        type: 'apikey'
    });
  },

  getSetting: async (key) => {
      const record = await dbHelper.get(STORE_SETTINGS, key);
      return record ? record.value : null;
  },

  saveSetting: async (key, value) => {
      await dbHelper.put(STORE_SETTINGS, { key, value, type: 'config' });
  },

  // НОВОЕ: Генерация уникального ID устройства
  getDeviceId: async () => {
      // 1. Пробуем найти уже сохраненный ID
      const record = await dbHelper.get(STORE_SETTINGS, "device_installation_id");
      if (record && record.value) {
          return record.value;
      }

      // 2. Если нет - генерируем новый
      const newId = crypto.randomUUID();
      
      // 3. Сохраняем его
      await dbHelper.put(STORE_SETTINGS, { 
          key: "device_installation_id", 
          value: newId, 
          type: "system" 
      });
      
      return newId;
  },

  // --- USAGE COUNTER (TRIAL) ---
  
  getUsageCount: async () => {
      const record = await dbHelper.get(STORE_SETTINGS, 'system_usage');
      return record ? (parseInt(record.value) || 0) : 0;
  },

  setUsageCount: async (val) => {
      await dbHelper.put(STORE_SETTINGS, { key: 'system_usage', value: val, type: 'system' });
  },

  incrementUsageCount: async () => {
      const current = await storageService.getUsageCount();
      await storageService.setUsageCount(current + 1);
      return current + 1;
  }
};