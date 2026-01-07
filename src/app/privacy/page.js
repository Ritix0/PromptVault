/* src/app/privacy/page.js */
export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', lineHeight: '1.6', color: 'var(--foreground)' }}>
      <h1 style={{fontSize: '2rem', marginBottom: '1rem'}}>Privacy Policy</h1>
      <p style={{opacity: 0.6, marginBottom: '2rem'}}>Last updated: January 7, 2026</p>

      <h2>1. Introduction</h2>
      <p>PromptVault ("we", "our") is a Local-First application designed to help users manage, version, and execute their AI prompts. We prioritize your privacy by keeping your data on your device by default.</p>

      <h2>2. Data Collection & Storage</h2>
      <ul>
        <li><strong>Local Data:</strong> All prompts, edit history, settings, and tags are stored locally in your browser's IndexedDB. We do not operate a backend server to store your content.</li>
        <li><strong>API Keys:</strong> Keys for third-party AI services (OpenAI, Anthropic, Gemini, DeepSeek, etc.) are stored exclusively on your device (in Local Storage) and are sent directly to the respective providers' APIs. They are never transmitted to our servers.</li>
      </ul>

      <h2>3. Google User Data (Cloud Sync Feature)</h2>
      <p>If you choose to enable the optional "Cloud Sync" feature to backup your data, PromptVault interacts with your Google account as follows:</p>
      
      <h3>Data Accessed</h3>
      <p>We request access to the following Google OAuth scopes:</p>
      <ul>
        <li><strong>Google Drive (https://www.googleapis.com/auth/drive.file):</strong> This scope allows us to create and update only the specific backup files created by this app (e.g., `promptvault_backup.json`). We cannot access your other personal files or photos.</li>
        <li><strong>Google Sheets (https://www.googleapis.com/auth/spreadsheets):</strong> This scope allows us to create a specific spreadsheet named "PromptVault_History" and append rows to it when you execute a prompt.</li>
      </ul>

      <h3>Data Usage</h3>
      <p>The data accessed from Google APIs is used solely for the following user-facing features:</p>
      <ul>
        <li><strong>Backup & Restore:</strong> To save a secure copy of your local database to your personal Google Drive, preventing data loss if you clear your browser cache.</li>
        <li><strong>Logging:</strong> To automatically record your prompt inputs and AI outputs into a Google Sheet for your personal analysis and history tracking.</li>
      </ul>
      <p><strong>We do not share, sell, or transfer your Google User Data to any third parties.</strong> The data transfer happens directly between your client-side browser and Google's servers.</p>

      <h2>4. Limited Use Disclosure</h2>
      <p>PromptVault's use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" style={{color: 'var(--primary)'}}>Google API Services User Data Policy</a>, including the Limited Use requirements.</p>

      <h2>5. Contact</h2>
      <p>If you have any questions about this Privacy Policy or your data, please contact us at:</p>
      <p><strong>Email:</strong> milligat13@gmail.com</p>
      
      <div style={{marginTop: '2rem'}}>
        <a href="/" style={{color: 'var(--primary)', textDecoration: 'underline'}}>← Back to App</a>
      </div>
    </div>
  );
}