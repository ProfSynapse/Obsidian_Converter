<!-- src/lib/components/common/FileIcon.svelte -->
<script>
    export let type = 'file';
    export let size = '24px';
    export let color = null;
  
    const FILE_ICONS = {
      // Documents
      'txt': { icon: '📄', color: '#4A90E2', label: 'Text Document' },
      'pdf': { icon: '📕', color: '#E24A4A', label: 'PDF Document' },
      'doc': { icon: '📘', color: '#4A90E2', label: 'Word Document' },
      'docx': { icon: '📘', color: '#4A90E2', label: 'Word Document' },
      'md': { icon: '📝', color: '#4AE2B5', label: 'Markdown Document' },
      
      // Data files
      'csv': { icon: '📊', color: '#4AE266', label: 'CSV File' },
      'json': { icon: '📋', color: '#E2C84A', label: 'JSON File' },
      'xml': { icon: '📋', color: '#E2884A', label: 'XML File' },
      
      // Images
      'jpg': { icon: '🖼️', color: '#E24A8B', label: 'Image' },
      'jpeg': { icon: '🖼️', color: '#E24A8B', label: 'Image' },
      'png': { icon: '🖼️', color: '#E24A8B', label: 'Image' },
      'gif': { icon: '🖼️', color: '#E24A8B', label: 'Image' },
      
      // Audio
      'mp3': { icon: '🎵', color: '#9E4AE2', label: 'Audio File' },
      'wav': { icon: '🎵', color: '#9E4AE2', label: 'Audio File' },
      'ogg': { icon: '🎵', color: '#9E4AE2', label: 'Audio File' },
      
      // Video
      'mp4': { icon: '🎥', color: '#E24A4A', label: 'Video File' },
      'mov': { icon: '🎥', color: '#E24A4A', label: 'Video File' },
      'avi': { icon: '🎥', color: '#E24A4A', label: 'Video File' },
      
      // Web
      'html': { icon: '🌐', color: '#E2884A', label: 'HTML File' },
      'css': { icon: '🎨', color: '#4A90E2', label: 'CSS File' },
      'js': { icon: '⚡', color: '#E2C84A', label: 'JavaScript File' },
      
      // Special types
      'url': { icon: '🔗', color: '#4AE2B5', label: 'URL Link' },
      'parenturl': { icon: '🗺️', color: '#9E4AE2', label: 'Parent URL' },
      'youtube': { icon: '▶️', color: '#E24A4A', label: 'YouTube Video' },
      
      // Fallback
      'default': { icon: '📄', color: '#B8B8B8', label: 'File' }
    };
  
    $: fileType = type.toLowerCase().replace('.', '');
    $: config = FILE_ICONS[fileType] || FILE_ICONS.default;
    $: iconColor = color || config.color;
    $: ariaLabel = config.label;
  </script>
  
  <div 
    class="file-icon"
    style="
      --icon-color: {iconColor};
      --icon-size: {size};
    "
    role="img"
    aria-label={ariaLabel}
  >
    <span class="icon">
      {config.icon}
    </span>
  </div>
  
  <style>
    .file-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--icon-size);
      height: var(--icon-size);
      border-radius: var(--rounded-sm);
      background: color-mix(in srgb, var(--icon-color) 10%, transparent);
      color: var(--icon-color);
      transition: all var(--transition-duration-normal) ease;
    }
  
    .icon {
      font-size: calc(var(--icon-size) * 0.7);
      line-height: 1;
    }
  
    /* Hover effect */
    .file-icon:hover {
      transform: scale(1.05);
      background: color-mix(in srgb, var(--icon-color) 15%, transparent);
    }
  
    /* Accessibility */
    @media (prefers-reduced-motion: reduce) {
      .file-icon {
        transition: none;
      }
      
      .file-icon:hover {
        transform: none;
      }
    }
  
    @media (prefers-contrast: high) {
      .file-icon {
        border: 2px solid var(--icon-color);
      }
    }
  </style>