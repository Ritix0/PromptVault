/* src/app/terms/page.js */
export default function TermsOfService() {
  return (
    // ИЗМЕНЕНИЕ: color: 'var(--foreground)' вместо '#333'
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', lineHeight: '1.6', color: 'var(--foreground)' }}>
      <h1 style={{fontSize: '2rem', marginBottom: '1rem'}}>Terms of Service</h1>
      <p style={{opacity: 0.6, marginBottom: '2rem'}}>Last updated: January 2026</p>

      <h2>1. Acceptance of Terms</h2>
      <p>By accessing and using PromptVault, you accept and agree to be bound by the terms and provision of this agreement.</p>

      <h2>2. "As Is" Software</h2>
      <p>PromptVault is provided "as is". We connect to third-party APIs (OpenAI, Anthropic, etc.), but we cannot guarantee their availability. If a third-party provider changes their API or blocks requests, PromptVault may lose functionality temporarily.</p>

      <h2>3. PRO License & Refunds</h2>
      <p>The PRO license unlocks advanced interface features. <strong>Please test the Free Trial version before purchasing</strong> to ensure the API connection works from your location/network.</p>
      <p>Due to the nature of digital license keys, refunds are generally not provided unless the key itself is proven invalid.</p>

      <h2>4. User Responsibility</h2>
      <p>You are responsible for maintaining the confidentiality of your own data (via Google Drive backups) and your API keys.</p>

      <h2>5. Contact & Support</h2>
      <p>For support, bug reports, or license issues, contact: <strong>milligat13@gmail.com</strong></p>

      <div style={{marginTop: '2rem'}}>
        <a href="/" style={{color: 'var(--primary)', textDecoration: 'underline'}}>← Back to App</a>
      </div>
    </div>
  );
}