<!-- src/routes/+page.svelte -->

<script>
  import ObsidianNoteConverter from '$lib/components/ObsidianNoteConverter.svelte';
</script>

<ObsidianNoteConverter />

<style>
  /* Add any page-specific styles here */
  main {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background-color: var(--color-background-page);
  }
</style>
