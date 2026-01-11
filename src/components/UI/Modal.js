/* src/components/UI/Modal.js */
"use client";

import styles from "./Modal.module.css";
import { useUI } from "@/context/UIContext";

export default function Modal() {
  const { modal, closeModal } = useUI();

  if (!modal.isOpen) return null;

  // Если переданы кастомные кнопки (для выбора из 3+ вариантов)
  if (modal.customButtons && modal.customButtons.length > 0) {
      return (
        <div className={styles.backdrop}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.header}>
              {modal.title}
            </div>
            
            <div className={styles.body}>
              {modal.content}
            </div>

            <div className={styles.footer} style={{flexWrap: 'wrap', justifyContent: 'center'}}>
              {modal.customButtons.map((btn, index) => (
                  <button
                    key={index}
                    className={`${styles.btn} ${
                        btn.variant === 'danger' ? styles.btnDanger : 
                        btn.variant === 'primary' ? styles.btnConfirm : 
                        styles.btnCancel
                    }`}
                    onClick={() => {
                        if (btn.onClick) btn.onClick();
                        closeModal();
                    }}
                  >
                      {btn.label}
                  </button>
              ))}
            </div>
          </div>
        </div>
      );
  }

  // СТАНДАРТНЫЙ РЕЖИМ (Alert / Confirm)
  const handleConfirm = () => {
    if (modal.onConfirm) modal.onConfirm();
    closeModal();
  };

  const handleCancel = () => {
    if (modal.onCancel) modal.onCancel();
    closeModal();
  };

  return (
    <div className={styles.backdrop} onClick={modal.type === 'alert' ? handleConfirm : handleCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          {modal.title || "Confirm Action"}
        </div>
        
        <div className={styles.body}>
          {modal.content}
        </div>

        <div className={styles.footer}>
          {/* Если type 'alert', показываем только кнопку OK */}
          {modal.type !== 'alert' && (
            <button className={`${styles.btn} ${styles.btnCancel}`} onClick={handleCancel}>
              {modal.cancelText || "Cancel"}
            </button>
          )}
          
          <button 
            className={`${styles.btn} ${modal.variant === 'danger' ? styles.btnDanger : styles.btnConfirm}`} 
            onClick={handleConfirm}
          >
            {modal.confirmText || "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}