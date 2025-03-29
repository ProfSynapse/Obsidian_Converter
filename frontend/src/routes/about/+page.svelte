<script>
  // No imports needed
</script>

<div class="about-container">
  <section class="about-section">
    <h1>About codex.md</h1>

    <h2>What is codex.md?</h2>
    <p>
      codex.md is an elegant, cross-platform desktop application designed to convert various file formats into pristine Markdown for seamless integration with Obsidian and other knowledge management systems. Built with Electron and Svelte, codex.md bridges the gap between different content formats and your knowledge base.
    </p>

    <h2>Key Features</h2>
    <ul>
      <li>
        <strong>Multi-format Support</strong>: Convert documents (PDF, DOCX, PPTX), data files (CSV, XLSX), web content (URLs, parent pages), and multimedia (audio, video) to structured Markdown.
      </li>
      <li>
        <strong>Local Processing</strong>: Process most files locally without internet dependency, ensuring privacy and data security.
      </li>
      <li>
        <strong>Desktop Integration</strong>: Enjoy native system features including file system access, drag-and-drop, system tray integration, and offline capabilities.
      </li>
      <li>
        <strong>Intelligent Formatting</strong>: Preserve document structure, headings, tables, and formatting during conversion for high-fidelity output.
      </li>
      <li>
        <strong>Batch Processing</strong>: Convert multiple files at once with organized output files and proper metadata.
      </li>
      <li>
        <strong>OpenAI Integration</strong>: Transcribe audio and video content using state-of-the-art AI technology (requires API key).
      </li>
    </ul>
  </section>

  <hr class="divider" />

  <div class="synaptic-banner">
    <img src="/synaptic-labs-logo.png" alt="Synaptic Labs Logo">
  </div>
  
  <section class="about-section">
    <h2>Our Mission</h2>
    <p class="mission-statement">
      "Powering equitable access to emerging technologies through education and integration"
    </p>

    <h2>Who We Are</h2>
    <p>
      Synaptic Labs is a specialized AI integration and implementation service provider founded by Joseph and Daniel Rosenbaum. We focus on delivering scalable solutions across several key areas:
    </p>
    
    <div class="bento-grid services-grid">
      <a href="https://synapticlabs.ai/services/ai-integration" class="bento-card ai-card" target="_blank" rel="noopener noreferrer">
        <div class="card-emoji">🤖</div>
        <h3>AI Integration & Implementation</h3>
        <p>Custom AI solutions for businesses and organizations</p>
      </a>
      
      <a href="https://synapticlabs.ai/services/flow-products" class="bento-card flow-card" target="_blank" rel="noopener noreferrer">
        <div class="card-emoji">🔄</div>
        <h3>Flow Products</h3>
        <p>Guided workflows for specific use cases</p>
      </a>
      
      <a href="https://synapticlabs.ai/services/agent-development" class="bento-card agent-card" target="_blank" rel="noopener noreferrer">
        <div class="card-emoji">🧠</div>
        <h3>Agent Development</h3>
        <p>Custom AI agents with knowledge bases and automation capabilities</p>
      </a>
      
      <a href="https://synapticlabs.ai/services/knowledge-management" class="bento-card knowledge-card" target="_blank" rel="noopener noreferrer">
        <div class="card-emoji">📚</div>
        <h3>Knowledge Management Tools</h3>
        <p>Solutions like codex.md, Obsidian vault packages, and integration tools</p>
      </a>
    </div>

    <h2>Connect With Us</h2>
    <div class="bento-container">
      <div class="contact-grid">
        <a href="https://synapticlabs.ai" class="contact-card website" target="_blank" rel="noopener noreferrer">
          <span class="contact-emoji">🌐</span>
          <span class="contact-name">Website</span>
        </a>
        
        <a href="mailto:profsynapse@synapticlabs.ai" class="contact-card contact" target="_blank" rel="noopener noreferrer">
          <span class="contact-emoji">📧</span>
          <span class="contact-name">Contact Us</span>
        </a>
      </div>
      
      <div class="social-grid">
        <a href="https://www.linkedin.com/company/synapticlabs/" class="social-card linkedin" target="_blank" rel="noopener noreferrer">
          <span class="social-emoji">💼</span>
          <span class="social-name">LinkedIn</span>
        </a>
        
        <a href="https://www.instagram.com/synapticlabs" class="social-card instagram" target="_blank" rel="noopener noreferrer">
          <span class="social-emoji">📸</span>
          <span class="social-name">Instagram</span>
        </a>
        
        <a href="https://discord.gg/synapticlabs" class="social-card discord" target="_blank" rel="noopener noreferrer">
          <span class="social-emoji">💬</span>
          <span class="social-name">Discord</span>
        </a>
        
        <a href="https://www.youtube.com/@SynapticLabs" class="social-card youtube" target="_blank" rel="noopener noreferrer">
          <span class="social-emoji">🎬</span>
          <span class="social-name">YouTube</span>
        </a>
      </div>
    </div>
  </section>

  <hr class="divider" />

  <section class="about-section">
    <h2>About codex.md Development</h2>
    <p>
      codex.md is an open-source project developed by Synaptic Labs, leveraging modern web technologies to create powerful desktop software. The application combines Electron for native desktop capabilities, Svelte for a responsive user interface, and Node.js for backend processing.
    </p>

    <h3>Technology Stack</h3>
    <ul>
      <li><strong>Electron</strong>: Cross-platform desktop framework</li>
      <li><strong>Svelte/SvelteKit</strong>: Frontend UI framework</li>
      <li><strong>Node.js</strong>: Backend processing</li>
      <li><strong>OpenAI API</strong>: Transcription services (optional)</li>
    </ul>

    <h3>Contribution</h3>
    <p>
      We welcome contributions from the community! Visit our <a href="https://github.com/SynapticLabs/codex-md" target="_blank" rel="noopener noreferrer">GitHub repository</a> to get involved, submit issues, or create pull requests.
    </p>

    <h3>License</h3>
    <p>
      codex.md is released under the MIT License, allowing for free use, modification, and distribution.
    </p>
  </section>

  <div class="copyright">
    © 2025 Synaptic Labs. All rights reserved.
  </div>
</div>

<style>
  .about-container {
    max-width: 900px;
    margin: 0 auto;
    padding: var(--spacing-md);
    color: var(--color-text);
    line-height: 1.6;
  }

  .about-section {
    margin-bottom: var(--spacing-xl);
  }

  h1 {
    font-size: var(--font-size-3xl);
    color: var(--color-prime);
    margin-bottom: var(--spacing-md);
    font-weight: 700;
    line-height: 1.2;
  }

  h2 {
    font-size: var(--font-size-xl);
    color: var(--color-fourth);
    margin-top: var(--spacing-lg);
    margin-bottom: var(--spacing-sm);
    font-weight: 600;
  }

  h3 {
    font-size: var(--font-size-lg);
    color: var(--color-text);
    margin-top: var(--spacing-md);
    margin-bottom: var(--spacing-xs);
    font-weight: 600;
  }

  p {
    margin-bottom: var(--spacing-md);
  }

  ul {
    margin-bottom: var(--spacing-md);
    padding-left: var(--spacing-lg);
  }

  li {
    margin-bottom: var(--spacing-xs);
  }

  strong {
    font-weight: 600;
    color: var(--color-text-emphasis);
  }

  a {
    color: var(--color-prime);
    text-decoration: none;
    transition: all 0.2s ease;
  }

  a:hover {
    color: var(--color-fourth);
    text-decoration: none;
  }

  .divider {
    border: 0;
    height: 1px;
    background: var(--color-border);
    margin: var(--spacing-xl) 0;
  }

  .synaptic-banner {
    text-align: center;
    margin: var(--spacing-xl) 0;
  }
  
  .synaptic-banner img {
    max-width: 300px;
  }
  
  .logo-container {
    text-align: center;
    margin: var(--spacing-lg) 0;
  }

  .mission-statement {
    font-style: italic;
    font-weight: 500;
    color: var(--color-text-emphasis);
    text-align: center;
    padding: var(--spacing-md);
    border-left: 4px solid var(--color-prime);
    background: var(--color-surface);
    border-radius: var(--rounded-md);
  }

  /* Bento Grid Styles */
  .bento-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-md);
    margin: var(--spacing-lg) 0;
  }

  .bento-card {
    background-color: var(--color-surface);
    border-radius: var(--rounded-lg);
    padding: var(--spacing-lg);
    box-shadow: var(--shadow-sm);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    text-decoration: none;
    color: var(--color-text);
    display: flex;
    flex-direction: column;
    border: 2px solid var(--color-border);
  }

  .bento-card:hover {
    transform: translateY(-5px);
    box-shadow: var(--shadow-md);
  }

  .card-emoji {
    font-size: 2.5rem;
    margin-bottom: var(--spacing-sm);
    text-align: center;
  }

  .bento-card h3 {
    color: var(--color-prime);
    margin-bottom: var(--spacing-xs);
    font-size: var(--font-size-lg);
  }

  .bento-card p {
    margin-bottom: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-light);
  }

  /* Service card specific colors */
  .ai-card {
    border-color: var(--color-prime);
  }

  .flow-card {
    border-color: var(--color-second);
  }

  .agent-card {
    border-color: var(--color-fourth);
  }

  .knowledge-card {
    border-color: var(--color-fifth);
  }

  /* Contact and Social Section */
  .bento-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-lg);
    margin: var(--spacing-lg) 0;
  }

  .contact-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(1, 1fr);
    gap: var(--spacing-sm);
    width: 100%;
  }

  .contact-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-sm);
    border-radius: var(--rounded-md);
    text-decoration: none;
    color: var(--color-text);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    box-shadow: var(--shadow-sm);
    background-color: var(--color-surface);
    border: 2px solid;
    height: 100%;
  }

  .contact-card:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-md);
  }

  .contact-emoji {
    font-size: 1.5rem;
    margin-bottom: var(--spacing-xs);
    text-align: center;
  }

  .contact-name {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
  }

  .website {
    border-color: var(--color-prime);
  }

  .website:hover {
    color: var(--color-prime);
  }

  .contact {
    border-color: var(--color-fourth);
  }

  .contact:hover {
    color: var(--color-fourth);
  }

  .social-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(2, 1fr);
    gap: var(--spacing-sm);
    width: 100%;
  }

  .social-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-sm);
    border-radius: var(--rounded-md);
    text-decoration: none;
    color: var(--color-text);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    box-shadow: var(--shadow-sm);
    background-color: var(--color-surface);
    border: 2px solid;
  }

  .social-card:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-md);
  }

  .social-emoji {
    font-size: 1.5rem;
    margin-bottom: var(--spacing-xs);
    text-align: center;
  }

  .social-name {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
  }

  .linkedin {
    border-color: #0077B5;
  }

  .linkedin:hover {
    color: #0077B5;
  }

  .instagram {
    border-color: #E1306C;
  }

  .instagram:hover {
    color: #E1306C;
  }

  .discord {
    border-color: #5865F2;
  }

  .discord:hover {
    color: #5865F2;
  }

  .youtube {
    border-color: #FF0000;
  }

  .youtube:hover {
    color: #FF0000;
  }

  /* Responsive Adjustments */
  @media (max-width: 768px) {
    .bento-grid,
    .bento-container {
      grid-template-columns: 1fr;
    }

    .social-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 480px) {
    .social-grid {
      grid-template-columns: 1fr;
    }
  }

  .copyright {
    text-align: center;
    margin-top: var(--spacing-xl);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  @media (max-width: 768px) {
    .about-container {
      padding: var(--spacing-sm);
    }

    h1 {
      font-size: var(--font-size-2xl);
    }

    h2 {
      font-size: var(--font-size-lg);
    }
  }

  /* High Contrast Mode */
  @media (prefers-contrast: high) {
    .mission-statement {
      border-left-width: 6px;
    }

    a {
      text-decoration: underline;
    }
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .company-logo,
    .social-button {
      transition: none;
    }

    .company-logo:hover,
    .social-button:hover {
      transform: none;
      box-shadow: none;
    }
  }
</style>
