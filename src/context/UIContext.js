/* src/context/UIContext.js */
"use client";

import { createContext, useContext, useState, useCallback } from "react";
import ToastContainer from "@/components/UI/Toast";
import Modal from "@/components/UI/Modal";

const UIContext = createContext();

export const UIProvider = ({ children }) => {
  // --- TOASTS STATE ---
  const [toasts, setToasts] = useState([]);

  // 1. Объявляем removeToast
  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // 2. Объявляем showToast
  const showToast = useCallback((message, type = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => { removeToast(id); }, 4000);
  }, [removeToast]);

  // --- MODAL STATE ---
  const [modal, setModal] = useState({
    isOpen: false,
    title: "",
    content: "",
    type: "confirm", 
    variant: "default",
    customButtons: [], // Для showChoice
    confirmText: "OK",
    cancelText: "Cancel",
    onConfirm: null,
    onCancel: null,
  });

  const closeModal = useCallback(() => {
    setModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  /**
   * showConfirm - Да/Нет (возвращает true/false)
   */
  const showConfirm = useCallback((title, content, options = {}) => {
    return new Promise((resolve) => {
      setModal({
        isOpen: true,
        title,
        content,
        type: "confirm",
        variant: options.variant || "default",
        customButtons: [], // Сбрасываем кастомные кнопки
        confirmText: options.confirmText || "Confirm",
        cancelText: options.cancelText || "Cancel",
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  }, []);

  /**
   * showAlert - Просто уведомление (возвращает true)
   */
  const showAlert = useCallback((title, content) => {
    return new Promise((resolve) => {
      setModal({
        isOpen: true,
        title,
        content,
        type: "alert",
        customButtons: [],
        variant: "default",
        confirmText: "OK",
        onConfirm: () => resolve(true),
        onCancel: () => resolve(true),
      });
    });
  }, []);

  /**
   * showChoice - Выбор из нескольких вариантов
   * Возвращает значение (value) нажатой кнопки
   * 
   * Пример options: 
   * [
   *   { label: "Cloud Force", value: "cloud_force", variant: "danger" },
   *   { label: "Smart Merge", value: "newest", variant: "primary" },
   *   { label: "Local Force", value: "local_force", variant: "default" }
   * ]
   */
  const showChoice = useCallback((title, content, choices = []) => {
      return new Promise((resolve) => {
          // Преобразуем опции в формат кнопок для Modal.js
          const buttons = choices.map(choice => ({
              label: choice.label,
              variant: choice.variant || 'default',
              onClick: () => resolve(choice.value)
          }));

          setModal({
              isOpen: true,
              title,
              content,
              type: 'custom',
              customButtons: buttons,
              // Стандартные колбэки на случай клика мимо (вернем null или первое значение)
              onCancel: () => resolve(null) 
          });
      });
  });

  return (
    <UIContext.Provider value={{ showToast, removeToast, showConfirm, showAlert, showChoice, modal, closeModal, toasts }}>
      {children}
      <ToastContainer />
      <Modal />
    </UIContext.Provider>
  );
};

export const useUI = () => useContext(UIContext);