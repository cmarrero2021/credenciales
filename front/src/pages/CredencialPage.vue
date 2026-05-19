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
          <q-btn  label="Limpiar Filtros" color="primary" @click="clearFilters" class="full-width" />
        </div>
      </div>
      <div class="q-mt-sm">
        <!-- Lista oculta: aplicamos filtros y cargamos la primera credencial con foto disponible -->
      </div>
    </div>
    <q-btn v-if="trabajador && (hasPermission('print_credencial') || hasPermission('view_admin'))" label="Imprimir" color="secondary" @click="imprimirCredencial" class="q-mb-lg" />
    <q-btn v-if="(hasPermission('print_credencial') || hasPermission('view_admin'))" label="Imprimir por lote" color="primary" outline class="q-ml-sm q-mb-lg" @click="batchDialog = true" />

    <div v-if="trabajador" class="credencial-container">
      <!-- Parte delantera -->
      <div class="credencial-preview credencial-frontal">
        <img :src="getFondoFor(trabajador)" class="fondo-img" alt="Fondo carnet" />
        <img :src="getFotoUrl(trabajador.foto_url)" class="foto-trabajador" alt="Foto trabajador" />
        <div class="info-stack">
          <div class="nombre">{{ trabajador.nombres }} {{ trabajador.apellidos }}</div>
          <div class="cedula">{{ trabajador.cedula }}</div>
          <div class="cargo">{{ trabajador.cargo }}</div>
        </div>
        <div :class="[
          trabajador.condicion === 'JUBILADO' ? 'franja-jubilado' : 'franja' + trabajador.nivel,
          isWideFranja(trabajador) ? 'franja-w' : ''
        ]">
          {{ trabajador.condicion === 'JUBILADO' ? 'JUBILADO' : trabajador.abreviacion }}
        </div>
      </div>

        
      <!-- Parte trasera -->
      <div class="credencial-preview credencial-trasera">
        <div class="contenido-trasero">
          <div class="texto-trasero">
            <p class="parrafo-trasero">
              <span class="bullet">•</span> Este carnet es de uso exclusivo para el personal que labora en Ministerio del Poder Popular de Adultos y Adultas Mayores Abuelos y Abuelas de la Patria
            </p>
            <p class="parrafo-trasero">
              <span class="bullet">•</span> Debe ser utilizado en un lugar visible
            </p>
            <p class="parrafo-trasero">
              <span class="bullet">•</span> Puede ser retenido por la Dirección General de Seguridad cuando lo requiera
            </p>
            <p class="parrafo-trasero">
              <span class="bullet">•</span> Es intransferible
            </p>
            <p class="parrafo-trasero">
              <span class="bullet">•</span> Se agradece a todas las autoridades Civiles y Militares prestarle la mayor colaboración posible al portador de esta credencial, dentro de las normas legales
            </p>
            <p class="parrafo-trasero">
              <span class="bullet">•</span> En caso de ser transferido a otra dirección o en caso de vencimiento, debe ser entregado
            </p>
          </div>
          <div class="footer-container">
            <img :src="getFooterFor(trabajador)" alt="Sello" class="sello-img" />
            <QrcodeVue :value="qrUrl" :size="qrSize" level="H" class="qr-code" />
          </div>
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

    <!-- Batch print dialog -->
    <q-dialog v-model="batchDialog">
      <q-card style="min-width:320px; max-width:520px">
        <q-card-section>
          <div class="text-h6">Impresión por lote</div>
          <div class="q-mt-md">Seleccione alcance de la impresión por lote:</div>
          <q-option-group v-model="batchOption" type="radio" class="q-mt-sm" :options="[
            { label: 'Todas las instituciones', value: 'all' },
            { label: 'Solo una institución', value: 'institution' }
          ]" />
          <div v-if="batchOption === 'institution'" class="q-mt-sm">
            <q-select v-model="batchInstitution" :options="instituciones" option-value="id" option-label="institucion" label="Institución" emit-value map-options dense />
          </div>
          <div class="q-mt-sm text-subtitle2">Se imprimirán las credenciales que cumplan los filtros actuales y que tengan foto.</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancelar" v-close-popup @click="batchDialog=false" />
          <q-btn flat label="Imprimir" color="primary" @click="batchPrint" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import { Notify, LocalStorage } from 'quasar'
import QrcodeVue from 'qrcode.vue'

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

/*const backendBase = 'http://localhost:3001'*/
const backendBase = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/+$/, '') : 'http://credenciales.minaamp.gob.ve';
function getFotoUrl(url) {
  if (!url) return '/img/no_person.png'
  // Base64 embebida: devolver tal cual
  if (url.startsWith('data:image/')) return url
  if (url.startsWith('/uploads')) {
    return backendBase + url
  }
  if (url.includes('no_person.png') || url.startsWith('/img')) {
    // Servir desde el frontend (nginx lo entrega sin proxear al backend)
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
  // Use the provided INASS frontal image when the trabajador belongs to INASS.
  // Place the attached image in `front/public/img` with this name: `frontal_inass.png`.
  if (isINASS(item)) {
    return '/img/frontal_carnet_inass1.png'
  }
  return defaultFondoUrl
}

function isWideFranja(item) {
  if (!item) return false
  const area = (item.area || item.unidad || item.unidad_adscripcion || '').toString().toLowerCase()
  const targets = [
    'dirección general de la oficina de seguridad',
    'direccion general de la oficina de seguridad',
    'dirección general de la oficina de gestión comunicacional',
    'direccion general de la oficina de gestión comunicacional',
    'direccion general de la oficina de gestion comunicacional',
    'dirección general de la oficina de gestión comunicacional'
  ]
  return targets.some(t => area.includes(t))
}

function getFooterFor(item) {
  if (isINASS(item)) {
    return '/img/inass_sello_firma.png'
  }
  // Default to Ministerio seal
  return '/img/ministerio_sello_firma.png'
}
const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/+$/, '')
axios.defaults.baseURL = apiBase
const qrBaseUrl = import.meta.env.VITE_CREDENCIAL_QR_URL || (typeof window !== 'undefined' ? `${window.location.origin}/credencial?cedula=` : 'http://localhost:3001/credenciales/cedula=')
const qrSize = 75
const qrUrl = computed(() => {
  if (!trabajador.value || !trabajador.value.cedula) return ''
  return `${qrBaseUrl}${trabajador.value.cedula}`
})

// Top-level permission helper for template and code
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
  // 1) Si se introdujo una cédula posible, priorizamos ese match exacto
  if (cedVal && cedVal.toString().length >= 6) {
    if (String(cedVal) !== String(cedula.value)) {
      cedula.value = String(cedVal)
      buscarTrabajador()
    }
  }
  // 2) Si tenemos resultados de CUALQUIER otro filtro (nombres, área, sede...), 
  // cargamos la credencial del TRABAJADOR en primer lugar del top de resultados
  else if (matches && matches.length > 0) {
    const first = matches[0]
    if (String(first.cedula) !== String(cedula.value)) {
      cedula.value = String(first.cedula)
      buscarTrabajador()
    }
  } 
  // 3) Si no hay match con ninguno, oscurecer
  else {
    trabajador.value = null
    mostrarInfo.value = false
    if (!filterCedula.value && !filterNombres.value && !filterApellidos.value && !filterInstitucion.value && !filterSede.value && !filterArea.value && !filterCargo.value) {
      cedula.value = ''
    }
  }
}, { deep: true })

async function fetchFilterOptions() {
  try {
    // Build requests conditionally depending on permissions to avoid 403 responses
    const requests = [
      axios.get(`${apiBase}/auth/instituciones`),
      axios.get(`${apiBase}/auth/sedes`),
      axios.get(`${apiBase}/auth/areas`),
      axios.get(`${apiBase}/auth/servidores_cargos`)
    ]

    // Helper to check permissions stored in LocalStorage
    // Only request servidores if user has permission to read servers
    const willFetchServidores = (LocalStorage.getItem('permissions') || []).some(p => {
      if (!p) return false
      if (typeof p === 'string') return p === 'read_servidor' || p === 'view_admin'
      if (typeof p === 'object' && p.name) return p.name === 'read_servidor' || p.name === 'view_admin'
      return false
    })
    if (willFetchServidores) requests.push(axios.get(`${apiBase}/auth/servidores`))

    const [instRes, sedesRes, areasRes, cargosRes, servidoresRes] = await Promise.all(requests)
    instituciones.value = instRes.data || []
    sedes.value = sedesRes.data || []
    areas.value = areasRes.data || []
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
  // Además de limpiar los filtros, ocultar la credencial principal y los resultados
  cedula.value = ''
  trabajador.value = null
  mostrarInfo.value = false
  // Reset opciones de impresión por lote
  batchDialog.value = false
  batchOption.value = 'all'
  batchInstitution.value = null
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

function buildCredentialHtml(item) {
  const foto = getFotoUrl(item.foto_url || '/img/no_person.png')
  const qrImg = encodeURI(`${qrBaseUrl}${item.cedula}`)
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrImg}`
  const nombre = (item.nombres || '').toUpperCase()
  const apellidos = (item.apellidos || '').toUpperCase()
  // Be defensive: cargo may come under several possible property names depending on backend
  const cargo = item.cargo || item.cargo_nombre || item.cargo_descripcion || item.cargo_text || ''
  const unidad = item.area || item.unidad || item.unidad_adscripcion || item.unidad_adscripcion_nombre || ''
  const ced = item.cedula || ''
  // Use full names for printing (no abbreviation) and return two separate print pages
  const displayNombres = nombre
  const displayApellidos = apellidos
  const nivel = item.nivel || item.nivel_id || 1
  let franjaColor = '#ffde00'
  if (String(nivel) === '2') franjaColor = 'rgb(99, 146, 248)'
  if (String(nivel) === '3') franjaColor = 'rgb(248, 99, 99)'
  // Prefer the explicit abbreviation; otherwise use a short form of the unidad/area (adscripción)
  const franjaText = (item.abreviacion && String(item.abreviacion).trim())
    ? String(item.abreviacion).trim()
    : (item.unidad || item.unidad_adscripcion || item.area || '')
      ? String(item.unidad || item.unidad_adscripcion || item.area).toUpperCase().slice(0, 14)
      : ''
  // choose images depending on institution
  const fondoFront = getFondoFor(item)
  const footerImg = getFooterFor(item)

  return `
    <div class="print-page">
      <div class="credencial-preview credencial-frontal">
        <img src="${fondoFront}" class="fondo-img" />
        <img src="${foto}" class="foto-trabajador" crossorigin="anonymous" />
        <div class="info-stack">
          <div class="nombre">${displayNombres} ${displayApellidos}</div>
          <div class="cedula">${ced}</div>
          <div class="cargo">${cargo}</div>
        </div>
        
        <div class="${item.condicion === 'JUBILADO' ? 'franja-jubilado' : 'franja' + nivel}${isWideFranja(item) ? ' franja-w' : ''}">
          ${item.condicion === 'JUBILADO' ? 'JUBILADO' : franjaText}
        </div>
      </div>
    </div>
    <div class="print-page print-page-back">
      <div class="credencial-preview credencial-trasera">
        <div class="contenido-trasero">
          <div class="texto-trasero">
            <p class="parrafo-trasero"><span class="bullet">•</span> Este carnet es de uso exclusivo para el personal que labora en Ministerio del Poder Popular de Adultos y Adultas Mayores Abuelos y Abuelas de la Patria</p>
            <p class="parrafo-trasero"><span class="bullet">•</span> Debe ser utilizado en un lugar visible</p>
            <p class="parrafo-trasero"><span class="bullet">•</span> Puede ser retenido por la Dirección General de Seguridad cuando lo requiera</p>
            <p class="parrafo-trasero"><span class="bullet">•</span> Es intransferible</p>
            <p class="parrafo-trasero"><span class="bullet">•</span> Se agradece a todas las autoridades Civiles y Militares prestarle la mayor colaboración posible al portador de esta credencial, dentro de las normas legales</p>
            <p class="parrafo-trasero"><span class="bullet">•</span> En caso de ser transferido a otra dirección o en caso de vencimiento, debe ser entregado</p>
          </div>
          <div class="footer-container">
            <img src="${footerImg}" class="sello-img" />
            <img src="${qrSrc}" class="qr-code" />
          </div>
        </div>
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
    /* La página trasera se imprime con la misma orientación que la delantera */
    .print-page-back {
      /* sin rotación */
    }
    @media print {
      .print-page-back {
        /* Rotar la cara trasera 180° sólo al imprimir para compensar el volteo del papel en duplex */
        transform: rotate(180deg);
        transform-origin: 50% 50%;
        display: block;
      }
      /* Asegurar que los contenidos internos no reciban transform adicionales inesperados */
      .print-page-back * { transform: none !important; }
    }
    .credencial-preview { 
      width: 55mm; height: 85mm; position: relative; background: transparent; margin: 0; 
      font-family: 'Georama', sans-serif; overflow: hidden; border: none; box-shadow: none; 
    }
    
    .fondo-img { position: absolute; width: 100%; height: 100%; left: 0; top: 0; z-index: 1; object-fit: cover; }
    .foto-trabajador { position: absolute; width: 19mm; height: 19mm; left: 18mm; top: 18.5mm; object-fit: cover; z-index: 2; border-radius: 3mm; border: 1px solid #888; }
    
    .info-stack { position: absolute; top: 38.5mm; left: 0; width: 100%; display:flex; flex-direction:column; align-items:center; gap:0mm; padding: 0 4mm; z-index: 4; }
    .nombre { text-align:center; display:block; font-size:3.7mm; font-weight:700; line-height:1.05; word-wrap:break-word; margin: 0; width: 100%; }
    .cedula { font-size:5mm; font-weight:700; margin-top:0.3mm; display:block; line-height:1.05; width: 100%; text-align:center; }
    .cargo { font-size:2.8mm; display:block; margin-top:0.5mm; text-align:center; line-height:1.05; width: 100%; }
    .unidad { display:block; font-size:2.6mm; color:#222; margin-top:0.2mm; }
    
    .franja1, .franja2, .franja3 { position: absolute; top: 60mm; left: 0; width: 55mm; text-align: center; font-size: 5.6mm; font-weight: 700; z-index: 3; }
    .franja1 { background-color: #ffde00; color: rgba(0,0,0,1); }
    .franja2 { background-color: rgb(99, 146, 248); color: #f8f8f8; }
    .franja3 { background-color: rgb(248, 99, 99); color: #f8f8f8; }
    .franja-jubilado { background-color: #0000FF !important; color: #FFFFFF !important; position: absolute; top: 60mm; left: 0; width: 55mm; text-align: center; font-size: 5.6mm; font-weight: 700; z-index: 3; }
    .franja-w { height: 9mm; line-height: 9mm; padding-top: 0; padding-bottom: 0; font-size: 8mm; font-weight: 800; top: 58.5mm; }
    
    .credencial-trasera { background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); }
    .contenido-trasero { width: 100%; height: 100%; padding: 4mm; display: flex; flex-direction: column; justify-content: space-between; max-width: 55mm; padding-right: 2mm; }
    .texto-trasero { width: 100%; flex: 1; display: flex; flex-direction: column; justify-content: space-evenly; padding-bottom: 2mm; max-width: 55mm; }
    .parrafo-trasero { margin: 0; padding: 0 1mm; font-size: 2.3mm; line-height: 1.3; color: #2c3e50; text-align: justify; display: flex; align-items: flex-start; overflow-wrap: break-word; }
    .bullet { font-weight: 700; margin-right: 1.2mm; color: #34495e; font-size: 2.5mm; }
    .footer-container { display:flex; justify-content: space-between; align-items:flex-start; padding-top:1.5mm; gap:2mm; }
    .sello-img { width:110px; height:100px; object-fit:contain; margin-left:-4mm; margin-top:-1.5mm; max-width: 90px; max-height: 90px; filter: brightness(0.6) contrast(1.4); }
    .qr-code { background:white; padding:1mm; border-radius:2mm; width:24mm; height:24mm; object-fit:contain; display:block; transform: none !important; box-shadow: none; border: 1px solid #ccc; }
    .qr-code img { width:100%; height:100%; object-fit:contain; }
    
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  `

  const w = window.open('', '_blank')
  if (!w) {
    Notify.create({ type: 'negative', message: 'Imposible abrir ventana de impresión (bloqueador de popups).' })
    return
  }
  
  // INYECCIÓN DE LA ETIQUETA <base>
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><base href="${origin}/"><title>Impresión masiva</title><style>${style}</style></head><body>${html}</body></html>`)
  w.document.close()

  // FUNCIÓN WAITFORIMAGES DESCOMENTADA Y ACTIVA
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
        // cross-origin or access error, stop waiting
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

  // LANZAMIENTO SEGURO ESPERANDO FUENTES E IMÁGENES
  const fontsReady = (w.document.fonts && w.document.fonts.ready) ? w.document.fonts.ready.catch(() => {}) : Promise.resolve()
  Promise.all([fontsReady, waitForImages(w, 8000)]).then(() => setTimeout(doPrint, 250)).catch(() => setTimeout(doPrint, 500))
}

async function batchPrint() {
  let list = filteredServers.value || []
  if (batchOption.value === 'institution' && batchInstitution.value) {
    list = list.filter(s => Number(s.institucion_id) === Number(batchInstitution.value))
  }
  list = list.filter(s => s.foto_url && s.foto_url !== '/img/no_person.png')
  if (!list || list.length === 0) {
    Notify.create({ type: 'negative', message: 'No hay credenciales con foto para imprimir con esos filtros.' })
    return
  }

  // Enrich each item with the full trabajador data (to ensure `abreviacion`, `nivel`, `unidad`, etc. match individual view)
  const enriched = await Promise.all(list.map(async (s) => {
    try {
      const res = await axios.get(`${apiBase}/auth/credencial/${s.cedula}`)
      if (res && res.data && res.data.cedula) return res.data
    } catch (err) {
      // if request fails, fall back to original item
      console.warn('batchPrint: could not fetch full data for', s.cedula, err && err.message)
    }
    return s
  }))

  const html = enriched.map(buildCredentialHtml).join('\n')
  batchDialog.value = false
  
  // Registrar historial de forma silenciosa para cada credencial impresa
  enriched.forEach(s => {
    if (s && s.cedula) bgReportPrint(s.cedula)
  })

  openPrintWindow(html)
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
      ? 'Network Error: no se pudo conectar al servidor. Verifica que el backend esté corriendo en http://localhost:3001'
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
          disableDialogCred.value = true
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
  // Prefer simple browser printing for now
  if (!trabajador.value) return
  const html = buildCredentialHtml(trabajador.value)
  
  // Registrar que se realizó la impresión en el backend
  if (trabajador.value.cedula) {
    bgReportPrint(trabajador.value.cedula)
  }

  openPrintWindow(html)
}

// Function to log the print action to the database without stopping the UI
async function bgReportPrint(cedulaStr) {
  try {
    const token = LocalStorage.getItem('token')
    if (!token) return
    await axios.post(`${apiBase}/auth/credencial/historico`, { cedula: cedulaStr }, {
      headers: { Authorization: `Bearer ${token}` }
    })
  } catch (err) {
    console.error('No se pudo registrar la impresión en el módulo de gestión:', err)
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
  left: 18mm;
  top: 18.5mm;
  object-fit: cover;
  z-index: 2;
  border-radius: 3mm;
  border: 1px solid #888;
}
.info-stack {
  position: absolute;
  top: 38.5mm;
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
}
.cedula {
  text-align: center;
  font-size: 5mm;
  font-family: 'Georama', sans-serif;
  font-weight: 700;
  line-height: 1.05;
  width: 100%;
  margin-top: 0.3mm;
}
.cargo {
  text-align: center;
  font-size: 2.8mm;
  font-family: 'Georama', sans-serif;
  font-weight: 400;
  line-height: 1.05;
  width: 100%;
  margin-top: 0.5mm;
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
.franja-jubilado {
  position: absolute;
  top: 59mm;
  color:#FFFFFF;
  background-color: #0000FF;
  left: 0;
  width: 55mm;
  text-align: center;
  font-size: 5.6mm;
  font-family: 'Georama', sans-serif;
  font-weight: 700;
  z-index: 3;
}
/* Wider franja for specified adscripciones (on-screen) */
.franja-w {
  height: 9mm;
  line-height: 9mm;
  padding-top: 0;
  padding-bottom: 0;
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
  width: 110px;
  height: 100px;
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
</style>
