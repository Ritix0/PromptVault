/* src/app/privacy/page.js */
export default function PrivacyPolicy() {
  return (
    // ИЗМЕНЕНИЕ: color: 'var(--foreground)' вместо '#333'
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', lineHeight: '1.6', color: 'var(--foreground)' }}>
      <h1 style={{fontSize: '2rem', marginBottom: '1rem'}}>Privacy Policy</h1>
      <p style={{opacity: 0.6, marginBottom: '2rem'}}>Last updated: January 2026</p>

      <h2>1. Introduction</h2>
      <p>PromptVault ("we", "our") is a Local-First application. This means <strong>we do not operate a backend database to store your prompts or API keys</strong>. Your data remains strictly in your control.</p>

      <h2>2. Data Storage</h2>
      <ul>
        <li><strong>Local Storage:</strong> Your prompts, settings, and API keys are stored in your browser's IndexedDB and LocalStorage.</li>
        <li><strong>Google Drive (Optional):</strong> If you enable Cloud Sync, your data is backed up directly to your personal Google Drive and Google Sheets. We do not have access to these files; only your browser does.</li>
      </ul>

      <h2>3. API Keys</h2>
      <p>PromptVault uses a "Bring Your Own Key" (BYOK) architecture. Your API keys (OpenAI, Anthropic, etc.) are encrypted and stored locally on your device. They are sent directly from your browser to the respective AI provider's API. They are never sent to our servers.</p>

      <h2>4. Google User Data</h2>
      <p>If you choose to sign in with Google, we use OAuth verification solely to allow the application to write backups to <em>your</em> Google Drive. We do not collect, sell, or view your Google user data.</p>

      <h2>5. Contact</h2>
      <p>If you have questions about this policy or discover a bug, please contact us at: <strong>milligat13@gmail.com</strong></p>
      
      <div style={{marginTop: '2rem'}}>
        <a href="/" style={{color: 'var(--primary)', textDecoration: 'underline'}}>← Back to App</a>
      </div>
    </div>
  );
}