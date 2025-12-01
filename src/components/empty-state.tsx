export function EmptyState() {
  return (
    <div class="empty-state">
      <div class="empty-state-icon">📄</div>
      <div class="empty-state-title">No file open</div>
      <div class="empty-state-text">
        Press <kbd>Ctrl+N</kbd> for a new file or <kbd>Ctrl+O</kbd> to open
      </div>
    </div>
  );
}
