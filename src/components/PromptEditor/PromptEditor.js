/* src/components/PromptEditor/PromptEditor.js */
"use client";

import { useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { diffWords } from "diff"; 
import styles from "./PromptEditor.module.css";
import { storageService } from "@/services/storage";
import { llmService } from "@/services/llm";
import { userService } from "@/services/user"; 
import { useUI } from "@/context/UIContext"; // Импорт UI Context

export default function PromptEditor({ initialData, onSave, onCancel, onDelete, onUpdate }) {
  const { showToast, showConfirm, showAlert } = useUI(); // Хуки UI
  const [activeTab, setActiveTab] = useState("edit");
  
  // 1. Изменение: Стейт для прав и триалов
  const [isPro, setIsPro] = useState(false); 
  const [trialInfo, setTrialInfo] = useState({ allowed: true, trialsLeft: 10 });
  
  // Basic Data
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [version, setVersion] = useState(1);
  const [history, setHistory] = useState([]);
  
  // Organization Data (Tags & Favorite)
  const [tags, setTags] = useState(""); 
  const [isFavorite, setIsFavorite] = useState(false);

  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);

  // Compare Tab State
  const [compareLeftId, setCompareLeftId] = useState("current");
  const [compareRightId, setCompareRightId] = useState("");

  // --- EXECUTION MODES ---
  // Initial mode depends on loading, will be updated in useEffect
  const [executionMode, setExecutionMode] = useState("manual");

  // Run/Arena State 
  const [runMode, setRunMode] = useState("single");
  const [providers, setProviders] = useState([]);
  
  // Test Data State 
  const [testInput, setTestInput] = useState(""); 
  
  // AI Response State 
  const [aiResponse, setAiResponse] = useState("");
  const [manualResult, setManualResult] = useState(""); 

  // API Models State
  const [providerA, setProviderA] = useState("");
  const [modelA, setModelA] = useState("");
  const [loadingA, setLoadingA] = useState(false);
  const [errorA, setErrorA] = useState(null);

  const [providerB, setProviderB] = useState("");
  const [modelB, setModelB] = useState("");
  const [responseB, setResponseB] = useState(""); 
  const [loadingB, setLoadingB] = useState(false);
  const [errorB, setErrorB] = useState(null);

  // Key State
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setContent(initialData.content || "");
      setVersion(initialData.version || 1);
      
      // ВОССТАНОВЛЕНИЕ КОНТЕКСТА
      setTestInput(initialData.testInput || "");
      setAiResponse(initialData.lastResult || ""); 
      setManualResult(initialData.lastResult || "");
      
      // ОРГАНИЗАЦИЯ
      setTags((initialData.tags || []).join(", "));
      setIsFavorite(initialData.isFavorite || false);

      const hist = initialData.history || [];
      const sortedHist = [...hist].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setHistory(sortedHist);

      if (sortedHist.length > 0) {
        setCompareLeftId(sortedHist[0].version.toString());
        setCompareRightId("current");
      }
    } else {
      setTitle(""); setContent(""); setVersion(1); setHistory([]);
      setTestInput(""); setAiResponse(""); setManualResult("");
      setTags(""); setIsFavorite(false);
    }
    
    // Reset UI States
    setIsDeleteConfirming(false);
    setErrorA(null); setErrorB(null);
    setResponseB("");

    // Providers Check
    const availProviders = llmService.getProviders();
    setProviders(availProviders);

    if (availProviders.length > 0) {
      setProviderA(availProviders[0].id);
      setModelA(availProviders[0].defaultModel);
      setProviderB(availProviders[0].id);
      setModelB(availProviders[0].defaultModel);
    }

    // 2. Изменение: Загрузка статуса пользователя и ключей
    const checkUserStatus = async () => {
        // 1. Check PRO status
        const proStatus = await userService.isPro();
        setIsPro(proStatus);
        
        // 2. Check Trial limit
        const access = await userService.canRunAI();
        setTrialInfo(access);

        // 3. Check API Keys & Auto Switch
        try {
            const keys = await storageService.getAllApiKeys();
            const hasAnyKey = Object.values(keys).some(k => k && k.length > 5);
            setHasApiKey(hasAnyKey);

            // Если есть ключ и это PRO или еще есть попытки -> включаем Auto по умолчанию
            if (hasAnyKey && (proStatus || access.allowed)) {
                setExecutionMode("auto");
            } else {
                setExecutionMode("manual");
            }
        } catch (e) {
            console.error("Failed to check keys", e);
        }
    };
    checkUserStatus();

  }, [initialData]); 

  // --- COMPARE LOGIC ---
  const allVersions = useMemo(() => {
    const list = [];
    list.push({
        id: "current",
        label: `Current Draft (v${version})`,
        content: content,
        testInput: testInput
    });
    history.forEach(h => {
        list.push({
            id: h.version.toString(),
            label: `v${h.version} - ${new Date(h.timestamp).toLocaleString()}`,
            content: h.content,
            testInput: h.testInput || ""
        });
    });
    return list;
  }, [content, testInput, version, history]);

  const renderDiff = (text1, text2) => {
    if (!text1) text1 = "";
    if (!text2) text2 = "";
    const diff = diffWords(text1, text2);
    return diff.map((part, index) => {
        const spanClass = part.added ? styles.diffAdded : part.removed ? styles.diffRemoved : '';
        return <span key={index} className={spanClass}>{part.value}</span>;
    });
  };

  // --- Actions ---
  const handleSave = () => {
    if (!title.trim() && !content.trim()) return;
    
    const resultToSave = manualResult || aiResponse;
    const tagsArray = tags.split(",").map(t => t.trim()).filter(t => t.length > 0);

    onSave({
      id: initialData?.id || crypto.randomUUID(),
      title: title.trim() || "Untitled Prompt",
      content: content,
      testInput: testInput,   
      lastResult: resultToSave,
      tags: tagsArray,        
      isFavorite: isFavorite  
    });
  };

  const handleDeleteClick = () => {
    if (isDeleteConfirming) { if (onDelete && initialData?.id) onDelete(initialData.id); } 
    else { setIsDeleteConfirming(true); setTimeout(() => setIsDeleteConfirming(false), 3000); }
  };

  const handleRestore = async (h) => {
    // ЗАМЕНА confirm НА showConfirm
    const isConfirmed = await showConfirm(
        `Restore v${h.version}?`,
        "Current unsaved changes will be lost.",
        { confirmText: "Restore", variant: "default" }
    );
    
    if(isConfirmed) { 
        setTitle(h.title); 
        setContent(h.content); 
        if (h.testInput) setTestInput(h.testInput);
        setActiveTab("edit");
        showToast("Version restored", "info");
    }
  };

  // --- CLIPBOARD HELPERS ---
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard", "success");
  };

  const openExternal = (url) => {
    window.open(url, "_blank");
  };

  // --- AUTOMATED RUN ---
  const executeRun = async (provId, modId, setResp, setLoad, setErr) => {
    const apiKey = await storageService.getApiKey(provId);
    
    if (!apiKey) {
        setErr(`No API Key for ${provId}. Switch to Manual Mode or add key in Settings.`);
        return;
    }
    setLoad(true); setErr(null); setResp("");
    try {
      const res = await llmService.run(provId, apiKey, modId, content, testInput);
      setResp(res);
      if (setResp === setAiResponse) {
          setManualResult(res); 
      }

      // 3. Изменение: Увеличение счетчика при успехе
      await storageService.incrementUsageCount();
      // Обновляем инфо о триале в UI
      const newInfo = await userService.canRunAI();
      setTrialInfo(newInfo);

    } catch (e) { setErr(e.message || "Error"); } 
    finally { setLoad(false); }
  };

  const handleRunClick = async () => {
    if (!content.trim()) { 
        // ЗАМЕНА alert
        showToast("System prompt is empty!", "error"); 
        return; 
    }
    
    // 4. Изменение: Проверка прав (Check Access)
    const access = await userService.canRunAI();
    if (!access.allowed) {
        // ЗАМЕНА alert
        showAlert("Limit Reached", access.reason);
        return;
    }
    
    executeRun(providerA, modelA, setAiResponse, setLoadingA, setErrorA);
    if (runMode === "arena") {
      executeRun(providerB, modelB, setResponseB, setLoadingB, setErrorB);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div style={{display:'flex', alignItems:'center', gap:'0.5rem', flex: 1}}>
                <button 
                    onClick={async (e) => {
                        e.stopPropagation();
                        const newStatus = !isFavorite;
                        setIsFavorite(newStatus); 
                        if (initialData?.id) {
                            await storageService.toggleFavorite(initialData.id);
                            if (onUpdate) onUpdate(); 
                        }
                    }}
                    style={{
                        fontSize: '1.5rem', 
                        cursor: 'pointer', 
                        color: isFavorite ? '#fbbf24' : 'var(--border)',
                        background: 'transparent',
                        border: 'none',
                        padding: '0 0.5rem',
                        lineHeight: 1
                    }}
                    title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                >
                    {isFavorite ? "★" : "☆"}
                </button>
                <input className={styles.titleInput} placeholder="Prompt Title..." value={title} onChange={(e) => setTitle(e.target.value)}/>
            </div>
            <span style={{opacity:0.4, fontSize:'0.8rem', marginLeft:'1rem'}}>v{version}</span>
        </div>
        <div className={styles.tabs}>
            <div className={`${styles.tab} ${activeTab==='edit'?styles.activeTab:''}`} onClick={()=>setActiveTab('edit')}>✏️ Edit</div>
            <div className={`${styles.tab} ${activeTab==='run'?styles.activeTab:''}`} onClick={()=>setActiveTab('run')}>▶️ Run</div>
            <div className={`${styles.tab} ${activeTab==='compare'?styles.activeTab:''}`} onClick={()=>setActiveTab('compare')}>⚖️ Compare</div>
            <div className={`${styles.tab} ${activeTab==='history'?styles.activeTab:''}`} onClick={()=>setActiveTab('history')}>🕒 History ({history.length})</div>
        </div>
      </div>

      {/* --- EDIT TAB --- */}
      {activeTab === 'edit' && (
        <>
          <div className={styles.roleLabelRow}>
            <span className={`${styles.roleBadge} ${styles.roleSystem}`}>SYSTEM</span>
            <span className={styles.roleDesc}>Instructions & Logic</span>
          </div>
          <textarea className={styles.contentArea} value={content} onChange={(e) => setContent(e.target.value)} />
          
          <div style={{marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
             <span style={{fontSize:'0.9rem', fontWeight:600, opacity:0.6}}>Tags:</span>
             <input 
                type="text" 
                placeholder="e.g. seo, coding, email (comma separated)" 
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                style={{
                    flex: 1, 
                    padding: '0.5rem', 
                    borderRadius: '4px', 
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--card-bg)',
                    color: 'var(--foreground)'
                }}
             />
          </div>

          <div className={styles.footer}>
            <div className={styles.actionsLeft}>
              {initialData?.id && <button className={isDeleteConfirming?styles.btnDeleteConfirm:styles.btnDelete} onClick={handleDeleteClick}>{isDeleteConfirming ? "Confirm?" : "Delete"}</button>}
            </div>
            <div className={styles.actionsRight}>
              <button className={styles.btnSecondary} onClick={onCancel}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleSave}>Save</button>
            </div>
          </div>
        </>
      )}

      {/* --- RUN TAB --- */}
      {activeTab === 'run' && (
        <div className={styles.runContainer}>
            
            {/* 1. ПЕРЕКЛЮЧАТЕЛЬ (Теперь доступен всем, но Auto требует ключ) */}
            <div className={styles.executionSwitchContainer}>
                <div className={styles.executionSwitch}>
                    <div 
                        className={`${styles.execBtn} ${executionMode === 'manual' ? styles.execBtnActive : ''}`}
                        onClick={() => setExecutionMode('manual')}
                    >
                        🖐 Manual
                    </div>
                    {/* 5. Изменение: Разблокировка кнопки Auto */}
                    <div 
                        className={`${styles.execBtn} ${executionMode === 'auto' ? styles.execBtnActive : ''}`}
                        onClick={() => {
                            if(hasApiKey) setExecutionMode('auto');
                            // ЗАМЕНА alert
                            else showToast("Please add an API key in Settings first.", "error");
                        }}
                    >
                        🤖 Auto (API)
                    </div>
                </div>
            </div>

            <div style={{flex: 1, overflowY: 'auto'}}>
                {/* 2. ВЫБОР ИНТЕРФЕЙСА */}
                
                {/* ВАРИАНТ А: MANUAL MODE (Librarian) */}
                {executionMode === 'manual' && (
                    <div className={styles.manualContainer}>
                        <div style={{textAlign:'center', marginBottom:'1rem'}}>
                            <h3 style={{color: 'var(--primary)'}}>The Librarian Mode</h3>
                            <p style={{fontSize:'0.9rem', opacity: 0.7}}>Copy-paste workflow (No API costs)</p>
                        </div>

                        <div className={styles.manualStep}>
                            <div className={styles.stepLabel}>Step 1: Copy Data</div>
                            <div className={styles.copyRow}>
                                <button className={styles.btnCopy} onClick={() => copyToClipboard(content)}>
                                    📋 Copy System Prompt
                                </button>
                                {testInput && (
                                    <button className={styles.btnCopy} onClick={() => copyToClipboard(testInput)}>
                                        📋 Copy User Input
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className={styles.manualStep}>
                            <div className={styles.stepLabel}>Step 2: Paste into AI</div>
                            <div className={styles.externalLinks}>
                                <span className={styles.linkBtn} onClick={() => openExternal("https://chat.openai.com")}>ChatGPT ↗</span>
                                <span className={styles.linkBtn} onClick={() => openExternal("https://claude.ai")}>Claude ↗</span>
                                <span className={styles.linkBtn} onClick={() => openExternal("https://gemini.google.com")}>Gemini ↗</span>
                            </div>
                        </div>

                        <div className={styles.manualStep}>
                            <div className={styles.stepLabel}>Step 3: Save Result</div>
                            <textarea 
                                className={styles.manualResultArea} 
                                placeholder="Paste the AI response here to save it locally..."
                                value={manualResult}
                                onChange={(e) => setManualResult(e.target.value)}
                            />
                        </div>
                        
                        <div className={styles.roleLabelRow} style={{marginTop: '1rem'}}>
                            <span className={`${styles.roleBadge} ${styles.roleUser}`}>USER INPUT</span>
                             <span className={styles.roleDesc}>Test Data (Variables / Context)</span>
                        </div>
                        <textarea 
                            className={styles.testInputArea} 
                            placeholder="Type your test data here to copy it later..."
                            value={testInput} 
                            onChange={(e) => setTestInput(e.target.value)} 
                        />
                    </div>
                )}

                {/* ВАРИАНТ Б: AUTO MODE (API) */}
                {executionMode === 'auto' && (
                    <>
                        <div className={styles.runControls}>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                <div className={styles.modeToggle}>
                                    <div className={`${styles.modeBtn} ${runMode==='single'?styles.modeBtnActive:''}`} onClick={()=>setRunMode('single')}>Single</div>
                                    <div className={`${styles.modeBtn} ${runMode==='arena'?styles.modeBtnActive:''}`} onClick={()=>setRunMode('arena')}>⚔️ Arena</div>
                                </div>
                                
                                {/* 6. Изменение: Кнопка запуска со счетчиком и проверкой */}
                                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                    {!isPro && trialInfo.allowed && (
                                        <span style={{fontSize:'0.8rem', color:'var(--primary)'}}>
                                            Trial: {trialInfo.trialsLeft} left
                                        </span>
                                    )}
                                    {!isPro && !trialInfo.allowed && (
                                        <span style={{fontSize:'0.8rem', color:'#ef4444', fontWeight:'bold'}}>
                                            Limit Reached
                                        </span>
                                    )}
                                    <button 
                                        className={styles.btnPrimary} 
                                        onClick={handleRunClick} 
                                        disabled={loadingA || loadingB || (!isPro && !trialInfo.allowed)}
                                        style={{opacity: (!isPro && !trialInfo.allowed) ? 0.5 : 1}}
                                    >
                                        {(loadingA || loadingB) ? "Running..." : (runMode === 'arena' ? "⚔️ FIGHT!" : "🚀 Run")}
                                    </button>
                                </div>
                            </div>
                            <div className={styles.roleLabelRow} style={{marginTop: '0.5rem'}}>
                                <span className={`${styles.roleBadge} ${styles.roleUser}`}>USER INPUT</span>
                                <span className={styles.roleDesc}>Test Data (Variables / Context)</span>
                            </div>
                            <textarea className={styles.testInputArea} placeholder="Test content..." value={testInput} onChange={(e) => setTestInput(e.target.value)} />
                        </div>

                        {/* RESULTS AREA */}
                        {runMode === 'single' ? (
                            <div className={styles.runControls} style={{marginTop: '1rem', display: 'flex', flexDirection: 'column'}}>
                                <div className={styles.runTopBar}>
                                    <select className={styles.btnSecondary} value={providerA} onChange={e=>{setProviderA(e.target.value); setModelA(llmService.getModels(e.target.value)[0])}}>
                                        {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    <select className={styles.btnSecondary} value={modelA} onChange={e=>setModelA(e.target.value)}>
                                        {llmService.getModels(providerA).map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div className={styles.runResult}>
                                    {errorA && <div className={styles.error}>{errorA}</div>}
                                    {!errorA && !aiResponse && !loadingA && <span style={{opacity:0.5}}>Ready to run...</span>}
                                    {aiResponse && <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiResponse}</ReactMarkdown>}
                                </div>
                            </div>
                        ) : (
                            <div className={styles.arenaGrid} style={{marginTop: '1rem'}}>
                                <div className={styles.arenaCol}>
                                    <div className={styles.colLabel}>Contender 1</div>
                                    <div className={styles.arenaColHeader}>
                                        <select className={styles.btnSecondary} style={{width:'100%'}} value={providerA} onChange={e=>{setProviderA(e.target.value); setModelA(llmService.getModels(e.target.value)[0])}}>
                                            {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div className={styles.arenaResult}>
                                        {loadingA && <div>Loading...</div>}
                                        {errorA && <div className={styles.error}>{errorA}</div>}
                                        {aiResponse && <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiResponse}</ReactMarkdown>}
                                    </div>
                                </div>
                                <div className={styles.arenaCol}>
                                    <div className={styles.colLabel}>Contender 2</div>
                                    <div className={styles.arenaColHeader}>
                                        <select className={styles.btnSecondary} style={{width:'100%'}} value={providerB} onChange={e=>{setProviderB(e.target.value); setModelB(llmService.getModels(e.target.value)[0])}}>
                                            {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div className={styles.arenaResult}>
                                        {loadingB && <div>Loading...</div>}
                                        {errorB && <div className={styles.error}>{errorB}</div>}
                                        {responseB && <ReactMarkdown remarkPlugins={[remarkGfm]}>{responseB}</ReactMarkdown>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* --- КНОПКИ СОХРАНЕНИЯ В RUN --- */}
            <div className={styles.footer} style={{marginTop: '1rem', borderTop: '1px solid var(--border)'}}>
                <div className={styles.actionsLeft}></div>
                <div className={styles.actionsRight}>
                    <button className={styles.btnSecondary} onClick={onCancel}>Cancel</button>
                    <button className={styles.btnPrimary} onClick={handleSave}>Save Result</button>
                </div>
            </div>
        </div>
      )}

      {/* --- COMPARE TAB --- */}
      {activeTab === 'compare' && (
        <div className={styles.compareContainer}>
            <div className={styles.compareControls}>
                <div className={styles.compareSelector}>
                    <label className={styles.diffLabel}>Base Version (Left)</label>
                    <select className={styles.compareSelect} value={compareLeftId} onChange={e=>setCompareLeftId(e.target.value)}>
                        {allVersions.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                    </select>
                </div>
                <div className={styles.compareSelector}>
                    <label className={styles.diffLabel}>Comparison (Right)</label>
                    <select className={styles.compareSelect} value={compareRightId} onChange={e=>setCompareRightId(e.target.value)}>
                        {allVersions.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                    </select>
                </div>
            </div>

            <div className={styles.diffGrid}>
                {(() => {
                    const left = allVersions.find(v => v.id === compareLeftId) || allVersions[0] || {};
                    const right = allVersions.find(v => v.id === compareRightId) || allVersions[0] || {};
                    
                    return (
                        <div className={styles.diffCol}>
                            <div className={styles.diffLabel}>System Prompt Diff</div>
                            <div className={styles.diffBox}>{renderDiff(left.content, right.content)}</div>
                            
                            <div className={styles.diffLabel} style={{marginTop:'1rem'}}>User Input Diff</div>
                            <div className={styles.diffBox}>{renderDiff(left.testInput, right.testInput)}</div>
                        </div>
                    );
                })()}
            </div>
        </div>
      )}

      {/* --- HISTORY TAB --- */}
      {activeTab === 'history' && (
        <div className={styles.historyContainer}>
            {history.map((h, idx) => (
                <div key={idx} className={styles.historyItem}>
                    <div className={styles.historyHeader}>
                        <span className={styles.historyVersion}>v{h.version}</span>
                        <span className={styles.historyDate}>{new Date(h.timestamp).toLocaleString()}</span>
                    </div>
                    {h.testInput && (
                        <div style={{fontSize:'0.75rem', opacity:0.6, marginTop:'5px', fontStyle:'italic'}}>
                            Test Input used: {h.testInput.substring(0, 60)}{h.testInput.length>60?"...":""}
                        </div>
                    )}
                    <div className={styles.historyPreview}>{h.content}</div>
                    <button className={styles.btnRestore} onClick={() => handleRestore(h)}>↺ Restore</button>
                </div>
            ))}
        </div>
      )}
    </div>
  );
}