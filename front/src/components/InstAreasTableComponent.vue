<template>
  <div class="centered-container">
    <div class="q-pa-md">
      <!-- Filtros superiores -->
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="row q-col-gutter-md">
            <!-- Filtro de Instituciones -->
            <div class="col-12 col-md-6">
              <q-select v-model="selectedInstitutions" :options="institutionsOptions" label="Instituciones" multiple
                use-chips emit-value map-options clearable>
                <template v-slot:option="{ itemProps, opt, selected, toggleOption }">
                  <q-item v-bind="itemProps">
                    <q-item-section>
                      <q-item-label>{{ opt.label }}</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-checkbox :model-value="selected" @update:model-value="toggleOption(opt)" />
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
            </div>

            <!-- Buscador de Áreas -->
            <div class="col-12 col-md-6">
              <q-select v-model="selectedAreas" :options="filteredAreasOptions" label="Áreas" multiple use-chips
                use-input input-debounce="300" @filter="filterAreas" emit-value map-options clearable>
                <template v-slot:option="{ itemProps, opt, selected, toggleOption }">
                  <q-item v-bind="itemProps">
                    <q-item-section>
                      <q-item-label>{{ opt.label }}</q-item-label>
                      <q-item-label caption>{{ opt.institution }}</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-checkbox :model-value="selected" @update:model-value="toggleOption(opt)" />
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
            </div>
          </div>

          <!-- Controles adicionales -->
          <div class="row q-mt-sm">
            <div class="col">
              <q-btn label="Limpiar filtros" color="grey" flat dense @click="clearFilters" class="q-mr-sm" />
              <q-btn label="Exportar a Excel" color="positive" dense @click="exportToExcel" />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Tabla principal -->
      <q-table :rows="filteredRows" :columns="columns" row-key="area" :pagination="pagination" :loading="loading"
        :rows-per-page-options="[10, 20, 50, 100]" class="sticky-header-table">
        <!-- Slot para totales -->
        <template v-slot:bottom-row>
          <q-tr>
            <q-td colspan="2" class="text-right text-weight-bold">Totales:</q-td>
            <q-td class="text-center text-weight-bold">{{ totalMovilizados }}</q-td>
            <q-td class="text-center text-weight-bold">{{ totalPorMovilizar }}</q-td>
            <q-td class="text-center text-weight-bold bg-grey-2">{{ totalGeneral }}</q-td>
          </q-tr>
        </template>
      </q-table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'
import { useQuasar } from 'quasar'
import * as XLSX from 'xlsx'
import TableProcessor from 'pdfmake/src/tableProcessor'

const $q = useQuasar()

// Datos y estado
const rawData = ref([])
const loading = ref(true)
const selectedInstitutions = ref(['MINAAMP', 'INASS'])
const selectedAreas = ref([])
const areasSearchFilter = ref('')

// Columnas de la tabla
const columns = [
  {
    name: 'institucion',
    label: 'Institución',
    field: 'institucion',
    sortable: true,
    align: 'left'
  },
  {
    name: 'area',
    label: 'Área',
    field: 'area',
    sortable: true,
    align: 'left',
    classes: 'text-weight-bold'
  },
  {
    name: 'movilizados',
    label: 'Movilizados',
    field: row => parseInt(row.movilizados),
    sortable: true,
    align: 'center'
  },
  {
    name: 'por_movilizar',
    label: 'Por Movilizar',
    field: row => parseInt(row.por_movilizar),
    sortable: true,
    align: 'center'
  },
  {
    name: 'total',
    label: 'Total',
    field: row => parseInt(row.total),
    sortable: true,
    align: 'center',
    classes: 'bg-grey-2'
  }
]

// Paginación
const pagination = ref({
  sortBy: 'institucion',
  descending: false,
  page: 1,
  rowsPerPage: 20
})

// Obtener datos del endpoint
const fetchData = async () => {
  try {
    loading.value = true
    const response = await axios.get(import.meta.env.VITE_GR_INSTAREASTOTAL_URL)
        rawData.value = response.data
    loadPersistedFilters()
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Error al cargar los datos',
      position: 'top'
    })
  } finally {
    loading.value = false
  }
}

// Opciones para filtros
const institutionsOptions = computed(() => {
  const uniqueInstitutions = [...new Set(rawData.value.map(item => item.institucion))]
  return uniqueInstitutions.map(inst => ({
    label: inst,
    value: inst
  }))
})

const allAreasOptions = computed(() => {
  // Si no hay instituciones seleccionadas, muestra todas las áreas
  if (!selectedInstitutions.value || selectedInstitutions.value.length === 0) {
    return rawData.value.map(item => ({
      label: `${item.area} (${item.total})`,
      value: item.area,
      institution: item.institucion
    }))
  }
  // Si hay instituciones seleccionadas, filtra por ellas
  return rawData.value
    .filter(item => selectedInstitutions.value.includes(item.institucion))
    .map(item => ({
      label: `${item.area} (${item.total})`,
      value: item.area,
      institution: item.institucion
    }))
})
const filteredAreasOptions = ref([])

const filterAreas = (val, update) => {
  update(() => {
    const needle = val ? val.toLowerCase() : ''
    filteredAreasOptions.value = allAreasOptions.value.filter(
      v => v.label.toLowerCase().indexOf(needle) > -1 ||
        v.institution.toLowerCase().indexOf(needle) > -1
    )
  })
}

// Filtrar datos para la tabla

const filteredRows = computed(() => {
  if (!selectedInstitutions.value) {
    // eslint-disable-next-line vue/no-side-effects-in-computed-properties
    selectedInstitutions.value = ['MINAAMP', 'INASS'] // Asignar valor por defecto si es null
  }

  return rawData.value.filter(item => {
    const institutionMatch = selectedInstitutions.value.length === 0 ||
      selectedInstitutions.value.includes(item.institucion)
    const areaMatch = selectedAreas.value.length === 0 ||
      selectedAreas.value.includes(item.area)
    return institutionMatch && areaMatch
  })
})
// Totales calculados
const totalMovilizados = computed(() => {
  return filteredRows.value.reduce((sum, row) => sum + parseInt(row.movilizados), 0)
})

const totalPorMovilizar = computed(() => {
  return filteredRows.value.reduce((sum, row) => sum + parseInt(row.por_movilizar), 0)
})

const totalGeneral = computed(() => {
  return filteredRows.value.reduce((sum, row) => sum + parseInt(row.total), 0)
})

// Exportar a Excel
const exportToExcel = () => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const ws = XLSX.utils.json_to_sheet(filteredRows.value)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Datos')
    XLSX.writeFile(wb, `InstAreas_Movilizacion_${timestamp}.xlsx`)

    $q.notify({
      type: 'positive',
      message: 'Exportación a Excel completada',
      position: 'top'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Error al exportar a Excel',
      position: 'top'
    })
  }
}

// Persistencia de filtros
const persistFilters = () => {
  localStorage.setItem('instAreasFilters', JSON.stringify({
    institutions: selectedInstitutions.value,
    areas: selectedAreas.value
  }))
}

const loadPersistedFilters = () => {
  const savedFilters = localStorage.getItem('instAreasFilters')
  if (savedFilters) {
    try {
      const { institutions, areas } = JSON.parse(savedFilters)
      selectedInstitutions.value = institutions || ['MINAAMP', 'INASS'] // Valor por defecto si es null/undefined
      selectedAreas.value = areas ? areas.filter(area =>
        rawData.value.some(item => item.area === area)
      ) : []
    } catch (e) {
      console.error('Error parsing saved filters:', e)
      selectedInstitutions.value = ['MINAAMP', 'INASS']
      selectedAreas.value = []
    }
  }
}
const clearFilters = () => {
  selectedInstitutions.value = ['MINAAMP', 'INASS']
  selectedAreas.value = []
  areasSearchFilter.value = ''
}

// Watch para persistencia
watch([selectedInstitutions, selectedAreas], () => {
  persistFilters()
}, { deep: true })
// Watch para el filtro de áreas
watch(selectedInstitutions, () => {
  // Actualiza las opciones de áreas cuando cambian las instituciones seleccionadas
  filteredAreasOptions.value = allAreasOptions.value
  // Limpia las áreas seleccionadas que ya no correspondan a la institución seleccionada
  selectedAreas.value = selectedAreas.value.filter(area =>
    allAreasOptions.value.some(opt => opt.value === area)
  )
})

// Ciclo de vida
onMounted(() => {
  fetchData().then(() => {
    filteredAreasOptions.value = allAreasOptions.value
  })
})
</script>

<style scoped>
.sticky-header-table {
  height: calc(100vh - 220px);
}

.sticky-header-table :deep(.q-table__top),
.sticky-header-table :deep(.q-table__bottom),
.sticky-header-table :deep(.q-table__middle) {
  position: sticky;
  z-index: 1;
}

.sticky-header-table :deep(.q-table__top) {
  top: 0;
}

.sticky-header-table :deep(.q-table__bottom) {
  bottom: 0;
}
.centered-container {
  min-height: 100vh;
  width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.q-pa-md {
  max-width: 900px; /* O el ancho que prefieras */
  margin: 0 auto;
  box-sizing: border-box;
}
</style>
