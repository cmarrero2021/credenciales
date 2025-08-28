<template>
  <div class="q-ml-xl q-mr-xl">
    <q-input v-model="cedula" label="Buscar por cédula" @keyup.enter="buscarTrabajador" class="q-mb-md" />
    <q-btn label="Buscar" color="primary" @click="buscarTrabajador" class="q-mb-lg" />
    <q-btn v-if="trabajador" label="Imprimir" color="secondary" @click="imprimirCredencial" class="q-mb-lg" />
    <!-- <q-btn v-if="trabajador" label="Alternar menú" color="primary" @click="emitirToggleDrawer" class="q-mb-lg" /> -->
    <div v-if="trabajador" class="credencial-container">
      <div class="credencial-preview">
        <img :src="fondoUrl" class="fondo-img" alt="Fondo carnet" />
        <img :src="getFotoUrl(trabajador.foto_url)" class="foto-trabajador" alt="Foto trabajador" />
        <div class="nombre">{{ trabajador.nombres }} {{ trabajador.apellidos }}</div>
        <div class="cargo">{{ trabajador.cargo }}</div>
        <div class="cedula">{{ trabajador.cedula }}</div>
      </div>
      <div v-if="mostrarInfo" class="info-servidor no-print">
  <div><b>Cédula:</b> {{ trabajador.cedula }}</div>
  <div><b>Nombres:</b> {{ trabajador.nombres }}</div>
  <div><b>Apellidos:</b> {{ trabajador.apellidos }}</div>
  <div><b>Institución:</b> {{ trabajador.institucion || trabajador.institucion }}</div>
  <div><b>Unidad Adscripción:</b> {{ trabajador.area || trabajador.area }}</div>
  <div><b>Cargo:</b> {{ trabajador.cargo }}</div>
      </div>
    </div>
  </div>
</template>
<script setup>
const mostrarInfo = ref(true)
function emitirToggleDrawer() {
  window.dispatchEvent(new CustomEvent('toggle-drawer'));
}
import { onMounted, onBeforeUnmount } from 'vue'
import { inject } from 'vue'
const imprimiendo = ref(false)

function ocultarElementos() {
  imprimiendo.value = true
  document.body.classList.add('solo-credencial')
}
function restaurarElementos() {
  imprimiendo.value = false
  document.body.classList.remove('solo-credencial')
}
function imprimirCredencial() {
  mostrarInfo.value = false;
  // Colapsar el drawer usando el evento global específico
  window.dispatchEvent(new CustomEvent('collapse-drawer'));
  let originalPadding = '';
  // Eliminar clases de margen del div principal
  const mainDiv = document.querySelector('div.q-ml-xl.q-mr-xl');
  let restoreMargin = false;
  if (mainDiv) {
    if (mainDiv.classList.contains('q-ml-xl')) {
      mainDiv.classList.remove('q-ml-xl');
      restoreMargin = true;
    }
    if (mainDiv.classList.contains('q-mr-xl')) {
      mainDiv.classList.remove('q-mr-xl');
      restoreMargin = true;
    }
  }
  document.querySelectorAll('.q-header, .q-field, .q-btn').forEach(function(element) {
    element.style.display = 'none';
  });
  // Muestra la credencial
  const credencial = document.querySelector('.credencial-preview');
  if (credencial) credencial.style.display = 'block';
  // Guardar y modificar el padding-left de q-page-container
  const pageContainer = document.querySelector('.q-page-container');
  if (pageContainer) {
    originalPadding = pageContainer.style.paddingLeft;
    pageContainer.style.paddingLeft = '0px';
  }
  setTimeout(() => {
    window.print();
    document.querySelectorAll('.q-header, .q-field, .q-btn').forEach(function(element) {
      element.style.display = '';
    });
    if (credencial) credencial.style.display = '';
    if (pageContainer) {
      pageContainer.style.paddingLeft = originalPadding;
    }
    // Restituir clases de margen
    if (mainDiv && restoreMargin) {
      mainDiv.classList.add('q-ml-xl');
      mainDiv.classList.add('q-mr-xl');
    }
  mostrarInfo.value = true;
  }, 500);
}
onMounted(() => {
  window.addEventListener('afterprint', restaurarElementos)
})
onBeforeUnmount(() => {
  window.removeEventListener('afterprint', restaurarElementos)
})
const backendBase = 'http://localhost:3001'
function getFotoUrl(url) {
  if (!url) return ''
  if (url.startsWith('/uploads') || url.startsWith('/img')) {
    return backendBase + url
  }
  return url
}
import { ref } from 'vue'
import axios from 'axios'
import { Notify } from 'quasar'
const cedula = ref('')
const trabajador = ref(null)
const fondoUrl = '/img/frontal_carnet.png'
const apiBase = import.meta.env.VITE_API_URL || ''
const buscarTrabajador = async () => {
  if (!cedula.value) return
  try {
    const res = await axios.get(`${apiBase}/auth/credencial/${cedula.value}`)
    if (!res.data || !res.data.cedula) {
      trabajador.value = null;
  Notify.create({ type: 'negative', message: 'El número de Cédula de Identidad introducido no corresponde con ningún trabajador registrado.', position: 'center' });
      return;
    }
    // Verificar si la foto es la imagen por defecto
    if (res.data.foto_url === '/img/no_person.png') {
      trabajador.value = null;
      Notify.create({ type: 'warning', message: 'No se puede imprimir la credencial porque no existe la foto del Servidor Público.', position: 'center' });
      return;
    }
    trabajador.value = res.data;
  } catch (err) {
    trabajador.value = null;
  Notify.create({ type: 'negative', message: 'El número de Cédula de Identidad introducido no corresponde con ningún trabajador registrado.', position: 'center' });
  }
}
</script>
<style scoped>
.credencial-container {
  display: flex;
  flex-direction: row;
  gap: 32px;
  align-items: flex-start;
}
@media (max-width: 900px) {
  .credencial-container {
    flex-direction: column;
    gap: 16px;
    align-items: center;
  }
}
.info-servidor {
  background: #f8f8f8;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.07);
  padding: 18px 24px;
  min-width: 220px;
  font-size: 1.1em;
  max-width: 350px;
}
.no-print {
  display: block;
}
@media print {
  .no-print {
    display: none !important;
  }
}
@font-face {
  font-family: 'Georama';
  src: url('@/assets/fonts/georama/Georama-Regular.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Georama';
  src: url('@/assets/fonts/georama/Georama-Bold.ttf') format('truetype');
  font-weight: 700;
  font-style: normal;
}
.credencial-preview {
  width: 55mm;
  height: 85mm;
  position: relative;
  border: 1px solid #ccc;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  background: #fff;
}
@media print {
  body.solo-credencial * {
    display: none !important;
  }
  body.solo-credencial .credencial-preview, body.solo-credencial .credencial-preview * {
    display: block !important;
    visibility: visible !important;
  }
}
.fondo-img {
  position: absolute;
  width: 55mm;
  height: 85mm;
  left: 0;
  top: 0;
  z-index: 1;
}
.foto-trabajador {
  position: absolute;
  width: 19mm;
  height: 19mm;
  left: 19mm;
  top: 28mm;
  object-fit: cover;
  z-index: 2;
  border-radius: 3mm;
  border: 1px solid #888;
}
.nombre {
  position: absolute;
  top: 50mm;
  left: 0;
  width: 55mm;
  text-align: center;
  font-size: 4mm;
  font-family: 'Georama', sans-serif;
  font-weight: 700;
  z-index: 2;
}
.cedula {
  position: absolute;
  top: 71mm;
  left: 0;
  width: 55mm;
  text-align: center;
  font-size: 5.6mm;
  font-family: 'Georama', sans-serif;
  font-weight: 700;
  z-index: 2;
}
.cargo {
  position: absolute;
  top: 64.52mm;
  left: 0;
  width: 55mm;
  text-align: center;
  font-size: 3.2mm;
  font-family: 'Georama', sans-serif;
  font-weight: 400;
  z-index: 2;
}
</style>
