try {
  var t = localStorage.getItem('tracelab-theme');
  if (t !== 'light') document.documentElement.classList.add('dark');
} catch(e) {}
