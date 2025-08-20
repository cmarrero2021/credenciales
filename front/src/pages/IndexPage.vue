<template>
  <!-- (Mantener template existente sin cambios) -->
  <div class="row justify-center q-mt-md q-mb-md">
    <div class="col-auto text-center">
      <img alt="Logo" src="img/logo-nobg1.png" class="responsive-logo" />
    </div>
  </div>

  <div class="q-ml-md q-mr-md sections-wrapper">
    <div v-if="secciones.length === 0" class="text-center">
      <q-spinner-hourglass color="primary" size="3em" />
      <p>Cargando contenido...</p>
    </div>

    <div v-else class="row items-stretch no-wrap">
      <!-- (Mantener estructura de secciones existente) -->
      <div class="desktop-background" :style="backgroundStyle"></div>

      <div class="col-md-6 q-px-sm section-container" :ref="(el) => { if (el) sectionRefs[0] = el }">
        <div class="content-wrapper text-left">
          <p style="font-family: Gotham Bold;font-size:36px;">{{ secciones[0].titulo }}</p>
          <p :id="`seccion${secciones[0].orden}`" class="animated">
            {{ secciones[0].contenido }}
          </p>
        </div>
      </div>

      <div class="col-md-6 q-px-sm section-container" :ref="(el) => { if (el) sectionRefs[1] = el }">
        <div class="content-wrapper text-right">
          <p style="font-family: Gotham Bold;font-size:36px;">{{ secciones[1].titulo }}</p>
          <p :id="`seccion${secciones[1].orden}`" class="animated">
            {{ secciones[1].contenido }}
          </p>
        </div>
      </div>
    </div>
  </div>
  <div class="flex justify-center items-center" style="margin-top: 20px; gap: 60px;">
    <div class="image-container" @click="$router.push('/estadisticas')" style="cursor: pointer;">
      <img alt="Estadísticas" :src="estadisticas" style="width: 150px; height: 150px;margin-left:25px;" />
      <p style="font-weight: bold; text-align: center; margin-top: 10px;font-size:24px !important;">Estadísticas</p>
    </div>
    <div class="image-container" @click="$router.push('/revistas')" style="cursor: pointer;">
      <img alt="Publicaciones" :src="publicaciones" style="width: 150px; height: 150px;margin-left:20px;" />
      <p style="font-weight: bold; text-align: center; margin-top: 10px;font-size:24px !important;">Publicaciones</p>
    </div>
  </div>
  <div class="flex justify-center items-center"
    style="padding-bottom: 30px;padding-top: 30px; margin-top: 20px; gap: 40px; background-color: gainsboro;">
    <div class="text-center">
      <div>
        <h3
          style="font-family: Gotham Bold;font-size:48px;font-weight: bold; text-align: center; margin-top: 2px;margin-bottom:-5px; color: #273984;">
          Suscríbete
        </h3>
        <h6 style="text-align: center; color: #273984;margin-top:-10px;">
          Para recibir novedades
        </h6>
      </div>
      <div style="margin-top: -30px;">
        <q-input rounded outlined v-model="email" label="Correo electrónico"
          style="width:500px;background-color: white;border-radius: 25px !important;" class="suscribir">
          <template v-slot:append>
            <q-btn label="Enviar" color="primary" @click="enviar" :loading="loading" />
          </template>
        </q-input>
      </div>
    </div>
  </div>

  <!-- Sección de pie -->
  <div class="q-pa-xl footer-sections">
    <div class="row q-col-gutter-xs center-around footer-container">
      <div class="column footer-column">
        <q-img :src="logoBlanco" alt="Logo" />
        <div class="text-h7 q-mt-md">Síguenos</div>
        <div class="row q-gutter-md q-mt-sm">
          <q-icon name="mdi-instagram" size="30px" />
          <q-icon name="mdi-youtube" size="30px" />
        </div>
      </div>
      <div class="column footer-column">
        <div class="text-h6 q-mb-sm" style="font-family: Gotham Bold;">Enlaces</div>
        <div class="text-h7 text-white" title="Observatorio Nacional de Ciencia, Tecnología e Innovación">
          <a class="mostrar" href="https://www.oncti.gob.ve/">→
            ONCTI
          </a>
          <a class="ocultar" href="https://www.oncti.gob.ve/">→
            Observatorio Nacional de Ciencia, tecnología e Innovación
          </a>
        </div>
        <div class="text-h7 text-white" title="Observatorio en Línea">
          <a class="mostrar" href="https://observatorio.oncti.gob.ve/#/">→
            OEL
          </a>
          <a class="ocultar" href="https://observatorio.oncti.gob.ve/#/">→
            Observatorio en Línea
          </a>
        </div>
      </div>
      <div class="column footer-column">
        <div class="text-h6 q-mb-sm" style="font-family: Gotham Bold;">Novedades</div>

        <div class="row q-pa-sm" style="border: 1px solid white; border-radius: 8px; margin-bottom: 10px;">
          <div class="col-3"><q-img :src=portada1 width="50px" height="60px" /> </div>
          <div class="col-9 flex items-center">{{ revista1 }}</div>
        </div>

        <div class="row q-pa-sm" style="border: 1px solid white; border-radius: 8px;">
          <div class="col-3"><q-img :src=portada2 width="50px" height="60px" /> </div>
          <div class="col-9 flex items-center">{{ revista2 }}</div>
        </div>
      </div>
      <div class="column footer-column">
        <div class="text-h6 q-mb-sm" style="font-family: Gotham Bold;">Contactos</div>
        <div class="row items-start q-mb-sm">
          <q-img :src="ubicacionImg" style="width: 20px; height: 20px; margin-right: 8px;" />
          <div class="text-body2">
            Avenida Universidad, esquina El Chorro, <br />Torre Ministerial, piso 16,
            La Hoyada, <br /> Caracas, Distrito Capital
          </div>
        </div>
        <div class="row items-center q-mb-sm">
          <q-img :src="correoImg" style="width: 20px; height: 20px; margin-right: 8px;" />
          <div class="text-body2">Correoelectronico@gmail.com</div>
        </div>
        <q-img :src="logoOncti" style="width: 120px; margin-top: 10px;" />
      </div>
    </div>
  </div>
  <!-- Sección de pie -->
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import axios from 'axios';
import { Notify, useQuasar } from "quasar";
import socket from "src/services/websocket.js";
import fondoInicio from 'src/assets/img/fondo_inicio.png';
import estadisticas from 'src/assets/img/estadisticas.png';
import publicaciones from 'src/assets/img/publicaciones.png';
import logoBlanco from 'src/assets/img/logo_blanco.png'
import ubicacionImg from 'src/assets/img/ubicacion.png'
import correoImg from 'src/assets/img/correo.png'
import logoOncti from 'src/assets/img/logo_oncti_blanco.png'
const $q = useQuasar();
const VITE_IMAGE_INICIO_URL = import.meta.env.VITE_IMAGE_INICIO_URL;
const VITE_RECIENTES_URL = import.meta.env.VITE_RECIENTES_URL;
const VITE_IMAGE_BASE_URL = import.meta.env.VITE_IMAGE_BASE_URL;
const VITE_SC_INSERT_URL = import.meta.env.VITE_SC_INSERT_URL;
const secciones = ref([]);
const sectionRefs = ref([]);
const recientes = ref([]);
const portada1 = ref();
const portada2 = ref();
const revista1 = ref();
const revista2 = ref();
const email = ref('');
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const loading = ref(false);
//////////////
let socketMessageHandler = null;
//////////////
const CACHE_KEY = 'seccionesHomeCache';
const isValidCache = (data) => {
  return Array.isArray(data) &&
    data.length === 2 &&
    data.every(item => item.titulo && item.contenido);
};
const procesarDatos = (data) => {
  return data.sort((a, b) => a.orden - b.orden).slice(0, 2);
};
//////////////
const backgroundStyle = computed(() => ({
  backgroundImage: `url(${fondoInicio})`,
  aspectRatio: '8000 / 1855'
}));

// const cargarSecciones = async () => {
const cargarSecciones = async (usarCache = true) => {
  recientes.value = await axios.get(VITE_RECIENTES_URL);
  portadas(recientes.value);
  try {
    if (usarCache) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (isValidCache(parsed)) {
          secciones.value = parsed; // Usar parsed del caché
          return;
        }
      }
    }

    // Si no hay caché o es inválido, hacer fetch
    const response = await axios.get(VITE_IMAGE_INICIO_URL);
    const procesadas = procesarDatos(response.data); // Variable local al bloque
    secciones.value = procesadas;
    localStorage.setItem(CACHE_KEY, JSON.stringify(procesadas));
  } catch (error) {
    console.error('Error:', error);
    if (!secciones.value.length) { // Verificar si no hay datos
      Notify.create({ message: "Error al cargar", color: "negative" });
    }
  }
};

const configurarObserver = () => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("visible", entry.isIntersecting);
        entry.target.classList.toggle("inactive", !entry.isIntersecting);
      });
    },
    { threshold: 0.1 }
  );

  sectionRefs.value.forEach((section) => section && observer.observe(section));
};

const enviar = async () => {
  if (!email.value) {
    Notify.create({
      message: 'El campo correo es requerido',
      color: 'negative'
    });
    return;
  }

  if (!emailRegex.test(email.value)) {
    Notify.create({
      message: 'El formato del correo electrónico no es válido',
      color: 'negative'
    });
    return;
  }
  loading.value = true;
  try {
    const response = await axios.post(VITE_SC_INSERT_URL, {
      correo: email.value
    });
    Notify.create({
      message: response.data.length > 0 ? response.data : "Correo ya registrado",
      color: response.status === 201 ? 'positive' : 'negative'
    });

    if (response.status === 201) {
      email.value = '';
    }
  } catch (error) {
    const status = error.response?.status;
    const message = error.response?.data?.mensaje || 'Error al enviar el correo';

    Notify.create({
      message: message,
      color: [400, 500].includes(status) ? 'negative' : 'negative'
    });
  } finally {
    loading.value = false;
  }
};
const portadas = (portadas) => {
  portada1.value = VITE_IMAGE_BASE_URL + portadas.data[0].portada;
  portada2.value = VITE_IMAGE_BASE_URL + portadas.data[1].portada;
  revista1.value = portadas.data[0].revista;
  revista2.value = portadas.data[1].revista;
}
onMounted(async () => {
  await cargarSecciones(true);
  configurarObserver();
  socketMessageHandler = async () => {
    try {
      await cargarSecciones(false);
      // Notify.create({ message: "Contenido actualizado", color: "positive" });
    } catch (error) {
      console.error('Error en WebSocket:', error);
    }
  };
  socket.addEventListener("message", socketMessageHandler);
  // socket.addEventListener("message", async () => {
  //   try {
  //     // await cargarSecciones(false);
  //     await cargarSecciones();
  //     Notify.create({ message: "Contenido actualizado", color: "positive", timeout: 2000 });
  //   } catch (error) {
  //     console.error('Error en WebSocket:', error);
  //     Notify.create({ message: "Error al actualizar", color: "negative", timeout: 3000 });
  //   }
  // });
});
onUnmounted(() => {
  if (socketMessageHandler) {
    socket.removeEventListener("message", socketMessageHandler); // <-- Eliminar con misma referencia
    socketMessageHandler = null;
  }
});
</script>

<style scoped>
.sections-wrapper {
  position: relative;
}

.responsive-logo {
  width: 100%;
  max-width: 500px;
  height: auto;
  padding: 0 20px;
}

.desktop-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  z-index: 0;
  display: none;
}

.section-container {
  position: relative;
  z-index: 1;
  min-height: 300px;
  display: flex;
  align-items: center;
}

.content-wrapper {
  padding: 30px;
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  width: 100%;
}

.animated {
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.6s ease-out;
}

.visible .animated {
  opacity: 1;
  transform: translateY(0);
}

.footer-sections {
  background-color: #243b86;
  color: white;
}

.footer-container {
  display: flex;
  justify-content: center;
  gap: 5px;
  margin: 0 auto;
  max-width: 1200px;
  padding: 0 40px;
}

.footer-column {
  min-width: 200px;
  position: relative;
}

a {
  color: white;
  text-decoration: none;
  /* Opcional: para quitar la subrayado por defecto */
}

/* Estilo para los enlaces visitados */
a:visited {
  color: white;
}

.mostrar {
  display: block;
}

.ocultar {
  display: none;
}

@media (min-width: 768px) {
  .suscribir {
    width: 400px;
  }

  .desktop-background {
    display: block;
  }

  .sections-wrapper {
    overflow: hidden;
    border-radius: 12px;
    padding: 0 10px;
  }

  .row.no-wrap {
    margin: 0 -5px;
  }

  .section-container {
    width: calc(50% - 10px);
    margin: 0 5px;
    padding: 0;
  }

  .content-wrapper {
    width: 95%;
    padding: 25px;
  }

  .section-container:first-child .content-wrapper {
    margin-right: -5%;
    padding-right: 30px;
  }

  .section-container:last-child .content-wrapper {
    margin-left: -5%;
    padding-left: 30px;
  }

  .footer-container {
    flex-direction: row;
  }

  .footer-column:nth-child(1) {
    flex: 0 0 2%;
  }

  .footer-column:nth-child(2) {
    flex: 0 0 1%;
    padding-left: 20px;
    margin-right: -40px;
  }

  .footer-column:nth-child(3) {
    flex: 0 0 25%;
    margin-right: 20px !important;
  }

  .footer-column:nth-child(4) {
    flex: 0 0 30%;
  }

  .footer-column:nth-child(1) .content-wrapper {
    margin-left: 0 !important;
    margin-right: auto !important;
    width: 100% !important;
    text-align: left !important;
  }


}

@media (max-width: 400px) {
  .suscribir {
    width: 300px !important;
  }
}

@media (max-width: 767px) {
  .row.no-wrap {
    flex-wrap: wrap !important;
  }

  .mostrar {
    display: none;
  }

  .ocultar {
    display: block;
  }

  .section-container {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 0 20px 0 !important;
  }

  .sections-wrapper {
    background-color: #273984;
    padding: 15px !important;
  }

  .content-wrapper {
    text-align: left !important;
    padding: 20px 15px !important;
  }

  .section-container:last-child {
    margin-bottom: 0 !important;
  }

  .footer-container {
    flex-direction: column;
    padding: 0;
  }

  .footer-column {
    margin-bottom: 20px;
    width: 100%;
  }
}

.container {
  max-width: 1000px;
  margin: auto;
  padding: 20px;
}

.title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 20px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
}

.table th,
.table td {
  border: 1px solid #ccc;
  padding: 10px;
  text-align: left;
}

.table th {
  background-color: #f5f5f5;
}

.actions {
  display: flex;
  gap: 10px;
}

.button {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.button.edit {
  background-color: #4CAF50;
  color: white;
}

.button.delete {
  background-color: #f44336;
  color: white;
}

.button.add {
  background-color: #2196F3;
  color: white;
  margin-bottom: 10px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 5px;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 8px;
  box-sizing: border-box;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.error {
  color: red;
  font-size: 12px;
  margin-top: 5px;
}

.modal {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  max-width: 600px;
  margin: auto;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.modal-header {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 15px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.hidden {
  display: none;
}
</style>
