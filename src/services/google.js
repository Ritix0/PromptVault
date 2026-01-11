/* src/services/google.js */

// КОНФИГУРАЦИЯ
const CLIENT_ID = "833291081802-47b7ntjqck33dhuldk71gpkqkp82edoj.apps.googleusercontent.com"; 
const SCOPES = "https://www.googleapis.com/auth/drive.file";
const DB_FILENAME = "promptvault_backup.json";

let tokenClient;
let gapiInited = false;
let gisInited = false;
let accessToken = null;
let tokenExpiresAt = 0; // Время истечения токена (timestamp)
let scriptsLoadingPromise = null;

// Внутренняя функция получения токена (с проверкой срока жизни)
const ensureToken = async () => {
    const now = Date.now();
    
    // 1. Если токена нет в памяти, ищем в localStorage
    if (!accessToken) {
        accessToken = localStorage.getItem("pv_google_token");
        const exp = localStorage.getItem("pv_google_token_exp");
        if (exp) tokenExpiresAt = parseInt(exp, 10);
    }

    // 2. Если токена все еще нет — мы не авторизованы
    if (!accessToken) return null;

    // 3. Проверка срока действия (если осталось меньше 5 минут — обновляем)
    // Google токены живут 1 час (3600 сек). 
    if (tokenExpiresAt && now > (tokenExpiresAt - 5 * 60 * 1000)) {
        console.log("🔄 Google Token expiring soon, refreshing...");
        
        if (tokenClient) {
             return new Promise((resolve) => {
                // Временный callback для обновления
                const originalCallback = tokenClient.callback;
                
                tokenClient.callback = (resp) => {
                    if (resp.error) {
                        console.error("Token refresh failed:", resp);
                        resolve(null); // Не удалось обновить
                    } else {
                        const newToken = resp.access_token;
                        const expiresIn = resp.expires_in || 3599;
                        const newExp = Date.now() + (expiresIn * 1000);
                        
                        accessToken = newToken;
                        tokenExpiresAt = newExp;
                        
                        localStorage.setItem("pv_google_token", newToken);
                        localStorage.setItem("pv_google_token_exp", newExp.toString());
                        
                        if (window.gapi && window.gapi.client) {
                            window.gapi.client.setToken({ access_token: newToken });
                        }
                        console.log("✅ Google Token refreshed!");
                        resolve(newToken);
                    }
                    // Возвращаем старый колбэк (хотя он перезаписывается при init, но для порядка)
                    tokenClient.callback = originalCallback; 
                };

                // Запрашиваем токен тихо (prompt: '')
                tokenClient.requestAccessToken({ prompt: '' }); 
             });
        }
    }
    
    return accessToken;
};

// Внутренняя функция инициализации API перед запросом
const ensureInit = async () => {
    // 1. Загружаем скрипты
    if (!gapiInited || !gisInited) {
        await googleService.loadScripts();
    }
    
    // 2. Гарантируем валидный токен
    const token = await ensureToken();
    
    // 3. Передаем токен в gapi
    if (token && window.gapi && window.gapi.client) {
        const currentTokenObj = window.gapi.client.getToken();
        // Если в gapi нет токена или он отличается — обновляем
        if (!currentTokenObj || currentTokenObj.access_token !== token) {
            window.gapi.client.setToken({ access_token: token });
        }
    }
    
    return true;
};

// Обработчик ошибок
const handleApiError = (e, context) => {
    console.error(`Google API Error [${context}]:`, JSON.stringify(e, null, 2) || e);
    
    const code = e.status || (e.result && e.result.error && e.result.error.code);
    
    // 401/403: Токен протух или невалиден
    if (code === 401 || code === 403) {
        console.warn("Token expired or invalid (401/403). Logging out locally.");
        
        localStorage.removeItem("pv_google_token");
        localStorage.removeItem("pv_google_token_exp");
        accessToken = null;
        tokenExpiresAt = 0;
        
        if (window.gapi && window.gapi.client) {
            window.gapi.client.setToken(null);
        }
        
        // Выбрасываем ошибку с понятным текстом для UI (чтобы showToast показал)
        throw new Error("Session expired. Please sign in again.");
    }
    throw e;
};

export const googleService = {
  
  // --- ИНИЦИАЛИЗАЦИЯ ---
  loadScripts: () => {
    if (scriptsLoadingPromise) return scriptsLoadingPromise;

    scriptsLoadingPromise = new Promise((resolve) => {
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
            discoveryDocs: [
              "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"
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
            
            const newToken = resp.access_token;
            // Сохраняем время жизни (обычно 3599 сек)
            const expiresIn = resp.expires_in || 3599;
            const expTime = Date.now() + (expiresIn * 1000);

            accessToken = newToken;
            tokenExpiresAt = expTime;

            localStorage.setItem("pv_google_token", newToken);
            localStorage.setItem("pv_google_token_exp", expTime.toString());

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
      // Переопределяем callback для этого конкретного вызова
      tokenClient.callback = (resp) => {
        if (resp.error) reject(resp);
        
        const newToken = resp.access_token;
        const expiresIn = resp.expires_in || 3599;
        const expTime = Date.now() + (expiresIn * 1000);

        accessToken = newToken;
        tokenExpiresAt = expTime;

        localStorage.setItem("pv_google_token", newToken);
        localStorage.setItem("pv_google_token_exp", expTime.toString());

        if (window.gapi && window.gapi.client) {
            window.gapi.client.setToken({ access_token: accessToken });
        }
        resolve(accessToken);
      };
      
      // Запрашиваем авторизацию (если токен есть, попробуем тихо, иначе попап)
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
    tokenExpiresAt = 0;
    
    localStorage.removeItem("pv_google_token");
    localStorage.removeItem("pv_google_token_exp");
    
    if (window.gapi && window.gapi.client) {
        window.gapi.client.setToken(null);
    }
  },

  isAuthenticated: () => {
      // Простая синхронная проверка наличия токена (без проверки валидности)
      return !!localStorage.getItem("pv_google_token");
  },

  // --- DRIVE BACKUP (JSON) ---
  
  uploadBackup: async (jsonData) => {
    // ВАЖНО: await ensureToken не здесь, а внутри ensureInit
    // Но для проверки логина делаем быстрый чек
    if (!localStorage.getItem("pv_google_token")) return;
    
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
    if (!localStorage.getItem("pv_google_token")) return null;
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
     return;
  },

  // --- SMART SYNC (ALL) ---
  syncEverything: async (rawJsonData, allPrompts) => {
    if (!localStorage.getItem("pv_google_token")) throw new Error("Not authenticated");
    await ensureInit();

    // 1. Бэкап файла: загружаем rawJsonData
    await googleService.uploadBackup(rawJsonData);
    console.log("Backup synced (File Only).");

    return 0;
  }
};