/* src/components/UI/Toast.js */
"use client";

import styles from "./Toast.module.css";
import { useUI } from "@/context/UIContext";

export default function ToastContainer() {
  const { toasts, removeToast } = useUI();

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <div 
            key={toast.id} 
            className={`${styles.toast} ${styles[toast.type] || styles.info}`}
        >
          <span>{toast.message}</span>
          <button 
            className={styles.closeBtn} 
            onClick={() => removeToast(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}