<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <h5>Gestión de Carnets</h5>
      </div>
      <div class="col-auto">
        <q-btn label="Refrescar" icon="refresh" color="primary" @click="loadData" />
      </div>
      <div class="col-auto">
        <q-btn label="Exportar Excel" icon="download" color="green" class="q-ml-sm" @click="exportToExcel" />
        <q-btn label="Exportar PDF" icon="picture_as_pdf" color="red" class="q-ml-sm" @click="exportToPDF" />
      </div>
      <div class="col-auto">
        <q-input dense debounce="300" v-model="filter" placeholder="Buscar nombre o cédula" clearable />
      </div>
      <div class="col-auto">
        <q-input dense type="date" v-model="filterDateStart" label="Desde" stack-label clearable />
      </div>
      <div class="col-auto">
        <q-input dense type="date" v-model="filterDateEnd" label="Hasta" stack-label clearable />
      </div>
    </div>
    <q-table
      title="Listado de carnets impresos"
      :columns="columns"
      :rows="filteredRows"
      row-key="id"
      :loading="loading"
      :filter="filter"
      :rows-per-page-options="[10, 20, 50, 0]"
    
      flat
      dense
      class="responsive-table"
    >
      <template v-slot:body-cell-foto="props">
        <q-td>
          <img :src="getFotoUrl(props.row.foto_url)" alt="foto" style="width:42px; height:42px; object-fit:cover; border-radius:4px" v-if="props.row.foto_url" />
        </q-td>
      </template>

      <template v-slot:body-cell-created_at="props">
        <q-td>
          {{ props.row.created_at_fmt || props.row.created_at }}
        </q-td>
      </template>

      <template v-slot:body-cell-disabled_at="props">
        <q-td>
          {{ props.row.disabled_at ? (props.row.disabled_at_fmt || props.row.disabled_at) : '-' }}
        </q-td>
      </template>

      <template v-slot:body-cell-actions="props">
        <q-td align="center">
          <div style="display:inline-flex;align-items:center;gap:6px;">
            <q-badge color="negative" label="Inactivo" v-if="isRowDisabled(props.row)" />
            <q-btn dense flat icon="visibility" color="primary" @click="viewRow(props.row)" title="Ver" />
          </div>
          <q-btn v-if="!isRRHHOnly" dense flat icon="edit" color="warning" @click="editRow(props.row)" title="Editar" />
          <template v-if="isRowDisabled(props.row)">
            <q-btn dense flat icon="check_circle" color="positive" @click="enableRow(props.row)" title="Habilitar" />
          </template>
          <template v-else>
            <q-btn dense flat icon="block" color="negative" @click="disableRow(props.row)" title="Deshabilitar" />
          </template>
        </q-td>
      </template>
    </q-table>

    <!-- Confirmación para impresión por lotes -->
    <q-dialog v-model="batchDialog">
      <q-card style="min-width: 280px; max-width: 420px;">
        <q-card-section>
          <div class="text-h6">Confirmar impresión por lote</div>
          <div class="q-mt-md">Se imprimirá el lote de credenciales. ¿Desea continuar?</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancelar" v-close-popup @click="batchDialog = false" />
          <q-btn flat label="Imprimir" color="secondary" @click="confirmBatchPrint" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- View dialog -->
    <q-dialog v-model="viewDialog">
      <q-card style="min-width: 320px; max-width: 820px;">
        <q-card-section>
          <div class="q-gutter-sm q-mb-sm">
            <q-badge color="green" label="Carnet: Activo" v-if="!isRowDisabled(selected)" />
            <q-badge color="negative" label="Carnet: Inactivo" v-else />
            <q-badge color="secondary" label="Trabajador: Activo" v-if="selected?.trabajador_activo !== false && selected?.trabajador_activo !== null" />
            <q-badge color="negative" label="Trabajador: Inactivo" v-else-if="selected?.trabajador_activo === false" />
          </div>
          <div class="row">
            <div class="col-4">
              <img :src="getFotoUrl(selected?.foto_url)" style="width:100%; border-radius:6px;" v-if="selected?.foto_url" />
            </div>
            <div class="col-8">
              <div><b>Cédula:</b> {{ selected?.cedula }}</div>
              <div><b>Nombres:</b> {{ selected?.nombres }}</div>
              <div><b>Apellidos:</b> {{ selected?.apellidos }}</div>
              <div><b>Institución:</b> {{ selected?.institucion }}</div>
              <div><b>Adscripción:</b> {{ selected?.area }}</div>
              <div><b>Impreso por:</b> {{ selected?.impreso_por }}</div>
              <div><b>Cargo:</b> {{ selected?.cargo }}</div>
              <div v-if="selected?.disable_reason || selected?.reason || selected?.motivo" class="q-mt-sm"><b>Inhabilitado (motivo):</b> {{ selected.disable_reason || selected.reason || selected.motivo }}</div>
              <div v-if="selected?.disabled_by" class="q-mt-xs"><b>Deshabilitado por:</b> {{ selected.disabled_by }}</div>
              <div v-if="selected?.disabled_at || selected?.fecha_deshabilitado" class="q-mt-xs"><b>Fecha inhabilitación:</b> {{ selected.disabled_at || selected.fecha_deshabilitado }}</div>
            </div>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cerrar" v-close-popup />
          <q-btn flat label="Ver carnet" color="primary" @click="openCredencial" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Edit dialog -->
    <q-dialog v-model="editDialog">
      <q-card style="min-width: 320px; max-width: 720px;">
        <q-card-section>
          <div class="text-h6">Editar servidor</div>
                  <div class="q-gutter-md q-mt-md">
                    <q-input v-model="form.cedula" label="Cédula" dense />
                    <q-input v-model="form.nombres" label="Nombres" dense />
                    <q-input v-model="form.apellidos" label="Apellidos" dense />
                    <q-input v-model="form.institucion" label="Institución" dense />
                    <q-select v-model="form.area" :options="areasOptions" label="Adscripción" dense clearable option-label="label" option-value="value" />
                    <q-input v-model="form.cargo" label="Cargo" dense />
                    <q-input v-model="form.foto_url" label="URL Foto" dense />
                  </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancelar" v-close-popup @click="resetForm" />
          <q-btn flat label="Guardar" color="primary" @click="saveForm" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Disable dialog -->
    <q-dialog v-model="disableDialog">
      <q-card style="min-width: 280px; max-width: 420px;">
        <q-card-section>
          <div class="text-h6">Deshabilitar carnet</div>
          <template v-if="!isRRHHOnly">
            <div class="q-mt-md">Seleccione el motivo por el cual se deshabilita este carnet:</div>
            <div class="q-mt-sm">
              <q-select v-model="disableReason" :options="availableDisableReasons" option-label="label" option-value="value" dense />
            </div>
          </template>
          <template v-else>
            <div class="q-mt-sm">
              <div class="q-mt-md">El motivo por el cual se deshabilita es: <span style="font-weight:700">EGRESO</span></div>
            </div>
          </template>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancelar" v-close-popup />
          <q-btn flat label="Deshabilitar" color="negative" @click="confirmDisable" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { Notify, LocalStorage } from 'quasar'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

const rows = ref([])
const loading = ref(false)
const filter = ref('')
const selected = ref(null)

const filterDateStart = ref('')
const filterDateEnd = ref('')

const filteredRows = computed(() => {
  let data = rows.value
  if (filterDateStart.value) {
    const start = new Date(filterDateStart.value + 'T00:00:00')
    data = data.filter(r => r.created_at && new Date(r.created_at) >= start)
  }
  if (filterDateEnd.value) {
    const end = new Date(filterDateEnd.value + 'T23:59:59')
    data = data.filter(r => r.created_at && new Date(r.created_at) <= end)
  }
  return data
})

// estado del formulario y diálogos
const viewDialog = ref(false)
const editDialog = ref(false)
const form = ref({})
const batchDialog = ref(false)

const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
/*const backendBase = 'https://localhost:3001'*/
const backendBase = import.meta.env.VITE_API_URL.replace(/\/+$/, '') || 'https://credenciales.minaamp.gob.ve';

// Selección dinámica del frontal del carnet según institución y adscripción (seguridad / comunicaciones).
function isINASS_item_local(item) {
  if (!item) return false
  const name = (item.institucion || item.institucion_nombre || '').toString()
  return /INSTITUTO NACIONAL DE LOS SERVICIOS SOCIALES/i.test(name)
}

function getFondoFor_local(item) {
  const rawArea = (item?.area || item?.unidad || item?.adscripcion || '').toString()
  const area = rawArea.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  const isInass = isINASS_item_local(item)
  const seguridadKeywords = ['seguridad', 'direccion general de la oficina de seguridad']
  const comunicacionKeywords = ['comunic', 'gesti', 'comunicacional', 'comunicaciones', 'gestion comunicacional', 'prensa']
  if (seguridadKeywords.some(k => area.includes(k))) return backendBase + (isInass ? '/img/frontal_seguridad_inass.png' : '/img/frontal_seguridad_ministerio.png')
  if (comunicacionKeywords.some(k => area.includes(k))) return backendBase + (isInass ? '/img/frontal_prensa_inass.png' : '/img/frontal_prensa_ministerio.png')
  return backendBase + (isInass ? '/img/frontal_carnet_inass1.png' : '/img/frontal_carnet.png')
}

function prepareExportData() {
  const visibleRows = filteredRows.value.filter(r => {
    if (!filter.value) return true
    const q = filter.value.toLowerCase()
    return String(r.cedula || '').toLowerCase().includes(q) || 
           String(r.nombres || '').toLowerCase().includes(q) ||
           String(r.apellidos || '').toLowerCase().includes(q)
  })

  return visibleRows.map(r => ({
    'Cédula': r.cedula,
    'Nombres': r.nombres,
    'Apellidos': r.apellidos,
    'Institución': r.institucion,
    'Adscripción': r.area,
    'Cargo': r.cargo,
    'Impreso por': r.impreso_por || '',
    'Fecha Impresión': r.created_at_fmt || r.created_at || '',
    'Estado': (r.activo === false || !!r.disable_reason || !!r.disabled_at) ? 'Inactivo' : 'Activo',
    'Motivo Inhabilitación': r.disable_reason || r.reason || r.motivo || '',
    'Deshabilitado por': r.disabled_by || '',
  }))
}

function exportToExcel() {
  const data = prepareExportData()
  if (data.length === 0) {
    Notify.create({ message: 'No hay datos para exportar', color: 'warning' })
    return
  }
  try {
    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Carnets Impresos')
    XLSX.writeFile(workbook, 'Listado_Carnets_Impresos.xlsx')
  } catch (err) {
    console.error('Error al exportar Excel:', err)
    Notify.create({ message: 'Error al exportar Excel -> ' + err.message, color: 'negative' })
  }
}

function exportToPDF() {
  const data = prepareExportData()
  if (data.length === 0) {
    Notify.create({ message: 'No hay datos para exportar', color: 'warning' })
    return
  }
  try {
    const doc = new jsPDF('landscape')
    const headers = Object.keys(data[0])
    const body = data.map(obj => Object.values(obj).map(v => typeof v === 'string' ? v : String(v || '')))
    
    doc.setFontSize(18)
    doc.setTextColor(40, 40, 40)
    doc.text('Listado de Carnets Impresos', 14, 22)
    doc.setFontSize(11)
    doc.setTextColor(100)
    doc.text(`Fecha de exportación: ${new Date().toLocaleString()}`, 14, 30)

    autoTable(doc, {
      startY: 35,
      head: [headers],
      body: body,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { top: 35 }
    })
    doc.save('Listado_Carnets_Impresos.pdf')
  } catch (err) {
    console.error('Error al exportar PDF:', err)
    Notify.create({ message: 'Error al exportar PDF -> ' + err.message, color: 'negative' })
  }
}
const areasURL = import.meta.env.VITE_LS_AREAS_URL || ''

const areasOptions = ref([])

const baseColumns = [
  { name: 'foto', label: '', field: 'foto_url', sortable: false },
  { name: 'cedula', label: 'Cédula', field: 'cedula' },
  { name: 'nombres', label: 'Nombres', field: 'nombres' },
  { name: 'apellidos', label: 'Apellidos', field: 'apellidos' },
  { name: 'cargo', label: 'Cargo', field: 'cargo' },
  { name: 'area', label: 'Adscripción', field: 'area' },
  { name: 'disabled_by', label: 'Deshabilitado por', field: 'disabled_by' },
  { name: 'disable_reason', label: 'Motivo', field: 'disable_reason' },
  { name: 'disabled_at', label: 'Fecha deshabilitación', field: 'disabled_at' },
  { name: 'impreso_por', label: 'Impreso por', field: 'impreso_por' },
  { name: 'created_at', label: 'Fecha impresión', field: 'created_at', sortable: true }
]

   //Determinar si el usuario actual puede ver los botones de acción (RRHH/perfil)
function readStoredPermissions() {
  try {
    const tryGet = (k) => {
      if (typeof LocalStorage.get === 'function') return LocalStorage.get(k)
      if (typeof LocalStorage.getItem === 'function') return LocalStorage.getItem(k)
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage.getItem(k) ? JSON.parse(window.localStorage.getItem(k)) : null
      return null
    }
    let perms = tryGet('permissions') || tryGet('userPermissions') || []
    if (!perms) return []
    if (!Array.isArray(perms)) return []
    return perms
  } catch (e) {
    return []
  }
}

function permissionNamesFrom(perms) {
  try {
    return perms.map(p => {
      if (!p) return null
      if (typeof p === 'string') return p
      if (typeof p === 'object') {
        return p.name || p.permission_name || p.permission || p.key || null
      }
      return String(p)
    }).filter(Boolean)
  } catch (e) {
    return []
  }
}

const showActions = computed(() => {
  const perms = readStoredPermissions()
  const names = permissionNamesFrom(perms)
  return names.includes('update_servidor') || names.includes('delete_servidor') || names.includes('print_credencial') || names.includes('manage_servidores') || names.includes('update_historico')
})

// Determina si el usuario actual es administrador o solo RRHH.
const isAdmin = computed(() => {
  const perms = readStoredPermissions()
  const names = permissionNamesFrom(perms)
  return names.includes('view_admin') || names.includes('view_admin1')
})

const isRRHH = computed(() => {
  const perms = readStoredPermissions()
  const names = permissionNamesFrom(perms)
  return names.includes('update_historico')
})

// Usuarios exclusivos de RRHH: tienen el permiso update_historico pero no son administradores. Estos usuarios solo pueden deshabilitar por "Egreso" y no pueden elegir otros motivos ni ver ciertos botones.
const isRRHHOnly = computed(() => isRRHH.value && !isAdmin.value)

const columns = computed(() => {
  const cols = [...baseColumns]
  if (showActions.value) cols.push({ name: 'actions', label: 'Acciones', field: 'actions', align: 'center' })
  return cols
})

// Deshabilitar carnet: diálogo/estado
const disableDialog = ref(false)
const allDisableReasons = [
  { label: 'Egreso', value: 'egreso' },
  { label: 'Extravio', value: 'extravio' },
  { label: 'Deterioro', value: 'deterioro' },
  { label: 'Robo/Hurto', value: 'robo_hurto' },
  { label: 'Actualización', value: 'actualizacion' }
]
const disableReason = ref(null)

//  Si el usuario es solo RRHH (RRHH no administrador), restrinja los motivos disponibles solo a 'Egreso'. Para otros usuarios, mostrar todos los motivos.
const availableDisableReasons = computed(() => {
  if (isRRHHOnly.value) return allDisableReasons.filter(r => r.value === 'egreso')
  return allDisableReasons
})
const rowToDisable = ref(null)

function disableRow(row) {
  rowToDisable.value = row
  // Comportamiento predeterminado: los usuarios exclusivos de RRHH utilizan 'egreso' por defecto y no pueden seleccionar otras opciones.
  if (isRRHHOnly.value) {
    disableReason.value = 'egreso'
  } else {
    disableReason.value = null
  }
  disableDialog.value = true
}

async function confirmDisable() {
  if (!rowToDisable.value) return
  if (!disableReason.value) {
    Notify.create({ type: 'negative', message: 'Seleccione motivo para deshabilitar' })
    return
  }
  // No generar HTML aquí: este flujo solo deshabilita el registro seleccionado
  try {
    const token = getToken()
    // Reutilizar el punto final existente para la desactivación; incluir el motivo en el cuerpo.
    await axios.patch(`${apiBase}/auth/eliminar_servidor/${rowToDisable.value.cedula}`, { reason: disableReason.value }, { headers: { Authorization: `Bearer ${token}` } })
    Notify.create({ type: 'positive', message: 'Servidor deshabilitado' })
    disableDialog.value = false
    // Actualizar de forma optimista la fila local para que la interfaz de usuario refleje el cambio inmediatamente.
    try{
      const idx = rows.value.findIndex(r => String(r.cedula) === String(rowToDisable.value.cedula))
      if (idx !== -1) {
        rows.value[idx] = {
          ...rows.value[idx],
          activo: false,
          disable_reason: disableReason.value,
          trabajador_activo: disableReason.value === 'egreso' ? false : (rows.value[idx].trabajador_activo ?? null),
          disabled_by: getLocalUserName() || rows.value[idx].disabled_by || null
        }
      }
    } catch(e){ console.error('Error updating local row after disable:', e) }
    await loadData()
  } catch (err) {
    console.error('confirmDisable error', err)
    Notify.create({ type: 'negative', message: 'Error deshabilitando' })
  }
}

function getLocalUserName(){
  try{
    const candidates = ['user','currentUser','me','usuario','userInfo','profile']
    for (const k of candidates){
      const v = LocalStorage.getItem(k)
      if (!v) continue
      let obj = v
      if (typeof v === 'string'){
        try{ obj = JSON.parse(v) }catch(e){ obj = v }
      }
      if (!obj) continue
      if (typeof obj === 'string') return obj
      if (obj.name) return obj.name
      if (obj.full_name) return obj.full_name
      if (obj.nombre || obj.nombres) return ((obj.nombres||obj.nombre||'') + ' ' + (obj.apellidos||obj.apellido||'')).trim()
      if (obj.username) return obj.username
    }
  }catch(e){ console.error('getLocalUserName error', e) }
  return null
}

function getToken(){
  try{
    const try1 = (typeof LocalStorage.get === 'function') ? LocalStorage.get('token') : undefined
    if (try1) return try1
    const try2 = (typeof LocalStorage.getItem === 'function') ? LocalStorage.getItem('token') : undefined
    if (try2) return try2
    const try3 = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage.getItem('token') : undefined
    if (try3) return try3
  }catch(e){ console.error('getToken error', e) }
  return null
}

async function enableRow(row) {
  try {
    const token = getToken()
    const query = (row && row.id) ? `?row_id=${row.id}` : ''
    await axios.patch(`${apiBase}/auth/habilitar_servidor/${row.cedula}${query}`, {}, { headers: { Authorization: `Bearer ${token}` } })
    try {
      // Obtenga la última credencial individual del servidor para actualizar la fila con precisión. Esto es importante para reflejar cualquier cambio adicional que el backend pueda haber aplicado durante la habilitación (por ejemplo, restablecer campos relacionados con la deshabilitación).
      const credRes = await axios.get(`${apiBase}/auth/credencial/${row.cedula}`, { headers: { Authorization: `Bearer ${token}` } })
      const fresh = credRes.data || {}
      // Buscar por ID histórico si está disponible, de lo contrario por cédula (esto es para manejar casos donde el ID histórico puede no estar presente o no coincidir)
      let idx = -1
      if (row && row.id !== undefined && row.id !== null) {
        idx = rows.value.findIndex(r => r.id !== undefined && r.id === row.id)
      }
      if (idx === -1) idx = rows.value.findIndex(r => String(r.cedula) === String(row.cedula))
      const merged = (idx !== -1) ? { ...rows.value[idx], ...mapCredencialToRow(fresh) } : mapCredencialToRow(fresh)
      if (idx !== -1) rows.value.splice(idx, 1, merged)
      else rows.value.unshift(merged)

      if (selected.value && String(selected.value.cedula) === String(row.cedula)) {
        selected.value = { ...(selected.value || {}), ...mapCredencialToRow(fresh) }
      }

      Notify.create({ type: 'positive', message: 'Servidor habilitado' })
      // Actualizar en segundo plano con un breve retraso para permitir que la base de datos se estabilice. 
      setTimeout(() => { loadData().catch(e => console.warn('Background loadData failed:', e)) }, 800)
    } catch (e) {
      console.warn('Could not fetch fresh credencial after enable, falling back to optimistic update:', e)
      try {
        let idx = -1
        if (row && row.id !== undefined && row.id !== null) {
          idx = rows.value.findIndex(r => r.id !== undefined && r.id === row.id)
        }
        if (idx === -1) idx = rows.value.findIndex(r => String(r.cedula) === String(row.cedula))
        if (idx !== -1) {
          const updated = { ...rows.value[idx], activo: true, vigente: true, disable_reason: null, disabled_at: null, disabled_by: null }
          rows.value.splice(idx, 1, updated)
        }
        if (selected.value && String(selected.value.cedula) === String(row.cedula)) {
          selected.value = { ...(selected.value || {}), activo: true, disable_reason: null, disabled_at: null, disabled_by: null }
        }
        Notify.create({ type: 'positive', message: 'Servidor habilitado' })
        setTimeout(() => { loadData().catch(e => console.warn('Background loadData failed:', e)) }, 800)
      } catch (ee) { console.error('Fallback optimistic update failed', ee) }
    }
  } catch (err) {
    console.error('enableRow error', err)
    const msg = err?.response?.data?.error || err?.response?.data?.message || err.message || 'Error habilitando servidor'
    Notify.create({ type: 'negative', message: msg })
  }
}

function getFotoUrl(url) {
  if (!url) return ''
  if (url.startsWith('data:')) return url
  if (url.startsWith('/uploads') || url.startsWith('/img')) return backendBase + url
  return url
}

function mapCredencialToRow(fresh) {
  if (!fresh) return {}
  const disable_reason = fresh.disable_reason || fresh.reason || fresh.motivo || null
  const disabled_at = fresh.disabled_at || fresh.fecha_deshabilitado || null
  const activo = (typeof fresh.activo !== 'undefined') ? fresh.activo : true
  return {
    ...fresh,
    id: fresh.id || null,
    foto_url: fresh.foto_url || null,
    impreso_por: fresh.impreso_por || null,
    disable_reason,
    disabled_at,
    disabled_at_fmt: disabled_at ? formatDateDDMMYYYYHHmm(disabled_at) : null,
    disabled_by: fresh.disabled_by || null,
    activo,
    trabajador_activo: (typeof fresh.trabajador_activo !== 'undefined') ? fresh.trabajador_activo : null,
    created_at: fresh.created_at || null,
    created_at_fmt: fresh.created_at ? formatDateDDMMYYYYHHmm(fresh.created_at) : null
  }
}

// Devuelve el color de fondo de la franja según el nivel o área.
function getFranjaColor(r) {
  try {
    const n = (r && (r.nivel || r.nivel_id)) ? Number(r.nivel || r.nivel_id) : null
    if (n === 1) return 'yellow'
    if (n === 3) return 'rgb(248, 99, 99)'
    return 'rgb(99, 146, 248)'
  } catch (e) { return 'rgb(99, 146, 248)' }
}

async function loadData() {
  loading.value = true
  try {
    const token = getToken()
    if (!token) {
      Notify.create({ type: 'warning', message: 'Debe iniciar sesión para ver el histórico' })
      loading.value = false
      return
    }
  
    const res = await axios.get(`${apiBase}/auth/credencial/historico?_=${Date.now()}`, { headers: { Authorization: `Bearer ${token}` } }) // endpoint protegido
    const data = Array.isArray(res.data) ? res.data : []
    // Ayuda para normalizar "quién deshabilitado" y convertirlo en un nombre legible.
    function buildDisabledBy(obj){
      if (!obj) return null
      if (typeof obj === 'string') return obj
      const candidates = []
      const pushIf = v => { if (v && typeof v === 'string') candidates.push(v) }
      
      pushIf(obj.name)
      pushIf(obj.full_name)
      pushIf(obj.display_name)
      pushIf(obj.username)
      pushIf(obj.user_name)
      pushIf(obj.usuario)
      pushIf(obj.nombre)
      // Para nombres divididos en partes, intente construir un nombre completo. Esto es común en muchos sistemas donde el "quién" puede tener campos separados para nombre y apellido.
      const first = obj.first_name || obj.impreso_por_first || obj.disable_user_first || obj.disable_first || obj.nombres
      const last = obj.last_name || obj.impreso_por_last || obj.disable_user_last || obj.disable_last || obj.apellidos
      if (first || last) pushIf(((first||'') + ' ' + (last||'')).trim())
      pushIf(obj.apellidos)
      pushIf(obj.nombres)
      if (candidates.length > 0) return candidates[0]
      try {
        const sj = JSON.stringify(obj)
        return sj.length < 120 ? sj : null
      } catch(e){ return null }
    }

    // Formatear fecha y asegurar foto_url
    rows.value = data.map(r => {
      const area = r.unidad ?? r.area ?? null
      const area_id = r.area_id ?? r.unidad_id ?? null
      const institucion = r.institucion ?? null
      const impreso_por_id = r.impreso_por_id || null
      const impreso_por_first = r.impreso_por_first || null
      const impreso_por_last = r.impreso_por_last || null
      const impreso_por_username = r.impreso_por_username || null
      const impreso_por = r.impreso_por || ((impreso_por_first || impreso_por_last)
        ? `${impreso_por_first || ''} ${impreso_por_last || ''}`.trim()
        : (impreso_por_username || null))

      const activo = (r.activo !== undefined) ? r.activo : (r.servidor_activo !== undefined ? r.servidor_activo : true)
      const disable_reason = r.disable_reason || r.reason || r.motivo || null
      const disabled_at = r.disabled_at || r.fecha_deshabilitado || null
      const trabajador_activo = (r.trabajador_activo !== undefined) ? r.trabajador_activo : (r.servidor_activo !== undefined ? r.servidor_activo : null)

      // Determinar si esta fila representa una credencial deshabilitada/inactiva.
      const rowIsDisabled = (activo === false) || !!(disable_reason) || !!(disabled_at)

      // Solo se rellena disabled_by cuando la fila está realmente deshabilitada. Esto es para evitar confusiones en la interfaz de usuario al mostrar un campo "Deshabilitado por" con información que puede estar presente pero no ser relevante si la credencial aún está activa.
      const computedDisabledBy = rowIsDisabled ? (
        (typeof r.disabled_by === 'string' && r.disabled_by) ||
        buildDisabledBy(r.disabled_by) ||
        buildDisabledBy(r.deshabilitado_por) ||
        buildDisabledBy(r.inhabilitado_por) ||
        buildDisabledBy(r.disable_user) ||
        buildDisabledBy(r.disable_user_name) ||
        buildDisabledBy(r.disable_username) ||
        ((r.disable_user_first || r.disable_user_last) ? `${r.disable_user_first || ''} ${r.disable_user_last || ''}`.trim() : null) ||
        ((r.impreso_por_first || r.impreso_por_last) ? `${r.impreso_por_first || ''} ${r.impreso_por_last || ''}`.trim() : null) ||
        null
      ) : null

      return {
        ...r,
        area,
        area_id,
        institucion,
        impreso_por_id,
        impreso_por_first,
        impreso_por_last,
        impreso_por_username,
        impreso_por,
        disabled_by: computedDisabledBy,
        created_at_fmt: r.created_at ? formatDateDDMMYYYYHHmm(r.created_at) : null,
        foto_url: r.foto_url || r.foto || null,
        activo,
        disable_reason,
        disabled_at,
        disabled_at_fmt: (disabled_at) ? formatDateDDMMYYYYHHmm(disabled_at) : null,
        trabajador_activo
      }
    })
  } catch (err) {
    console.error('Error loadData:', err)
    const msg = err?.response?.data?.error || err.message || 'Error cargando datos'
    Notify.create({ type: 'negative', message: msg })
  } finally {
    loading.value = false
  }
  }


function isRowDisabled(r) {
  if (!r) return false
  return (r.activo === false) || !!(r.disable_reason || r.reason || r.motivo) || !!(r.disabled_at || r.fecha_deshabilitado)
}

function viewRow(row) {
  selected.value = { ...row }
  viewDialog.value = true
}

function openBatchDialog() {
  batchDialog.value = true
}

async function confirmBatchPrint() {
  batchDialog.value = false
  try {
    await printBatch()
  } catch (e) {
    console.error('Error ejecutando printBatch desde diálogo:', e)
    Notify.create({ type: 'negative', message: 'Error al iniciar impresión por lote' })
  }
}

const router = useRouter()
function openCredencialFor(row) {
  if (!row || !row.cedula) return
  viewDialog.value = false
  router.push({ path: '/credencial', query: { cedula: row.cedula } })
}

function editRow(row) {
  form.value = { ...row }
  try{
    if (row){
      // Almacenar foto original para detectar ediciones del usuario
      form.value._originalFoto = row.foto_url || null

      let match = null
      if (row.area_id !== undefined && row.area_id !== null) {
        match = areasOptions.value.find(o => String(o.value) === String(row.area_id))
      }
      if (!match && row.area) {
        // Intente hacer coincidir por etiqueta (sin distinguir entre mayúsculas y minúsculas)
        match = areasOptions.value.find(o => String(o.label).toLowerCase() === String(row.area).toLowerCase())
      }
      if (!match && row.area) {
        // Si aún no hay coincidencia, agregue el área actual como una opción para que la selección pueda mostrarla
        const v = row.area_id ?? row.area
        match = { label: row.area, value: v }
        areasOptions.value = [match, ...areasOptions.value]
      }
      form.value.area = match
    }
  }catch(e){
    console.error('Error setting form.area', e)
  }
  editDialog.value = true
}

async function saveForm() {
  try {
    const ced = form.value.cedula
    // Usar endpoint existente para actualizar servidor
    const token = getToken()

    // Preparar carga útil: evitar enviar imágenes base64 grandes en JSON (causa 413)
    const payload = { ...form.value }
    // Normalizar selecciones: extraer valores *_id esperados por el backend
    if (payload.area) {
      if (typeof payload.area === 'object') {
        payload.area_id = payload.area.value ?? payload.area_id
      } else if (!isNaN(Number(payload.area))) {
        payload.area_id = Number(payload.area)
      }
      delete payload.area
    }
    if (payload.institucion) {
      if (typeof payload.institucion === 'object') {
        payload.institucion_id = payload.institucion.value ?? payload.institucion_id
      }
      delete payload.institucion
    }
    if (payload.cargo) {
      if (typeof payload.cargo === 'object') {
        payload.cargo_id = payload.cargo.value ?? payload.cargo_id
      }
      delete payload.cargo
    }

    // Si la foto_url es una URL de datos (base64), elimínela para minimizar la solicitud.
   // Mostrar la advertencia "foto no enviada" solo si el usuario modificó la foto base64.
    let fotoRemoved = false
    const originalFoto = form.value._originalFoto ?? null
    if (payload.foto_url && typeof payload.foto_url === 'string' && payload.foto_url.startsWith('data:')) {
      // Retirar de la carga útil para evitar 413
      delete payload.foto_url
      fotoRemoved = true
    }
    // Eliminar las propiedades auxiliares internas antes de enviar
    if (payload._originalFoto) delete payload._originalFoto

    await axios.patch(`${apiBase}/auth/actualizar_servidor/${ced}`, payload, { headers: { Authorization: `Bearer ${token}` } })
    Notify.create({ type: 'positive', message: 'Guardado correctamente' })
    editDialog.value = false
    // Actualizar filas locales para reflejar los cambios inmediatamente (es posible que la fuente histórica no refleje la tabla de servidores)
    try{
      const areaLabel = form.value.area && typeof form.value.area === 'object' ? form.value.area.label : form.value.area
      const areaId = form.value.area && typeof form.value.area === 'object' ? form.value.area.value : form.value.area_id || null
      const idx = rows.value.findIndex(r => (r.cedula == ced))
      if (idx !== -1) {
        rows.value[idx] = { ...rows.value[idx], area: areaLabel ?? rows.value[idx].area, area_id: areaId ?? rows.value[idx].area_id, nombres: payload.nombres ?? rows.value[idx].nombres, apellidos: payload.apellidos ?? rows.value[idx].apellidos }
      } else {
        // reserva: recargar datos si no se encuentra la fila (aunque debería estar)
        await loadData()
      }
    }catch(e){
      console.error('Error updating local rows after save:', e)
      await loadData()
    }

    if (fotoRemoved) {
      // Mostrar advertencia solo si el usuario cambió la foto (es decir, nueva base64 diferente de la original)
      const newFoto = form.value.foto_url ?? null
      if (newFoto && newFoto !== originalFoto) {
        Notify.create({ type: 'warning', message: 'La foto en base64 no fue enviada por tamaño; suba la imagen usando la opción de archivo.' })
      }
    }
  } catch (err) {
    console.error(err)
    Notify.create({ type: 'negative', message: 'Error guardando' })
  }
}

function resetForm() { form.value = {} }

function openCredencial() {
  if (!selected.value) return
  // Abrir la vista de credencial (página existente) pasando la cédula por query
  viewDialog.value = false
  router.push({ path: '/credencial', query: { cedula: selected.value.cedula } })
}

// Imprimir un lote de carnets: abrir una ventana con tarjetas imprimibles
async function printBatch() {
  try {
    // Genera un PDF de tamaño A4 completo usando jsPDF en el navegador para que la credencial ocupe exactamente toda la hoja.
    const items = (typeof selectedRows !== 'undefined' && selectedRows && selectedRows.length) ? selectedRows : (rows.value && rows.value.length ? rows.value : [])
    if (!items.length) {
      Notify.create({ type: 'warning', message: 'No hay registros para imprimir' })
      return
    }


    function fetchImageAsDataURL(url){
      return fetch(url).then(r => r.blob()).then(blob => new Promise((res, rej) => {
        const fr = new FileReader()
        fr.onload = () => res(fr.result)
        fr.onerror = rej
        fr.readAsDataURL(blob)
      }))
    }

    const doc = new jsPDF({ unit: 'mm', format: [55, 85], orientation: 'portrait' })

    for (let i = 0; i < items.length; i++){
      const r = items[i]
      doc.setFillColor(255,255,255)
      doc.rect(0, 0, 55, 85, 'F')
      // Imagen de fondo (opcional)
      try {
        const fondoUrl = getFondoFor_local(r)
        const fondoData = await fetchImageAsDataURL(fondoUrl)
        // dibujar fondo que cubra el formato CR80 exacto
        doc.addImage(fondoData, 'PNG', 0, 0, 55, 85)
      } catch (e) { console.warn('No se pudo cargar fondo, se usa relleno blanco', e) }

      // foto trabajador
      try {
        const fotoUrl = getFotoUrl(r.foto_url) || ''
        if (fotoUrl){
          const fotoData = await fetchImageAsDataURL(fotoUrl)
          // Colocar la foto centrada cerca de la parte superior (19x19 mm).
          const w = 19
          const h = 19
          const x = 18
          const y = 20
          doc.addImage(fotoData, 'PNG', x, y, w, h)
        }
      } catch(e){ console.warn('foto draw failed', e) }

      // Nombre, cédula, cargo
      doc.setTextColor(0,0,0)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(((r.nombres||'') + ' ' + (r.apellidos||'')).toUpperCase(), 27.5, 42, { align: 'center' })
      doc.setFontSize(14)
      doc.text(String(r.cedula || ''), 27.5, 47, { align: 'center' })
      doc.setFontSize(7)
      doc.text((r.cargo || ''), 27.5, 54, { align: 'center' })

      // Franja color bloque en la parte inferior con el área o nivel (si está disponible)
      const color = getFranjaColor(r)
      try{
        // Análisis simple para rgb(...) o color con nombre. Esto es para manejar casos donde el color puede ser un valor CSS. Si el formato no es reconocido, se usará un color predeterminado.
        if (color.startsWith('rgb')){
          const nums = color.replace(/[rgba()]/g,'').split(',').map(s=>Number(s.trim()))
          doc.setFillColor(nums[0], nums[1], nums[2])
        } else if (color === 'yellow') doc.setFillColor(255, 204, 0)
        else doc.setFillColor(99,146,248)
      }catch(e){ doc.setFillColor(99,146,248) }
      doc.rect(0, 59, 55, 26, 'F')
      doc.setTextColor(255,255,255)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      const abre = r.abreviacion || (r.area ? (r.area.split(' ')[0] || '') : '')
      doc.text(String(abre).toUpperCase(), 27.5, 66.5, { align: 'center' })

      // Agregar página siguiente si es necesario
      if (i < items.length - 1) doc.addPage()
    }

    // Abrir el PDF generado en una pestaña nueva
    const blobUrl = doc.output('bloburl')
    window.open(blobUrl, '_blank')
    Notify.create({ type: 'positive', message: 'PDF generado: en nueva pestaña para imprimir' })
  } catch (e) {
    console.error('printBatch PDF error', e)
    Notify.create({ type: 'negative', message: 'Error generando PDF para impresión: ' + (e.message || e) })
  }
}

async function fetchAreas(){
  try{
    if (areasURL){
      const res = await axios.get(areasURL)
        if (Array.isArray(res.data)){
          areasOptions.value = res.data.map(item => ({ label: item.area, value: item.area_id }))
      }
    }
    // reserva: extraer de filas cargadas si el endpoint no devuelve datos o no está configurado, 
    // para asegurar que al menos las áreas presentes en los registros históricos estén disponibles como opciones
    if ((!areasOptions.value || areasOptions.value.length === 0) && rows.value.length){
      const uniq = [...new Set(rows.value.map(r => ({ area: r.area, area_id: r.area_id })).filter(x => x.area))]
      areasOptions.value = uniq.map(x => ({ label: x.area, value: x.area_id }))
    }
  }catch(e){
    console.error('Error fetchAreas', e)
    // alternativa aún: usar filas cargadas para extraer áreas si el endpoint falla o no está configurado, 
    // para asegurar que al menos las áreas presentes en los registros históricos estén disponibles como opciones
    if (rows.value.length){
      const uniq = [...new Set(rows.value.map(r => ({ area: r.area, area_id: r.area_id })).filter(x => x.area))]
      areasOptions.value = uniq.map(x => ({ label: x.area, value: x.area_id }))
    }
  }
}

let __isMounted = true
function _onCredencialPrinted(e){
  try{ console.info('credencial:printed event received', e && e.detail) }catch(e){}
  // Actualizar solo si el componente aún está montado. Esto es importante para evitar errores si el evento se dispara después de que el usuario haya navegado fuera de la página.
  if (!__isMounted) return
  try{ loadData() }catch(e){ console.error('Error reloading data after credencial:printed', e) }
}

onMounted(async () => {
  __isMounted = true
  await loadData()
  await fetchAreas()
  if (typeof window !== 'undefined') {
    window.printBatch = printBatch
    window.addEventListener && window.addEventListener('credencial:printed', _onCredencialPrinted)
  }
})

onBeforeUnmount(() => {
  __isMounted = false
  if (typeof window !== 'undefined') {
    if (window.removeEventListener) window.removeEventListener('credencial:printed', _onCredencialPrinted)
    try{ delete window.printBatch }catch(e){}
  }
})

function pad(n){ return n<10? '0'+n : ''+n }
function formatDateDDMMYYYYHHmm(value){
  try{
    const d = new Date(value)
    const dd = pad(d.getDate())
    const mm = pad(d.getMonth()+1)
    const yyyy = d.getFullYear()
    const hh = pad(d.getHours())
    const min = pad(d.getMinutes())
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`
  }catch(e){ return value }
}

</script>

<style scoped>
/* Alineaciones mínimas para la vista de Carnets */
.responsive-table .q-table__middle .q-td:first-child { padding-left: 6px !important; }
.q-page { max-width: none; margin: 0; padding-left: 16px; padding-right: 16px }
.responsive-table { width: 100% }
</style>
