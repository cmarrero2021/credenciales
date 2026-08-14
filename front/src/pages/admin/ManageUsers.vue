<template>
  <div class="q-pa-md">
    <div class="row items-center q-gutter-md">
      <h6 class="col">Gestión de Usuarios</h6>
      <div class="col">
        <q-input dense debounce="300" v-model="filter" placeholder="Buscar por nombre, cédula o email" clearable>
          <template #append>
            <q-icon name="search" />
          </template>
        </q-input>
      </div>
      <q-btn class="col-auto" color="primary" label="Nuevo usuario" icon="add" @click="openCreate" />
    </div>

    <div class="q-mt-sm">
      <q-card flat>
        <q-card-section>
          <div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap">
            <!--<div><strong>Token:</strong> {{ debugToken() ? 'present' : 'none' }}</div>-->
            <!--<div><strong>Permissions:</strong> {{ (LocalStorage.getItem('permissions') || []).length }}</div>-->
            <div v-if="lastError" style="color:var(--q-danger);"><strong>Error:</strong> {{ lastError }}</div>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <div class="q-mt-md">
      <q-table
        :rows="filteredUsers"
        :columns="columns"
        row-key="id"
        dense
        :loading="loading"
        :rows-per-page-options="[10, 20, 50, 0]"
      >
        <template v-slot:body-cell-name="props">
          <q-td>
            {{ props.row.first_name }} {{ props.row.last_name }}
          </q-td>
        </template>

        <template v-slot:body-cell-roles="props">
          <q-td>
            <span v-for="(r, i) in props.row.roles" :key="r.id">{{ r.name }}<span v-if="i < props.row.roles.length -1">, </span></span>
          </q-td>
        </template>

        <template v-slot:body-cell-created_at="props">
          <q-td>
            {{ formatDate(props.row.created_at) }}
          </q-td>
        </template>

        <template v-slot:body-cell-created_by="props">
          <q-td>
            {{ (props.row.created_by_first || '') + ' ' + (props.row.created_by_last || '') }}
          </q-td>
        </template>

        <template v-slot:body-cell-actions="props">
          <q-td align="right">
            <q-btn dense flat icon="edit" @click="editUser(props.row)" />
            <q-btn dense flat :icon="props.row.status === 'disabled' ? 'check' : 'block'" :color="props.row.status === 'disabled' ? 'positive' : 'negative'" @click="toggleStatus(props.row)" />
            <q-btn dense flat icon="delete" color="negative" @click="removeUser(props.row)" />
          </q-td>
        </template>
      </q-table>
    </div>

    <q-dialog v-model="dialog">
      <q-card style="min-width: 400px;">
        <q-card-section>
          <div class="text-h6">{{ isEditing ? 'Editar usuario' : 'Nuevo usuario' }}</div>
        </q-card-section>

        <q-card-section>
          <q-form @submit.prevent="saveUser">
            <q-input v-model="form.first_name" label="Nombre" dense />
            <q-input v-model="form.last_name" label="Apellidos" dense class="q-mt-sm" />
            <q-input v-model="form.cedula" label="Cédula" dense class="q-mt-sm" />
            <q-input v-model="form.email" label="Email" dense class="q-mt-sm" />
            <q-input v-if="!isEditing" v-model="form.password" type="password" label="Contraseña" dense class="q-mt-sm" />
            <q-select v-model="form.roles" :options="roleOptions" option-label="name" option-value="id" label="Roles" multiple dense class="q-mt-sm" />
          </q-form>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancelar" v-close-popup @click="closeDialog" />
          <q-btn color="primary" label="Guardar" @click="saveUser" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { LocalStorage, Notify } from 'quasar'

const users = ref([])
const rawUsers = ref([])
const roles = ref([])
const dialog = ref(false)
const isEditing = ref(false)
const form = ref({ id: null, first_name: '', last_name: '', cedula: '', email: '', password: '', roles: [] })

const columns = [
  { name: 'id', label: 'ID', field: 'id' },
  { name: 'name', label: 'Nombre', field: row => row.first_name + ' ' + (row.last_name || '') },
  { name: 'cedula', label: 'Cédula', field: 'cedula' },
  { name: 'email', label: 'Email', field: 'email' },
  { name: 'roles', label: 'Roles', field: 'roles' },
  { name: 'created_at', label: 'Creado', field: 'created_at' },
  { name: 'created_by', label: 'Creado por', field: row => (row.created_by_first || '') + ' ' + (row.created_by_last || '') },
  { name: 'status', label: 'Estado', field: 'status' },
  { name: 'actions', label: 'Acciones', field: 'actions' }
]

const roleOptions = ref([])
const filter = ref('')
const pagination = ref({ page: 1, rowsPerPage: 10, rowsNumber: 0 })
// vistas filtradas/paginadas del lado del cliente
const filteredUsers = computed(() => {
  const q = (filter.value || '').toLowerCase().trim()
  if (!q) return rawUsers.value
  return rawUsers.value.filter(u => ((u.first_name||'') + ' ' + (u.last_name||'') + ' ' + (u.cedula||'') + ' ' + (u.email||'')).toLowerCase().includes(q))
})
// q-table gestionará la paginación cuando se le proporcione el array completo de `filteredUsers`.
watch(filteredUsers, (v) => {
  pagination.value.rowsNumber = v.length
  const maxPage = Math.max(1, Math.ceil((v.length || 0) / (pagination.value.rowsPerPage || 10)))
  if (pagination.value.page > maxPage) pagination.value.page = maxPage
})
const loading = ref(false)
const route = useRoute()
const lastError = ref(null)

let filterTimeout = null
const currentAbort = { controller: null }

function debugToken() {
  try { return LocalStorage.getItem('token') } catch (e) { return null }
}

function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  return dt.toLocaleString()
}

const router = useRouter()
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/+$/, '')

async function loadUsers(page = 1, perPage = 10, q = '') {
  // Cancelar solicitud previa si la hubiera
  if (currentAbort.controller) {
    try { currentAbort.controller.abort() } catch (e) { /* ignore */ }
  }
  currentAbort.controller = new AbortController()
  loading.value = true
  try {
      // Solicitar lista completa para paginación del lado del cliente (el backend admite el filtrado, pero aquí obtenemos todo)
      const params = { page: 1, per_page: 1000 }
      if (q) params.q = q
      console.debug('loadUsers token=', debugToken(), 'params=', params)
      const resPromise = axios.get(API_BASE + '/auth/users', { params, signal: currentAbort.controller.signal, timeout: 8000 })

    // Seguridad: garantizar que no permanezcamos cargando indefinidamente
    const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error('request-timeout')), 12000))
      const res = await Promise.race([resPromise, timeoutPromise])
    console.debug('loadUsers response=', res && res.data)
    // Almacenar el conjunto completo en rawUsers y calcular la vista paginada
    const all = (res && res.data && res.data.users) ? res.data.users : []
    rawUsers.value = all
    pagination.value.rowsNumber = filteredUsers.value.length
  } catch (err) {
    // Si se aborta o cancela, salga silenciosamente y despeje la carga.
    if (err && (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED')) {
      console.debug('loadUsers aborted/cancelled', err && err.code)
      lastError.value = 'request-aborted'
      return
    }
    console.error('Error cargando usuarios', err, err?.response?.status, err?.response?.data)
    lastError.value = err?.message || (err?.response && JSON.stringify(err.response.data)) || String(err)
    if (err && err.response && err.response.status === 401) {
      // Not autenticado: limpiar token y redirigir a login
      LocalStorage.remove('token')
      LocalStorage.remove('permissions')
      router.push('/login')
      return
    }
    Notify.create({ type: 'negative', message: 'Error cargando usuarios' })
    rawUsers.value = []
    users.value = []
    pagination.value.rowsNumber = 0
  } finally {
    loading.value = false
    // borrar el controlador después de terminar
    if (currentAbort.controller) currentAbort.controller = null
  }
}

function scheduleLoad() {
  if (filterTimeout) clearTimeout(filterTimeout)
  filterTimeout = setTimeout(() => {
    pagination.value.page = 1
    loadUsers(pagination.value.page, pagination.value.rowsPerPage, filter.value)
  }, 300)
}

// Ver cambios de paginación
function onPaginationChange() {
  loadUsers(pagination.value.page, pagination.value.rowsPerPage, filter.value)
}

// Conexiones sencillas de observador
// Solo se recarga desde el backend cuando cambia el filtro (obtenemos el conjunto completo una vez)
watch(() => filter.value, (nv, ov) => {
  if (nv !== ov) scheduleLoad()
})

// recargar cuando cambia la ruta (en caso de que el componente permanezca montado)
watch(() => route.fullPath, (nv, ov) => {
  console.debug('route changed in ManageUsers', { from: ov, to: nv })
  loadUsers(pagination.value.page, pagination.value.rowsPerPage, filter.value)
})

onBeforeUnmount(() => {
  // Limpiar los temporizadores y solicitudes pendientes para evitar dejar la interfaz de usuario en estado de carga
  if (filterTimeout) {
    clearTimeout(filterTimeout)
    filterTimeout = null
  }
  if (currentAbort.controller) {
    try { currentAbort.controller.abort() } catch (e) { /* ignore */ }
    currentAbort.controller = null
  }
})

async function loadRoles() {
  try {
    console.debug('loadRoles token=', debugToken())
    const res = await axios.get(API_BASE + '/auth/roles', { timeout: 8000 })
    console.debug('loadRoles response=', res && res.data)
    // el backend puede devolver { roles: [...] } o una matriz directamente
    const data = res && res.data
    if (!data) {
      roles.value = []
    } else if (Array.isArray(data)) {
      roles.value = data
    } else if (Array.isArray(data.roles)) {
      roles.value = data.roles
    } else if (Array.isArray(data.data)) {
      roles.value = data.data
    } else {
      // respaldo: intenta encontrar una matriz dentro de la respuesta
      const found = Object.values(data).find(v => Array.isArray(v))
      roles.value = found || []
    }
    roleOptions.value = roles.value
  } catch (err) {
    console.error('Error cargando roles', err)
    if (err && err.response && err.response.status === 401) {
      LocalStorage.remove('token')
      LocalStorage.remove('permissions')
      router.push('/login')
      return
    }
  }
}

function openCreate() {
  isEditing.value = false
  form.value = { id: null, first_name: '', last_name: '', cedula: '', email: '', password: '', roles: [] }
  dialog.value = true
}

function closeDialog() {
  dialog.value = false
}

function editUser(u) {
  isEditing.value = true
  form.value = { id: u.id, first_name: u.first_name, last_name: u.last_name, cedula: u.cedula, email: u.email, password: '', roles: (u.roles || []).map(r => r.id) }
  dialog.value = true
}

async function saveUser() {
  try {
    if (isEditing.value) {
      const payload = { first_name: form.value.first_name, last_name: form.value.last_name, cedula: form.value.cedula, email: form.value.email, roles: form.value.roles }
      console.debug('saveUser update token=', debugToken(), 'payload=', payload)
      await axios.put(API_BASE + '/auth/users/' + form.value.id, payload)
      Notify.create({ type: 'positive', message: 'Usuario actualizado' })
    } else {
      const payload = { first_name: form.value.first_name, last_name: form.value.last_name, cedula: form.value.cedula, email: form.value.email, password: form.value.password, roles: form.value.roles }
      console.debug('saveUser create token=', debugToken(), 'payload=', payload)
      await axios.post(API_BASE + '/auth/users', payload)
      Notify.create({ type: 'positive', message: 'Usuario creado' })
    }
    dialog.value = false
    await loadUsers(pagination.value.page, pagination.value.rowsPerPage, filter.value)
  } catch (err) {
    console.error('Error guardando usuario', err)
    const backendError = err.response?.data?.error
      || (Array.isArray(err.response?.data?.errors) && err.response?.data?.errors.join(' '))
    Notify.create({ type: 'negative', message: backendError || 'Error guardando usuario' })
  }
}

async function removeUser(u) {
  if (!confirm('¿Eliminar usuario? (borrado lógico)')) return
  try {
    console.debug('removeUser token=', debugToken(), 'id=', u.id)
    await axios.delete(API_BASE + '/auth/users/' + u.id)
    Notify.create({ type: 'positive', message: 'Usuario eliminado' })
    await loadUsers(pagination.value.page, pagination.value.rowsPerPage, filter.value)
  } catch (err) {
    console.error('Error eliminando usuario', err)
    Notify.create({ type: 'negative', message: 'Error eliminando usuario' })
  }
}

async function toggleStatus(u) {
  try {
    const newStatus = u.status === 'disabled' ? 'active' : 'disabled'
    console.debug('toggleStatus token=', debugToken(), 'id=', u.id, 'newStatus=', newStatus)
    await axios.put(API_BASE + '/auth/users/' + u.id, { status: newStatus })
    Notify.create({ type: 'positive', message: 'Estado actualizado' })
    await loadUsers(pagination.value.page, pagination.value.rowsPerPage, filter.value)
  } catch (err) {
    console.error('Error actualizando estado', err)
    Notify.create({ type: 'negative', message: 'Error actualizando estado' })
  }
}

onMounted(() => {
  loadRoles()
  loadUsers(pagination.value.page, pagination.value.rowsPerPage, filter.value)
})
</script>
