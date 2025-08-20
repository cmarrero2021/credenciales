<template>
  <q-page class="q-pa-md">
    <!-- Cabecera de la página -->
    <header class="page-header">
    </header>
    <!-- Filtro Drawer -->
    <FilterDrawer v-model="drawerVisible" :filters="filters" :areas-conocimiento="areasConocimiento"
      :revistas-indices="revistasIndices" :revistas-idiomas="revistasIdiomas" :revistas-editorial="revistasEditorial"
      :revistas-periodicidad="revistasPeriodicidad" :revistas-formato="revistasFormato"
      :revistas-estado="revistasEstado" @filter-changed="handleFilterChange" />
    <!-- Contenido principal -->
    <main class="main-content">
      <!-- Tarjetas de Revistas -->
      <div class="revistas-container">
        <div v-if="filteredRevistas.length > 0">
          <div class="row q-gutter-md justify-center">
            <q-card v-for="revista in paginatedRevistas" :key="revista.id" class="my-card col-md-3 col-sm-6 col-xs-12"
              @click="openDialog(revista)">
              <q-img :src="`${imageBaseUrl}${revista.portada}`" :alt="revista.portada" />
              <q-card-section>
              </q-card-section>
            </q-card>
          </div>
          <!-- Paginación -->
          <div class="q-mt-md flex flex-center">
            <q-pagination v-model="pagination.page" :max="totalPages" :max-pages="10" direction-links boundary-links
              class="q-mt-md flex flex-center" />
          </div>
        </div>
        <div v-else class="no-results">
          <p>No se encontraron revistas que coincidan con los filtros seleccionados.</p>
        </div>
      </div>
    </main>
    <!-- Diálogo para mostrar detalles -->
    <q-card-section class="scrollable-content" ref="dialogContent">
      <q-dialog v-model="dialogVisible" :maximized="isMaximized" transition-show="scale" transition-hide="fade">
        <q-card class="custom-dialog">
          <!-- Toolbar -->
          <q-toolbar class="bg-primary text-white">
            <q-toolbar-title class="text-center text-responsive">
              Seguimiento y Movilización Electoral MINAAMP
            </q-toolbar-title>
            <q-btn :icon="isMaximized ? 'fullscreen_exit' : 'fullscreen'" flat round dense @click="toggleMaximized"
              :title="isMaximized ? 'Salir de pantalla completa' : 'Pantalla completa'" />
            <q-btn icon="picture_as_pdf" :loading="loading" :disable="loading" flat round dense @click="exportToPdf"
              title="Exportar a PDF">
              <template v-slot:loading>
                <q-spinner-hourglass class="on-left" />
                Generando...
              </template>
            </q-btn>
            <q-btn icon="close" flat round dense @click="dialogVisible = false" />
          </q-toolbar>
          <!-- Contenido del diálogo con scroll -->
          <q-card-section class="scrollable-content" ref="dialogContent">
            <div>
              <div>
                <q-img src="img/cintillo.jpg" />
              </div>
            </div>
            <div v-if="selectedRevista" class="row q-col-gutter-md" id="contenidoRevista">
              <!-- Columna de la Imagen -->
              <div class="col-xs-12 col-sm-4 col-md-4">
                <q-img :src="`${imageBaseUrl}${selectedRevista.portada}`" :alt="`Portada de ${selectedRevista.revista}`"
                  class="portada-img" style="height: 100%; object-fit: cover;" />
              </div>
              <!-- Columna de Información -->
              <div class="col-xs-12 col-sm-8 col-md-8">
                <div class="row q-col-gutter-sm">
                  <!-- Primera Columna -->
                  <div class="col-6">
                    <template v-for="(value, key, index) in Object.fromEntries(
                      Object.entries(selectedRevista).filter(([key]) => !['portada', 'resumen', 'id'].includes(key))
                    )" :key="key">
                      <div v-if="index < Math.ceil(Object.keys(Object.fromEntries(
                        Object.entries(selectedRevista).filter(([key]) => !['portada', 'resumen', 'id'].includes(key))
                      )).length / 2)" class="q-mb-sm">
                        <div class="etq">{{ key.toUpperCase().replace(/_/g, ' ') }}</div>
                        <div class="contenido">{{ value ?? '' }}</div>
                      </div>
                    </template>
                  </div>
                  <!-- Segunda Columna -->
                  <div class="col-6">
                    <template v-for="(value, key, index) in Object.fromEntries(
                      Object.entries(selectedRevista).filter(([key]) => !['portada', 'resumen', 'id'].includes(key))
                    )" :key="key">
                      <div v-if="index >= Math.ceil(Object.keys(Object.fromEntries(
                        Object.entries(selectedRevista).filter(([key]) => !['portada', 'resumen', 'id'].includes(key))
                      )).length / 2)" class="q-mb-sm">
                        <div class="etq">{{ key.toUpperCase().replace(/_/g, ' ') }}</div>
                        <div class="contenido">{{ value ?? '' }}</div>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>
            <!-- Contenedor para el Resumen -->
            <div class="col-12 q-mt-lg">
              <div v-if="selectedRevista.resumen" class="resumen-container">
                <label class="resumen-title">RESÚMEN</label>
                <div class="resumen-content" v-html="selectedRevista.resumen"></div>
              </div>
              <div v-else class="resumen-container">
                <label class="resumen-title">RESÚMEN</label>
                <div class="resumen-content"></div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </q-dialog>
    </q-card-section>
  </q-page>
</template>
<script setup>
import { ref, computed, onMounted, watch, nextTick } from "vue";
import axios from "axios";
import { Notify } from "quasar";
import FilterDrawer from "components/FilterDrawer.vue";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
const imageBaseUrl = ref("");
const revistas = ref([]);
const dialogContent = ref(null);
const isMaximized = ref(false);
const toggleMaximized = () => {
  isMaximized.value = !isMaximized.value;
};
const filters = ref({
  revista: "",
  area_conocimiento: [],
  indice: [],
  idioma: [],
  editorial: [],
  periodicidad: [],
  formato: [],
  estado: [],
  issn_digital: "",
  issn_impreso: "",
  deposito_legal_digital: "",
  deposito_legal_impreso: "",
});
const pagination = ref({
  page: 1,
  rowsPerPage: 10,
});
const dialogVisible = ref(false);
const selectedRevista = ref(null);
const areasConocimiento = ref([]);
const revistasIndices = ref([]);
const revistasIdiomas = ref([]);
const revistasEditorial = ref([]);
const revistasPeriodicidad = ref([]);
const revistasFormato = ref([]);
const revistasEstado = ref([]);
const loading = ref(false);
// Watcher para controlar la paginación
watch(pagination, (newVal) => {
  if (newVal.page > totalPages.value) {
    pagination.value.page = Math.max(1, totalPages.value);
  }
}, { deep: true });
// Obtener datos de la API
onMounted(async () => {
  try {
    const apiUrl = import.meta.env.VITE_API_URL;
    const response = await axios.get(apiUrl);
    revistas.value = response.data;
    imageBaseUrl.value = import.meta.env.VITE_IMAGE_BASE_URL;
  } catch (error) {
    console.error("Error fetching data:", error);
  }
  try {
    const areasUrl = import.meta.env.VITE_AREASR_BASE_URL;
    const areasResponse = await axios.get(areasUrl);
    areasConocimiento.value = areasResponse.data.map((area) => ({
      label: area.area_conocimiento,
      value: area.area_conocimiento,
    }));
  } catch (error) {
    console.error("Error fetching areas:", error);
  }
  try {
    const indicesUrl = import.meta.env.VITE_INDICESR_BASE_URL;
    const indicesResponse = await axios.get(indicesUrl);
    revistasIndices.value = indicesResponse.data.map((indice) => ({
      label: indice.indice,
      value: indice.indice,
    }));
  } catch (error) {
    console.error("Error fetching indices:", error);
  }
  try {
    const idiomasUrl = import.meta.env.VITE_IDIOMASR_BASE_URL;
    const idiomasResponse = await axios.get(idiomasUrl);
    revistasIdiomas.value = idiomasResponse.data.map((idioma) => ({
      label: idioma.idioma,
      value: idioma.idioma,
    }));
  } catch (error) {
    console.error("Error fetching languages:", error);
  }
  try {
    const editorialUrl = import.meta.env.VITE_EDITORIALR_BASE_URL;
    const editorialResponse = await axios.get(editorialUrl);
    revistasEditorial.value = editorialResponse.data.map((editorial) => ({
      label: editorial.editorial,
      value: editorial.editorial,
    }));
  } catch (error) {
    console.error("Error fetching editorial:", error);
  }
  try {
    const periodicidadUrl = import.meta.env.VITE_PERIODICIDADR_BASE_URL;
    const periodicidadResponse = await axios.get(periodicidadUrl);
    revistasPeriodicidad.value = periodicidadResponse.data.map(
      (periodicidad) => ({
        label: periodicidad.periodicidad,
        value: periodicidad.periodicidad,
      })
    );
  } catch (error) {
    console.error("Error fetching periodicity:", error);
  }
  try {
    const formatoUrl = import.meta.env.VITE_FORMATOR_BASE_URL;
    const formatoResponse = await axios.get(formatoUrl);
    revistasFormato.value = formatoResponse.data.map((formato) => ({
      label: formato.formato,
      value: formato.formato,
    }));
  } catch (error) {
    console.error("Error fetching formats:", error);
  }
  try {
    const estadoUrl = import.meta.env.VITE_ESTADOR_BASE_URL;
    const estadoResponse = await axios.get(estadoUrl);
    revistasEstado.value = estadoResponse.data.map((estado) => ({
      label: estado.estado,
      value: estado.estado,
    }));
  } catch (error) {
    console.error("Error fetching states:", error);
  }
});
const filteredRevistas = computed(() => {
  return revistas.value.filter((revista) => {
    if (!revista.portada) return false; // Nueva condición para portadas inválidas
    return (
      revista.revista.toLowerCase().includes(filters.value.revista.toLowerCase()) &&
      (filters.value.area_conocimiento.length === 0 ||
        filters.value.area_conocimiento.includes(revista.area_conocimiento)) &&
      (filters.value.indice.length === 0 ||
        filters.value.indice.includes(revista.indice)) &&
      (filters.value.idioma.length === 0 ||
        filters.value.idioma.includes(revista.idioma)) &&
      (filters.value.editorial.length === 0 ||
        filters.value.editorial.includes(revista.editorial)) &&
      (filters.value.periodicidad.length === 0 ||
        filters.value.periodicidad.includes(revista.periodicidad)) &&
      (filters.value.formato.length === 0 ||
        filters.value.formato.includes(revista.formato)) &&
      (filters.value.estado.length === 0 ||
        filters.value.estado.includes(revista.estado)) &&
      (filters.value.issn_digital === "" ||
        (revista.issn_digital && revista.issn_digital.toLowerCase().includes(filters.value.issn_digital.toLowerCase()))) &&
      (filters.value.issn_impreso === "" ||
        (revista.issn_impreso && revista.issn_impreso.toLowerCase().includes(filters.value.issn_impreso.toLowerCase()))) &&
      (filters.value.deposito_legal_digital === "" ||
        (revista.deposito_legal_digital && revista.deposito_legal_digital.toLowerCase().includes(filters.value.deposito_legal_digital.toLowerCase()))) &&
      (filters.value.deposito_legal_impreso === "" ||
        (revista.deposito_legal_impreso && revista.deposito_legal_impreso.toLowerCase().includes(filters.value.deposito_legal_impreso.toLowerCase())))
    );
  });
});
// Paginación
const paginatedRevistas = computed(() => {
  const start = (pagination.value.page - 1) * pagination.value.rowsPerPage;
  const end = start + pagination.value.rowsPerPage;
  return filteredRevistas.value.slice(start, end);
});
const totalPages = computed(() => {
  return Math.ceil(
    filteredRevistas.value.length / pagination.value.rowsPerPage
  );
});
// Abrir diálogo con los detalles de la revista
const openDialog = (revista) => {
  selectedRevista.value = revista;
  dialogVisible.value = true;
  // setTimeout(() => {
  //   const cintilloImage = document.querySelectorAll("img[src='img/cintillo.png']");
  //   cintilloImage.forEach(cintillo => {
  //     cintillo.style.display = 'none';
  //   });
  // }, 100);
};

// Generar PDF
const exportToPdf = async () => {
  loading.value = true;
  if (!selectedRevista.value) {
    Notify.create({
      message: "No hay datos disponibles para exportar.",
      color: "negative",
      timeout: 3000,
    });
    loading.value = false;
    return;
  }
  try {
    // Referencia al contenedor del diálogo
    if (!dialogContent.value) {
      console.error("El contenedor del diálogo no está disponible.");
      return;
    } else {
      console.log(dialogContent.value)
    }
    // Acceder al nodo DOM real usando $el
    const dialogElement = dialogContent.value.$el;
    // Desactivar el scroll temporalmente para capturar todo el contenido
    const originalOverflow = dialogElement.style.overflow;
    dialogElement.style.overflow = "visible";
    // Usar html2canvas para capturar el contenido completo
    const canvas = await html2canvas(dialogElement, {
      scale: 2, // Aumenta la calidad de la imagen
      useCORS: true, // Permite cargar imágenes externas
    });
    // Ocultar el cintillo nuevamente después de capturar el contenido
    // Restaurar el scroll original
    dialogElement.style.overflow = originalOverflow;
    // Convertir el canvas a una imagen
    const imgData = canvas.toDataURL("image/png");
    // Crear el PDF
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });
    // Calcular las dimensiones del PDF
    const imgWidth = pdf.internal.pageSize.getWidth();
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    // Agregar la imagen al PDF
    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    // Generar el nombre del archivo
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const fileName = `${timestamp}_${selectedRevista.value.revista.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    // Guardar el PDF
    pdf.save(fileName);
  } catch (error) {
    console.error("Error al generar el PDF:", error);
    Notify.create({
      message: "Error al generar el PDF",
      color: "negative",
      timeout: 3000,
    });
  } finally {
    loading.value = false;
  }
};
const handleFilterChange = (newFilters) => {
  const oldFilters = JSON.stringify(filters.value);
  const newFiltersStr = JSON.stringify(newFilters);
  if (oldFilters === newFiltersStr) return;
  // Congelar temporalmente la reactividad
  const frozenNewFilters = JSON.parse(newFiltersStr);
  // Actualización atómica de filtros
  const updatedFilters = {
    revista: String(frozenNewFilters.revista || ''),
    issn_digital: String(frozenNewFilters.issn_digital || ''),
    issn_impreso: String(frozenNewFilters.issn_impreso || ''),
    deposito_legal_digital: String(frozenNewFilters.deposito_legal_digital || ''),
    deposito_legal_impreso: String(frozenNewFilters.deposito_legal_impreso || ''),
    area_conocimiento: Array.isArray(frozenNewFilters.area_conocimiento)
      ? [...frozenNewFilters.area_conocimiento]
      : [],
    indice: Array.isArray(frozenNewFilters.indice)
      ? [...frozenNewFilters.indice]
      : [],
    idioma: Array.isArray(frozenNewFilters.idioma)
      ? [...frozenNewFilters.idioma]
      : [],
    editorial: Array.isArray(frozenNewFilters.editorial)
      ? [...frozenNewFilters.editorial]
      : [],
    periodicidad: Array.isArray(frozenNewFilters.periodicidad)
      ? [...frozenNewFilters.periodicidad]
      : [],
    formato: Array.isArray(frozenNewFilters.formato)
      ? [...frozenNewFilters.formato]
      : [],
    estado: Array.isArray(frozenNewFilters.estado)
      ? [...frozenNewFilters.estado]
      : []
  };
  // Actualización única y atómica
  filters.value = updatedFilters;
  // Paginación condicional
  if (pagination.value.page !== 1) {
    pagination.value.page = 1;
  }
};
</script>
<style scoped>
.q-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  text-align: center;
  margin-bottom: 30px;
}

.page-header h1 {
  color: #333;
  margin-bottom: 10px;
}

.page-header p {
  color: #666;
  font-size: 1.1em;
}

.main-content {
  display: flex;
  gap: 20px;
}

.revistas-container {
  flex: 1;
}

.my-card {
  width: 75%;
  max-width: 200px;
  cursor: pointer;
}

.my-card .q-img {
  height: 250px;
  object-fit: cover;
}

.my-card .text-h6 {
  font-size: 1.1em;
  margin-bottom: 5px;
}

.my-card .text-subtitle2 {
  font-size: 0.9em;
  color: #666;
}

.my-card .text-caption {
  font-size: 0.8em;
  color: #888;
}

.q-pagination {
  margin-top: 20px;
}

.no-results {
  text-align: center;
  padding: 40px 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.no-results p {
  color: #666;
  font-size: 1.1em;
}

.custom-dialog {
  width: 100%;
  max-width: 1200px;
  margin: auto;
  position: relative;
  z-index: 7000;
  border-radius: 10px !important;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.q-dialog__inner--maximized .custom-dialog {
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  border-radius: 0 !important;
  margin: 0 !important;
}

.scrollable-content {
  height: 100%;
  flex: 1;
  overflow-y: auto;
}

.portada-img {
  height: 200px;
  object-fit: cover;
}

.text-responsive {
  font-size: 1.2rem;
}

.etq {
  font-size: 10px;
  font-weight: bolder;
}

.contenido {
  font-size: 10px;
}

.q-field {
  margin-bottom: -25px;
  font-size: 10px;
  width: 100%;
}

.resumen-title {
  margin-bottom: 12px;
  font-size: 12px;
  font-weight: bold;
  color: #333;
}

.resumen-content {
  font-size: 10px;
  line-height: 1.6;
  color: #555;
  white-space: pre-wrap;
}

.scrollable-content {
  overflow-y: auto;
}

@media (max-width: 599px) {
  .text-responsive {
    font-size: 1rem;
  }

  .my-card {
    width: 75%;
    max-width: 200px;
    cursor: pointer;
  }

  .my-card .q-img {
    height: 300px;
    object-fit: cover;
  }
}

@media (max-width: 399px) {
  .text-responsive {
    font-size: 0.9rem;
  }
}
</style>
