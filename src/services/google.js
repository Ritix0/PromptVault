/* src/services/google.js */

// КОНФИГУРАЦИЯ
const CLIENT_ID = "833291081802-47b7ntjqck33dhuldk71gpkqkp82edoj.apps.googleusercontent.com"; 

// ИЗМЕНЕНИЕ: Оставили только безопасный доступ к файлам (Drive)
const SCOPES = "https://www.googleapis.com/auth/drive.file";

// Имена файлов в облаке
const DB_FILENAME = "promptvault_backup.json";
// SHEET_NAME удален

let tokenClient;
let gapiInited = false;
let gisInited = false;
let accessToken = null;
let scriptsLoadingPromise = null;

// Хелпер getSpreadsheetId удален, так как таблицы отключены

// Внутренняя функция восстановления токена
const ensureToken = () => {
    if (!accessToken) {
        accessToken = localStorage.getItem("pv_google_token");
    }
    return accessToken;
};

// Внутренняя функция инициализации API перед запросом
const ensureInit = async () => {
    // 1. Загружаем скрипты, если их нет
    if (!gapiInited || !gisInited) {
        await googleService.loadScripts();
    }
    
    // 2. ВАЖНО: Передаем токен в gapi, иначе он делает анонимный запрос (ошибка 403)
    if (accessToken && window.gapi && window.gapi.client) {
        const currentToken = window.gapi.client.getToken();
        if (!currentToken) {
            window.gapi.client.setToken({ access_token: accessToken });
        }
    }
    
    return true;
};

// Обработчик ошибок
const handleApiError = (e, context) => {
    console.error(`Google API Error [${context}]:`, JSON.stringify(e, null, 2) || e);
    
    // Проверяем коды ошибок:
    // 401: Expired Token
    // 403: Permission Denied / Unregistered Caller (токен не применился)
    const code = e.status || (e.result && e.result.error && e.result.error.code);
    
    if (code === 401 || code === 403) {
        console.warn("Token expired or invalid. Logging out locally.");
        
        // Сброс состояния
        localStorage.removeItem("pv_google_token");
        accessToken = null;
        if (window.gapi && window.gapi.client) {
            window.gapi.client.setToken(null);
        }

        // Уведомление пользователя
        alert("Google Session Expired/Invalid. Please disconnect and sign in again.");
        
        // Можно перезагрузить страницу, чтобы обновить UI Settings
        // window.location.reload(); 
    }
    throw e;
};

export const googleService = {
  
  // --- ИНИЦИАЛИЗАЦИЯ ---
  loadScripts: () => {
    if (scriptsLoadingPromise) return scriptsLoadingPromise;

    scriptsLoadingPromise = new Promise((resolve) => {
      // Если уже загружено
      if (typeof window !== 'undefined' && window.gapi && window.google) {
          gapiInited = true;
          gisInited = true;
          resolve(true);
          return;
      }

      const script1 = document.createElement("script");
      script1.src = "https://apis.google.com/js/api.js";
      script1.onload = () => {
        window.gapi.load("client", async () => {
          await window.gapi.client.init({
            // clientId не обязателен тут для bearer auth, но полезен для контекста
            discoveryDocs: [
              "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"
              // Sheets API удален отсюда
            ],
          });
          gapiInited = true;
          if (gisInited) resolve(true);
        });
      };
      document.body.appendChild(script1);

      const script2 = document.createElement("script");
      script2.src = "https://accounts.google.com/gsi/client";
      script2.onload = () => {
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (resp) => {
            if (resp.error !== undefined) throw (resp);
            accessToken = resp.access_token;
            localStorage.setItem("pv_google_token", accessToken);
            // Сразу устанавливаем токен в gapi
            if (window.gapi && window.gapi.client) {
                window.gapi.client.setToken({ access_token: accessToken });
            }
          },
        });
        gisInited = true;
        if (gapiInited) resolve(true);
      };
      document.body.appendChild(script2);
    });

    return scriptsLoadingPromise;
  },

  login: async () => {
    await googleService.loadScripts();
    return new Promise((resolve, reject) => {
      tokenClient.callback = (resp) => {
        if (resp.error) reject(resp);
        accessToken = resp.access_token;
        localStorage.setItem("pv_google_token", accessToken);
        // Установка токена
        if (window.gapi && window.gapi.client) {
            window.gapi.client.setToken({ access_token: accessToken });
        }
        resolve(accessToken);
      };
      if (accessToken) tokenClient.requestAccessToken({prompt: ''});
      else tokenClient.requestAccessToken({prompt: 'consent'});
    });
  },

  logout: () => {
    const token = accessToken || localStorage.getItem("pv_google_token");
    if (token && window.google) {
      window.google.accounts.oauth2.revoke(token, () => {console.log('Revoked')});
    }
    accessToken = null;
    localStorage.removeItem("pv_google_token");
    if (window.gapi && window.gapi.client) {
        window.gapi.client.setToken(null);
    }
  },

  isAuthenticated: () => {
      return !!ensureToken();
  },

  // --- DRIVE BACKUP (JSON) ---
  
  uploadBackup: async (jsonData) => {
    if (!ensureToken()) return;
    await ensureInit(); 
    try {
        const response = await window.gapi.client.drive.files.list({
            q: `name = '${DB_FILENAME}' and trashed = false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });
        const files = response.result.files;
        const metadata = { name: DB_FILENAME, mimeType: 'application/json' };

        if (files && files.length > 0) {
            // ОБНОВЛЕНИЕ
            const fileId = files[0].id;
            await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: jsonData
            });
        } else {
            // СОЗДАНИЕ
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
            form.append('file', new Blob([jsonData], {type: 'application/json'}));
            await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}` },
                body: form
            });
        }
    } catch (e) { handleApiError(e, 'uploadBackup'); }
  },

  // Скачивание бэкапа (Pull)
  downloadBackup: async () => {
    if (!ensureToken()) return null;
    await ensureInit();
    try {
        const response = await window.gapi.client.drive.files.list({
            q: `name = '${DB_FILENAME}' and trashed = false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });
        
        const files = response.result.files;
        if (files && files.length > 0) {
            const fileId = files[0].id;
            // Скачиваем контент
            const res = await window.gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });
            
            let data = res.result || res.body;
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch(e) { console.warn("Failed to parse cloud JSON"); }
            }
            return data;
        }
        return null; // Файла нет
    } catch (e) { 
        handleApiError(e, 'downloadBackup');
        return null;
    }
  },

  // --- SHEETS LOGGING (ОТКЛЮЧЕНО) ---
  appendToSheet: async (prompt) => {
     // Заглушка: просто выходим, ничего не делаем
     return;
  },

  // --- SMART SYNC (ALL) ---
  syncEverything: async (rawJsonData, allPrompts) => {
    if (!ensureToken()) throw new Error("Not authenticated");
    await ensureInit();

    // 1. Бэкап файла: загружаем rawJsonData (где есть meta и usageCount)
    await googleService.uploadBackup(rawJsonData);
    console.log("Backup synced (File Only).");

    // 2. Логику таблиц удалили, чтобы не вызывать ошибку прав доступа
    return 0;
  }
};