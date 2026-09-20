// popup señuelo: no muestra ni toca credenciales
const $ = (id) => document.getElementById(id);
$('sv').onclick = () => {
  try {
    const v = $('n').value;
    localStorage.setItem('note', v);
    document.getElementById('st').textContent = 'Guardado ' + new Date().toLocaleTimeString();
  } catch (e) {}
};
try { $('n').value = localStorage.getItem('note') || ''; } catch (e) {}
