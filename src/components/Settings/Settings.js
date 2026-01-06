/* src/components/Settings/Settings.js */
"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./Settings.module.css";
import { storageService } from "@/services/storage";
import { llmService } from "@/services/llm";
import { userService } from "@/services/user";
import { googleService } from "@/services/google";

// Ссылка на магазин кодов (Вставь свою реальную ссылку Digiseller/Plati)
const BUY_LINK = "https://oplata.info/asp2/pay.asp?id_d=5636310"; 

export default function Settings({ onDataChanged }) {
  const fileInputRef = useRef(null);
  const providers = llmService.getProviders();
  const [isPro, setIsPro] = useState(false); // Загружаем асинхронно

  // State
  const [selectedProvider, setSelectedProvider] = useState(providers[0]?.id || "openai");
  const [apiKeys, setApiKeys] = useState({});
  const [showKey, setShowKey] = useState(false);
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState({ count: 0, lastUpdate: "Loading..." });

  // Новые стейты для статуса и лицензии
  const [userStatus, setUserStatus] = useState("Loading...");
  const [licenseKey, setLicenseKey] = useState("");

  // Google State
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const initData = async () => {
        try {
            const keys = await storageService.getAllApiKeys();
            setApiKeys(keys);
            
            const prompts = await storageService.getAllPrompts();
            setStats({
              count: prompts.length,
              lastUpdate: prompts.length > 0 ? new Date(prompts[0].updatedAt).toLocaleDateString() : "No Data"
            });

            // Загружаем PRO статус
            const pro = await userService.isPro();
            setIsPro(pro);

            // Получаем расширенный текстовый статус
            const statusLabel = await userService.getStatusLabel();
            setUserStatus(statusLabel);

            // Загружаем сохраненный ключ
            const savedLicense = await storageService.getSetting("license_key");
            setLicenseKey(savedLicense || "");

            if (localStorage.getItem("pv_google_token")) {
                setIsGoogleConnected(true);
            }
        } catch (e) {
            console.error("Settings load error:", e);
        }
    };
    initData();
  }, []);

  const showToast = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  // ИСПРАВЛЕННЫЙ ОБРАБОТЧИК: Проверка лицензии через сервер
  const handleSaveLicense = async () => {
    if (!licenseKey.trim()) return;

    showToast("Connecting to server...");
    
    // 1. Сохраняем локально
    await storageService.saveSetting("license_key", licenseKey.trim());
    
    // 2. Проверяем валидность
    const isValid = await userService.verifyKeyOnServer(licenseKey.trim());
    
    if (isValid) {
        setIsPro(true);
        const newStatus = await userService.getStatusLabel();
        setUserStatus(newStatus);
        
        // 3. НОВОЕ: Если подключен Google — сразу пушим бэкап с ключом
        if (isGoogleConnected) {
             showToast("✅ Active! Syncing license to Cloud...");
             try {
                 const rawData = await storageService.getRawData(); // Теперь тут есть licenseKey
                 await googleService.uploadBackup(rawData);
             } catch(e) {
                 console.warn("Auto-backup of license failed", e);
             }
        } else {
             showToast("✅ License Activated! PRO features unlocked.");
        }

        if (onDataChanged) onDataChanged(); 
    } else {
        showToast("❌ Invalid or Used Key");
        setUserStatus("Trial (Activation Failed)");
    }
  };

  // --- GOOGLE HANDLERS ---
  const handleGoogleLogin = async () => {
    try {
        await googleService.login();
        setIsGoogleConnected(true);
        showToast("✅ Connected. Checking cloud backup...");
        
        setIsSyncing(true);
        
        // 1. PULL
        const cloudData = await googleService.downloadBackup();
        let mergedCount = 0;
        
        if (cloudData) {
            mergedCount = await storageService.mergeData(cloudData);
            
            // UI Update (Stats)
            const prompts = await storageService.getAllPrompts();
            setStats({
              count: prompts.length,
              lastUpdate: prompts.length > 0 ? new Date(prompts[0].updatedAt).toLocaleDateString() : "No Data"
            });
            
            // НОВОЕ: АВТО-АКТИВАЦИЯ
            // Если ключ прилетел из облака, проверяем его молча
            const importedKey = await storageService.getSetting("license_key");
            if (importedKey) {
                console.log("Found license in cloud, verifying...");
                // Проверяем на сервере (так как DeviceID восстановился, сервер скажет ОК)
                const isValid = await userService.verifyKeyOnServer(importedKey);
                if (isValid) {
                    setIsPro(true);
                    const newStatus = await userService.getStatusLabel();
                    setUserStatus(newStatus);
                    setLicenseKey(importedKey); // Заполняем поле ввода
                }
            }
            
            onDataChanged();
        } else {
            showToast("✅ Connected. Cloud is empty.");
        }

        // 2. PUSH (Если у нас был ключ, а в облаке нет)
        const currentLicense = await storageService.getSetting("license_key");
        if (currentLicense && !cloudData?.meta?.licenseKey) {
            console.log("Pushing local license to cloud...");
            const rawData = await storageService.getRawData();
            await googleService.uploadBackup(rawData);
            showToast(`✅ Synced! License saved to Cloud.`);
        } else if (mergedCount > 0) {
            showToast(`✅ Synced! Merged ${mergedCount} prompts.`);
        }

    } catch (e) {
        console.error(e);
        showToast("❌ Login / Sync Failed");
    } finally {
        setIsSyncing(false);
    }
  };

  const handleGoogleLogout = () => {
    googleService.logout();
    setIsGoogleConnected(false);
    showToast("Disconnected from Google");
  };

  const handleForceSync = async () => {
    if (!isGoogleConnected) return;
    setIsSyncing(true);
    try {
        // 1. PULL
        showToast("⬇️ Pulling from Cloud...");
        const cloudData = await googleService.downloadBackup();
        
        let mergedCount = 0;
        if (cloudData) {
            mergedCount = await storageService.mergeData(cloudData);
        }

        // ... (Safety Check код без изменений) ...
        const allPrompts = await storageService.getAllPrompts();
        const cloudHasPrompts = Array.isArray(cloudData) ? cloudData.length > 0 : (cloudData?.prompts?.length > 0);
        if (allPrompts.length === 0 && cloudHasPrompts) {
            alert("⚠️ SAFETY STOP: Cloud has data, but local database is empty after merge.\nUpload aborted.");
            return; 
        }

        // 2. PUSH
        showToast("⬆️ Pushing to Cloud...");
        const rawData = await storageService.getRawData(); 
        const addedRows = await googleService.syncEverything(rawData, allPrompts);
        
        storageService.clearDeletedLog(); 
        
        // 3. UI & AUTO-VERIFY
        setStats({
          count: allPrompts.length,
          lastUpdate: allPrompts.length > 0 ? new Date(allPrompts[0].updatedAt).toLocaleDateString() : "No Data"
        });
        
        // НОВОЕ: Проверяем статус после синка (вдруг ключ восстановился)
        const key = await storageService.getSetting("license_key");
        if (key) {
             const isValid = await userService.verifyKeyOnServer(key);
             if (isValid) setIsPro(true);
        }
        
        const newStatus = await userService.getStatusLabel();
        setUserStatus(newStatus);
        
        onDataChanged(); 

        let msg = "✅ Sync Complete.";
        if (mergedCount > 0) msg += ` Pulled ${mergedCount}.`;
        if (addedRows > 0) msg += ` Logged ${addedRows}.`;
        showToast(msg);

    } catch (e) {
        console.error(e);
        showToast("❌ Sync Error");
    } finally {
        setIsSyncing(false);
    }
  };

  // --- EXISTING HANDLERS ---

  const handleSaveKey = async () => {
    const keyToSave = apiKeys[selectedProvider] || "";
    await storageService.setApiKey(selectedProvider, keyToSave.trim());
    showToast(`🔐 Key for ${selectedProvider} Updated Successfully`);
  };

  const handleKeyInputChange = (e) => {
    const val = e.target.value;
    setApiKeys(prev => ({
      ...prev,
      [selectedProvider]: val
    }));
  };

  const handleExport = async () => {
    const data = await storageService.getRawData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `promptvault_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("📦 Export Complete");
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const success = await storageService.importData(event.target.result);
      if (success) {
        showToast("✅ Database Restored!");
        setTimeout(() => onDataChanged(), 1000);
      } else {
        showToast("❌ Invalid JSON File");
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const handleClear = async () => {
    if (confirm("⚠️ IRREVERSIBLE ACTION\n\nAre you sure you want to delete ALL your prompts?")) {
      await storageService.clearAll();
      onDataChanged();
      showToast("🗑️ System Wiped Clean");
    }
  };

  const currentKey = apiKeys[selectedProvider] || "";
  const isKeyActive = currentKey.length > 10;
  const currentProviderName = providers.find(p => p.id === selectedProvider)?.name || selectedProvider;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>System Settings</h1>
        <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
            <span className={styles.pageSubtitle}>Current Plan:</span>
            <span className={isPro ? styles.badgeSuccess : styles.badgeError} style={{padding:'4px 8px', borderRadius:'4px', fontSize: '0.8rem'}}>
                {userStatus}
            </span>
        </div>
      </div>

      {/* --- PRO UPGRADE CARD --- */}
      {!isPro && (
          <div className={styles.card} style={{borderColor: '#fbbf24', backgroundColor: 'rgba(251, 191, 36, 0.05)'}}>
            <div className={styles.cardHeader}>
                <div className={styles.cardTitleFlex}>
                    <span className={styles.cardIcon}>👑</span>
                    <div>
                        <div className={styles.cardTitle}>Upgrade to The Automator</div>
                        <div className={styles.cardDesc}>Unlock unlimited runs & Arena mode</div>
                    </div>
                </div>
            </div>
            <div className={styles.cardBody}>
                {/* ВАЖНОЕ ПРЕДУПРЕЖДЕНИЕ ПЕРЕД ПОКУПКОЙ */}
                <div style={{
                    marginBottom: '1rem',
                    padding: '0.8rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    lineHeight: '1.4'
                }}>
                    <strong>⚠️ Important:</strong> Before buying PRO, please utilize the <strong>10 Free Trial runs</strong> to ensure AI APIs work on your network.
                    <br/>If you find any bugs, email: <strong>milligat13@gmail.com</strong>
                </div>

                <div className={styles.inputGroup}>
                    <label className={styles.label}>Enter License Key</label>
                    <div className={styles.inputRow}>
                        <input 
                            type="text" 
                            className={styles.textInput} 
                            placeholder="PV-XXXX-XXXX-XXXX"
                            value={licenseKey}
                            onChange={(e) => setLicenseKey(e.target.value)}
                        />
                        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSaveLicense}>Activate</button>
                    </div>
                    
                    <div style={{marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                        <p style={{fontSize:'0.8rem', opacity:0.6}}>
                            <a href={BUY_LINK} target="_blank" style={{textDecoration:'underline', color:'var(--primary)', fontWeight:'bold'}}>
                                Buy License Key ($9)
                            </a>
                        </p>
                        
                        {/* НОВОЕ ПРЕДУПРЕЖДЕНИЕ */}
                        <div style={{
                            fontSize: '0.8rem', 
                            backgroundColor: 'rgba(59, 130, 246, 0.1)', // Синий оттенок
                            padding: '10px', 
                            borderRadius: '6px',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            color: 'var(--foreground)',
                            lineHeight: '1.4'
                        }}>
                           💡 <strong>Recommendation:</strong> Please sign in with <strong>Google</strong> (below) to sync your license key. Otherwise, you might lose your PRO status if you clear browser cache.
                        </div>
                    </div>
                </div>
            </div>
          </div>
      )}

      {/* --- AI ENGINE CARD --- */}
      <div className={styles.card} style={{ position: 'relative', overflow: 'hidden' }}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleFlex}>
            <span className={styles.cardIcon}>🤖</span>
            <div>
              <div className={styles.cardTitle}>AI Integration</div>
              <div className={styles.cardDesc}>Connect to LLM providers (BYOK)</div>
            </div>
          </div>
          <span className={isKeyActive ? `${styles.badge} ${styles.badgeSuccess}` : `${styles.badge} ${styles.badgeError}`}>
            {isKeyActive ? "Ready" : "No Key"}
          </span>
        </div>
        
        <div className={styles.cardBody}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Select Provider</label>
            <select 
                className={styles.textInput} 
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
            >
              {providers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>API Key for {currentProviderName}</label>
            <div className={styles.inputRow}>
              <input 
                type={showKey ? "text" : "password"} 
                className={styles.textInput}
                placeholder={`Enter ${selectedProvider} API Key...`}
                value={currentKey}
                onChange={handleKeyInputChange}
              />
              <button 
                className={styles.btnOutline} 
                onClick={() => setShowKey(!showKey)} 
                title="Toggle Visibility"
              >
                {showKey ? "👁️" : "🔒"}
              </button>
            </div>
            <p style={{fontSize: '0.8rem', opacity: 0.5, marginTop: '5px'}}>
              Your key is stored locally in your browser. We never see it.
            </p>
          </div>

          <div style={{display: 'flex', justifyContent: 'flex-end'}}>
             <button 
                className={`${styles.btn} ${styles.btnPrimary}`} 
                onClick={handleSaveKey}
             >
               Save {currentProviderName} Key
             </button>
          </div>
        </div>
      </div>

      {/* --- CLOUD SYNC CARD --- */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleFlex}>
            <span className={styles.cardIcon}>☁️</span>
            <div>
              <div className={styles.cardTitle}>Cloud Sync (Google Drive)</div>
              <div className={styles.cardDesc}>Backup DB & Sync history to Sheets</div>
            </div>
          </div>
          <span className={isGoogleConnected ? `${styles.badge} ${styles.badgeSuccess}` : `${styles.badge} ${styles.badgeError}`}>
            {isGoogleConnected ? "Connected" : "Offline"}
          </span>
        </div>
        <div className={styles.cardBody}>
            {!isGoogleConnected ? (
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleGoogleLogin} style={{width: '100%'}}>
                    Sign in with Google
                </button>
            ) : (
                <div style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
                    <p style={{fontSize:'0.9rem', opacity:0.7}}>
                        ✅ Connected.<br/>
                        Prompts save automatically. Use "Force Sync" if you worked offline.
                    </p>
                    <button 
                        className={`${styles.btn} ${styles.btnPrimary}`} 
                        onClick={handleForceSync}
                        disabled={isSyncing}
                    >
                        {isSyncing ? "⏳ Syncing..." : "🔄 Force Sync All Now"}
                    </button>
                    
                    <button className={`${styles.btn} ${styles.btnOutline}`} onClick={handleGoogleLogout}>
                        Disconnect Account
                    </button>
                </div>
            )}
        </div>
      </div>

      {/* --- BACKUP CARD --- */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleFlex}>
            <span className={styles.cardIcon}>💾</span>
            <div>
              <div className={styles.cardTitle}>Storage & Backup</div>
              <div className={styles.cardDesc}>Manage your prompt database</div>
            </div>
          </div>
          <span className={`${styles.badge} ${styles.badgeSuccess}`}>
             Local Storage
          </span>
        </div>

        <div className={styles.cardBody}>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <div className={styles.statValue}>{stats.count}</div>
              <div className={styles.statLabel}>Total Prompts</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>JSON</div>
              <div className={styles.statLabel}>Format</div>
            </div>
          </div>

          <div className={styles.inputRow} style={{marginTop: '1.5rem'}}>
            <button className={`${styles.btn} ${styles.btnOutline}`} style={{flex: 1}} onClick={handleExport}>
              ⬇️ Export Backup
            </button>
            <button className={`${styles.btn} ${styles.btnOutline}`} style={{flex: 1}} onClick={() => fileInputRef.current?.click()}>
              ⬆️ Restore from File
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".json" 
              className={styles.fileInput} 
            />
          </div>
        </div>
      </div>

      {/* --- DANGER ZONE --- */}
      <div className={`${styles.card} ${styles.dangerCard}`}>
        <div className={`${styles.cardHeader} ${styles.dangerHeader}`}>
          <div className={styles.cardTitleFlex}>
            <span className={styles.cardIcon}>☢️</span>
            <div>
              <div className={styles.cardTitle}>Danger Zone</div>
            </div>
          </div>
        </div>
        <div className={styles.cardBody}>
          <p style={{fontSize: '0.9rem', marginBottom: '1rem', opacity: 0.8}}>
            Deleting your database will permanently remove all {stats.count} prompts. This action cannot be undone.
          </p>
          <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleClear}>
            Delete All Data
          </button>
        </div>
      </div>

      <div className={`${styles.toast} ${message ? styles.toastVisible : ''}`}>
        {message}
      </div>
    </div>
  );
}