<template>
  <div class="q-pa-md">
    <div class="image-container">
      <img class="responsive-image" src="/img/logo_nobg1.png" alt="Electoral MINAAMP - INASS" />
    </div>

    <h4 class="q-mb-md">SERVIDORES</h4>

    <q-table title="Lista de Servidores" :rows="filteredServers" :columns="isQuickEditMode ? quickEditColumns : columns"
      :rows-per-page-options="[10, 20, 50]" row-key="id" :pagination="pagination" :loading="loading" virtual-scroll
      class="responsive-table" :class="{ 'editing-mode': isQuickEditMode }">
      <!-- Búsqueda general y botón borrar filtros -->
      <template v-slot:top>
        <!-- Primera fila: Búsqueda general y botón borrar filtros -->
        <div class="full-width row wrap items-center q-mb-md">
          <!-- Búsqueda general -->
          <div class="col-xs-10 col-sm-5 q-pr-xs">
            <q-input outlined dense debounce="300" v-model="searchQuery" label="Búsqueda general"
              placeholder="Buscar en todos los campos">
              <template v-slot:append>
                <q-icon v-if="searchQuery" name="clear" @click.stop="clearSearch" class="cursor-pointer" size="sm" />
              </template>
            </q-input>
          </div>
          <!-- Botón "Borrar todos los filtros" -->
          <div class="col-xs-2 col-sm-1">
            <q-btn icon="fas fa-trash" title="Borrar todos los filtros" @click="clearAllFilters" color="negative" flat
              size="sm" class="full-width" />
          </div>
        </div>

        <!-- Segunda fila: Filtros para las columnas -->
        <div class="full-width row wrap items-center content-center q-mb-md" v-if="!isQuickEditMode">
          <div class="col-xs-12 col-sm-6 col-md-3 q-pa-sm" v-for="col in columns" :key="col.name">
            <div v-if="col.filterable">
              <div v-if="col.type === 'select'">
                <q-select :model-value="filters[col.name]" @update:model-value="val => updateFilter(col.name, val)"
                  :options="getOptions(col.name)" :label="col.label" multiple outlined dense use-chips clearable>
                  <template v-slot:append>
                    <q-icon v-if="filters[col.name] && filters[col.name].length > 0" name="clear"
                      @click.stop="clearFilter(col.name)" class="cursor-pointer" size="sm" />
                  </template>
                </q-select>
              </div>
              <div v-else>
                <q-input :model-value="filters[col.name]" @update:model-value="val => updateFilter(col.name, val)"
                  :label="col.label" placeholder="Filtrar" outlined dense debounce="300">
                  <template v-slot:append>
                    <q-icon v-if="filters[col.name]" name="clear" @click.stop="clearFilter(col.name)"
                      class="cursor-pointer" size="sm" />
                  </template>
                </q-input>
              </div>
            </div>
          </div>
          <!-- ///////////////////////////// -->
          <!-- En el template, dentro del v-slot:top, después de los filtros existentes -->
          <!-- <div class="full-width row wrap items-center q-mb-md" v-if="!isQuickEditMode">
            <div class="col-3 q-pa-sm">
              <div class="text-caption q-mb-xs">Filtrar por estado del voto:</div>
              <q-slider
                v-model="votoFilter"
                :min="1"
                :max="3"
                :step="1"
                snap
                markers
                label-always
                :label-value="votoFilter === 1 ? 'Todos' : votoFilter === 2 ? 'Votaron' : 'No Votaron'"
              />
            </div>
          </div> -->
          <!-- ///////////////////////////// -->
        </div>
          <div class="col-xs-2 col-sm-2 row items-center q-gutter-sm">
          <div class="col row items-center q-gutter-sm" style="gap:8px;">
            <q-btn icon="add" title="Agregar nueva revista" @click="openNewModal" color="positive" size="sm" v-if="(hasPermission('create_servidor') || hasPermission('view_admin')) && !isQuickEditMode" />
            <q-btn icon="file_upload" label="CARGA MASIVA" title="Carga masiva de servidores" @click="goToMassive" color="primary" size="sm" v-if="(hasPermission('create_servidor') || hasPermission('view_admin')) && !isQuickEditMode" />
            <!-- Batch page size selection removed per request (no longer used) -->
          <!--  <q-btn icon="print" label="IMPRIMIR LOTE" color="teal" size="sm" :disable="!selectionModel.length" @click="generatePdfBatch(batchPageSize)" v-if="hasPermission('view_admin')" /> -->
          </div>
        </div>
      </template>

      <!-- Columna de foto -->
      <template v-slot:body-cell-foto="props">
        <q-td :props="props">
          <img :src="getFotoUrl(props.row.foto_url)" alt="Foto"
            style="width:48px;height:48px;object-fit:cover;border-radius:50%;border:1px solid #ccc;" />
        </q-td>
      </template>

      <!-- Botones de acción en cada fila (modo normal) -->
      <template v-slot:body-cell-actions="props" v-if="!isQuickEditMode">
        <q-td :props="props">
          <div class="row items-center">
            <!-- Botón Editar -->
            <q-btn icon="edit" color="primary" title="Editar servidor" size="xs" @click.stop="openEditModal(props.row)"
              class="q-mr-xs" v-if="(hasPermission('update_servidor') || hasPermission('view_admin'))" />

            <!-- Botón Marcas Votó -->
            <!-- <q-btn icon="check" color="secondary" title="Marcar que el servidor votó" size="xs"
              class="q-mr-xs" @click.stop="startQuickEdit(props.row)" v-if="hasPermission('view_admin')"/> -->

            <!-- Botón Borrar -->
            <q-btn icon="delete" @click.stop="eliminarServidor(props.row)" color="negative" title="Eliminar Servidor"
              size="xs" class="q-mr-xs" v-if="(hasPermission('delete_servidor') || hasPermission('view_admin'))" />
          </div>
        </q-td>
      </template>

      <!-- Celda de hora_voto (editable en modo rápido) -->
      <template v-slot:body-cell-hora_voto="props">
        <q-td :props="props" :class="{ 'editing-cell': isQuickEditMode && props.row === editingRow }">
          <div v-if="isQuickEditMode && props.row === editingRow">
            <q-input v-model="editingRowData.hora_voto" type="time" dense outlined
              @update:model-value="handleTimeChange(props.row)" />
          </div>
          <div v-else>
            {{ props.value }}
          </div>
        </q-td>
      </template>

      <!-- Celda de observaciones (editable en modo rápido) -->
      <template v-slot:body-cell-observaciones="props">
        <q-td :props="props" :class="{ 'editing-cell': isQuickEditMode && props.row === editingRow }">
          <div v-if="isQuickEditMode && props.row === editingRow">
            <q-input v-model="editingRowData.observaciones" type="text" dense outlined
              @update:model-value="val => editingRowData.observaciones = val.toUpperCase()" />
          </div>
          <div v-else>
            {{ props.value }}
          </div>
        </q-td>
      </template>

      <!-- Celda de controles (solo en modo rápido) -->
      <template v-slot:body-cell-controles="props">
        <q-td v-if="isQuickEditMode && props.row === editingRow">
          <div class="row items-center justify-end">
            <q-btn icon="check" color="positive" size="sm" @click.stop="saveQuickEdit(props.row)" class="q-mr-xs" />
            <q-btn icon="close" color="negative" size="sm" @click.stop="cancelQuickEdit" />
          </div>
        </q-td>
        <q-td v-else></q-td>
      </template>

      <!-- Estado de carga -->
      <template v-slot:loading>
        <q-inner-loading showing color="primary" />
      </template>
    </q-table>

    <!-- Modal de Edición -->
    <q-dialog v-model="editDialog" persistent>
      <q-card style="width: 700px; max-width: 80vw;">
        <q-card-section>
          <div class="text-h6">{{ isEditing ? 'Editar Servidor' : 'Cargar Servidor' }}</div>
        </q-card-section>

        <q-card-section style="margin-left:25px;">
          <q-form @submit="saveChanges" class="q-gutter-md">
            <div class="row q-col-gutter-md">
              <!-- Campos del formulario -->
              <div class="col-12 col-md-6">
                <q-input v-model="editForm.id" label="ID" readonly filled />
              </div>
              <div class="col-12 col-md-6">
                <q-input v-model="editForm.cedula" label="Cédula" type="number" filled :readonly="isEditing" />
              </div>
              <div class="col-12 col-md-6">
                <q-input :model-value="editForm.nombres"
                  @update:model-value="val => editForm.nombres = val.toUpperCase()" label="Nombres" filled />
              </div>
              <div class="col-12 col-md-6">
                <q-input :model-value="editForm.apellidos"
                  @update:model-value="val => editForm.apellidos = val.toUpperCase()" label="Apellidos" filled />
              </div>
              <!-- <div class="col-12 col-md-6">
                <q-input v-model="editForm.hora_voto" label="Votó" type="time" filled />
              </div> -->
              <div class="col-12 col-md-6">
                <q-select v-model="editForm.institucion" :options="optionsu.institucion" label="Institución" filled
                  option-label="label" option-value="value" />
              </div>
              <div class="col-12 col-md-6">
                <q-select v-model="editForm.sede" :options="optionsu.sede" label="Sede" filled option-label="label"
                  option-value="value" />
              </div>
              <div class="col-12 col-md-6">
                <q-select v-model="editForm.area" :options="optionsu.area" label="Adscripción" filled
                  option-label="label" option-value="value" :disable="editForm.condicion === 'JUBILADO'" />
              </div>
              <div class="col-12 col-md-6">
                <q-select v-model="editForm.cargo" :options="optionsu.cargo" label="Cargo" filled option-label="label"
                  option-value="value" :disable="editForm.condicion === 'JUBILADO'" />
              </div>
              <div class="col-12 col-md-6">
                <q-select v-model="editForm.condicion" :options="condicionOptions" label="Condición" filled
                  emit-value map-options />
              </div>
              <!-- Campo para subir foto (PNG/JPG/JPEG) y previsualización -->
              <div class="col-12">
                <q-file v-model="editForm.foto" label="Foto del usuario (PNG, JPG, JPEG)" filled accept="image/png, image/jpeg, image/jpg" :clearable="true"
                  @rejected="onFileRejected" @update:model-value="onFotoChange" />
                <div class="q-mt-md">
                  <div class="text-caption">Vista previa de la foto:</div>
                  <img :src="fotoPreview || getFotoUrl(editForm.foto_url)" alt="Vista previa"
                    style="max-width: 200px; max-height: 200px; border-radius: 8px; border: 1px solid #ccc;" />
                </div>
              </div>
              <!-- <div class="col-12">
                <q-input :model-value="editForm.observaciones"
                  @update:model-value="val => editForm.observaciones = val.toUpperCase()" label="Observaciones"
                  type="textarea" filled />
              </div> -->
            </div>
            <div class="row justify-end">
              <q-btn icon="cancel" color="negative" type="reset" @click="closeEditModal" />
              <q-btn icon="save" color="primary" type="submit" class="q-ml-sm"
                :disable="!editForm.foto && !editForm.foto_url" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
// Ordenamiento múltiple para la tabla
const customSort = (rows, sortBy, descending) => {
  if (!Array.isArray(sortBy)) sortBy = [sortBy];
  if (!Array.isArray(descending)) descending = [descending];
  return rows.slice().sort((a, b) => {
    for (let i = 0; i < sortBy.length; i++) {
      const col = sortBy[i];
      const dir = descending[i] ?? false;
      if (a[col] < b[col]) return dir ? 1 : -1;
      if (a[col] > b[col]) return dir ? -1 : 1;
    }
    return 0;
  });
};
// Estado del modal de edición
const editDialog = ref(false);
import { ref, onMounted, computed, watch } from 'vue';
// Vista previa de la foto
const fotoPreview = ref(null);

const onFotoChange = (file) => {
  if (file && file instanceof File) {
    const maxSizeBytes = 1 * 1024 * 1024; // 1 MB
    if (file.size > maxSizeBytes) {
      Notify.create({
        type: 'negative',
        message: 'El tamaño del archivo es muy grande y no podrá ser cargado. El tamaño máximo de archivo es de 1 Mb.',
        timeout: 5000
      });
      editForm.value.foto = null;
      fotoPreview.value = null;
      return;
    }
    fotoPreview.value = URL.createObjectURL(file);
  } else {
    fotoPreview.value = null;
  }
};

// Limpiar vista previa al cerrar modal
watch(editDialog, (val) => {
  if (!val) fotoPreview.value = null;
});
import { LocalStorage, Notify } from 'quasar'
import axios from 'axios';
import { useRouter } from 'vue-router';

const router = useRouter();
const votoFilter = ref(1); // 1=Todos, 2=Votaron, 3=No votaron
// Definición de columnas para la tabla
const columns = [
  { name: 'foto', label: 'Foto', field: 'foto_url', align: 'center' },
  { name: 'actions', label: 'Acciones', align: 'left' },
  { name: 'cedula', label: 'Cédula', field: 'cedula', sortable: true, filterable: true, align: 'left', type: 'text' },
  { name: 'nombres', label: 'Nombres', field: 'nombres', sortable: true, filterable: true, align: 'left', type: 'text' },
  { name: 'apellidos', label: 'Apellidos', field: 'apellidos', sortable: true, filterable: true, align: 'left', type: 'text' },
  { name: 'institucion', label: 'Institución', field: 'institucion', sortable: true, filterable: true, align: 'left', type: 'select' },
  { name: 'sede', label: 'Sede', field: 'sede', sortable: true, filterable: true, align: 'left', type: 'select' },
  { name: 'area', label: 'Adscripción', field: 'area', sortable: true, filterable: true, align: 'left', type: 'select' },
  { name: 'cargo', label: 'Cargo', field: 'cargo', sortable: true, filterable: true, align: 'left', type: 'select' },
  { name: 'condicion', label: 'Condición', field: 'condicion', sortable: true, filterable: true, align: 'left', type: 'text' },
];
// Función para obtener la URL de la foto
// Soporta base64 (data:image/...) devuelto por el backend en producción,
// rutas /uploads/... y URLs absolutas.
// El avatar por defecto se sirve desde los estáticos del FRONTEND (/img/no_person.png),
// sin apiBase, para que nginx lo entregue directamente sin proxear al backend.
const DEFAULT_AVATAR = '/img/no_person.png';
const apiBase = import.meta.env.VITE_API_URL || '';
const getFotoUrl = (foto_url) => {
  if (!foto_url) return DEFAULT_AVATAR;
  // Base64 embebida: devolver tal cual (evita segunda petición HTTP)
  if (foto_url.startsWith('data:image/')) return foto_url;
  const normalized = foto_url.replace(/\\/g, '/');
  if (normalized.includes('no_person.png')) {
    return DEFAULT_AVATAR;
  }
  if (normalized.includes('/uploads/')) {
    return apiBase + normalized;
  }
  if (normalized.startsWith('uploads/')) {
    return apiBase + '/' + normalized;
  }
  // Fallback: avatar por defecto desde el frontend
  return DEFAULT_AVATAR;
};

// Columnas para el modo edición rápida
// const quickEditColumns = [
//   { name: 'cedula', label: 'Cédula', field: 'cedula', sortable: true, align: 'left' },
//   { name: 'nombres', label: 'Nombre', field: 'nombres', sortable: true, align: 'left' },
//   { name: 'hora_voto', label: 'Votó', field: 'hora_voto', sortable: true, align: 'left' },
//   // { name: 'observaciones', label: 'Observaciones', field: 'observaciones', sortable: false, align: 'left' },
//   { name: 'controles', label: 'Controles', align: 'right' }
// ];

// URLs de los endpoints
const apiURL = import.meta.env.VITE_API_URL;
const estadosURL = import.meta.env.VITE_MP_ESTADOSS_URL;
// const estadosURL = import.meta.env.VITE_ESTADOR_BASE_URL;
const estadosLsURL = import.meta.env.VITE_LS_ESTADOS_URL;
const servidoresURL = import.meta.env.VITE_LS_SERVERS_URL
const institucionesURL = import.meta.env.VITE_LS_INSTITUTIONS_URL;
const sedesURL = import.meta.env.VITE_LS_SEDES_URL;
const areasURL = import.meta.env.VITE_LS_AREAS_URL;
const servidorDetailURL = import.meta.env.VITE_BC_SERVER_URL;
const updateServerURL = import.meta.env.VITE_UP_SERVER_URL;
const insertServerURL = import.meta.env.VITE_IN_SERVER_URL;
const deleteServerURL = import.meta.env.VITE_BR_SERVER_URL;

// Obtener permisos
const hasPermission = (permissionName) => {
  const permissions = LocalStorage.getItem('permissions') || []
  return permissions.some(p => {
    if (!p) return false
    if (typeof p === 'string') return p === permissionName
    if (typeof p === 'object' && p.name) return p.name === permissionName
    return false
  })
}

// Estado de la aplicación
const servers = ref([]);
const loading = ref(true);
const pagination = ref({
  sortBy: 'desc',
  descending: false,
  page: 1,
  rowsPerPage: 10
});
// Selección para impresión por lotes
const selectionModel = ref([])

// Tamaño por página para impresión en lotes (UI removed); default used in function

function chunkArray(arr, size) {
  const res = []
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size))
  return res
}

// Imprimir lote desde módulo Servidores
async function printBatchServidores(size = null) {
  try {
    const sel = selectionModel.value || []
    if (!sel || sel.length === 0) {
      Notify.create({ type: 'warning', message: 'No hay elementos seleccionados para imprimir.' })
      return
    }

    // If `size` is a ref (passed from template), unwrap it
    if (size && typeof size === 'object' && 'value' in size) size = size.value

    // Determine selected rows: support selectionModel containing row objects or keys (id/cedula)
    let selectedRows = []
    if (sel.length && typeof sel[0] === 'object') {
      selectedRows = sel
    } else {
      // allow numeric/string matches for id or cedula
      const selSet = new Set(sel.map(x => (typeof x === 'number' ? String(x) : String(x))))
      selectedRows = servers.value.filter(s => selSet.has(String(s.id)) || selSet.has(String(s.cedula)))
    }

    if (!selectedRows.length) {
      Notify.create({ type: 'warning', message: 'No se encontraron registros seleccionados.' })
      return
    }

    const pageSize = Number(size || 20)
    const groups = chunkArray(selectedRows, pageSize)

    // Verificar que todos los registros seleccionados tengan foto válida
    const missing = selectedRows.filter(r => {
      const fu = getFotoUrl(r.foto_url)
      // Si la foto resuelta apunta a la imagen por defecto o está vacía, marcar como faltante
      return !r.foto_url || fu.endsWith('/img/no_person.png') || fu.includes('no_person.png')
    })
    if (missing.length) {
      const cedulas = missing.map(r => r.cedula || r.id).join(', ')
      Notify.create({ type: 'negative', message: `No se imprimirá. Faltan fotos para las cédulas: ${cedulas}` })
      return
    }

    const win = window.open('', '_blank')
    if (!win) {
      Notify.create({ type: 'negative', message: 'Bloqueador de ventanas emergentes impide la impresión masiva' })
      return
    }

    // Datos para construir QR
    const qrBaseUrl = import.meta.env.VITE_CREDENCIAL_QR_URL || (apiURL || '') + '/credenciales/cedula='

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi]
      const html = []
      html.push('<!doctype html><html><head><meta charset="utf-8"><title>Impresión masiva</title>')
      html.push('<style>body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:8px} .sheet{display:flex;flex-wrap:wrap;gap:8px} .cred{width:55mm;height:85mm;box-sizing:border-box;border:0;margin:0;padding:0} .fondo{position:relative;width:55mm;height:85mm;overflow:hidden} .foto{position:absolute;right:8mm;top:18mm;width:19mm;height:19mm;object-fit:cover;border-radius:3mm;border:1px solid #888} .nombre{position:absolute;top:36mm;width:100%;text-align:center;font-size:4mm;font-weight:700} .cedula{position:absolute;top:40mm;width:100%;text-align:center;font-size:5.6mm;font-weight:700} .cargo{position:absolute;top:48mm;width:100%;text-align:center;font-size:3.2mm} .back{width:55mm;height:85mm;padding:4mm;box-sizing:border-box} .qr{position:absolute;right:6mm;bottom:6mm;width:18mm;height:18mm} @media print{ .cred{page-break-inside:avoid} /* Rotar la cara trasera 180° sólo al imprimir para compensar el volteo del papel en duplex */ .cred .back{transform:rotate(180deg);transform-origin:50% 50%;display:block} .cred .back *{transform:none !important;} }</style>')
      html.push('</head><body>')
      html.push('<div class="sheet">')
      for (const r of group) {
        const foto = getFotoUrl(r.foto_url)
        const nombres = (r.nombres || '')
        const apellidos = (r.apellidos || '')
        const ced = r.cedula || ''
        const institucion = r.institucion || ''
        const area = r.area || ''
        const cargo = r.cargo || ''
        const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrBaseUrl + ced)}`

        // Frontal
        html.push(`<div class="cred"><div class="fondo"><img src="/img/frontal_carnet.png" style="width:55mm;height:85mm;position:absolute;left:0;top:0"/>`)
        html.push(`<img class="foto" src="${foto}" alt="foto"/>`)
        html.push(`<div class="nombre">${nombres} ${apellidos}</div>`)
        html.push(`<div class="cedula">${ced}</div>`)
        html.push(`<div class="cargo">${cargo}</div>`)
        html.push('</div></div>')

        // Trasera
        const footerImg = getFooterFor_item(r)
        html.push(`<div class="cred"><div class="back"><div style="font-size:2.3mm;color:#2c3e50">• Este carnet es de uso exclusivo para el personal que labora en Ministerio del Poder Popular de Adultos y Adultas Mayores Abuelos y Abuelas de la Patria</div><div style="position:relative;height:100%"><img src="${footerImg}" style="width:110px;height:100px;object-fit:contain;margin-left:-4mm;margin-top:-1.5mm;max-width:90px;max-height:90px;" /><img class="qr" src="${qrImg}" /></div></div></div>`)
      }
      html.push('</div></body></html>')

      win.document.open()
      win.document.write(html.join(''))
      win.document.close()
      await new Promise(resolve => setTimeout(resolve, 700))
      try { win.focus(); win.print() } catch (e) { console.error('Error printing group', e); Notify.create({ type: 'negative', message: 'Error al imprimir lote' }) }
      if (gi < groups.length - 1) await new Promise(resolve => setTimeout(resolve, 1000))
    }
    try { win.close() } catch (e) {}
  } catch (e) {
    console.error('printBatchServidores error', e)
    Notify.create({ type: 'negative', message: 'Error generando impresión masiva' })
  }
}

// Generar un único PDF descargable con frontal+trasera por cada credencial
async function generatePdfBatch(size = null) {
  try {
    const sel = selectionModel.value || []
    if (!sel || sel.length === 0) {
      Notify.create({ type: 'warning', message: 'No hay elementos seleccionados para imprimir.' })
      return
    }
    if (size && typeof size === 'object' && 'value' in size) size = size.value

    // Resolve selection rows (objects or keys)
    let selectedRows = []
    if (sel.length && typeof sel[0] === 'object') selectedRows = sel
    else {
      const selSet = new Set(sel.map(x => String(x)))
      selectedRows = servers.value.filter(s => selSet.has(String(s.id)) || selSet.has(String(s.cedula)))
    }
    if (!selectedRows.length) {
      Notify.create({ type: 'warning', message: 'No se encontraron registros seleccionados.' })
      return
    }

    // Verificar fotos
    const missing = selectedRows.filter(r => {
      const fu = getFotoUrl(r.foto_url)
      return !r.foto_url || fu.endsWith('/img/no_person.png') || fu.includes('no_person.png')
    })
    if (missing.length) {
      const cedulas = missing.map(r => r.cedula || r.id).join(', ')
      Notify.create({ type: 'negative', message: `No se generará el PDF. Faltan fotos para las cédulas: ${cedulas}` })
      return
    }

    // Render batch by converting the single-card HTML into images using html2canvas + jsPDF
    const html2canvasModule = await import('html2canvas')
    const html2canvas = html2canvasModule && (html2canvasModule.default || html2canvasModule)
    const { jsPDF } = await import('jspdf')

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
    const a4Wmm = 210
    const a4Hmm = 297
    const cardWmm = 55
    const cardHmm = 85
    const topOffsetMm = 22

    // Container to render pages off-screen
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.left = '-9999px'
    container.style.top = '0'
    document.body.appendChild(container)

    for (let idx = 0; idx < selectedRows.length; idx++) {
      const r = selectedRows[idx]

      // Build HTML using the same classes/styles used by `CredencialPage.vue` so CSS matches
      const styleBlock = `
        @font-face {
          font-family: 'Georama';
          src: url('../assets/fonts/georama/Georama-Regular.ttf') format('truetype');
          font-weight: 400;
          font-style: normal;
        }
        @font-face {
          font-family: 'Georama';
          src: url('../assets/fonts/georama/Georama-Bold.ttf') format('truetype');
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
          left: 18mm;
          top: 20mm;
          object-fit: cover;
          z-index: 2;
          border-radius: 3mm;
          border: 1px solid #888;
        }
        .nombre { position: absolute; top: 40mm; left: 0; width: 55mm; text-align: center; font-size: 4mm; font-family: 'Georama', sans-serif; font-weight: 700; z-index: 2; }
        .cedula { position: absolute; top: 44mm; left: 0; width: 55mm; text-align: center; font-size: 5.6mm; font-family: 'Georama', sans-serif; font-weight: 700; z-index: 2; }
        .cargo { position: absolute; top: 52mm; left: 0; width: 55mm; text-align: center; font-size: 3.2mm; font-family: 'Georama', sans-serif; font-weight: 400; z-index: 2; }

        /* Estilos para la parte trasera de la credencial (copiados de CredencialPage.vue) */
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
  align-items: flex-start; /* subir el QR dentro del contenedor */
  padding-top: 1.5mm; /* un poco menos de padding superior */
  gap: 2mm;
}

.sello-img {
  width: 110px;
  height: 100px;
  object-fit: contain;
  margin-left: -4mm; /* acercar el sello hacia la izquierda */
  margin-top: -1.5mm; /* alinear un poco más arriba si hace falta */
}

.qr-code {
  background: white;
  padding: 1.5mm;
  border-radius: 2mm;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  transform: translateY(-5mm); /* elevar el QR dentro de la tarjeta */
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
  /* Rotar la cara trasera sólo en impresión física para compensar el volteo duplex */
  .credencial-trasera { transform: rotate(180deg); transform-origin: 50% 50%; }
}
  `;

  const frontHtml = `
        <div class="credencial-preview credencial-frontal">
          <img class="fondo-img" src="/img/frontal_carnet.png" />
          <img class="foto-trabajador" src="${getFotoUrl(r.foto_url)}" />
          <div class="nombre">${(r.nombres || '') + ' ' + (r.apellidos || '')}</div>
          <div class="cedula">${r.cedula || ''}</div>
          <div class="cargo">${r.cargo || ''}</div>
        </div>
      `

      container.insertAdjacentHTML('beforeend', `<div style="width:${a4Wmm}mm;height:${a4Hmm}mm;background:#fff;display:flex;justify-content:center;align-items:flex-start;margin:0;padding:0"><style>${styleBlock}</style><div style="margin-top:${topOffsetMm}mm">${frontHtml}</div></div>`)
      const pageEl = container.lastElementChild
      await new Promise(resolve => setTimeout(resolve, 80))
      const canvas = await html2canvas(pageEl, { scale: 2, useCORS: true })
      const imgData = canvas.toDataURL('image/jpeg', 0.95)
      if (idx > 0) pdf.addPage()
      pdf.addImage(imgData, 'JPEG', 0, 0, a4Wmm, a4Hmm)
      container.removeChild(pageEl)

      // Back page: render with same stylesheet for identical layout
      const qrBase = import.meta.env.VITE_CREDENCIAL_QR_URL || (apiURL || '') + '/credenciales/cedula='
      const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrBase + r.cedula)}`
      const backHtml = `
        <div class="credencial-preview credencial-trasera">
          <div class="contenido-trasero">
            <div class="texto-trasero">
              <p class="parrafo-trasero"><span class="bullet">•</span> Este carnet es de uso exclusivo para el personal que labora en Ministerio del Poder Popular de Adultos y Adultas Mayores Abuelos y Abuelas de la Patria</p>
              <p class="parrafo-trasero"><span class="bullet">•</span> Puede ser retenido por la Dirección General de Seguridad cuando lo requiera</p>
              <p class="parrafo-trasero"><span class="bullet">•</span> Es intransferible</p>
              <p class="parrafo-trasero"><span class="bullet">•</span> Se agradece a todas las autoridades Civiles y Militares prestarle la mayor colaboración posible al portador de esta credencial, dentro de las normas legales</p>
            </div>
            <div class="footer-container">
              <img src="${getFooterFor_item(r)}" alt="Sello" class="sello-img" />
              <img class="qr-code" src="${qrImgUrl}" />
            </div>
          </div>
        </div>
      `

      container.insertAdjacentHTML('beforeend', `<div style="width:${a4Wmm}mm;height:${a4Hmm}mm;background:#fff;display:flex;justify-content:center;align-items:flex-start;margin:0;padding:0"><style>${styleBlock}</style><div style="margin-top:${topOffsetMm}mm">${backHtml}</div></div>`)
      await new Promise(resolve => setTimeout(resolve, 80))
      const backPage = container.lastElementChild
      const canvasBack = await html2canvas(backPage, { scale: 2, useCORS: true })
      const imgBack = canvasBack.toDataURL('image/jpeg', 0.95)
      pdf.addPage()
      pdf.addImage(imgBack, 'JPEG', 0, 0, a4Wmm, a4Hmm)
      container.removeChild(backPage)
    }

    document.body.removeChild(container)
    pdf.save(`credenciales_lote_${Date.now()}.pdf`)
    Notify.create({ type: 'positive', message: 'PDF generado y descargado' })
  } catch (err) {
    console.error('generatePdfBatch error', err)
    Notify.create({ type: 'negative', message: 'Error generando PDF: ' + (err.message || err) })
  }
}

// Búsqueda general
const searchQuery = ref('');

// Filtros para las columnas
const filters = ref({
  areas: null,
  institucion: null,
  sede: null,
  cargo: null,
  indice: null
});

// Opciones para los select
const options = ref({
  areas: [],
  institucion: [],
  sede: [],
  cargo: [],
});
const optionsu = ref({
  areas: [],
  institucion: [],
  sede: [],
  cargo: [],
});

const editForm = ref({});
const isEditing = ref(false);
// Función para abrir el modal de edición y cargar los datos del servidor seleccionado
const openEditModal = (row) => {
  isEditing.value = true;
  // Inicializar selects con objeto {label, value} correcto
  editForm.value = {
    ...row,
    institucion: optionsu.value.institucion.find(opt => opt.value === row.institucion_id) || null,
    sede: optionsu.value.sede.find(opt => opt.value === row.sede_id) || null,
    area: optionsu.value.area.find(opt => opt.value === row.area_id) || null,
    cargo: optionsu.value.cargo.find(opt => opt.value === row.cargo_id) || null,
    condicion: row.condicion || 'ACTIVO'
  };
  // Si hay foto, mostrar la previsualización
  fotoPreview.value = row.foto_url ? getFotoUrl(row.foto_url) : null;
  editDialog.value = true;
};
// Función para cerrar el modal de edición y limpiar el formulario
const closeEditModal = () => {
  editDialog.value = false;
  isEditing.value = false;
  editForm.value = {};
  fotoPreview.value = null;
};

// Función para abrir el modal para agregar un nuevo servidor
const openNewModal = () => {
  isEditing.value = false;
  editForm.value = { condicion: 'ACTIVO' };
  fotoPreview.value = null;
  editDialog.value = true;
};

// Navegar a la página de carga masiva
const goToMassive = () => {
  router.push('/massive_servers')
}

// Estado para el modo edición rápida
const isQuickEditMode = ref(false);
const editingRow = ref(null);
const editingRowData = ref({});
const originalRowData = ref({});

// Función para obtener los datos de las revistas
const fetchServers = async () => {
  try {
    const response = await axios.get(servidoresURL);
    servers.value = response.data;
    console.log("servers:", servers.value)
  } catch (error) {
    console.error('Error al obtener las revistas:', error);
    const status = error.response?.status;
    if (status === 403) {
      Notify.create({ type: 'negative', message: 'Acceso denegado: no tienes permisos para ver servidores.' })
      // Redirect to home or leave page empty
      // router.push('/')
    } else {
      Notify.create({ type: 'negative', message: 'Error cargando servidores.' })
    }
  } finally {
    loading.value = false;
  }
};

const isINASS = computed(() => {
  if (!editForm.value.institucion) return false;
  const name = editForm.value.institucion.label || '';
  return /INSTITUTO NACIONAL DE LOS SERVICIOS SOCIALES/i.test(name);
});

const isINASS_item = (item) => {
  if (!item) return false;
  const name = (item.institucion || item.institucion_nombre || '').toString();
  return /INSTITUTO NACIONAL DE LOS SERVICIOS SOCIALES/i.test(name);
};

const getFooterFor_item = (item) => {
  if (isINASS_item(item)) {
    return '/img/inass_sello_firma.png';
  }
  return '/img/ministerio_sello_firma.png';
};

const condicionOptions = computed(() => {
  const isMinistry = editForm.value.institucion && /MINISTERIO DEL PODER POPULAR PARA LOS ADULTOS/i.test(editForm.value.institucion.label || '');
  return [
    { label: 'ACTIVO', value: 'ACTIVO' },
    { label: 'JUBILADO', value: 'JUBILADO', disable: !!isMinistry }
  ];
});

watch(() => editForm.value.institucion, (newInst) => {
  if (newInst && /MINISTERIO DEL PODER POPULAR PARA LOS ADULTOS/i.test(newInst.label || '')) {
    if (editForm.value.condicion === 'JUBILADO') {
      editForm.value.condicion = 'ACTIVO';
      Notify.create({
        type: 'warning',
        message: 'La opción Jubilado no está permitida para el Ministerio.'
      });
    }
  }
});

watch(() => editForm.value.condicion, (newVal) => {
  if (newVal === 'JUBILADO') {
    editForm.value.area = null;
    editForm.value.cargo = null;
  }
});

// Función para obtener las opciones de los filtros
const fetchOptions = async () => {
  try {
    const areasResponse = await axios.get(areasURL);
    options.value.area = areasResponse.data.map(item => item.area);
    const areasResponseU = await axios.get(areasURL);
    optionsu.value.area = areasResponseU.data.map(item => ({
      label: item.area,
      value: item.area_id
    }));

    // Obtener instituciones
    const institucionsResponse = await axios.get(institucionesURL);
    options.value.institucion = institucionsResponse.data.map(item => item.institucion);
    const institucionsResponseU = await axios.get(institucionesURL);
    optionsu.value.institucion = institucionsResponseU.data.map(item => ({
      label: item.institucion,
      value: item.id
    }));
    // Obtener sedes
    const sedesResponse = await axios.get(sedesURL);
    options.value.sede = sedesResponse.data.map(item => item.sede);
    const sedesResponseU = await axios.get(sedesURL);
    optionsu.value.sede = sedesResponseU.data.map(item => ({
      label: item.sede,
      value: item.id
    }));

    // Obtener cargos
    const cargosResponse = await axios.get('/auth/servidores_cargos');
    options.value.cargo = cargosResponse.data.map(item => item.cargo);

    const cargosResponseU = await axios.get('/auth/servidores_cargos');
    optionsu.value.cargo = cargosResponseU.data.map(item => ({
      label: item.cargo,
      value: item.id
}));

  } catch (error) {
    console.error('Error al obtener las opciones de los filtros:', error);
  }
};

// Actualizar los filtros
const updateFilter = (key, value) => {
  filters.value[key] = value;
};

// Borrar un filtro específico
const clearFilter = (filterName) => {
  filters.value[filterName] = null;
};

// Borrar todos los filtros
const clearAllFilters = () => {
  for (const filter in filters.value) {
    filters.value[filter] = null;
  }
  searchQuery.value = '';
  // votoFilter.value = 1;
};

// Borrar la búsqueda general
const clearSearch = () => {
  searchQuery.value = '';
};

// Obtener las opciones para un filtro select
const getOptions = (filterName) => {
  return options.value[filterName] || [];
};

// Calcular la lista de revistas filtradas
/////////////////////////
const filteredServers = computed(() => {
  let votofilteredServers = servers.value.filter(server => {
    return true;
  });

  // Filtrar por búsqueda general
  const searchValue = searchQuery.value.toLowerCase();
  let searchedServers = votofilteredServers.filter(server => {
    return columns
      .filter(col => col.filterable)
      .some(col => {
        const serverValue = server[col.field]?.toString()?.toLowerCase() || '';
        return serverValue.includes(searchValue);
      });
  });

  // Finalmente aplicar los filtros por columna
  return searchedServers.filter(server => {
    return columns
      .filter(col => col.filterable)
      .every(col => {
        // Para filtros de tipo select
        if (col.type === 'select' && filters.value[col.name] && filters.value[col.name].length > 0) {
          return filters.value[col.name].includes(server[col.field]);
        }

        // Para otros tipos de filtros
        const filterValue = filters.value[col.name]?.toLowerCase() || '';
        const serverValue = server[col.field]?.toString()?.toLowerCase() || '';
        return serverValue.includes(filterValue);
      });
  });
});
/////////////////////////

// Función para guardar cambios (debe ser async y única)
const saveChanges = async () => {
  try {
    // Bloquear si no hay foto cargada ni foto previa
    if (!editForm.value.foto && !editForm.value.foto_url) {
      Notify.create({
        type: 'negative',
        message: 'Debe cargar una foto PNG para guardar los cambios.'
      });
      return;
    }
    const formData = new FormData();
    // Siempre tomar el id seleccionado del q-select
    formData.append('area_id', editForm.value.area?.value ?? '');
    formData.append('institucion_id', editForm.value.institucion?.value ?? '');
    formData.append('sede_id', editForm.value.sede?.value ?? '');
    formData.append('cargo_id', editForm.value.cargo?.value ?? '');
    formData.append('cedula', editForm.value.cedula);
    formData.append('nombres', editForm.value.nombres?.toUpperCase() ?? '');
    formData.append('apellidos', editForm.value.apellidos?.toUpperCase() ?? '');
    formData.append('condicion', editForm.value.condicion || 'ACTIVO');

    if (editForm.value.foto) {
      formData.append('foto', editForm.value.foto);
    }

    // Leer el token del LocalStorage para incluirlo en el header Authorization
    const token = LocalStorage.getItem('token');
    const authHeaders = {
      'Content-Type': 'multipart/form-data',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    if (isEditing.value) {
      await axios.patch(`${updateServerURL}${editForm.value.cedula}`, formData, {
        headers: authHeaders
      });
      Notify.create({
        type: 'positive',
        message: 'Los cambios se han guardado correctamente.'
      });
    } else {
      await axios.post(insertServerURL, formData, {
        headers: authHeaders
      });
      Notify.create({
        type: 'positive',
        message: 'El servidor se ha creado correctamente.'
      });
    }
    await fetchServers();
    closeEditModal();
  } catch (error) {
    const cedula = editForm.value.cedula;
    const mensaje = error.response?.status === 409 ? `La cédula ${cedula} ya se encuentra registrada.` : `Ha ocurrido un error ${error} y no se han guardado los cambios.`;
    Notify.create({
      type: 'negative',
      message: mensaje
    });
  }
};
// Manejar rechazo de archivo
const onFileRejected = (rejectedFiles) => {
  Notify.create({
    type: 'negative',
    message: 'Solo se permite subir archivos en formato PNG, JPG o JPEG.'
  });
};

// Funciones para el modo edición rápida
const startQuickEdit = (row) => {
  isQuickEditMode.value = true;
  editingRow.value = row;
  editingRowData.value = { ...row };
  originalRowData.value = { ...row };
};

const cancelQuickEdit = () => {
  isQuickEditMode.value = false;
  editingRow.value = null;
  editingRowData.value = {};
  originalRowData.value = {};
};

const saveQuickEdit = async (row) => {
  try {
    const servidorData = {
      cedula: row.cedula,
      hora_voto: editingRowData.value.hora_voto,
      observaciones: editingRowData.value.observaciones?.toUpperCase() ?? ''
    };

    const token = LocalStorage.getItem('token');
    await axios.patch(`${updateServerURL}${row.cedula}`, servidorData, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });

    Notify.create({
      type: 'positive',
      message: 'Los cambios se han guardado correctamente.'
    });

    // Actualizar la fila en la tabla
    Object.assign(row, editingRowData.value);
    cancelQuickEdit();
    await fetchServers();
  } catch (error) {
    Notify.create({
      type: 'negative',
      message: `Error al guardar los cambios: ${error.message}`
    });
  }
};

const handleTimeChange = (row) => {
  console.log('Hora cambiada:', editingRowData.value.hora_voto);
};
const eliminarServidor = async (servidor) => {
  try {
    // Mostrar diálogo de confirmación
    const confirmacion = await new Promise((resolve) => {
      Notify.create({
        type: 'warning',
        message: `¿Está seguro que desea eliminar el servidor ${servidor.nombres} (C.I. ${servidor.cedula})?`,
        timeout: 0,
        actions: [
          {
            label: 'Confirmar',
            color: 'white',
            handler: () => resolve(true)
          },
          {
            label: 'Cancelar',
            color: 'white',
            handler: () => resolve(false)
          }
        ]
      });
    });

    if (!confirmacion) return;

    // Realizar la solicitud PATCH para borrado lógico
    loading.value = true;
    const token = LocalStorage.getItem('token');
    await axios.patch(`${deleteServerURL}${servidor.cedula}`, {}, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });

    Notify.create({
      type: 'positive',
      message: 'Servidor eliminado correctamente'
    });

    // Actualizar la lista
    await fetchServers();
  } catch (error) {
    console.error('Error al eliminar servidor:', error);
    Notify.create({
      type: 'negative',
      message: error.response?.data?.message || 'Error al eliminar el servidor'
    });
  } finally {
    loading.value = false;
  }
};
// Observar cambios en la paginación
watch(pagination, () => {
  // Lógica de paginación si es necesaria
}, { deep: true });

// Obtener los datos al montar el componente
onMounted(async () => {
  if (!LocalStorage.getItem('token')) {
    router.push('/login')
  }
  await fetchOptions();
  // Only fetch servers if the user has permission to read servers
  if (hasPermission('read_servidor') || hasPermission('view_admin')) {
    await fetchServers();
  } else {
    loading.value = false;
    // Optionally notify the user they don't have access
    // Notify.create({ type: 'warning', message: 'No tienes permisos para ver la lista de servidores.' })
  }
});
</script>

<style scoped>
.responsive-table {
  max-width: 100%;
  overflow-x: auto;
}

@media (max-width: 768px) {
  .responsive-table {
    overflow-x: scroll;
  }
}

/* Estilos para el modo edición rápida */
.editing-mode .q-table__top {
  background-color: #f5f5f5;
}

.editing-cell {
  background-color: #e8f5e9;
}

.editing-row {
  background-color: #e8f5e9;
}

.q-table__container.editing-mode {
  border: 1px solid #4caf50;
}

/* Estilos para el slider de filtrado */
.q-slider__track-container {
  height: 8px;
}

.q-slider__marker-labels-container {
  margin-top: 10px;
}

.q-slider__marker-label {
  font-size: 0.8rem;
}

.q-slider--dark .q-slider__track {
  background: #1976d2;
}

.q-slider--dark .q-slider__selection {
  background: #0d47a1;
}

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
