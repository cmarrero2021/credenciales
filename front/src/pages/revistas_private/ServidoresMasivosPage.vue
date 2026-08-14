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
          <q-btn flat color="orange" label="Ver errores" class="q-ml-sm" @click="openErrorsModal" />
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
    <!-- Modal para mostrar errores de carga masiva (servidores) -->
    <q-dialog v-model="errorsModal" maximized>
      <q-card style="min-width: 600px; max-width: 90vw;">
        <q-card-section class="q-pb-none">
          <div class="text-h6">Errores - Carga Masiva de Servidores</div>
          <div class="text-subtitle2 q-mt-sm">Último resumen:</div>
          <div v-if="latestSummary" class="q-mt-xs">
            <div>Generado: {{ new Date(latestSummary.created_at || latestSummary.generated_at).toLocaleString() }}</div>
            <div>Usuario: {{ latestSummary.user_id || '-' }}</div>
            <div>Total archivos con error: <strong>{{ errorsList.length }}</strong></div>
          </div>
          <div v-else class="text-caption q-mt-sm">No hay resumen disponible.</div>
        </q-card-section>

        <q-card-section>
          <div class="row items-center q-gutter-sm q-mb-sm">
            <div class="col">
              <q-input dense debounce="300" v-model="searchErrors" placeholder="Buscar por nombre de archivo o usuario..." clearable outlined />
            </div>
            <div class="col-auto">
              <q-btn dense flat icon="refresh" label="Refrescar" @click="fetchErrors" />
            </div>
          </div>
          <div class="text-caption text-grey-6 q-mb-sm">Haz clic en el nombre del archivo para ver el historial completo de intentos fallidos.</div>
          <q-table
            :rows="filteredErrors"
            :columns="[
              { name: 'created_at', label: 'Fecha y Hora', field: 'created_at', align: 'center', sortable: true },
              { name: 'file_name', label: 'Archivo (clic para ver historial)', field: 'file_name', align: 'center', sortable: true },
              { name: 'user_id', label: 'Usuario', field: 'user_id', align: 'center' }
            ]"
            row-key="id"
            dense
            v-model:pagination="errorsPagination"
            :rows-per-page-options="[5,10,20,50]"
          >
            <template v-slot:body-cell-created_at="props">
              <q-td :props="props" class="text-center">
                {{ new Date(props.row.created_at).toLocaleString() }}
              </q-td>
            </template>
            <template v-slot:body-cell-file_name="props">
              <q-td :props="props" class="text-center">
                <span
                  class="cursor-pointer text-primary"
                  style="text-decoration: underline; font-weight: 500;"
                  @click.stop="onErrorRowClick($event, props.row)"
                  :title="'Ver historial de intentos para: ' + props.row.file_name"
                >
                  {{ props.row.file_name }}
                </span>
              </q-td>
            </template>
            <template v-slot:body-cell-user_id="props">
              <q-td :props="props" class="text-center">{{ props.row.user_id || '-' }}</q-td>
            </template>
          </q-table>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat icon="download" label="Exportar TXT" color="positive" @click="exportErrorsToTxt" :disable="!errorsList.length" />
          <q-btn flat label="Refrescar" color="primary" @click="fetchErrors" />
          <q-btn flat label="Cerrar" color="primary" v-close-popup @click="errorsModal = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Dialog para historial por archivo -->
    <q-dialog v-model="fileHistoryDialog">
      <q-card style="min-width: 800px; max-width: 95vw;">
        <q-card-section class="q-pb-none">
          <div class="text-h6">Historial de cargas fallidas</div>
          <div class="text-subtitle2 text-grey-7 q-mt-xs">Archivo: <strong>{{ selectedFileName }}</strong></div>
          <div class="text-caption text-grey-5 q-mt-xs">Los intentos están ordenados del más reciente al más antiguo.</div>
        </q-card-section>
        <q-card-section>
          <q-table
            :rows="fileHistoryList"
            :columns="[
              { name: 'created_at', label: 'Fecha y Hora', field: 'created_at', align: 'center', sortable: true },
              { name: 'user_id', label: 'Usuario', field: 'user_id', align: 'center' },
              { name: 'reason', label: 'Motivo del Rechazo', field: 'reason', align: 'left' }
            ]"
            row-key="id"
            dense
            :rows-per-page-options="[5, 10, 20]"
          >
            <template v-slot:body-cell-created_at="props">
              <q-td :props="props" class="text-center">
                {{ new Date(props.row.created_at).toLocaleString() }}
              </q-td>
            </template>
            <template v-slot:body-cell-user_id="props">
              <q-td :props="props" class="text-center">{{ props.row.user_id || '-' }}</q-td>
            </template>
            <template v-slot:body-cell-reason="props">
              <q-td :props="props">{{ getSystemErrorMessage(props.row) }}</q-td>
            </template>
          </q-table>
        </q-card-section>
        <q-card-actions align="center">
          <q-btn label="Cerrar" color="primary" v-close-popup @click="fileHistoryDialog = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useQuasar, LocalStorage, Notify } from 'quasar';
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

const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

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
  const arr = resultados.value?.rechazadas.cedulas || [];
  if (!Array.isArray(arr)) return '';
  return arr.map(r => {
    if (!r) return '';
    if (typeof r === 'string') return r;
    const ced = r.cedula || '';
    const errs = (r.field_errors && Array.isArray(r.field_errors)) ? r.field_errors.join('; ') : (r.field_errors || '');
    return ced ? `${ced}${errs ? ': ' + errs : ''}` : errs;
  }).join('\n');
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
      const fecha_ingreso = r.fecha_ingreso || r.fecha_de_ingreso || r.ingreso || r.fecha || '';

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
        if (fecha_ingreso) formData.append('fecha_ingreso', fecha_ingreso);
      } catch (e) {
        // Fallback: enviar nombres si ocurre algo
        if (institucion) formData.append('institucion', institucion);
        if (sede) formData.append('sede', sede);
        if (area) formData.append('area', area);
        if (cargo) formData.append('cargo', cargo);
      }

        // Validaciones locales antes de enviar
        const rowFieldErrors = [];
        // Cedula requerido y numérico
        const cedClean = (ced || '').toString().trim();
        if (!/^[0-9]{6,9}$/.test(cedClean)) {
          rowFieldErrors.push('cedula: formato inválido (debe ser 6-9 dígitos)');
        }
        if (!nombres) rowFieldErrors.push('nombres: requerido');
        if (!apellidos) rowFieldErrors.push('apellidos: requerido');

        if (rowFieldErrors.length > 0) {
          results.rechazadas.cedulas.push({ cedula: cedClean || '(sin cédula)', row_number: null, field_errors: rowFieldErrors });
          results.rechazadas.cantidad++;
        } else {
          try {
            // Enviar como multipart/form-data igual que la inserción individual
            const resp = await axios.post(insertServerURL, formData);
            results.actualizadas.cedulas.push(cedClean);
            results.actualizadas.cantidad++;
          } catch (err) {
            const status = err?.response?.status;
            if (status === 409) {
              results.previamente_cargadas.cedulas.push(cedClean);
              results.previamente_cargadas.cantidad++;
            } else {
              const serverMsg = err?.response?.data?.error ? String(err.response.data.error) : 'error_interno';
              results.rechazadas.cedulas.push({ cedula: cedClean, row_number: null, field_errors: [serverMsg] });
              results.rechazadas.cantidad++;
            }
          }
        }
      results.total_procesadas = results.actualizadas.cantidad + results.rechazadas.cantidad + results.previamente_cargadas.cantidad;
    }

    resultados.value = results;
    // Reportar los rechazos al backend para que queden registrados en el historial de errores
    try {
      await reportErrorsToServer(file.name || ('mass_upload_' + Date.now()), results.rechazadas.cedulas || []);
    } catch (e) { console.warn('No se pudo reportar errores al backend:', e); }
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

// Registrar errores en el backend para poder consultarlos desde la vista "Ver Errores"
const reportErrorsToServer = async (fileLabel, rejectedCedulas) => {
    try {
      const token = LocalStorage.getItem('token');
      // Enviar cada rechazo como fila fallida con detalle de campos
      for (const r of rejectedCedulas) {
        // r can be string "cedula: reason" or object
        let rowNumber = null;
        let ced = null;
        let fieldErrors = null;
        if (typeof r === 'object') {
          rowNumber = r.row || r.row_number || null;
          ced = r.cedula || null;
          fieldErrors = r.field_errors || r.errors || null;
        } else if (typeof r === 'string') {
          // try to split on ':' to extract cedula and message
          const parts = r.split(':');
          ced = parts[0] || null;
          fieldErrors = parts.slice(1).join(':') || 'rechazo_datos';
        }
        const payload = { file_name: fileLabel || ('mass_upload_' + Date.now()), row_number: rowNumber, cedula: ced, field_errors: JSON.stringify(fieldErrors ? (Array.isArray(fieldErrors) ? fieldErrors : [String(fieldErrors)]) : []), details: null };
        try {
          await axios.post(`${apiBase}/auth/cargar_servidores_masivos/log_failed_row`, payload, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
        } catch (e) {
          console.warn('No se pudo reportar rechazo al servidor:', e && e.message ? e.message : e);
        }
      }
    } catch (e) {
      console.warn('reportErrorsToServer error', e && e.message ? e.message : e);
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

// --- Errores modal (reutiliza las APIs ya existentes en el backend) ---
const errorsModal = ref(false);
const errorsList = ref([]);
const latestSummary = ref(null);
const searchErrors = ref('');
const errorsPagination = ref({ page: 1, rowsPerPage: 10, rowsNumber: 0 });

const openErrorsModal = async () => {
  errorsModal.value = true;
  await fetchErrors();
  await fetchLatestSummary();
};

const fetchErrors = async () => {
  try {
    const token = LocalStorage.getItem('token');
    const resp = await axios.get(`${apiBase}/auth/cargar_servidores_masivos/errors/history?limit=200`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    });
    errorsList.value = resp.data || [];
    errorsPagination.value.rowsNumber = (errorsList.value || []).length;
  } catch (err) {
    console.error('Error fetching errors history', err);
    Notify.create({ type: 'negative', message: err.response?.data?.error || 'No se pudo obtener historial de errores.' });
    errorsList.value = [];
  }
};

const fetchLatestSummary = async () => {
  try {
    const token = LocalStorage.getItem('token');
    const resp = await axios.get(`${apiBase}/auth/cargar_servidores_masivos/errors/latest_db`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    });
    latestSummary.value = resp.data || null;
  } catch (err) {
    console.warn('No latest summary from DB', err);
    latestSummary.value = null;
  }
};

const fileHistoryDialog = ref(false);
const fileHistoryList = ref([]);
const selectedFileName = ref('');

const fetchFileHistory = async (fileName) => {
  try {
    const token = LocalStorage.getItem('token');
    const resp = await axios.get(`${apiBase}/auth/cargar_servidores_masivos/errors/file`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      params: { name: fileName }
    });
    fileHistoryList.value = resp.data || [];
  } catch (err) {
    console.error('Error fetching file history', err);
    fileHistoryList.value = [];
    Notify.create({ type: 'negative', message: err.response?.data?.error || 'No se pudo obtener historial de archivo.' });
  }
};

const onErrorRowClick = async (evt, row) => {
  const targetRow = row || (evt && evt.row) || null;
  if (!targetRow) return;
  const fname = targetRow.file_name || targetRow.file || targetRow.file_originalname || targetRow.fileName || null;
  if (!fname) {
    Notify.create({ type: 'warning', message: 'Nombre de archivo no disponible.' });
    return;
  }
  selectedFileName.value = fname;
  await fetchFileHistory(fname);
  fileHistoryDialog.value = true;
};

const filteredErrors = computed(() => {
  const q = (searchErrors.value || '').toString().trim().toLowerCase();
  if (!q) return errorsList.value || [];
  return (errorsList.value || []).filter(e => {
    return (e.file_name || '').toString().toLowerCase().includes(q)
      || (e.cedula || '').toString().toLowerCase().includes(q)
      || (e.reason || '').toString().toLowerCase().includes(q)
      || (e.user_id || '').toString().toLowerCase().includes(q)
  });
});

const exportErrorsToTxt = () => {
  const lines = [];
  for (const row of errorsList.value || []) {
    const motivo = getSystemErrorMessage(row);
    lines.push(`Archivo: ${row.file_name || row.file || ''}`);
    lines.push(`Cedula: ${row.cedula || ''}`);
    lines.push(`Usuario: ${row.user_id || ''}`);
    lines.push(`Motivo: ${motivo}`);
    lines.push('-'.repeat(60));
  }
  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `errores_carga_servidores_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
  Notify.create({ type: 'positive', message: 'Reporte de errores exportado como TXT.' });
};

const getSystemErrorMessage = (row) => {
  if (!row) return '';
  const reason = row.reason || '';
  const fileName = row.file_name || row.file || '';
  if (reason === 'rechazo_datos') {
    return `Los datos de la fila (cédula: ${row.cedula || 'N/A'}) no cumplen el formato requerido según el ejemplo. Revise el CSV/XLSX.`;
  }
  // Fallback to display raw reason
  return row.details || String(reason || 'Error desconocido');
};
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
