/* src/components/CookieBanner/CookieBanner.js */
"use client";

import { useState, useEffect } from "react";

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("pv_cookie_consent");
    if (!consent) {
      setShow(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("pv_cookie_consent", "true");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#1e293b',
      color: '#e2e8f0',
      padding: '1rem',
      borderTop: '1px solid #334155',
      display: 'flex',
      flexDirection: 'column', // На мобильных в колонку
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      zIndex: 9999,
      boxShadow: '0 -4px 10px rgba(0,0,0,0.1)'
    }}>
      <div style={{ maxWidth: '800px', fontSize: '0.9rem', textAlign: 'center' }}>
        <strong>🍪 Local Data & Privacy:</strong> We use local storage and cookies to save your settings and prompts directly in your browser. 
        We do not store your data on our servers. By using this site, you agree to our 
        <a href="/terms" style={{color: '#60a5fa', marginLeft: '5px'}}>Terms</a> and 
        <a href="/privacy" style={{color: '#60a5fa', marginLeft: '5px'}}>Privacy Policy</a>.
      </div>
      <button 
        onClick={handleAccept}
        style={{
          backgroundColor: '#2563eb',
          color: 'white',
          border: 'none',
          padding: '0.5rem 1.5rem',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        I Understand
      </button>
    </div>
  );
}