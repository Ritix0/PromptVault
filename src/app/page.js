/* src/app/page.js */
"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";
import { storageService } from "@/services/storage";
import { googleService } from "@/services/google"; 
import { userService } from "@/services/user"; 
import PromptEditor from "@/components/PromptEditor/PromptEditor";
import Settings from "@/components/Settings/Settings";

export default function Home() {
  const [view, setView] = useState("list"); 
  const [folder, setFolder] = useState("all"); 
  const [prompts, setPrompts] = useState([]);
  const [currentPrompt, setCurrentPrompt] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState([]); 
  const [isLoading, setIsLoading] = useState(true); 
  
  // Состояние для визуализации процесса синхронизации
  const [isSyncing, setIsSyncing] = useState(false);

  // НОВОЕ: Состояние для мобильного меню
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Загрузка данных
  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    setIsLoading(true);
    try {
        const data = await storageService.getAllPrompts();
        const sorted = data.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        setPrompts(sorted);
    } catch (error) {
        console.error("Failed to load prompts", error);
    } finally {
        setIsLoading(false);
    }
  };

  // --- ХЕЛПЕРЫ ---
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  // --- ЛОГИКА ФИЛЬТРАЦИИ ---
  const allTags = [...new Set(prompts
    .filter(p => !p.isDeleted)
    .flatMap(p => p.tags || []))
  ].sort();

  const filteredPrompts = prompts.filter(p => {
    if (folder === "trash") {
        if (!p.isDeleted) return false;
    } else {
        if (p.isDeleted) return false; 
        if (folder === "favorites" && !p.isFavorite) return false;
    }

    const matchesSearch = 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.content.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedTags.length > 0) {
        const hasTags = selectedTags.every(tag => (p.tags || []).includes(tag));
        if (!hasTags) return false;
    }

    return true;
  });

  // --- ACTIONS ---

  const handleSavePrompt = async (promptData) => {
    const savedPrompt = await storageService.savePrompt(promptData);
    await loadPrompts();
    setView("list");

    // Фоновая синхронизация при сохранении (упрощенная)
    if (localStorage.getItem("pv_google_token")) {
        console.log("🔄 Background Syncing...");
        googleService.appendToSheet(savedPrompt).catch(err => console.warn("Sheet sync failed:", err));
        
        // Отправляем полный JSON с метаданными
        storageService.getRawData().then(json => {
            googleService.uploadBackup(json).catch(err => console.warn("Backup sync failed:", err));
        });
    }
  };

  const handleDeletePrompt = async (id) => {
    await storageService.deletePrompt(id); 
    await loadPrompts();
    setView("list");
  };

  const handleRestore = async (e, id) => {
    e.stopPropagation();
    await storageService.restorePrompt(id);
    await loadPrompts();
  };

  const handlePermanentDelete = async (e, id) => {
    e.stopPropagation();
    if(confirm("Delete forever? This cannot be undone.")) {
        await storageService.permanentDelete(id);
        await loadPrompts();
    }
  };

  const handleToggleFavorite = async (e, id) => {
    e.stopPropagation();
    await storageService.toggleFavorite(id);
    await loadPrompts(); 
  };

  const toggleTagFilter = (tag) => {
    setSelectedTags(prev => 
        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
    // Примечание: Мы НЕ закрываем меню при выборе тега, чтобы можно было выбрать несколько
  };

  const handleDataChanged = () => {
    loadPrompts();
  };

  // --- ЛОГИКА БЫСТРОЙ СИНХРОНИЗАЦИИ ---
  const handleQuickSync = async () => {
      // 0. Проверка авторизации
      if (!localStorage.getItem("pv_google_token")) {
          alert("⚠️ Not connected to Google.\nPlease go to Settings and sign in first.");
          setView("settings");
          closeMobileMenu(); // Закрываем меню, если переходим в настройки
          return;
      }

      setIsSyncing(true); // Включаем индикатор загрузки
      
      try {
          // --- ЭТАП А: PULL (Скачивание) ---
          console.log("⬇️ Pulling from Cloud...");
          const cloudData = await googleService.downloadBackup();
          
          let mergedCount = 0;
          if (cloudData) {
              // Объединяем данные (включая восстановление лицензии и Device ID)
              mergedCount = await storageService.mergeData(cloudData);
          }

          // --- ЭТАП Б: RELOAD & SAFETY CHECK ---
          const allPrompts = await storageService.getAllPrompts();
          const cloudHasPrompts = Array.isArray(cloudData) ? cloudData.length > 0 : (cloudData?.prompts?.length > 0);
          
          if (allPrompts.length === 0 && cloudHasPrompts) {
              alert("⚠️ SAFETY STOP: Cloud has data, but local database is empty after merge.\nUpload aborted to prevent data loss.");
              setIsSyncing(false); 
              return; 
          }

          // --- ЭТАП В: PUSH (Отправка) ---
          console.log("⬆️ Pushing to Cloud...");
          const rawData = await storageService.getRawData();
          await googleService.syncEverything(rawData, allPrompts);
          storageService.clearDeletedLog();

          // --- ЭТАП Г: AUTO-VERIFY & FINALIZE ---
          const key = await storageService.getSetting("license_key");
          if (key) {
               userService.verifyKeyOnServer(key).then(isValid => {
                   if(isValid) console.log("License verified after sync");
               });
          }

          await loadPrompts(); // Обновляем UI
          alert(`✅ Sync Complete!\nPulled: ${mergedCount} new items.\nCloud and Local are in sync.`);

      } catch (e) {
          console.error("Quick sync failed:", e);
          alert(`❌ Sync Error: ${e.message || "Unknown error"}.\nCheck console for details.`);
      } finally {
          setIsSyncing(false);
          closeMobileMenu(); // Закрываем меню после завершения
      }
  };

  return (
    <div className={styles.container}>
      {/* Затемнение фона (Backdrop) для мобильного меню */}
      <div 
        className={`${styles.mobileBackdrop} ${isMobileMenuOpen ? styles.backdropVisible : ''}`}
        onClick={closeMobileMenu}
      />

      <header className={styles.header}>
        {/* Группировка для мобильного меню и лого */}
        <div className={styles.headerLeft}>
            <button 
                className={styles.mobileMenuBtn}
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Open Menu"
            >
                ☰
            </button>
            <div className={styles.logo} onClick={() => { setView("list"); setFolder("all"); }} style={{cursor: 'pointer'}}>
                PromptVault
            </div>
        </div>

        <nav className={styles.nav}>
          <button 
            className={styles.navLink} 
            onClick={() => { setView("list"); closeMobileMenu(); }}
            style={{ fontWeight: view === 'list' ? 'bold' : 'normal' }}
          >
            Dashboard
          </button>
          <button 
            className={styles.navLink} 
            onClick={() => { setView("settings"); closeMobileMenu(); }}
            style={{ fontWeight: view === 'settings' ? 'bold' : 'normal' }}
          >
            Settings
          </button>
        </nav>
      </header>

      <main className={styles.main}>
        {/* Добавляем класс sidebarOpen при открытии меню */}
        <aside className={`${styles.sidebar} ${isMobileMenuOpen ? styles.sidebarOpen : ''}`}>
          
          {/* Заголовок сайдбара с кнопкой закрытия для мобильных */}
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
              <div className={styles.sidebarTitle} style={{marginBottom: 0}}>Explorer</div>
              {/* Кнопка закрытия видна только на мобильных благодаря CSS (можно доработать, но пока используем общий класс) */}
              <button 
                className={styles.mobileMenuBtn} 
                onClick={closeMobileMenu}
                style={{border: 'none', padding: 0, fontSize: '1.5rem'}}
              >
                ✕
              </button>
          </div>

          <ul className={styles.menuList}>
            <li 
              className={styles.menuItem} 
              onClick={() => { setFolder("all"); setView("list"); closeMobileMenu(); }}
              style={{ fontWeight: folder === 'all' && view === 'list' ? 'bold' : 'normal', background: folder === 'all' && view === 'list' ? 'var(--border)' : 'transparent' }}
            >
              📂 All Prompts
            </li>
            <li 
              className={styles.menuItem} 
              onClick={() => { setFolder("favorites"); setView("list"); closeMobileMenu(); }}
              style={{ fontWeight: folder === 'favorites' ? 'bold' : 'normal', background: folder === 'favorites' ? 'var(--border)' : 'transparent' }}
            >
              ⭐ Favorites
            </li>
            <li 
              className={styles.menuItem} 
              onClick={() => { setFolder("trash"); setView("list"); closeMobileMenu(); }}
              style={{ fontWeight: folder === 'trash' ? 'bold' : 'normal', background: folder === 'trash' ? 'var(--border)' : 'transparent', color: folder === 'trash' ? '#ef4444' : 'inherit' }}
            >
              🗑️ Trash
            </li>
          </ul>

          <div className={styles.sidebarTitle} style={{marginTop: '2rem'}}>Tags</div>
          <div className={styles.tagCloud}>
            {allTags.length === 0 && <span style={{opacity:0.5, fontSize:'0.8rem'}}>
                {isLoading ? "Loading tags..." : "No tags yet"}
            </span>}
            {!isLoading && allTags.map(tag => (
                <span 
                    key={tag} 
                    className={`${styles.tag} ${selectedTags.includes(tag) ? styles.tagActive : ''}`}
                    onClick={() => toggleTagFilter(tag)}
                >
                    #{tag}
                </span>
            ))}
          </div>
          
          <div className={styles.sidebarTitle} style={{marginTop: '2rem'}}>Quick Actions</div>
          <ul className={styles.menuList}>
            <li className={styles.menuItem} onClick={() => { setCurrentPrompt(null); setView("create"); closeMobileMenu(); }}>
              ➕ New Prompt
            </li>
            {/* КНОПКА СИНХРОНИЗАЦИИ */}
            <li 
                className={styles.menuItem} 
                onClick={!isSyncing ? handleQuickSync : null}
                style={{ 
                    cursor: isSyncing ? 'wait' : 'pointer',
                    opacity: isSyncing ? 0.7 : 1,
                    color: 'var(--primary)',
                    fontWeight: 500
                }}
            >
              {isSyncing ? "⏳ Syncing..." : "☁️ Force Cloud Sync"}
            </li>
          </ul>
        </aside>

        <section className={styles.workspace}>
          {/* VIEW: LIST (DASHBOARD) */}
          {view === "list" && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>
                    {folder === 'all' && "All Prompts"}
                    {folder === 'favorites' && "⭐ Favorites"}
                    {folder === 'trash' && "🗑️ Trash Can"}
                  </h2>
                  {folder !== 'trash' && (
                      <button 
                          className={styles.createBtn}
                          onClick={() => { setCurrentPrompt(null); setView("create"); }}
                      >
                          + Create
                      </button>
                  )}
              </div>

              {/* SEARCH */}
              <div style={{ marginBottom: '1.5rem' }}>
                  <input 
                    type="text"
                    placeholder="🔍 Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{width: '100%', padding: '0.8rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)', outline: 'none'}}
                  />
              </div>
              
              {/* LIST */}
              {isLoading ? (
                  <div style={{padding: '2rem', textAlign: 'center', opacity: 0.6}}>
                      Loading database...
                  </div>
              ) : filteredPrompts.length === 0 ? (
                <p className={styles.placeholderText}>
                  {folder === 'trash' ? "Trash is empty." : "No prompts found."}
                </p>
              ) : (
                <ul style={{ listStyle: 'none' }}>
                  {filteredPrompts.map((p) => (
                    <li 
                      key={p.id} 
                      className={styles.promptItem}
                      onClick={() => { 
                          if(folder !== 'trash') {
                              setCurrentPrompt(p); setView("edit"); 
                          }
                      }}
                      style={{ cursor: folder === 'trash' ? 'default' : 'pointer' }}
                    >
                      <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}>
                          <div style={{flex:1}}>
                              <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
                                  {folder !== 'trash' && (
                                      <button 
                                        className={`${styles.starBtn} ${p.isFavorite ? styles.starActive : ''}`}
                                        onClick={(e) => handleToggleFavorite(e, p.id)}
                                      >
                                        {p.isFavorite ? "★" : "☆"}
                                      </button>
                                  )}
                                  <strong>{p.title}</strong>
                              </div>
                              
                              <div className={styles.promptMeta}>
                                  <span style={{marginRight:'10px'}}>{new Date(p.updatedAt).toLocaleDateString()}</span>
                                  {/* Tags in list */}
                                  {(p.tags || []).map(t => (
                                      <span key={t} className={styles.tag} style={{fontSize:'0.7rem', padding:'1px 5px'}}>#{t}</span>
                                  ))}
                              </div>
                          </div>

                          {/* TRASH ACTIONS */}
                          {folder === 'trash' && (
                              <div className={styles.trashActions}>
                                  <button className={styles.btnRestore} onClick={(e) => handleRestore(e, p.id)}>Restore</button>
                                  <button className={styles.btnDanger} onClick={(e) => handlePermanentDelete(e, p.id)}>Delete</button>
                              </div>
                          )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* VIEW: CREATE / EDIT */}
          {(view === "create" || view === "edit") && (
            <div className={styles.card}>
              <PromptEditor 
                initialData={currentPrompt}
                onSave={handleSavePrompt}
                onDelete={handleDeletePrompt}
                onCancel={() => setView("list")}
                onUpdate={loadPrompts}
              />
            </div>
          )}

          {/* VIEW: SETTINGS */}
          {view === "settings" && (
            <div className={styles.card}>
                <Settings onDataChanged={handleDataChanged} />
            </div>
          )}
        </section>
      </main>

      <footer className={styles.footer}>
        <div style={{marginBottom: '0.5rem'}}>
            PromptVault © 2026. Local-First Architecture. Data stored on your device.
        </div>
        <div style={{fontSize: '0.8rem', opacity: 0.8}}>
            <a href="/privacy" style={{marginRight: '10px', textDecoration: 'underline'}}>Privacy Policy</a>
            |
            <a href="/terms" style={{marginLeft: '10px', marginRight: '10px', textDecoration: 'underline'}}>Terms of Service</a>
            |
            <span style={{marginLeft: '10px'}}>Support: milligat13@gmail.com</span>
        </div>
      </footer>
    </div>
  );
}