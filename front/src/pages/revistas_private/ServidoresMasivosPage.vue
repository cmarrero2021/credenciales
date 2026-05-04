<template>
  <div class="self-centerq-pa-md">
      <div class="image-container">
        <img class="responsive-image" src="/img/logo_nobg1.png" alt="Electoral MINAAMP - INASS" />
      </div>

    <div class="row justify-center">
      <h4 class="q-mb-md text-center" style="font-weight:bold;">CARGA MASIVA DE SERVIDORES</h4>
    </div>

    <!-- Subir archivo CSV / XLSX con todos los campos -->
    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-md-6 q-mx-auto">
        <div class="text-subtitle q-mb-xs">Subir archivo CSV / XLSX con todos los campos</div>
        <q-file v-model="selectedFile" accept=".csv, .xls, .xlsx" filled label="Seleccionar archivo CSV/XLSX" />
        <div class="row justify-center q-mt-sm">
          <q-btn color="primary" label="Procesar archivo" @click="procesarArchivo" :loading="loadingFile" :disable="!selectedFile" />
          <q-btn flat color="secondary" label="Descargar ejemplo" class="q-ml-sm" @click="descargarEjemplo" />
        </div>
      </div>
    </div>

    <!-- Resultados - Se muestra solo si hay datos -->
    <template v-if="resultados">
      <div class="text-h6 q-mb-sm">Resultados del procesamiento</div>

      <!-- Contenedor responsive para los resultados -->
      <div class="row q-col-gutter-md">
        <!-- Cédulas actualizadas -->
        <div class="col-xs-12 col-md-4">
          <div class="text-positive">
            Actualizadas: {{ resultados.actualizadas.cantidad }}
          </div>
          <q-input
            v-model="cedulasActualizadas"
            type="textarea"
            autogrow
            filled
            readonly
            label="Cédulas actualizadas"
            class="q-mt-xs"
          />
        </div>

        <!-- Cédulas rechazadas -->
        <div class="col-xs-12 col-md-4">
          <div class="text-negative">
            Rechazadas: {{ resultados.rechazadas.cantidad }}
          </div>
          <q-input
            v-model="cedulasRechazadas"
            type="textarea"
            autogrow
            filled
            readonly
            label="Cédulas rechazadas"
            class="q-mt-xs"
          />
        </div>

        <!-- Cédulas previamente cargadas -->
        <div class="col-xs-12 col-md-4">
          <div class="text-warning">
            Previamente cargadas: {{ resultados.previamente_cargadas.cantidad }}
          </div>
          <q-input
            v-model="cedulasPreviamenteCargadas"
            type="textarea"
            autogrow
            filled
            readonly
            label="Cédulas ya existentes"
            class="q-mt-xs"
          />
        </div>
      </div>

      <!-- Resumen total -->
      <div class="text-subtitle1 q-mt-md">
        Total procesadas: {{ resultados.total_procesadas || resultados.total_procesadas }}
      </div>
    </template>

    <!-- Notificación de éxito/error -->
    <q-dialog v-model="showDialog" persistent>
      <q-card>
        <q-card-section>
          <div class="text-h6">{{ dialogTitle }}</div>
        </q-card-section>

        <q-card-section>
          {{ dialogMessage }}
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="OK" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import axios from 'axios';
import * as XLSX from 'xlsx';

const $q = useQuasar();

// Estado del componente
const resultados = ref(null);
const showDialog = ref(false);
const dialogTitle = ref('');
const dialogMessage = ref('');

// Archivo seleccionado para carga masiva completa
const selectedFile = ref(null);
const loadingFile = ref(false);

// Endpoint para inserción individual (se usa para insertar cada fila del archivo)
const insertServerURL = import.meta.env.VITE_IN_SERVER_URL;

// Endpoints para catálogos (usados para resolver nombres -> ids)
const institucionesURL = import.meta.env.VITE_LS_INSTITUTIONS_URL;
const sedesURL = import.meta.env.VITE_LS_SEDES_URL;
const areasURL = import.meta.env.VITE_LS_AREAS_URL;
const cargosURL = import.meta.env.VITE_MP_ESTADOSS_URL || import.meta.env.VITE_LS_CARGOS_URL;

// Mapas de resolución: nombre normalizado -> id
const institucionMap = ref({});
const sedeMap = ref({});
const areaMap = ref({});
const cargoMap = ref({});

const normalizeName = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

const buildLookup = (arr) => {
  const map = {};
  if (!Array.isArray(arr)) return map;
  for (const item of arr) {
    if (!item) continue;
    // posibles campos de nombre y id
    const name = item.institucion || item.sede || item.area || item.cargo || item.nombre || item.label || item.name || '';
    const id = item.id ?? item.area_id ?? item.institucion_id ?? item.value ?? item.cargo_id ?? null;
    if (name && id != null) map[normalizeName(name)] = id;
  }
  return map;
};

const fetchLookups = async () => {
  try {
    if (institucionesURL) {
      const r = await axios.get(institucionesURL);
      institucionMap.value = buildLookup(r.data);
    }
    if (sedesURL) {
      const r = await axios.get(sedesURL);
      sedeMap.value = buildLookup(r.data);
    }
    if (areasURL) {
      const r = await axios.get(areasURL);
      areaMap.value = buildLookup(r.data);
    }
    if (cargosURL) {
      const r = await axios.get(cargosURL);
      cargoMap.value = buildLookup(r.data);
    }
  } catch (e) {
    console.error('Error fetching lookups for massive upload', e);
  }
};

// Computed properties para los resultados
const cedulasActualizadas = computed(() => {
  return resultados.value?.actualizadas.cedulas?.join(', ') || '';
});

const cedulasRechazadas = computed(() => {
  return resultados.value?.rechazadas.cedulas?.join(', ') || '';
});

const cedulasPreviamenteCargadas = computed(() => {
  return resultados.value?.previamente_cargadas.cedulas?.join(', ') || '';
});



// Procesar archivo CSV / XLSX con registros completos
const procesarArchivo = async () => {
  if (!selectedFile.value) return;
  loadingFile.value = true;
  resultados.value = null;
  const file = selectedFile.value;
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!Array.isArray(raw) || raw.length === 0) throw new Error('Archivo sin filas');

    // Normalizar y mapear campos esperados
    const normalizeKey = (k) => String(k || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '_');
    const mapped = raw.map((row) => {
      const out = {};
      for (const key of Object.keys(row)) {
        const n = normalizeKey(key);
        out[n] = String(row[key]).trim();
      }
      return out;
    });

    const results = { actualizadas: { cantidad: 0, cedulas: [] }, rechazadas: { cantidad: 0, cedulas: [] }, previamente_cargadas: { cantidad: 0, cedulas: [] }, total_procesadas: 0 };

    for (const r of mapped) {
      // Buscar campos claves en varias formas
      const ced = r.cedula || r.cedula_rif || r.ci || r.cedula_persona || '';
      if (!ced) {
        results.rechazadas.cedulas.push('(sin cédula)');
        results.rechazadas.cantidad++;
        continue;
      }

      const nombres = r.nombres || r.nombre || r.nombre_persona || '';
      const apellidos = r.apellidos || r.apellido || '';
      const institucion = r.institucion || r.institucion_nombre || r.insti || '';
      const sede = r.sede || r.sede_nombre || '';
      const area = r.adscripcion || r.adscripcion_nombre || r.area || '';
      const cargo = r.cargo || '';

      const formData = new FormData();
      formData.append('cedula', ced);
      formData.append('nombres', (nombres || '').toUpperCase());
      formData.append('apellidos', (apellidos || '').toUpperCase());
      // Resolver nombres -> ids cuando sea posible; si no se encuentra id, enviar el nombre tal cual
      try {
        const instId = institucion ? institucionMap.value[normalizeName(institucion)] : null;
        const sedeId = sede ? sedeMap.value[normalizeName(sede)] : null;
        const areaId = area ? areaMap.value[normalizeName(area)] : null;
        const cargoId = cargo ? cargoMap.value[normalizeName(cargo)] : null;

        if (instId != null) formData.append('institucion_id', instId); else if (institucion) formData.append('institucion', institucion);
        if (sedeId != null) formData.append('sede_id', sedeId); else if (sede) formData.append('sede', sede);
        if (areaId != null) formData.append('area_id', areaId); else if (area) formData.append('area', area);
        if (cargoId != null) formData.append('cargo_id', cargoId); else if (cargo) formData.append('cargo', cargo);
      } catch (e) {
        // Fallback: enviar nombres si ocurre algo
        if (institucion) formData.append('institucion', institucion);
        if (sede) formData.append('sede', sede);
        if (area) formData.append('area', area);
        if (cargo) formData.append('cargo', cargo);
      }

      try {
        // Enviar como multipart/form-data igual que la inserción individual
        const resp = await axios.post(insertServerURL, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        results.actualizadas.cedulas.push(ced);
        results.actualizadas.cantidad++;
      } catch (err) {
        const status = err?.response?.status;
        if (status === 409) {
          results.previamente_cargadas.cedulas.push(ced);
          results.previamente_cargadas.cantidad++;
        } else {
          results.rechazadas.cedulas.push(ced + (err?.response?.data?.error ? `: ${err.response.data.error}` : ''));
          results.rechazadas.cantidad++;
        }
      }
      results.total_procesadas = results.actualizadas.cantidad + results.rechazadas.cantidad + results.previamente_cargadas.cantidad;
    }

    resultados.value = results;
    showDialog.value = true;
    dialogTitle.value = 'Carga masiva finalizada';
    dialogMessage.value = `Procesadas ${results.total_procesadas} filas: ${results.actualizadas.cantidad} creadas, ${results.previamente_cargadas.cantidad} ya existentes, ${results.rechazadas.cantidad} errores.`;
  } catch (error) {
    console.error('Error procesando archivo:', error);
    showDialog.value = true;
    dialogTitle.value = 'Error al procesar archivo';
    dialogMessage.value = error.message || 'Error procesando el archivo';
  } finally {
    loadingFile.value = false;
    // limpiar selección para evitar re-envío accidental
    selectedFile.value = null;
  }
};

// Descargar CSV ejemplo alojado en el workspace
const descargarEjemplo = () => {
  try {
    const url = new URL('../../assets/ejemplo_carga.csv', import.meta.url).href;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ejemplo_carga.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    console.error('Error descargando ejemplo', e);
    // Fallback: abrir en nueva pestaña
    window.open('/src/assets/ejemplo_carga.csv', '_blank');
  }
};



onMounted(() => {
  // precargar catálogos para resolución nombres -> ids
  fetchLookups();
});
</script>

<style scoped>
.image-container {
  width: 100%;
  max-width: 666px;
  height: auto;
  display: flex;
  justify-content: left;
  align-items: left;
}

.responsive-image {
  width: 25%;
  height: auto;
  max-width: 100%;
  max-height: 375px;
}
</style>
