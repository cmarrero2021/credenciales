<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h5 text-primary text-weight-bold">
        <q-icon name="category" class="q-mr-sm" />Gestión de Catálogos
      </div>
    </div>

    <q-card flat bordered>
      <q-tabs
        v-model="tab"
        dense
        class="text-grey"
        active-color="primary"
        indicator-color="primary"
        align="left"
        narrow-indicator
      >
        <q-tab name="sedes" label="Sedes" icon="domain" />
        <q-tab name="areas" label="Adscripciones (Áreas)" icon="apartment" />
        <q-tab name="cargos" label="Cargos" icon="work" />
      </q-tabs>

      <q-separator />

      <q-tab-panels v-model="tab" animated>
        <!-- SEDES TAB -->
        <q-tab-panel name="sedes">
          <q-table
            flat bordered
            title="Listado de Sedes"
            :rows="sedes"
            :columns="colSedes"
            row-key="id"
            :loading="loadingSedes"
            :filter="filterSedes"
            :pagination="{ rowsPerPage: 10 }"
          >
            <template v-slot:top-right>
              <q-input v-model="filterSedes" dense placeholder="Buscar..." class="q-mr-md">
                <template v-slot:append><q-icon name="search" /></template>
              </q-input>
              <q-btn color="primary" icon="add" label="Agregar Sede" @click="openDialog('sede')" />
            </template>
            <template v-slot:body-cell-actions="props">
              <q-td :props="props" class="q-gutter-xs">
                <q-btn flat dense round color="primary" icon="edit" @click="editItem('sede', props.row)">
                  <q-tooltip>Editar</q-tooltip>
                </q-btn>
                <q-btn flat dense round color="negative" icon="delete" @click="deleteItem('sede', props.row)">
                  <q-tooltip>Eliminar</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>

        <!-- AREAS TAB -->
        <q-tab-panel name="areas">
          <q-table
            flat bordered
            title="Listado de Adscripciones (Áreas)"
            :rows="areas"
            :columns="colAreas"
            row-key="area_id"
            :loading="loadingAreas"
            :filter="filterAreas"
            :pagination="{ rowsPerPage: 10 }"
          >
            <template v-slot:top-right>
              <q-input v-model="filterAreas" dense placeholder="Buscar..." class="q-mr-md">
                <template v-slot:append><q-icon name="search" /></template>
              </q-input>
              <q-btn color="primary" icon="add" label="Agregar Área" @click="openDialog('area')" />
            </template>
            <template v-slot:body-cell-actions="props">
              <q-td :props="props" class="q-gutter-xs">
                <q-btn flat dense round color="primary" icon="edit" @click="editItem('area', props.row)">
                  <q-tooltip>Editar</q-tooltip>
                </q-btn>
                <q-btn flat dense round color="negative" icon="delete" @click="deleteItem('area', props.row)">
                  <q-tooltip>Eliminar</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>

        <!-- CARGOS TAB -->
        <q-tab-panel name="cargos">
          <q-table
            flat bordered
            title="Listado de Cargos"
            :rows="cargos"
            :columns="colCargos"
            row-key="id"
            :loading="loadingCargos"
            :filter="filterCargos"
            :pagination="{ rowsPerPage: 10 }"
          >
            <template v-slot:top-right>
              <q-input v-model="filterCargos" dense placeholder="Buscar..." class="q-mr-md">
                <template v-slot:append><q-icon name="search" /></template>
              </q-input>
              <q-btn color="primary" icon="add" label="Agregar Cargo" @click="openDialog('cargo')" />
            </template>
            <template v-slot:body-cell-actions="props">
              <q-td :props="props" class="q-gutter-xs">
                <q-btn flat dense round color="primary" icon="edit" @click="editItem('cargo', props.row)">
                  <q-tooltip>Editar</q-tooltip>
                </q-btn>
                <q-btn flat dense round color="negative" icon="delete" @click="deleteItem('cargo', props.row)">
                  <q-tooltip>Eliminar</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-tab-panel>
      </q-tab-panels>
    </q-card>

    <!-- Diálogo de Crear / Editar -->
    <q-dialog v-model="dialogVisible" persistent>
      <q-card style="min-width: 380px; max-width: 500px;">
        <q-card-section class="bg-primary text-white">
          <div class="text-h6">
            <q-icon :name="isEdit ? 'edit' : 'add_circle'" class="q-mr-sm" />
            {{ isEdit ? 'Editar' : 'Agregar' }} {{ getEntityName() }}
          </div>
        </q-card-section>

        <q-card-section class="q-pt-md">
          <q-form @submit.prevent="saveItem" id="crud-form">
            <q-input
              v-model="formModel.name"
              :label="'Nombre de ' + getEntityName()"
              outlined
              autofocus
              :rules="[val => (val && val.trim().length > 0) || 'El campo es obligatorio']"
            />
          </q-form>
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat label="Cancelar" color="grey" v-close-popup :disable="saving" />
          <q-btn
            label="Guardar"
            color="primary"
            type="submit"
            form="crud-form"
            :loading="saving"
            icon="save"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useQuasar, LocalStorage } from 'quasar'

const $q = useQuasar()
const tab = ref('sedes')

const sedes = ref([])
const areas = ref([])
const cargos = ref([])

const loadingSedes = ref(false)
const loadingAreas = ref(false)
const loadingCargos = ref(false)

const filterSedes = ref('')
const filterAreas = ref('')
const filterCargos = ref('')

const dialogVisible = ref(false)
const saving = ref(false)
const isEdit = ref(false)
const currentEntity = ref('')
const formModel = ref({ id: null, name: '' })

// Base URL del backend con prefijo /auth
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/+$/, '')

function getAuthHeaders() {
  const token = LocalStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const colSedes = [
  { name: 'id', label: 'ID', field: 'id', sortable: true, align: 'left', style: 'width:60px' },
  { name: 'sede', label: 'Sede', field: 'sede', sortable: true, align: 'left' },
  { name: 'actions', label: 'Acciones', align: 'center', style: 'width:100px' }
]

const colAreas = [
  { name: 'area_id', label: 'ID', field: 'area_id', sortable: true, align: 'left', style: 'width:60px' },
  { name: 'area', label: 'Área / Adscripción', field: 'area', sortable: true, align: 'left' },
  { name: 'actions', label: 'Acciones', align: 'center', style: 'width:100px' }
]

const colCargos = [
  { name: 'id', label: 'ID', field: 'id', sortable: true, align: 'left', style: 'width:60px' },
  { name: 'cargo', label: 'Cargo', field: 'cargo', sortable: true, align: 'left' },
  { name: 'actions', label: 'Acciones', align: 'center', style: 'width:100px' }
]

onMounted(() => {
  loadSedes()
  loadAreas()
  loadCargos()
})

async function loadSedes() {
  loadingSedes.value = true
  try {
    const { data } = await axios.get(`${API_BASE}/auth/sedes`)
    sedes.value = Array.isArray(data) ? data : []
  } catch (error) {
    $q.notify({ type: 'negative', message: 'Error al cargar las sedes' })
  } finally {
    loadingSedes.value = false
  }
}

async function loadAreas() {
  loadingAreas.value = true
  try {
    const { data } = await axios.get(`${API_BASE}/auth/areas`)
    areas.value = Array.isArray(data) ? data : []
  } catch (error) {
    $q.notify({ type: 'negative', message: 'Error al cargar las áreas' })
  } finally {
    loadingAreas.value = false
  }
}

async function loadCargos() {
  loadingCargos.value = true
  try {
    const { data } = await axios.get(`${API_BASE}/auth/cargos`)
    cargos.value = Array.isArray(data) ? data : []
  } catch (error) {
    $q.notify({ type: 'negative', message: 'Error al cargar los cargos' })
  } finally {
    loadingCargos.value = false
  }
}

function getEntityName() {
  if (currentEntity.value === 'sede') return 'Sede'
  if (currentEntity.value === 'area') return 'Área'
  if (currentEntity.value === 'cargo') return 'Cargo'
  return ''
}

function openDialog(entity) {
  currentEntity.value = entity
  isEdit.value = false
  formModel.value = { id: null, name: '' }
  dialogVisible.value = true
}

function editItem(entity, row) {
  currentEntity.value = entity
  isEdit.value = true
  if (entity === 'sede') {
    formModel.value = { id: row.id, name: row.sede }
  } else if (entity === 'area') {
    formModel.value = { id: row.area_id, name: row.area }
  } else if (entity === 'cargo') {
    formModel.value = { id: row.id, name: row.cargo }
  }
  dialogVisible.value = true
}

async function saveItem() {
  if (!formModel.value.name || !formModel.value.name.trim()) return
  saving.value = true
  try {
    const entity = currentEntity.value
    const headers = getAuthHeaders()
    let payload = {}
    let endpoint = ''

    if (entity === 'sede') {
      payload = { sede: formModel.value.name.trim() }
      endpoint = `${API_BASE}/auth/sedes`
    } else if (entity === 'area') {
      payload = { area: formModel.value.name.trim() }
      endpoint = `${API_BASE}/auth/areas`
    } else if (entity === 'cargo') {
      payload = { cargo: formModel.value.name.trim() }
      endpoint = `${API_BASE}/auth/cargos`
    }

    if (isEdit.value) {
      await axios.put(`${endpoint}/${formModel.value.id}`, payload, { headers })
      $q.notify({ type: 'positive', message: `${getEntityName()} actualizada exitosamente` })
    } else {
      await axios.post(endpoint, payload, { headers })
      $q.notify({ type: 'positive', message: `${getEntityName()} creada exitosamente` })
    }

    dialogVisible.value = false
    if (entity === 'sede') loadSedes()
    else if (entity === 'area') loadAreas()
    else if (entity === 'cargo') loadCargos()
  } catch (error) {
    const msg = error?.response?.data?.error || `Error al guardar ${getEntityName().toLowerCase()}`
    $q.notify({ type: 'negative', message: msg })
  } finally {
    saving.value = false
  }
}

function deleteItem(entity, row) {
  const nombre = entity === 'sede' ? row.sede : entity === 'area' ? row.area : row.cargo
  $q.dialog({
    title: 'Confirmar Eliminación',
    message: `¿Está seguro que desea eliminar "<strong>${nombre}</strong>"?`,
    html: true,
    cancel: { label: 'Cancelar', flat: true },
    ok: { label: 'Eliminar', color: 'negative' },
    persistent: true
  }).onOk(async () => {
    try {
      const headers = getAuthHeaders()
      let endpoint = ''
      let id = null

      if (entity === 'sede') { endpoint = `${API_BASE}/auth/sedes`; id = row.id }
      else if (entity === 'area') { endpoint = `${API_BASE}/auth/areas`; id = row.area_id }
      else if (entity === 'cargo') { endpoint = `${API_BASE}/auth/cargos`; id = row.id }

      await axios.delete(`${endpoint}/${id}`, { headers })
      $q.notify({ type: 'positive', message: `${getEntityName()} eliminada correctamente` })

      if (entity === 'sede') loadSedes()
      else if (entity === 'area') loadAreas()
      else if (entity === 'cargo') loadCargos()
    } catch (error) {
      const msg = error?.response?.data?.error || 'Error al eliminar el registro'
      $q.notify({ type: 'negative', message: msg })
    }
  })
}
</script>
