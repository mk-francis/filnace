const Utils = (() => {
  function formatCurrency(value) {
    try {
      return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0));
    } catch (_) {
      const n = Math.round(Number(value || 0));
      return `₱${n.toLocaleString()}`;
    }
  }

  function parseDate(str) {
    return new Date(str);
  }

  function formatDate(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const dd = `${d.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  function downloadJSON(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return { formatCurrency, parseDate, formatDate, downloadJSON };
})();