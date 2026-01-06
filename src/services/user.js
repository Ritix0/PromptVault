/* src/services/user.js */
import { storageService } from "./storage";

// Ссылка на твой обновленный скрипт
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxhHbkdM6ActzrZASn9ju7Us3Bs_rwDwOnM_AQvbEl_ZgMIvexHDjLqu79QGfvDeCA/exec"; 

export const userService = {
  isPro: async () => {
    const cachedStatus = await storageService.getSetting("license_status"); 
    if (cachedStatus === 'active') return true;
    return false;
  },
  
  verifyKeyOnServer: async (key) => {
      try {
          // 1. Получаем уникальный ID этого браузера
          const deviceId = await storageService.getDeviceId();

          // 2. Отправляем Key + DeviceId
          const url = `${GOOGLE_SCRIPT_URL}?action=verify&licenseKey=${encodeURIComponent(key)}&deviceId=${encodeURIComponent(deviceId)}`;
          
          console.log("Verifying...", url);

          const response = await fetch(url, {
              method: "GET",
              redirect: "follow",
              headers: { "Content-Type": "text/plain;charset=utf-8" }
          });
          
          if (!response.ok) throw new Error("Server Error");

          const data = await response.json();
          console.log("Response:", data);

          if (data.valid) {
              await storageService.saveSetting("license_status", "active");
              return true;
          } else {
              // Если ошибка (например, Limit reached)
              await storageService.saveSetting("license_status", "inactive");
              // Можно вернуть сообщение об ошибке, чтобы показать юзеру
              console.warn("Server message:", data.message);
              return false;
          }
      } catch (e) {
          console.error("Verification error:", e);
          return false;
      }
  },
  
  // ... getStatusLabel и canRunAI без изменений ...
  getStatusLabel: async () => {
    const pro = await userService.isPro();
    if (pro) return "PRO Plan";
    const count = await storageService.getUsageCount();
    const left = Math.max(0, 10 - count);
    return `Trial (${left} runs left)`;
  },

  canRunAI: async () => {
    const pro = await userService.isPro();
    if (pro) return { allowed: true };
    const count = await storageService.getUsageCount();
    if (count < 10) return { allowed: true, trialsLeft: 10 - count };
    return { allowed: false, reason: "Trial limit reached. Please upgrade." };
  }
};