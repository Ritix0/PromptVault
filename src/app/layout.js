/* src/app/layout.js */
import "./globals.css";
import CookieBanner from "@/components/CookieBanner/CookieBanner"; // Импортируем компонент

export const metadata = {
  title: "PromptVault",
  description: "Secure, local-first prompt management",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <CookieBanner /> {/* Вставляем баннер сюда */}
      </body>
    </html>
  );
}