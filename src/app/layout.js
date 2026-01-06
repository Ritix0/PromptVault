/* src/app/layout.js */
import "./globals.css";
import CookieBanner from "@/components/CookieBanner/CookieBanner";

export const metadata = {
  title: "PromptVault (Local-First)",
  description: "Secure, local-first prompt management",
  // ДОБАВЛЯЕМ БЛОК verification СЮДА:
  verification: {
    google: "rEm88MlgB-J142CJqVlNSrwEu5fnP6D8lRY86PJQEew",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}