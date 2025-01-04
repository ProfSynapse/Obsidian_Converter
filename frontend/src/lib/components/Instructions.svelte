<script>
  import Accordion from './common/Accordion.svelte';
</script>

<div class="instructions">
  <Accordion title="Instructions - Click to Learn How It Works" icon="📖" expandedIcon="📖">
    <div class="instruction-content">
      <section class="instruction-section">
        <h3>🔍 Different Ways to Convert</h3>
        <ul>
          <li>
            <strong>Single Web Page</strong> - Just paste any website URL (like "<em>www.example.com/article</em>"). 
            This will convert just that one page into a note.
          </li>
          <li>
            <strong>Parent URL</strong> - If you want to convert multiple linked pages, use a parent URL. 
            For example, if you put in "<em>www.example.com/guide</em>", it will convert that page <strong>AND</strong> all the pages it links to.
          </li>
          <li>
            <strong>YouTube Videos</strong> - Copy and paste any YouTube video link 
            (it should look like "<em>youtube.com/watch?v=...</em>"). This will create notes from the video content.
          </li>
          <li>
            <strong>Files from Your Computer</strong> - Click the upload box or drag files into it. You can add:
            <ul class="sub-list">
              <li>Regular documents (like Word files or PDFs)</li>
              <li>Audio/Video files (these need an API key)</li>
            </ul>
          </li>
        </ul>
      </section>

      <section class="instruction-section">
        <h3>🔑 About API Keys</h3>
        <ul>
          <li>You <strong>only</strong> need an API key for audio/video files</li>
          <li>The key is temporary and gets cleared when you refresh</li>
          <li>Don't worry if you don't have one - you can still convert regular documents!</li>
        </ul>
      </section>

      <section class="instruction-section">
        <h3>📝 Steps to Convert</h3>
        <ol>
          <li>Add your content (either paste a URL or upload files)</li>
          <li>If you're converting audio/video, add your API key when prompted</li>
          <li>Click the "<strong>Start Conversion</strong>" button</li>
          <li>Wait for processing (this might take a minute)</li>
          <li>Download your converted notes</li>
        </ol>
      </section>
    </div>
  </Accordion>
</div>

<style>
  .instructions {
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
  }

  .instruction-content {
    padding: var(--spacing-lg) var(--spacing-xl);
    line-height: 1.7;
    font-size: var(--font-size-base);
  }

  .instruction-section {
    margin-bottom: var(--spacing-xl);
  }

  .instruction-section:last-child {
    margin-bottom: 0;
  }

  h3 {
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--color-text-emphasis, #1a1a1a);
    margin-bottom: var(--spacing-md);
  }

  ul, ol {
    margin: 0;
    padding-left: var(--spacing-xl);
  }

  .sub-list {
    margin-top: var(--spacing-xs);
    padding-left: var(--spacing-lg);
  }

  li {
    margin-bottom: var(--spacing-sm);
  }

  li:last-child {
    margin-bottom: 0;
  }

  strong {
    color: var(--color-text-emphasis, #1a1a1a);
    font-weight: 600;
  }

  em {
    color: var(--color-text-secondary);
    font-style: normal;
    background: var(--color-surface-highlight, #f0f0f0);
    padding: 0.2em 0.4em;
    border-radius: var(--rounded-sm);
    font-family: var(--font-mono);
    font-size: 0.9em;
  }

  /* Mobile Adjustments */
  @media (max-width: 640px) {
    .instruction-content {
      padding: var(--spacing-md);
      font-size: var(--font-size-sm);
    }

    h3 {
      font-size: var(--font-size-base);
    }

    ul, ol {
      padding-left: var(--spacing-lg);
    }

    .sub-list {
      padding-left: var(--spacing-md);
    }
  }
</style>
