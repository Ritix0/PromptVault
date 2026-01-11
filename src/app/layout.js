/* src/app/layout.js */
import "./globals.css";
import CookieBanner from "@/components/CookieBanner/CookieBanner";
import { UIProvider } from "@/context/UIContext";

export const metadata = {
  title: "PromptVault (Local-First)",
  description: "Secure, local-first prompt management",
  // ДОБАВЛЯЕМ БЛОК verification СЮДА:
  verification: {
    google: "7la86cOiEIRDy-89MryYWun2PXjV209prrhDMgVbHGY",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <UIProvider>
            {children}
            <CookieBanner />
        </UIProvider>
      </body>
    </html>
  );
}