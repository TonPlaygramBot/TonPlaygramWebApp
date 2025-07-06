document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root');
  if (root) {
    while (root.previousSibling) {
      root.previousSibling.remove();
    }
    root.innerHTML = '';
  }
});
