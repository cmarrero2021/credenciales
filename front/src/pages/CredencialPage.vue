<template>
  <div class="row items-center q-col-gutter-md q-mb-md q-pa-md">
    <div class="col">
      <h5>Carnets</h5>
    </div>
  </div>
  <div class="q-ml-xl q-mr-xl">
    <div class="q-mb-md filters-panel">
      <div class="q-gutter-sm row items-end">
        <q-input v-model="filterCedula" label="Cédula" dense class="col-12 col-md-2" debounce="500" />
        <q-input v-model="filterNombres" label="Nombres" dense class="col-12 col-md-3" debounce="500" />
        <q-input v-model="filterApellidos" label="Apellidos" dense class="col-12 col-md-3" debounce="500" />
        <q-select v-model="filterInstitucion" :options="instituciones" option-value="id" option-label="institucion" label="Institución" dense class="col-12 col-md-2" emit-value map-options />
        <q-select v-model="filterSede" :options="sedes" option-value="id" option-label="sede" label="Sede" dense class="col-12 col-md-2" emit-value map-options />
        <q-select v-model="filterArea" :options="areas" option-value="area_id" option-label="area" label="Área" dense class="col-12 col-md-3" emit-value map-options />
        <q-select v-model="filterCargo" :options="cargos" option-value="id" option-label="cargo" label="Cargo" dense class="col-12 col-md-3" emit-value map-options />
        <div class="col-12 col-md-2">
          <q-btn label="Limpiar Filtros" color="primary" @click="clearFilters" class="full-width" />
        </div>
      </div>
      <div class="q-mt-sm">
        <!-- Lista oculta: aplicamos filtros y cargamos la primera credencial con foto disponible -->
      </div>
    </div>
    <q-btn v-if="trabajador && (hasPermission('print_credencial') || hasPermission('view_admin'))" label="Imprimir" :color="isTooRecentIngreso(trabajador) ? 'grey' : 'secondary'" :disable="isTooRecentIngreso(trabajador)" @click="imprimirCredencial" class="q-mb-lg">
      <q-tooltip v-if="isTooRecentIngreso(trabajador)">No se puede imprimir: el servidor tiene menos de 3 meses de ingreso</q-tooltip>
    </q-btn>
    <q-btn v-if="trabajador && (hasPermission('print_credencial') || hasPermission('view_admin'))" label="Imprimir franja" color="amber-10" outline class="q-ml-sm q-mb-lg" @click="imprimirFranja" />
    <q-btn v-if="(hasPermission('print_credencial') || hasPermission('view_admin'))" label="Imprimir por lote" color="primary" outline class="q-ml-sm q-mb-lg" @click="batchDialog = true" />
    <q-btn v-if="(hasPermission('print_credencial') || hasPermission('view_admin'))" label="Franja por lote" color="warning" outline class="q-ml-sm q-mb-lg" @click="openFranjaBatchDialog" />

    <div v-if="trabajador" class="credencial-container">
      <!-- Parte delantera -->
      <div v-html="buildFrontalCardMarkup(trabajador)" class="credencial-front-render"></div>

      <!-- Parte trasera -->
      <div class="credencial-preview credencial-trasera">
        <img :src="(isINASS(trabajador) ? '/img/reverso_inass.png' : '/img/reverso.png')" class="fondo-img-reverso" alt="Reverso carnet" />
        <div class="qr-code-reverso">
          <QrcodeVue :value="qrUrl" :size="120" level="H" style="width:100%;height:100%;display:block;" />
        </div>
      </div>
      <div class="q-mt-sm">
        <div class="row q-gutter-sm">
          <div v-if="displayedMatches.length === 0 && (filterCedula || filterNombres || filterApellidos || filterInstitucion || filterSede || filterArea || filterCargo)" class="col-12 text-subtitle2 q-ml-sm text-grey">No hay credenciales con foto filtradas según su búsqueda.</div>
        </div>
      </div>

      <div v-if="mostrarInfo" class="info-servidor no-print">
        <div class="q-gutter-sm q-mb-sm">
          <q-badge color="green" label="Carnet: Activo" v-if="trabajador?.activo !== false" />
          <q-badge color="negative" label="Carnet: Inactivo" v-else />
          <q-badge color="secondary" label="Trabajador: Activo" v-if="trabajador?.trabajador_activo !== false && trabajador?.trabajador_activo !== null" />
          <q-badge color="negative" label="Trabajador: Inactivo" v-else-if="trabajador?.trabajador_activo === false" />
        </div>
        <div><b>Cédula:</b> {{ trabajador.cedula }}</div>
        <div><b>Nombres:</b> {{ trabajador.nombres }}</div>
        <div><b>Apellidos:</b> {{ trabajador.apellidos }}</div>
        <div><b>Institución:</b> {{ trabajador.institucion || trabajador.institucion }}</div>
        <div><b>Unidad Adscripción:</b> {{ trabajador.area || trabajador.area }}</div>
        <div><b>Cargo:</b> {{ trabajador.cargo }}</div>
        <div v-if="trabajador.fecha_ingreso"><b>Fecha de ingreso:</b> {{ formatFechaIngreso(trabajador) }}</div>
        <div v-if="trabajador.condicion"><b>Condición:</b> {{ trabajador.condicion }}</div>
        <div v-if="trabajador?.disable_reason" class="q-mt-sm"><b>Inhabilitado por:</b> {{ trabajador.disable_reason }}</div>
      </div>
    </div>

    <!-- Disable dialog when page opened via QR scan -->
    <q-dialog v-model="disableDialogCred">
      <q-card style="min-width: 280px; max-width: 420px;">
        <q-card-section>
          <div class="text-h6">Deshabilitar credencial</div>
          <div class="q-mt-md">Seleccione el motivo por el cual se deshabilita esta credencial:</div>
          <div class="q-mt-sm">
            <q-select v-model="disableReasonCred" :options="disableReasonsCred" option-label="label" option-value="value" dense />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancelar" v-close-popup />
          <q-btn flat label="Deshabilitar" color="negative" @click="confirmDisableCred" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Informativo: credencial inactiva detectada al escanear -->
    <q-dialog v-model="scannedInactiveDialog">
      <q-card style="min-width: 300px; max-width: 520px;">
        <q-card-section>
          <div class="text-h6" style="color: #b71c1c">⚠️ Credencial Inactiva</div>
          <div class="q-mt-md">La credencial escaneada se encuentra <b>INACTIVA</b>.</div>
          <div v-if="scannedInactiveMessage" class="q-mt-sm"><b>Motivo:</b> {{ scannedInactiveMessage }}</div>
          <div v-else class="q-mt-sm">No se especificó un motivo para la inactividad.</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cerrar" color="primary" v-close-popup @click="scannedInactiveDialog = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Batch print dialog -->
    <q-dialog v-model="batchDialog">
      <q-card style="min-width:340px; max-width:540px">
        <q-card-section class="bg-primary text-white">
          <div class="text-h6"><q-icon name="print" class="q-mr-sm" />Impresión por lote</div>
        </q-card-section>
        <q-card-section>
          <div class="q-mb-sm text-subtitle2">Seleccione el alcance de la impresión:</div>
          <q-option-group v-model="batchPrintMode" type="radio" class="q-mb-sm" :options="[
            { label: 'Carnet completo', value: 'full' },
            { label: 'Solo franja', value: 'franja' }
          ]" />
          <q-option-group v-model="batchOption" type="radio" class="q-mb-sm" :options="[
            { label: 'Todas las instituciones', value: 'all' },
            { label: 'Solo una institución', value: 'institution' },
            { label: 'Solo un área / adscripción', value: 'area' }
          ]" />
          <div v-if="batchOption === 'institution'" class="q-mt-sm">
            <q-select v-model="batchInstitution" :options="instituciones" option-value="id" option-label="institucion" label="Institución" emit-value map-options dense outlined />
          </div>
          <div v-if="batchOption === 'area'" class="q-mt-sm">
            <q-select
              v-model="batchArea"
              :options="areas"
              option-value="area_id"
              option-label="area"
              label="Área / Adscripción"
              emit-value
              map-options
              dense
              outlined
              use-input
              input-debounce="200"
              fill-input
              hide-selected
              @filter="filterAreaOptions"
              :display-value="areas.find(a => a.area_id === batchArea)?.area || ''"
            >
              <template v-slot:no-option>
                <q-item><q-item-section class="text-grey">Sin resultados</q-item-section></q-item>
              </template>
            </q-select>
          </div>
          <div v-if="batchOption === 'area'" class="q-mt-sm">
            <q-option-group
              v-model="batchEnte"
              :options="[
                { label: 'Ministerio (MINAAMP)', value: 'minaamp' },
                { label: 'INASS', value: 'inass' }
              ]"
              type="checkbox"
              inline
              :dense="true"
              label="Entes"
            />
            <div class="text-caption text-grey q-mt-xs">Seleccione uno o ambos entes para la impresión por área.</div>
          </div>
          <div class="q-mt-sm text-caption text-grey">Se imprimirán solo las credenciales que tengan foto registrada.</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancelar" v-close-popup @click="batchDialog=false" />
          <q-btn flat label="Imprimir" color="primary" icon="print" @click="batchPrint" :disable="(batchOption === 'institution' && !batchInstitution) || (batchOption === 'area' && (!batchArea || batchEnte.length === 0))" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="batchFranjaDialog">
      <q-card style="min-width:420px; max-width:760px; width:min(78vw, 760px);">
        <q-card-section class="bg-warning text-dark">
          <div class="text-h6"><q-icon name="print" class="q-mr-sm" />Impresión de franja por lote</div>
        </q-card-section>
        <q-card-section>
          <div class="q-mb-sm text-subtitle2">Seleccione el alcance para imprimir solo la franja:</div>
          <q-option-group v-model="batchOption" type="radio" class="q-mb-sm" :options="[
            { label: 'Todas las instituciones', value: 'all' },
            { label: 'Solo una institución', value: 'institution' },
            { label: 'Solo un área / adscripción', value: 'area' }
          ]" />
          <div class="q-mt-md">
            <q-select
              v-model="franjaSelectedServerIds"
              :options="franjaSelectionOptions"
              option-value="value"
              option-label="label"
              label="Servidores a imprimir la franja"
              use-input
              use-chips
              multiple
              emit-value
              map-options
              dense
              outlined
              clearable
              input-debounce="200"
              behavior="menu"
              @filter="onFilterFranja"
            >
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption>{{ scope.opt.detail }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
          </div>
          <div v-if="franjaPreviewServers.length" class="q-mt-md">
            <div class="text-body2 text-weight-medium q-mb-xs">
              Vista previa de la franja ({{ franjaPreviewServers.length }} servidor{{ franjaPreviewServers.length === 1 ? '' : 'es' }} seleccionado{{ franjaPreviewServers.length === 1 ? '' : 's' }})
            </div>
            <div class="franja-preview-grid">
              <div v-for="server in franjaPreviewServers" :key="server.cedula" class="franja-preview-shell">
                <div class="franja-preview-wrapper">
                  <div v-html="buildFrontalCardMarkup(server)" class="franja-preview-render"></div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="batchOption === 'institution'" class="q-mt-sm">
            <q-select v-model="batchInstitution" :options="instituciones" option-value="id" option-label="institucion" label="Institución" emit-value map-options dense outlined />
          </div>
          <div v-if="batchOption === 'area'" class="q-mt-sm">
            <q-select
              v-model="batchArea"
              :options="areas"
              option-value="area_id"
              option-label="area"
              label="Área / Adscripción"
              emit-value
              map-options
              dense
              outlined
              use-input
              input-debounce="200"
              fill-input
              hide-selected
              @filter="filterAreaOptions"
              :display-value="areas.find(a => a.area_id === batchArea)?.area || ''"
            >
              <template v-slot:no-option>
                <q-item><q-item-section class="text-grey">Sin resultados</q-item-section></q-item>
              </template>
            </q-select>
          </div>
          <div v-if="batchOption === 'area'" class="q-mt-sm">
            <q-option-group
              v-model="batchEnte"
              :options="[
                { label: 'Ministerio (MINAAMP)', value: 'minaamp' },
                { label: 'INASS', value: 'inass' }
              ]"
              type="checkbox"
              inline
              :dense="true"
              label="Entes"
            />
            <div class="text-caption text-grey q-mt-xs">Se imprimirá solo la franja de los servidores filtrados por esa adscripción.</div>
          </div>
          <div class="q-mt-sm text-caption text-grey">Solo se imprimirán los servidores con foto y sin franja impresa.</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancelar" v-close-popup @click="batchFranjaDialog=false" />
          <q-btn flat label="Imprimir franja" color="warning" icon="print" @click="batchFranjaPrint" :disable="(batchOption === 'institution' && !batchInstitution) || (batchOption === 'area' && (!batchArea || batchEnte.length === 0))" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Reprint confirmation dialog (individual) -->
    <q-dialog v-model="reprintDialog">
      <q-card style="min-width:320px; max-width:520px">
        <q-card-section>
          <div class="text-h6" style="color:#e65100">⚠️ {{ reprintDialogMode === 'franja' ? 'Franja ya impresa' : 'Carnet ya impreso' }}</div>
          <div class="q-mt-md">{{ reprintDialogMode === 'franja' ? 'La franja del servidor' : 'El carnet del servidor' }} <b>{{ trabajador?.nombres }} {{ trabajador?.apellidos }}</b> (C.I. {{ trabajador?.cedula }}) ya se {{ reprintDialogMode === 'franja' ? 'encuentra impresa' : 'encuentra impreso' }}.</div>
          <div class="q-mt-sm text-subtitle2">¿Desea reimprimir {{ reprintDialogMode === 'franja' ? 'esta franja' : 'este carnet' }}?</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancelar" v-close-popup />
          <q-btn label="Sí, reimprimir" color="warning" @click="reprintDialogMode === 'franja' ? confirmarReimpresionFranja() : confirmarReimpresion()" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Reprint confirmation dialog (batch) -->
    <q-dialog v-model="reprintBatchDialog">
      <q-card style="min-width:320px; max-width:560px">
        <q-card-section>
          <div class="text-h6" style="color:#e65100">⚠️ {{ reprintBatchDialogMode === 'franja' ? 'Franjas ya impresas detectadas' : 'Carnets ya impresos detectados' }}</div>
          <div class="q-mt-md">De las <b>{{ pendingBatchList.length }}</b> credenciales seleccionadas, <b>{{ pendingBatchAlreadyPrinted.length }}</b> ya se {{ reprintBatchDialogMode === 'franja' ? 'encuentran con franja impresa' : 'encuentran impresas' }}:</div>
          <div class="q-mt-sm" style="max-height:200px;overflow-y:auto;">
            <div v-for="item in pendingBatchAlreadyPrinted" :key="item.cedula" class="q-ml-md text-body2">• {{ item.nombres }} {{ item.apellidos }} (C.I. {{ item.cedula }})</div>
          </div>
          <div class="q-mt-md text-subtitle2">¿Desea reimprimir {{ reprintBatchDialogMode === 'franja' ? 'las franjas' : 'todos los carnets' }} del lote (incluyendo los ya impresos)?</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Omitir impresos" v-close-popup @click="reprintBatchDialogMode === 'franja' ? confirmarOmitirFranjasLote() : confirmarOmitirImpresosLote" />
          <q-btn label="Sí, reimprimir todo" color="warning" @click="reprintBatchDialogMode === 'franja' ? confirmarReimpresionFranjaLote() : confirmarReimpresionLote" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import { Notify, LocalStorage, useQuasar } from 'quasar'
import QrcodeVue from 'qrcode.vue'

const $q = useQuasar()
const mostrarInfo = ref(true)
const imprimiendo = ref(false)

function ocultarElementos() {
  imprimiendo.value = true
  document.body.classList.add('solo-credencial')
}
function restaurarElementos() {
  imprimiendo.value = false
  document.body.classList.remove('solo-credencial')
}

const backendBase = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/+$/, '') : 'https://credenciales.minaamp.gob.ve';
function getFotoUrl(url) {
  if (!url) return '/img/no_person.png'
  if (url.startsWith('data:image/')) return url
  if (url.startsWith('/uploads')) {
    return backendBase + url
  }
  if (url.includes('no_person.png') || url.startsWith('/img')) {
    return '/img/no_person.png'
  }
  return url
}

const cedula = ref('')
const trabajador = ref(null)
const defaultFondoUrl = '/img/frontal_carnet.png'

function isINASS(item) {
  if (!item) return false
  const name = (item.institucion || item.institucion_nombre || item.institucion_text || '').toString()
  return /INSTITUTO NACIONAL DE LOS SERVICIOS SOCIALES/i.test(name)
}

function getFondoFor(item) {
  const rawArea = (item?.area || item?.unidad || item?.adscripcion || '').toString()
  const area = rawArea.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  const seguridadKeywords = ['seguridad', 'direccion general de la oficina de seguridad']
  const tecnologiaKeywords = ['tecnol', 'inform', 'informaci', 'tecnologia', 'informacion']
  const comunicacionKeywords = ['gestion comunicacional', 'comunicacional', 'comunicaciones', 'prensa']
  const inass = isINASS(item)

  if (seguridadKeywords.some(k => area.includes(k))) {
    return inass ? '/img/frontal_seguridad_inass.png' : '/img/frontal_seguridad_ministerio.png'
  }
  if (tecnologiaKeywords.some(k => area.includes(k))) {
    return inass ? '/img/frontal_carnet_inass1.png' : defaultFondoUrl
  }
  if (comunicacionKeywords.some(k => area.includes(k))) {
    return inass ? '/img/frontal_comunicaciones_inass.png' : '/img/frontal_comunicaciones_ministerio.png'
  }

  return inass ? '/img/frontal_carnet_inass1.png' : defaultFondoUrl
}

function isWideFranja(item) {
  if (!item) return false
  const area = (item.area || item.unidad || item.unidad_adscripcion || '').toString().toLowerCase()
  return area.length > 28
}

function getFooterFor(item) {
  if (isINASS(item)) {
    return '/img/inass_sello_firma.png'
  }
  return '/img/ministerio_sello_firma.png'
}

function parseFechaIngreso(item) {
  const raw = item?.fecha_ingreso || item?.fecha_ingreso_str || item?.ingreso || null
  if (!raw) return null
  const date = new Date(raw)
  return Number.isFinite(date.getTime()) ? date : null
}

function formatFechaIngreso(item) {
  const date = parseFechaIngreso(item)
  if (!date) return null
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function isTooRecentIngreso(item) {
  const ingreso = parseFechaIngreso(item)
  if (!ingreso) return false
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 3)
  return ingreso > cutoff
}

const apiBase = (import.meta.env.VITE_API_URL || 'https://localhost:3001').replace(/\/+$/, '')
axios.defaults.baseURL = apiBase
const qrBaseUrl = import.meta.env.VITE_CREDENCIAL_QR_URL || (typeof window !== 'undefined' ? `${window.location.origin}/credencial?cedula=` : 'https://localhost:3001/credenciales/cedula=')
const qrSize = 75
const qrUrl = computed(() => {
  if (!trabajador.value || !trabajador.value.cedula) return ''
  return `${qrBaseUrl}${trabajador.value.cedula}`
})

function hasPermission(permissionName) {
  const permissions = LocalStorage.getItem('permissions') || []
  return permissions.some(p => {
    if (!p) return false
    if (typeof p === 'string') return p === permissionName
    if (typeof p === 'object' && p.name) return p.name === permissionName
    return false
  })
}

// Filters
const filterCedula = ref('')
const filterNombres = ref('')
const filterApellidos = ref('')
const filterInstitucion = ref(null)
const filterSede = ref(null)
const filterArea = ref(null)
const filterCargo = ref(null)

const instituciones = ref([])
const sedes = ref([])
const areas = ref([])
const cargos = ref([])
const servidores = ref([])
const batchDialog = ref(false)
const batchOption = ref('all')
const batchInstitution = ref(null)
const batchArea = ref(null)
const batchEnte = ref([])
const allAreas = ref([])

function filterAreaOptions(val, update) {
  if (!val) {
    update(() => { areas.value = allAreas.value })
    return
  }
  update(() => {
    const needle = val.toLowerCase()
    areas.value = allAreas.value.filter(a => (a.area || '').toLowerCase().includes(needle))
  })
}

// Reprint confirmation state
const reprintDialog = ref(false)
const reprintDialogMode = ref('full')
const reprintBatchDialog = ref(false)
const reprintBatchDialogMode = ref('full')
const pendingBatchList = ref([])
const pendingBatchAlreadyPrinted = ref([])
const batchPrintMode = ref('full')
const batchFranjaDialog = ref(false)
const franjaPrintedMap = ref({})
const franjaSelectedServerIds = ref([])
const franjaSearchText = ref('')

function normalizeFranjaSelection(value) {
  const raw = Array.isArray(value) ? value : (value == null ? [] : [value])
  const normalized = raw.map(v => {
    if (v == null) return ''
    if (typeof v === 'object') {
      const candidate = v.value ?? v.cedula ?? v.id ?? v.cedula_personal ?? ''
      return String(candidate)
    }
    return String(v)
  })
  return [...new Set(normalized.filter(Boolean))]
}

watch(franjaSelectedServerIds, (value) => {
  const normalized = normalizeFranjaSelection(value)
  if (JSON.stringify(normalized) !== JSON.stringify(value)) {
    franjaSelectedServerIds.value = normalized
  }
}, { deep: true })

const franjaSelectionOptions = computed(() => {
  const q = (franjaSearchText.value || '').trim().toLowerCase()
  const source = (servidores.value || []).filter(s => s && s.cedula)
  const filtered = !q
    ? source
    : source.filter(s => {
        const haystack = `${s.nombres || ''} ${s.apellidos || ''} ${s.cedula || ''}`.toLowerCase()
        return haystack.includes(q)
      })

  return filtered.map(s => ({
    label: `${(s.nombres || '').trim()} ${(s.apellidos || '').trim()} - C.I. ${s.cedula || 'N/A'}`.trim(),
    value: String(s.cedula),
    detail: `C.I. ${s.cedula || 'N/A'} - ${s.area || s.unidad || 'Sin Área'}`,
    item: s
  }))
})

const franjaPreviewServers = computed(() => {
  const selected = normalizeFranjaSelection(franjaSelectedServerIds.value)
  const source = servidores.value || []

  if (!selected.length) return []

  return selected
    .map(id => source.find(s => String(s.cedula) === String(id)))
    .filter(Boolean)
})

function onFilterFranja(val, update) {
  franjaSearchText.value = val || ''
  update(() => {})
}

const filteredServers = computed(() => {
  return servidores.value.filter(s => {
    if (filterCedula.value && !String(s.cedula || '').includes(filterCedula.value)) return false
    if (filterNombres.value && !String(s.nombres || '').toLowerCase().includes(filterNombres.value.toLowerCase())) return false
    if (filterApellidos.value && !String(s.apellidos || '').toLowerCase().includes(filterApellidos.value.toLowerCase())) return false

    if (filterInstitucion.value) {
      const instId = s.institucion_id ?? s.institucion_codigo ?? s.id_institucion
      const idMatch = Number(instId) === Number(filterInstitucion.value)
      const opt = instituciones.value.find(o => Number(o.id) === Number(filterInstitucion.value))
      const strMatch = opt && s.institucion && String(s.institucion).toLowerCase() === String(opt.institucion).toLowerCase()
      if (!idMatch && !strMatch) return false
    }

    if (filterSede.value) {
      const sedeId = s.sede_id ?? s.id_sede
      const idMatch = Number(sedeId) === Number(filterSede.value)
      const opt = sedes.value.find(o => Number(o.id) === Number(filterSede.value))
      const strMatch = opt && s.sede && String(s.sede).toLowerCase() === String(opt.sede).toLowerCase()
      if (!idMatch && !strMatch) return false
    }

    if (filterArea.value) {
      const areaId = s.area_id ?? s.unidad_id ?? s.id_area ?? s.unidad_adscripcion_id
      const idMatch = Number(areaId) === Number(filterArea.value)
      const opt = areas.value.find(o => Number(o.area_id) === Number(filterArea.value))
      const strMatch = opt && (s.area || s.unidad || s.unidad_adscripcion) && String(s.area || s.unidad || s.unidad_adscripcion).toLowerCase() === String(opt.area).toLowerCase()
      if (!idMatch && !strMatch) return false
    }

    if (filterCargo.value) {
      const cargoId = s.cargo_id ?? s.id_cargo
      const idMatch = Number(cargoId) === Number(filterCargo.value)
      const opt = cargos.value.find(o => Number(o.id) === Number(filterCargo.value))
      const strMatch = opt && s.cargo && String(s.cargo).toLowerCase() === String(opt.cargo).toLowerCase()
      if (!idMatch && !strMatch) return false
    }

    return true
  })
})

const displayedMatches = computed(() => {
  if (!filterCedula.value && !filterNombres.value && !filterApellidos.value && !filterInstitucion.value && !filterSede.value && !filterArea.value && !filterCargo.value) {
    return []
  }
  return filteredServers.value.filter(s => {
    const p = s.foto_url || s.foto
    return p && p !== '/img/no_person.png'
  }).slice(0, 50)
})

watch([displayedMatches, filterCedula], ([matches, cedVal]) => {
  if (cedVal && cedVal.toString().length >= 6) {
    if (String(cedVal) !== String(cedula.value)) {
      cedula.value = String(cedVal)
      buscarTrabajador()
    }
  } else if (matches && matches.length > 0) {
    const first = matches[0]
    if (String(first.cedula) !== String(cedula.value)) {
      cedula.value = String(first.cedula)
      buscarTrabajador()
    }
  } else {
    trabajador.value = null
    mostrarInfo.value = false
    if (!filterCedula.value && !filterNombres.value && !filterApellidos.value && !filterInstitucion.value && !filterSede.value && !filterArea.value && !filterCargo.value) {
      cedula.value = ''
    }
  }
}, { deep: true })

async function fetchFilterOptions() {
  try {
    const requests = [
      axios.get(`${apiBase}/auth/instituciones`),
      axios.get(`${apiBase}/auth/sedes`),
      axios.get(`${apiBase}/auth/areas`),
      axios.get(`${apiBase}/auth/servidores_cargos`)
    ]

    const willFetchServidores = (LocalStorage.getItem('permissions') || []).some(p => {
      if (!p) return false
      const name = typeof p === 'string' ? p : (p && p.name ? p.name : '')
      return [
        'read_servidor',
        'view_admin',
        'view_admin1',
        'print_credencial',
        'create_servidor',
        'update_servidor',
        'delete_servidor'
      ].includes(name)
    })
    if (willFetchServidores) requests.push(axios.get(`${apiBase}/auth/servidores`))

    const [instRes, sedesRes, areasRes, cargosRes, servidoresRes] = await Promise.all(requests)
    instituciones.value = instRes.data || []
    sedes.value = sedesRes.data || []
    areas.value = areasRes.data || []
    allAreas.value = areasRes.data || []
    cargos.value = cargosRes.data || []
    if (willFetchServidores) servidores.value = servidoresRes.data || []
  } catch (err) {
    console.error('Error fetching filter options', err)
    const status = err.response?.status
    if (status === 403) {
      Notify.create({ type: 'negative', message: 'Acceso denegado: no tienes permisos para obtener opciones de filtros de servidores.' })
    } else {
      Notify.create({ type: 'negative', message: 'Error cargando opciones de filtros.' })
    }
  }
}

function clearFilters() {
  filterCedula.value = ''
  filterNombres.value = ''
  filterApellidos.value = ''
  filterInstitucion.value = null
  filterSede.value = null
  filterArea.value = null
  filterCargo.value = null
  cedula.value = ''
  trabajador.value = null
  mostrarInfo.value = false
  batchDialog.value = false
  batchOption.value = 'all'
  batchInstitution.value = null
  batchArea.value = null
  franjaSelectedServerIds.value = []
}

function selectAndLoad(s) {
  if (!s || !s.cedula) return
  cedula.value = String(s.cedula)
  buscarTrabajador()
}

async function selectAndPrint(s) {
  if (!s || !s.cedula) return
  cedula.value = String(s.cedula)
  await buscarTrabajador()
  setTimeout(() => { if (trabajador.value) imprimirCredencial() }, 200)
}

function buildFrontalCardMarkup(item) {
  if (!item) return ''

  const foto = getFotoUrl(item.foto_url || '/img/no_person.png')
  const nombre = (item.nombres || '').toUpperCase()
  const apellidos = (item.apellidos || '').toUpperCase()
  const cargo = item.cargo || item.cargo_nombre || item.cargo_descripcion || item.cargo_text || ''
  const nivel = item.nivel || item.nivel_id || 1
  const franjaText = (item.abreviacion && String(item.abreviacion).trim())
    ? String(item.abreviacion).trim()
    : (item.unidad || item.unidad_adscripcion || item.area || '')
      ? String(item.unidad || item.unidad_adscripcion || item.area).toUpperCase().slice(0, 14)
      : ''
  const fondoFront = getFondoFor(item)

  return `
    <div class="credencial-preview credencial-frontal">
      <img src="${fondoFront}" class="fondo-img" alt="Fondo carnet" />
      <img src="${foto}" class="foto-trabajador" crossorigin="anonymous" alt="Foto trabajador" />
      <div class="info-stack">
        <div class="nombre">${nombre} ${apellidos}</div>
        <div class="cargo">${cargo}</div>
      </div>
      <div class="${item.condicion === 'JUBILADO' ? 'franja-jubilado' : 'franja' + nivel}${isWideFranja(item) ? ' franja-w' : ''}">
        ${item.condicion === 'JUBILADO' ? 'JUBILADO' : franjaText}
      </div>
    </div>
  `
}

function buildFranjaOnlyCardMarkup(item) {
  if (!item) return ''

  const nivel = item.nivel || item.nivel_id || 1
  const franjaText = (item.abreviacion && String(item.abreviacion).trim())
    ? String(item.abreviacion).trim()
    : (item.unidad || item.unidad_adscripcion || item.area || '')
      ? String(item.unidad || item.unidad_adscripcion || item.area).toUpperCase().slice(0, 14)
      : ''

  return `
    <div class="print-page franja-page">
      <div class="franja-only-card">
        <div class="${item.condicion === 'JUBILADO' ? 'franja-jubilado' : 'franja' + nivel}${isWideFranja(item) ? ' franja-w' : ''}">
          ${item.condicion === 'JUBILADO' ? 'JUBILADO' : franjaText}
        </div>
      </div>
    </div>
  `
}

function buildCredentialHtml(item) {
  const qrImg = encodeURI(`${qrBaseUrl}${item.cedula}`)
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrImg}`

  return `
    <div class="print-page">
      ${buildFrontalCardMarkup(item)}
    </div>
    <div class="print-page print-page-back">
      <div class="credencial-preview credencial-trasera">
        <img src="${isINASS(item) ? '/img/reverso_inass.png' : '/img/reverso.png'}" class="fondo-img-reverso" />
        <img src="${qrSrc}" class="qr-code-reverso" />
      </div>
    </div>`
}

function openPrintWindow(html) {
  const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : ''
  const style = `
    @font-face {
      font-family: 'Georama';
      src: url('${origin}/src/assets/fonts/georama/Georama-Regular.ttf') format('truetype');
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: 'Georama';
      src: url('${origin}/src/assets/fonts/georama/Georama-Bold.ttf') format('truetype');
      font-weight: 700;
      font-style: normal;
    }
    html,body { margin:0; padding:0; background: white; }
    * { box-sizing: border-box; font-family: 'Georama', sans-serif; }
    @page { size: 55mm 85mm; margin: 0; }

    .print-page {
      width: 55mm;
      height: 85mm;
      display: block;
      page-break-after: always;
      page-break-inside: avoid;
      padding: 0;
      margin: 0;
      overflow: hidden;
      position: relative;
    }
    @media print {
      .print-page-back {
        transform: rotate(180deg);
        transform-origin: 50% 50%;
        display: block;
      }
      .print-page-back * { transform: none !important; }
    }
    .credencial-preview {
      width: 55mm; height: 85mm; position: relative; background: transparent; margin: 0;
      font-family: 'Georama', sans-serif; overflow: hidden; border: none; box-shadow: none;
    }

    .fondo-img { position: absolute; width: 100%; height: 100%; left: 0; top: 0; z-index: 1; object-fit: cover; }
    .foto-trabajador { position: absolute; width: 22mm; height: 28mm; left: 16.5mm; top: 24.5mm; object-fit: cover; z-index: 2; border-radius: 4mm; border: none; box-sizing: border-box; }

    .info-stack { position: absolute; top: 53.5mm; left: 0; width: 100%; display:flex; flex-direction:column; align-items:center; gap:0mm; padding: 0 4mm; z-index: 4; }
    .nombre { text-align:center; display:block; font-size:3.7mm; font-weight:700; line-height:1.05; word-wrap:break-word; margin: 0; width: 100%; color: #0A124F; }
    .cedula { font-size:5mm; font-weight:700; margin-top:0.3mm; display:block; line-height:1.05; width: 100%; text-align:center; }
    .cargo { font-size:2.6mm; display:block; margin-top:0.5mm; text-align:center; line-height:1.08; width: 100%; color: #4C4847; }

    .franja1, .franja2, .franja3, .franja-jubilado { position: absolute; left: 0; top: 66.4mm; width: 55mm; min-height: 4.6mm; padding: 0.2mm 1.2mm; display:flex; align-items:center; justify-content:center; text-align:center; font-size: 2.3mm; font-weight: 800; z-index: 3; box-sizing:border-box; overflow:hidden; line-height:1.05; letter-spacing:0.02em; }
    .franja1, .franja2, .franja3 { background-color: #131250; color: rgba(255,255,255,1); }
    .franja-jubilado { background-color: #131250 !important; color: #FFFFFF !important; }
    .franja-w { min-height: 4.9mm; top: 66.2mm; font-size: 2.5mm; }

    .credencial-trasera { background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); }
    .fondo-img-reverso { position: absolute; width: 55mm; height: 85mm; left: 0; top: 0; z-index: 1; object-fit: cover; }
    .qr-code-reverso { position: absolute; width: 35%; height: 28%; left: 54%; top: 61%; z-index: 2; background: white; display: flex; align-items: center; justify-content: center; }
    .qr-code-reverso img, .qr-code-reverso canvas { width: 100% !important; height: 100% !important; object-fit: contain; }

    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  `

  const w = window.open('', '_blank')
  if (!w) {
    Notify.create({ type: 'negative', message: 'Imposible abrir ventana de impresión (bloqueador de popups).' })
    return
  }

  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><base href="${origin}/"><title>Impresión masiva</title><style>${style}</style></head><body>${html}</body></html>`)
  w.document.close()

  const waitForImages = (win, timeout = 8000) => new Promise(resolve => {
    const start = Date.now()
    const check = () => {
      try {
        const imgs = win.document.images || []
        let allLoaded = true
        for (let i = 0; i < imgs.length; i++) {
          if (!imgs[i].complete) { allLoaded = false; break }
        }
        if (allLoaded) return resolve(true)
      } catch (e) {
        return resolve(false)
      }
      if (Date.now() - start > timeout) return resolve(false)
      setTimeout(check, 100)
    }
    check()
  })

  const doPrint = () => {
    try { w.focus(); w.print() } catch (e) { console.error(e) }
  }

  const fontsReady = (w.document.fonts && w.document.fonts.ready) ? w.document.fonts.ready.catch(() => {}) : Promise.resolve()
  Promise.all([fontsReady, waitForImages(w, 8000)]).then(() => setTimeout(doPrint, 250)).catch(() => setTimeout(doPrint, 500))
}

async function batchPrint() {
  if (batchPrintMode.value === 'franja') {
    return batchFranjaPrint()
  }
  let list = filteredServers.value || []
  if (batchOption.value === 'institution' && batchInstitution.value) {
    list = list.filter(s => Number(s.institucion_id) === Number(batchInstitution.value))
  }
  if (batchOption.value === 'area' && batchArea.value) {
    list = list.filter(s => {
      const areaId = s.area_id ?? s.unidad_id ?? s.id_area ?? s.unidad_adscripcion_id
      const matchArea = areaId != null && Number(areaId) === Number(batchArea.value)
        || (() => {
          const opt = allAreas.value.find(a => Number(a.area_id) === Number(batchArea.value))
          return opt && (s.area || s.unidad || s.unidad_adscripcion) &&
            String(s.area || s.unidad || s.unidad_adscripcion).toLowerCase() === String(opt.area).toLowerCase()
        })()
      if (!matchArea) return false
      if (!batchEnte.value || batchEnte.value.length === 0) return true
      const institucionNombre = String(s.institucion || s.institucion_nombre || '').trim()
      const isInass = /INSTITUTO\s+NACIONAL\s+DE\s+LOS\s+SERVICIOS\s+SOCIALES/i.test(institucionNombre)
      const isMinaamp = /MINISTERIO\s+DEL\s+PODER\s+POPULAR|MINAAMP|ADULTOS\s+Y\s+ADULTAS\s+MAYORES/i.test(institucionNombre)
      if (batchEnte.value.includes('minaamp') && isMinaamp) return true
      if (batchEnte.value.includes('inass') && isInass) return true
      return false
    })
  }
  list = list.filter(s => s.foto_url && s.foto_url !== '/img/no_person.png')
  if (!list || list.length === 0) {
    Notify.create({ type: 'negative', message: 'No hay credenciales con foto para imprimir con esos filtros.' })
    return
  }

  const enriched = await Promise.all(list.map(async (s) => {
    try {
      const res = await axios.get(`${apiBase}/auth/credencial/${s.cedula}`)
      if (res && res.data && res.data.cedula) return res.data
    } catch (err) {
      console.warn('batchPrint: could not fetch full data for', s.cedula, err && err.message)
    }
    return s
  }))

  const alreadyPrinted = enriched.filter(s => s.ya_impreso === true)
  if (alreadyPrinted.length > 0) {
    pendingBatchList.value = enriched
    pendingBatchAlreadyPrinted.value = alreadyPrinted
    batchDialog.value = false
    reprintBatchDialog.value = true
    return
  }

  executeBatchPrint(enriched)
}

async function batchFranjaPrint() {
  const selectedCedulas = normalizeFranjaSelection(franjaSelectedServerIds.value)
  let list = servidores.value || []

  if (selectedCedulas.length > 0) {
    list = list.filter(s => selectedCedulas.includes(String(s.cedula)))
  } else {
    list = filteredServers.value || []
  }

  if (batchOption.value === 'institution' && batchInstitution.value) {
    list = list.filter(s => Number(s.institucion_id) === Number(batchInstitution.value))
  }
  if (batchOption.value === 'area' && batchArea.value) {
    list = list.filter(s => {
      const areaId = s.area_id ?? s.unidad_id ?? s.id_area ?? s.unidad_adscripcion_id
      const matchArea = areaId != null && Number(areaId) === Number(batchArea.value)
        || (() => {
          const opt = allAreas.value.find(a => Number(a.area_id) === Number(batchArea.value))
          return opt && (s.area || s.unidad || s.unidad_adscripcion) &&
            String(s.area || s.unidad || s.unidad_adscripcion).toLowerCase() === String(opt.area).toLowerCase()
        })()
      if (!matchArea) return false
      if (!batchEnte.value || batchEnte.value.length === 0) return true
      const institucionNombre = String(s.institucion || s.institucion_nombre || '').trim()
      const isInass = /INSTITUTO\s+NACIONAL\s+DE\s+LOS\s+SERVICIOS\s+SOCIALES/i.test(institucionNombre)
      const isMinaamp = /MINISTERIO\s+DEL\s+PODER\s+POPULAR|MINAAMP|ADULTOS\s+Y\s+ADULTAS\s+MAYORES/i.test(institucionNombre)
      if (batchEnte.value.includes('minaamp') && isMinaamp) return true
      if (batchEnte.value.includes('inass') && isInass) return true
      return false
    })
  }

  list = list.filter(s => s.foto_url && s.foto_url !== '/img/no_person.png' && !franjaPrintedMap.value[String(s.cedula)])
  if (!selectedCedulas.length && (!list || list.length === 0)) {
    Notify.create({ type: 'negative', message: 'Debe seleccionar al menos un servidor para imprimir la franja.' })
    return
  }
  if (!list || list.length === 0) {
    Notify.create({ type: 'negative', message: 'No hay servidores con foto y sin franja impresa para el filtro o selección actual.' })
    return
  }

  const enriched = await Promise.all(list.map(async (s) => {
    try {
      const res = await axios.get(`${apiBase}/auth/credencial/${s.cedula}`)
      if (res && res.data && res.data.cedula) return res.data
    } catch (err) {
      console.warn('batchFranjaPrint: no se pudo obtener', s.cedula, err && err.message)
    }
    return s
  }))

  const alreadyPrinted = enriched.filter(s => franjaPrintedMap.value[String(s.cedula)])
  if (alreadyPrinted.length > 0) {
    pendingBatchList.value = enriched
    pendingBatchAlreadyPrinted.value = alreadyPrinted
    reprintBatchDialogMode.value = 'franja'
    batchDialog.value = false
    batchFranjaDialog.value = false
    reprintBatchDialog.value = true
    return
  }

  executeFranjaPrint(enriched)
  batchDialog.value = false
  batchFranjaDialog.value = false
}

function confirmarReimpresionFranjaLote() {
  reprintBatchDialog.value = false
  executeFranjaPrint(pendingBatchList.value)
  pendingBatchList.value = []
  pendingBatchAlreadyPrinted.value = []
}

function confirmarOmitirFranjasLote() {
  reprintBatchDialog.value = false
  const pendientes = pendingBatchList.value.filter(item => !franjaPrintedMap.value[String(item.cedula)])
  pendingBatchList.value = []
  pendingBatchAlreadyPrinted.value = []
  if (!pendientes || pendientes.length === 0) {
    Notify.create({ type: 'info', message: 'No hay franjas pendientes de impresión después de omitir las ya impresas.' })
    return
  }
  executeFranjaPrint(pendientes)
}

async function executeBatchPrint(enriched) {
  const printable = enriched.filter(s => !isTooRecentIngreso(s))
  const excludedCount = enriched.length - printable.length
  if (excludedCount > 0) {
    Notify.create({
      type: 'negative',
      message: `Se excluyeron ${excludedCount} credenciales con fecha de ingreso menor a 3 meses.`
    })
  }
  if (!printable.length) {
    Notify.create({
      type: 'negative',
      message: 'No hay credenciales válidas para imprimir después de aplicar la restricción de ingreso.'
    })
    return
  }

  const html = printable.map(buildCredentialHtml).join('\n')
  batchDialog.value = false

  const createdHistoryIds = []
  const reportResults = await Promise.allSettled(
    printable.map(async (s) => {
      if (!s || !s.cedula) return null
      const saved = await bgReportPrint(s.cedula, false)
      if (saved) return saved
      return null
    })
  )

  reportResults.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) createdHistoryIds.push(result.value)
  })

  openPrintWindow(html)

  $q.dialog({
    title: 'Confirmar entrega de lote',
    message: `Se registró la impresión de ${printable.length} credenciales. ¿Se entregaron o quedan en espera?`,
    ok: {
      label: 'Entregadas',
      color: 'positive',
      icon: 'check'
    },
    cancel: {
      label: 'En espera',
      color: 'warning',
      icon: 'schedule'
    },
    persistent: true
  }).onOk(() => {
    markBatchHistoryDelivered(createdHistoryIds, true)
  }).onCancel(() => {
    markBatchHistoryDelivered(createdHistoryIds, false)
  })
}

function confirmarReimpresionLote() {
  reprintBatchDialog.value = false
  executeBatchPrint(pendingBatchList.value)
  pendingBatchList.value = []
  pendingBatchAlreadyPrinted.value = []
}

function confirmarOmitirImpresosLote() {
  reprintBatchDialog.value = false
  const pendientes = pendingBatchList.value.filter(item => item.ya_impreso !== true)
  pendingBatchList.value = []
  pendingBatchAlreadyPrinted.value = []
  if (!pendientes || pendientes.length === 0) {
    Notify.create({ type: 'info', message: 'No hay carnets pendientes de impresión después de omitir los ya impresos.' })
    return
  }
  executeBatchPrint(pendientes)
}

async function buscarTrabajador() {
  if (!cedula.value) return
  try {
    const res = await axios.get(`${apiBase}/auth/credencial/${cedula.value}`)
    if (!res.data || !res.data.cedula) {
      trabajador.value = null
      mostrarInfo.value = false
      Notify.create({ type: 'negative', message: 'El número de Cédula de Identidad introducido no corresponde con ningún trabajador registrado.', position: 'center' })
      return
    }
    if (res.data.foto_url === '/img/no_person.png') {
      trabajador.value = null
      mostrarInfo.value = false
      Notify.create({ type: 'warning', message: 'No se puede imprimir la credencial porque no existe la foto del Servidor Público.', position: 'center' })
      return
    }
    trabajador.value = res.data
    mostrarInfo.value = true
  } catch (err) {
    trabajador.value = null
    mostrarInfo.value = false
    console.error('Error buscarTrabajador:', err)
    const msg = (err && err.message && err.message.toLowerCase && err.message.toLowerCase().includes('network'))
      ? 'Network Error: no se pudo conectar al servidor. Verifica que el backend esté corriendo.'
      : 'El número de Cédula de Identidad introducido no corresponde con ningún trabajador registrado.'
    Notify.create({ type: 'negative', message: msg, position: 'center' })
  }
}

// Disable on scan
const disableDialogCred = ref(false)
const disableReasonCred = ref(null)
const disableReasonsCred = [
  { label: 'Egreso', value: 'egreso' },
  { label: 'Extravio', value: 'extravio' },
  { label: 'Deterioro', value: 'deterioro' },
  { label: 'Robo/Hurto', value: 'robo_hurto' },
  { label: 'Actualización', value: 'actualizacion' }
]
const scannedInactiveDialog = ref(false)
const scannedInactiveMessage = ref('')

async function confirmDisableCred() {
  if (!trabajador.value || !trabajador.value.cedula) return
  if (!disableReasonCred.value) {
    Notify.create({ type: 'negative', message: 'Seleccione motivo para deshabilitar' })
    return
  }
  try {
    const token = LocalStorage.getItem('token')
    await axios.patch(`${apiBase}/auth/eliminar_servidor/${trabajador.value.cedula}`, { reason: disableReasonCred.value }, { headers: { Authorization: `Bearer ${token}` } })
    Notify.create({ type: 'positive', message: 'Credencial deshabilitada' })
    trabajador.value = { ...trabajador.value, activo: false, disable_reason: disableReasonCred.value }
    disableDialogCred.value = false
  } catch (err) {
    console.error('confirmDisableCred', err)
    Notify.create({ type: 'negative', message: 'Error deshabilitando credencial' })
  }
}

const route = useRoute()

onMounted(() => {
  fetchFilterOptions()
  const q = route.query && route.query.cedula
  const scan = route.query && (route.query.scan === '1' || route.query.scan === 'true')
  if (q) {
    cedula.value = String(q)
    setTimeout(() => buscarTrabajador(), 50)
    if (scan) {
      const unwatch = watch(trabajador, (v) => {
        if (v && v.cedula) {
          const reason = v.disable_reason || v.inactive_reason || v.disable_motivo || v.motivo || null
          if (v.activo === false || reason) {
            scannedInactiveMessage.value = reason ? String(reason) : 'Credencial inactiva'
            scannedInactiveDialog.value = true
          } else {
            disableDialogCred.value = true
          }
          unwatch()
        }
      })
    }
  }
})

onBeforeUnmount(() => {
  // cleanup if needed
})

function imprimirCredencial() {
  if (!trabajador.value) return

  if (isTooRecentIngreso(trabajador.value)) {
    Notify.create({
      type: 'negative',
      message: 'No se puede imprimir la credencial: el trabajador tiene fecha de ingreso menor a 3 meses.'
    })
    return
  }

  if (trabajador.value.ya_impreso === true) {
    reprintDialogMode.value = 'full'
    reprintDialog.value = true
    return
  }

  executeIndividualPrint()
}

function imprimirFranja() {
  if (!trabajador.value) return
  const key = String(trabajador.value.cedula)
  if (franjaPrintedMap.value[key]) {
    reprintDialogMode.value = 'franja'
    reprintDialog.value = true
    return
  }
  executeFranjaPrint([trabajador.value])
}

function openFranjaBatchDialog() {
  franjaSearchText.value = ''
  batchFranjaDialog.value = true
}

function confirmarReimpresion() {
  reprintDialog.value = false
  executeIndividualPrint()
}

function confirmarReimpresionFranja() {
  reprintDialog.value = false
  executeFranjaPrint([trabajador.value])
}

async function executeIndividualPrint() {
  if (!trabajador.value) return
  const html = buildCredentialHtml(trabajador.value)
  const cedulaStr = trabajador.value.cedula
  const nombresStr = trabajador.value.nombres
  const apellidosStr = trabajador.value.apellidos

  openPrintWindow(html)

  let historyId = null
  try {
    historyId = await bgReportPrint(cedulaStr, false)
  } catch (err) {
    console.warn('[CredencialPage] No se pudo registrar la impresión automáticamente:', err)
  }

  $q.dialog({
    title: 'Confirmar entrega de carnet',
    message: `¿El carnet impreso de <strong>${nombresStr} ${apellidosStr}</strong> fue entregado al servidor, o se encuentra a la espera de ser entregado?`,
    html: true,
    ok: {
      label: 'Entregado',
      color: 'positive',
      icon: 'check'
    },
    cancel: {
      label: 'En espera',
      color: 'warning',
      icon: 'schedule'
    },
    persistent: true
  }).onOk(async () => {
    if (historyId) {
      await patchPrintDelivered(historyId, true)
    } else {
      await bgReportPrint(cedulaStr, true)
    }
  }).onCancel(async () => {
    if (!historyId) {
      await bgReportPrint(cedulaStr, false)
    }
  })
}

function executeFranjaPrint(items) {
  if (!Array.isArray(items) || items.length === 0) return
  const printable = items.filter(item => item && item.cedula)
  if (!printable.length) return

  const html = printable.map(buildFranjaOnlyCardMarkup).join('\n')
  openPrintWindow(html)

  printable.forEach(item => {
    const key = String(item.cedula)
    franjaPrintedMap.value[key] = true
  })

  const first = printable[0]
  const nombres = first.nombres || ''
  const apellidos = first.apellidos || ''

  $q.dialog({
    title: 'Confirmar entrega de franja',
    message: `¿Se completó la impresión de franjas de los ${printable.length} servidor(es) seleccionado(s)?`,
    html: true,
    ok: {
      label: 'Sí, entregada(s)',
      color: 'positive',
      icon: 'check'
    },
    cancel: {
      label: 'En espera',
      color: 'warning',
      icon: 'schedule'
    },
    persistent: true
  })
}

async function bgReportPrint(cedulaStr, entregadoVal) {
  try {
    const token = LocalStorage.getItem('token')
    if (!token) return null
    const res = await axios.post(`${apiBase}/auth/credencial/historico`, { cedula: cedulaStr, entregado: !!entregadoVal }, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return res.data?.historyId || null
  } catch (err) {
    console.error('No se pudo registrar la impresión en el módulo de gestión:', err)
    return null
  }
}

async function markBatchHistoryDelivered(historyIds, entregadoVal) {
  try {
    const token = LocalStorage.getItem('token')
    if (!token || !historyIds || historyIds.length === 0) return
    await Promise.allSettled(
      historyIds.map((historyId) => axios.patch(`${apiBase}/auth/credencial/historico/${historyId}/entregado`, { entregado: !!entregadoVal }, {
        headers: { Authorization: `Bearer ${token}` }
      }))
    )
  } catch (err) {
    console.error('No se pudo actualizar el estado de entrega del lote:', err)
  }
}

async function patchPrintDelivered(historyId, entregadoVal) {
  try {
    const token = LocalStorage.getItem('token')
    if (!token || !historyId) return
    await axios.patch(`${apiBase}/auth/credencial/historico/${historyId}/entregado`, { entregado: !!entregadoVal }, {
      headers: { Authorization: `Bearer ${token}` }
    })
  } catch (err) {
    console.error('No se pudo actualizar el estado de entrega del carnet:', err)
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
.credencial-front-render {
  display: inline-block;
  width: 55mm;
  height: 85mm;
  min-height: 85mm;
  position: relative;
}
.credencial-front-render :deep(.credencial-preview),
.credencial-front-render :deep(.fondo-img),
.credencial-front-render :deep(.foto-trabajador),
.credencial-front-render :deep(.info-stack),
.credencial-front-render :deep(.nombre),
.credencial-front-render :deep(.cargo),
.credencial-front-render :deep(.franja1),
.credencial-front-render :deep(.franja2),
.credencial-front-render :deep(.franja3),
.credencial-front-render :deep(.franja-jubilado),
.credencial-front-render :deep(.franja-w) {
  box-sizing: border-box;
}

.credencial-front-render :deep(.credencial-preview) {
  width: 55mm;
  height: 85mm;
  position: relative;
  overflow: hidden;
  background: transparent;
  margin: 0;
  border: none;
  box-shadow: none;
}

.credencial-front-render :deep(.fondo-img) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
}

.credencial-front-render :deep(.foto-trabajador) {
  position: absolute;
  width: 21.8mm;
  height: 27.8mm;
  left: 16.6mm;
  top: 24.2mm;
  object-fit: cover;
  z-index: 2;
  border-radius: 4mm;
  border: none;
}

.credencial-front-render :deep(.info-stack) {
  position: absolute;
  top: 53.1mm;
  left: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 4mm;
  box-sizing: border-box;
  z-index: 4;
}

.credencial-front-render :deep(.nombre) {
  text-align: center;
  font-size: 3.6mm;
  font-weight: 700;
  line-height: 1.05;
  width: 100%;
  word-wrap: break-word;
  color: #0A124F;
}

.credencial-front-render :deep(.cargo) {
  text-align: center;
  font-size: 2.5mm;
  line-height: 1.08;
  width: 100%;
  margin-top: 0.5mm;
  color: #4C4847;
}

.credencial-front-render :deep(.franja1),
.credencial-front-render :deep(.franja2),
.credencial-front-render :deep(.franja3),
.credencial-front-render :deep(.franja-jubilado),
.credencial-front-render :deep(.franja-w) {
  position: absolute;
  left: 0;
  top: 66.2mm;
  width: 55mm;
  min-height: 4.4mm;
  padding: 0.14mm 1.2mm;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 2.2mm;
  font-weight: 800;
  z-index: 3;
  box-sizing: border-box;
  overflow: hidden;
  line-height: 1.05;
  letter-spacing: 0.02em;
}

.credencial-front-render :deep(.franja1),
.credencial-front-render :deep(.franja2),
.credencial-front-render :deep(.franja3) { background: #131250 !important; color: rgba(255,255,255,1) !important; }
.credencial-front-render :deep(.franja-jubilado) { background: #131250 !important; color: #FFFFFF !important; }
.credencial-front-render :deep(.franja-w) { top: 66.2mm; font-size: 2.2mm; }

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

/* --- VISTA PREVIA CORREGIDA Y CENTRADA PARA LOTE MULTIPLE --- */
.franja-preview-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
  max-height: 460px;
  overflow-y: auto;
  padding: 12px;
  width: 100%;
}

.franja-preview-shell {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  background: #f0f2f5;
  width: 100%;
  max-width: 420px;
  box-sizing: border-box;
}

.franja-preview-wrapper {
  width: calc(55mm * 0.85);
  height: calc(85mm * 0.85);
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.franja-preview-render {
  width: 55mm;
  height: 85mm;
  position: absolute;
  top: 0;
  left: 0;
  transform: scale(0.85);
  transform-origin: top left;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
  background: #ffffff;
  border-radius: 4px;
  overflow: hidden;
}

.franja-preview-render :deep(.credencial-preview) {
  width: 55mm;
  height: 85mm;
  position: relative;
  overflow: hidden;
  background: transparent;
  margin: 0;
  border: none;
  box-shadow: none;
}

.franja-preview-render :deep(.fondo-img) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
}

.franja-preview-render :deep(.foto-trabajador) {
  position: absolute;
  width: 21.8mm;
  height: 27.8mm;
  left: 16.6mm;
  top: 24.2mm;
  object-fit: cover;
  z-index: 2;
  border-radius: 4mm;
  border: none;
}

.franja-preview-render :deep(.info-stack) {
  position: absolute;
  top: 53.1mm;
  left: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 4mm;
  box-sizing: border-box;
  z-index: 4;
}

.franja-preview-render :deep(.nombre) {
  text-align: center;
  font-size: 3.6mm;
  font-weight: 700;
  line-height: 1.05;
  width: 100%;
  word-wrap: break-word;
  color: #0A124F;
}

.franja-preview-render :deep(.cargo) {
  text-align: center;
  font-size: 2.5mm;
  line-height: 1.08;
  width: 100%;
  margin-top: 0.5mm;
  color: #4C4847;
}

.franja-preview-render :deep(.franja1),
.franja-preview-render :deep(.franja2),
.franja-preview-render :deep(.franja3),
.franja-preview-render :deep(.franja-jubilado),
.franja-preview-render :deep(.franja-w) {
  position: absolute;
  left: 0;
  top: 66.2mm;
  width: 55mm;
  min-height: 4.4mm;
  padding: 0.14mm 1.2mm;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 2.2mm;
  font-weight: 800;
  z-index: 3;
  box-sizing: border-box;
  overflow: hidden;
  line-height: 1.05;
  letter-spacing: 0.02em;
}

.franja-preview-render :deep(.franja1),
.franja-preview-render :deep(.franja2),
.franja-preview-render :deep(.franja3) { background: #131250 !important; color: rgba(255,255,255,1) !important; }
.franja-preview-render :deep(.franja-jubilado) { background: #131250 !important; color: #FFFFFF !important; }
.franja-preview-render :deep(.franja-w) { top: 66.2mm; font-size: 2.2mm; }

.franja-page {
  width: 55mm;
  height: 85mm;
  display: block;
  page-break-after: always;
  page-break-inside: avoid;
  margin: 0;
  padding: 0;
  overflow: hidden;
  position: relative;
}

.franja-only-card {
  width: 55mm;
  height: 85mm;
  position: relative;
  background: white;
  overflow: hidden;
}

@media print {
  .no-print {
    display: none !important;
  }
}
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
  overflow: hidden;
  background: transparent;
  border: none;
  box-shadow: none;
  margin: 0;
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
  object-fit: cover;
}
.foto-trabajador {
  position: absolute;
  width: 22mm;
  height: 28mm;
  left: 16.5mm;
  top: 24.5mm;
  object-fit: cover;
  z-index: 2;
  border-radius: 4mm;
  border: none;
  box-sizing: border-box;
}
.info-stack {
  position: absolute;
  top: 53.5mm;
  left: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0mm;
  padding: 0 4mm;
  box-sizing: border-box;
  z-index: 4;
}
.nombre {
  text-align: center;
  font-size: 3.7mm;
  font-family: 'Georama', sans-serif;
  font-weight: 700;
  line-height: 1.05;
  width: 100%;
  word-wrap: break-word;
  margin: 0;
  color: #0A124F;
}
.cedula {
  text-align: center;
  font-size: 5mm;
  font-family: 'Georama', sans-serif;
  font-weight: 700;
  line-height: 1.05;
  width: 100%;
  margin-top: 0.3mm;
  color: #0A124F;
}
.cargo {
  text-align: center;
  font-size: 2.6mm;
  font-family: 'Georama', sans-serif;
  font-weight: 400;
  line-height: 1.08;
  width: 100%;
  margin-top: 0.5mm;
  color: #4C4847;
}
.franja1, .franja2, .franja3, .franja-jubilado {
  position: absolute;
  left: 0;
  top: 66.1mm;
  width: 55mm;
  min-height: 4.3mm;
  padding: 0.14mm 1.2mm;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 2.3mm;
  font-family: 'Georama', sans-serif;
  font-weight: 800;
  z-index: 3;
  box-sizing: border-box;
  overflow: hidden;
  line-height: 1.05;
  letter-spacing: 0.02em;
}
.franja1, .franja2, .franja3 {
  background-color: #131250 !important;
  color: rgba(255,255,255,1) !important;
}
.franja-jubilado {
  color:#FFFFFF !important;
  background-color: #131250 !important;
}
.franja-w {
  min-height: 4.6mm;
  top: 65.9mm;
  font-size: 2.2mm;
}

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
.footer-container {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-top: 1.5mm;
  gap: 2mm;
}
.sello-img {
  width: 180px;
  height: 165px;
  object-fit: contain;
  margin-left: -4mm;
  margin-top: -1.5mm;
}
.qr-code {
  background: white;
  padding: 1.5mm;
  border-radius: 2mm;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  transform: none;
}
@media print {
  .credencial-frontal {
    page-break-after: always;
  }

  .credencial-trasera {
    page-break-before: always;
  }

  .credencial-preview {
    display: block !important;
    visibility: visible !important;
  }
}
.fondo-img-reverso {
  position: absolute;
  width: 55mm;
  height: 85mm;
  left: 0;
  top: 0;
  z-index: 1;
  object-fit: cover;
}
.qr-code-reverso {
  position: absolute;
  left: 54%;
  top: 61%;
  width: 35%;
  height: 28%;
  z-index: 10;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
}
.qr-code-reverso :deep(canvas),
.qr-code-reverso :deep(svg),
.qr-code-reverso :deep(img) {
  width: 100% !important;
  height: 100% !important;
  display: block !important;
  object-fit: contain;
}
</style>
