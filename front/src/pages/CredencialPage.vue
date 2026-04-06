<template>
  <div class="q-ml-xl q-mr-xl">
    <q-input v-model="cedula" label="Buscar por cédula" @keyup.enter="buscarTrabajador" class="q-mb-md" />
    <q-btn label="Buscar" color="primary" @click="buscarTrabajador" class="q-mb-lg" />
    <q-btn v-if="trabajador" label="Imprimir" color="secondary" @click="imprimirCredencial" class="q-mb-lg" />
    <!-- <q-btn v-if="trabajador" label="Alternar menú" color="primary" @click="emitirToggleDrawer" class="q-mb-lg" /> -->
    <div v-if="trabajador" class="credencial-container">
      <!-- Parte delantera -->
      <div class="credencial-preview credencial-frontal">
        <img :src="fondoUrl" class="fondo-img" alt="Fondo carnet" />
        <img :src="getFotoUrl(trabajador.foto_url)" class="foto-trabajador" alt="Foto trabajador" />
        <div class="nombre">{{ trabajador.nombres }} {{ trabajador.apellidos }}</div>
        <div class="cargo">{{ trabajador.cargo }}</div>
        <div class="cedula">{{ trabajador.cedula }}</div>
        <div :class="'franja' + trabajador.nivel">{{ trabajador.abreviacion }}</div>
      </div>

      <!-- Parte trasera -->
      <div class="credencial-preview credencial-trasera">
        <div class="contenido-trasero">
          <div class="texto-trasero">
            <p class="parrafo-trasero">
              <span class="bullet">•</span> Este carnet es de uso exclusivo para el personal que labora en Ministerio del Poder Popular de Adultos y Adultas Mayores Abuelos y Abuelas de la Patria
            </p>
            <!-- <p class="parrafo-trasero">
              <span class="bullet">•</span> Debe ser utilizado en un lugar visible
            </p> -->
            <p class="parrafo-trasero">
              <span class="bullet">•</span> Puede ser retenido por la Dirección General de Seguridad cuando lo requiera
            </p>
            <p class="parrafo-trasero">
              <span class="bullet">•</span> Es intransferible
            </p>
            <p class="parrafo-trasero">
              <span class="bullet">•</span> Se agradece a todas las autoridades Civiles y Militares prestarle la mayor colaboración posible al portador de esta credencial, dentro de las normas legales
            </p>
            <!-- <p class="parrafo-trasero">
              <span class="bullet">•</span> En caso de ser transferido a otra dirección o en caso de vencimiento, debe ser entregado
            </p> -->
          </div>
          <div class="footer-container">
            <img src="/img/sello.png" alt="Sello" class="sello-img" />
            <QrcodeVue :value="qrUrl" :size="qrSize" level="H" class="qr-code" />
          </div>
        </div>
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
async function imprimirCredencial() {
  // Verificar si estamos en Electron
  const isElectron = window.electronAPI && window.electronAPI.isElectron;

  if (isElectron) {
    // Modo Electron - Usar API nativa de impresión
    await imprimirCredencialElectron();
  } else {
    // Modo Web - Usar window.print() tradicional
    await imprimirCredencialWeb();
  }
}

// Función para imprimir en Electron
async function imprimirCredencialElectron() {
  mostrarInfo.value = false;
  window.dispatchEvent(new CustomEvent('collapse-drawer'));

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

  const credencial = document.querySelector('.credencial-preview');
  if (credencial) credencial.style.display = 'block';

  const pageContainer = document.querySelector('.q-page-container');
  let originalPadding = '';
  if (pageContainer) {
    originalPadding = pageContainer.style.paddingLeft;
    pageContainer.style.paddingLeft = '0px';
  }

  // Esperar un momento para que se apliquen los estilos
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    // Llamar a la API de Electron para imprimir
    // No necesitamos enviar datos, Electron imprimirá el contenido HTML actual
    const result = await window.electronAPI.printCredential();

    // Restaurar elementos
    document.querySelectorAll('.q-header, .q-field, .q-btn').forEach(function(element) {
      element.style.display = '';
    });
    if (credencial) credencial.style.display = '';
    if (pageContainer) {
      pageContainer.style.paddingLeft = originalPadding;
    }
    if (mainDiv && restoreMargin) {
      mainDiv.classList.add('q-ml-xl');
      mainDiv.classList.add('q-mr-xl');
    }
    mostrarInfo.value = true;

    // Mostrar notificación según el resultado
    if (result.success && result.printed) {
      Notify.create({
        type: 'positive',
        message: 'Credencial impresa exitosamente',
        position: 'top'
      });

      // Guardar en el histórico de impresión
      try {
        await axios.post(`${apiBase}/auth/credencial/historico`, {
          cedula: trabajador.value.cedula
        });
      } catch (error) {
        console.error('Error al guardar histórico:', error);
        // No mostramos error al usuario, solo lo registramos en consola
      }
    } else if (result.success && !result.printed) {
      Notify.create({
        type: 'negative',
        message: 'Impresión cancelada por el usuario',
        position: 'top'
      });
    } else {
      Notify.create({
        type: 'negative',
        message: 'Error al imprimir: ' + (result.error || 'Desconocido'),
        position: 'top'
      });
    }
  } catch (error) {
    console.error('Error en impresión Electron:', error);
    // Restaurar elementos en caso de error
    document.querySelectorAll('.q-header, .q-field, .q-btn').forEach(function(element) {
      element.style.display = '';
    });
    if (credencial) credencial.style.display = '';
    if (pageContainer) {
      pageContainer.style.paddingLeft = originalPadding;
    }
    if (mainDiv && restoreMargin) {
      mainDiv.classList.add('q-ml-xl');
      mainDiv.classList.add('q-mr-xl');
    }
    mostrarInfo.value = true;

    Notify.create({
      type: 'negative',
      message: 'Error al imprimir',
      position: 'top'
    });
  }
}

// Función para imprimir en navegador web (mantiene la lógica anterior con matchMedia)
function imprimirCredencialWeb() {
  mostrarInfo.value = false;
  window.dispatchEvent(new CustomEvent('collapse-drawer'));

  let originalPadding = '';
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

  const credencial = document.querySelector('.credencial-preview');
  if (credencial) credencial.style.display = 'block';

  const pageContainer = document.querySelector('.q-page-container');
  if (pageContainer) {
    originalPadding = pageContainer.style.paddingLeft;
    pageContainer.style.paddingLeft = '0px';
  }

  // Variable para detectar si se imprimió
  let seImprimio = false;

  // Función para restaurar elementos
  const restaurar = () => {
    document.querySelectorAll('.q-header, .q-field, .q-btn').forEach(function(element) {
      element.style.display = '';
    });
    if (credencial) credencial.style.display = '';
    if (pageContainer) {
      pageContainer.style.paddingLeft = originalPadding;
    }
    if (mainDiv && restoreMargin) {
      mainDiv.classList.add('q-ml-xl');
      mainDiv.classList.add('q-mr-xl');
    }
    mostrarInfo.value = true;
  };

  // Detectar si realmente se está imprimiendo usando matchMedia
  const mediaQueryList = window.matchMedia('print');
  const handlePrintChange = (mql) => {
    if (mql.matches) {
      seImprimio = true;
    }
  };

  mediaQueryList.addListener(handlePrintChange);

  // Listener para afterprint
  const handleAfterPrint = () => {
    restaurar();

    // Mostrar notificación según si se imprimió o se canceló (lógica invertida)
    if (!seImprimio) {
      Notify.create({
        type: 'positive',
        message: 'Credencial impresa exitosamente',
        position: 'top'
      });
      // Aquí se guardará la data en la tabla en el futuro
    } else {
      Notify.create({
        type: 'negative',
        message: 'Impresión cancelada',
        position: 'top'
      });
    }

    // Limpiar listeners
    window.removeEventListener('afterprint', handleAfterPrint);
    mediaQueryList.removeListener(handlePrintChange);
  };

  window.addEventListener('afterprint', handleAfterPrint);

  setTimeout(() => {
    window.print();
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
import { ref, computed } from 'vue'
import axios from 'axios'
import { Notify } from 'quasar'
import QrcodeVue from 'qrcode.vue'

const cedula = ref('')
const trabajador = ref(null)
const fondoUrl = '/img/frontal_carnet.png'
const apiBase = import.meta.env.VITE_API_URL || ''
const qrBaseUrl = import.meta.env.VITE_CREDENCIAL_QR_URL || 'https://intranet.minaamp.gob.ve/credenciales/cedula='

// Tamaño del QR en píxeles (aproximadamente 20mm para mejor escaneo)
const qrSize = 75

// URL completa del QR con la cédula del trabajador
const qrUrl = computed(() => {
  if (!trabajador.value || !trabajador.value.cedula) return ''
  return `${qrBaseUrl}${trabajador.value.cedula}`
})
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
  /*left: 19mm;*/
  left: 18mm;
  /*top: 28mm;*/
  top: 20mm;
  /* top: 23mm; */
  object-fit: cover;
  z-index: 2;
  border-radius: 3mm;
  border: 1px solid #888;
}
.nombre {
  position: absolute;
  top: 40mm;
  /* top: 43mm; */
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
  top: 44mm;
  /* top: 60mm; */
  left: 0;
  width: 55mm;
  text-align: center;
  font-size: 5.6mm;
  font-family: 'Georama', sans-serif;
  font-weight: 700;
  z-index: 2;
}
.franja1 {
  position: absolute;
  top: 59mm;
    background-color: yellow;
    color:rgba(0,0,0,1);
    left: 0;
  width: 55mm;
  text-align: center;
  font-size: 5.6mm;
  font-family: 'Georama', sans-serif;
  font-weight: 700;
  z-index: 3;
}
.franja2 {
  position: absolute;
  top: 59mm;
  color:#f8f8f8;
  background-color: rgb(99, 146, 248);
  left: 0;
  width: 55mm;
  text-align: center;
  font-size: 5.6mm;
  font-family: 'Georama', sans-serif;
  font-weight: 700;
  z-index: 3;
}
.franja3 {
  position: absolute;
  top: 59mm;
  color:#f8f8f8;
  background-color: rgb(248, 99, 99);
  left: 0;
  width: 55mm;
  text-align: center;
  font-size: 5.6mm;
  font-family: 'Georama', sans-serif;
  font-weight: 700;
  z-index: 3;
}
.cargo {
  position: absolute;
  top: 52mm;
  /* top: 55mm; */
  /*top: 64.52mm;*/
  left: 0;
  width: 55mm;
  text-align: center;
  font-size: 3.2mm;
  font-family: 'Georama', sans-serif;
  font-weight: 400;
  z-index: 2;
}

/* Estilos para la parte trasera de la credencial */
.credencial-trasera {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.contenido-trasero {
  width: 100%;
  height: 100%;
  padding: 4mm;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.texto-trasero {
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  padding-bottom: 2mm;
}

.parrafo-trasero {
  margin: 0;
  padding: 0 1mm;
  font-family: 'Georama', sans-serif;
  font-size: 2.3mm;
  line-height: 1.3;
  color: #2c3e50;
  text-align: justify;
  display: flex;
  align-items: flex-start;
}

.bullet {
  font-weight: 700;
  margin-right: 1.2mm;
  flex-shrink: 0;
  color: #34495e;
  font-size: 2.5mm;
}

/* Estilos para el contenedor del footer (sello y QR) */
.footer-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 2mm;
  gap: 2mm;
}

.sello-img {
  width: 100px;
  height: 100px;
  /* width: 75px;
  height: 75px; */
  object-fit: contain;
}

.qr-code {
  background: white;
  padding: 1.5mm;
  border-radius: 2mm;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

/* Ajustes para impresión */
@media print {
  .credencial-frontal {
    page-break-after: always;
  }

  .credencial-trasera {
    page-break-before: always;
  }

  /* Asegurar que ambas credenciales se impriman */
  .credencial-preview {
    display: block !important;
    visibility: visible !important;
  }
}
</style>
