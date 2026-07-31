try {
  var t = localStorage.getItem('baymax-theme')
  if (t === 'dark' || ((t === 'system' || !t) && matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark')
  }
} catch (e) {}
