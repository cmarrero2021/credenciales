<template>
  <div class="q-pa-md">
      <div class="image-container">
        <img class="responsive-image" src="/img/logo_nobg1.png" alt="Electoral MINAAMP - INASS" />
      </div>

    <h4 class="q-mb-md">SERVIDORES</h4>

    <q-table
      title="Lista de Servidores"
      :rows="filteredServers"
      :columns="isQuickEditMode ? quickEditColumns : columns"
      :rows-per-page-options="[10, 20, 50]"
      row-key="id"
      :pagination="pagination"
      :loading="loading"
      virtual-scroll
      class="responsive-table"
      :class="{ 'editing-mode': isQuickEditMode }"
    >
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
        <div class="col-xs-2 col-sm-1">
          <q-btn icon="add" title="Agregar nueva revista" @click="openNewModal" color="positive" size="sm"
            class="full-width" v-if="hasPermission('view_admin') && !isQuickEditMode" />
        </div>
      </template>

      <!-- Columna de foto -->
      <template v-slot:body-cell-foto="props">
        <q-td :props="props">
          <img :src="getFotoUrl(props.row.foto_url)" alt="Foto" style="width:48px;height:48px;object-fit:cover;border-radius:50%;border:1px solid #ccc;" />
        </q-td>
      </template>

      <!-- Botones de acción en cada fila (modo normal) -->
      <template v-slot:body-cell-actions="props" v-if="!isQuickEditMode">
        <q-td :props="props">
          <div class="row items-center">
            <!-- Botón Editar -->
            <q-btn icon="edit" color="primary" title="Editar servidor" size="xs" @click.stop="openEditModal(props.row)"
              class="q-mr-xs" v-if="hasPermission('view_admin')" />

            <!-- Botón Marcas Votó -->
            <q-btn icon="check" color="secondary" title="Marcar que el servidor votó" size="xs"
              class="q-mr-xs" @click.stop="startQuickEdit(props.row)" v-if="hasPermission('view_admin')"/>

            <!-- Botón Borrar -->
            <q-btn icon="delete" @click.stop="eliminarServidor(props.row)" color="negative" title="Eliminar Servidor" size="xs"
              class="q-mr-xs" v-if="hasPermission('view_admin')" />
          </div>
        </q-td>
      </template>

      <!-- Celda de hora_voto (editable en modo rápido) -->
      <template v-slot:body-cell-hora_voto="props">
        <q-td :props="props" :class="{ 'editing-cell': isQuickEditMode && props.row === editingRow }">
          <div v-if="isQuickEditMode && props.row === editingRow">
            <q-input
              v-model="editingRowData.hora_voto"
              type="time"
              dense
              outlined
              @update:model-value="handleTimeChange(props.row)"
            />
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
            <q-input
              v-model="editingRowData.observaciones"
              type="text"
              dense
              outlined
              @update:model-value="val => editingRowData.observaciones = val.toUpperCase()"
            />
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
            <q-btn
              icon="check"
              color="positive"
              size="sm"
              @click.stop="saveQuickEdit(props.row)"
              class="q-mr-xs"
            />
            <q-btn
              icon="close"
              color="negative"
              size="sm"
              @click.stop="cancelQuickEdit"
            />
          </div>
        </q-td>
        <q-td v-else-if="isQuickEditMode"></q-td>
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
                <q-input v-model="editForm.cedula" label="Cédula" type="number" filled />
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
                <q-select v-model="editForm.area" :options="optionsu.area" label="Adscripción" filled option-label="label"
                  option-value="value" />
              </div>
              <div class="col-12 col-md-6">
                <q-select v-model="editForm.cargo" :options="optionsu.cargo" label="Cargo" filled
                  option-label="label" option-value="value" />
              </div>
                <!-- Campo para subir foto PNG -->
                <div class="col-12">
                  <q-file
                    v-model="editForm.foto"
                    label="Foto PNG del usuario"
                    filled
                    accept="image/png"
                    :clearable="true"
                    @rejected="onFileRejected"
                      @update:model-value="onFotoChange"
                  />
                    <div v-if="fotoPreview" class="q-mt-md">
                      <div class="text-caption">Vista previa de la foto:</div>
                      <img :src="fotoPreview" alt="Vista previa" style="max-width: 200px; max-height: 200px; border-radius: 8px; border: 1px solid #ccc;" />
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
              <q-btn icon="save" color="primary" type="submit" class="q-ml-sm" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
// Estado del modal de edición
const editDialog = ref(false);
import { ref, onMounted, computed, watch } from 'vue';
// Vista previa de la foto
const fotoPreview = ref(null);

const onFotoChange = (file) => {
  if (file && file instanceof File) {
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
  { name: 'nombres', label: 'Nombre', field: 'nombres', sortable: true, filterable: true, align: 'left', type: 'text' },
  // { name: 'hora_voto', label: 'Votó', field: 'hora_voto', sortable: true, filterable: false, align: 'left', type: 'text' },
  { name: 'institucion', label: 'Institución', field: 'institucion', sortable: true, filterable: true, align: 'left', type: 'select' },
  { name: 'sede', label: 'Sede', field: 'sede', sortable: true, filterable: true, align: 'left', type: 'select' },
  { name: 'area', label: 'Adscripción', field: 'area', sortable: true, filterable: true, align: 'left', type: 'select' },
  { name: 'cargo', label: 'Cargo', field: 'cargo', sortable: true, filterable: true, align: 'left', type: 'select' },
  // { name: 'observaciones', label: 'Observaciones', field: 'observaciones', sortable: false, filterable: false, align: 'left', type: 'text' },
];
// Función para obtener la URL de la foto (soporta rutas locales y absolutas)
const apiBase = import.meta.env.VITE_API_URL || '';
const getFotoUrl = (foto_url) => {
  if (!foto_url) return apiBase + '/img/no_person.png';
  const normalized = foto_url.replace(/\\/g, '/');
  if (normalized.includes('no_person.png')) {
    return apiBase + '/img/no_person.png';
  }
  if (normalized.includes('/uploads/')) {
    return apiBase + normalized;
  }
  if (normalized.startsWith('uploads/')) {
    return apiBase + '/' + normalized;
  }
  // Fallback
  return apiBase + '/img/no_person.png';
};

// Columnas para el modo edición rápida
const quickEditColumns = [
  { name: 'cedula', label: 'Cédula', field: 'cedula', sortable: true, align: 'left' },
  { name: 'nombres', label: 'Nombre', field: 'nombres', sortable: true, align: 'left' },
  { name: 'hora_voto', label: 'Votó', field: 'hora_voto', sortable: true, align: 'left' },
  // { name: 'observaciones', label: 'Observaciones', field: 'observaciones', sortable: false, align: 'left' },
  { name: 'controles', label: 'Controles', align: 'right' }
];

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
  return permissions.some(p => p.name === permissionName)
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
  } catch (error) {
    console.error('Error al obtener las revistas:', error);
  } finally {
    loading.value = false;
  }
};

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

    // Obtener estados
    const cargosResponse = await axios.get(estadosURL);
    options.value.cargo = cargosResponse.data.map(item => item.cargo);
    const cargosResponseU = await axios.get(estadosURL);
    // const cargosResponseU = await axios.get(cargosLsURL);
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
// Función para abrir el modal de creación
const openNewModal = () => {
  editForm.value = {
    // Inicializa todos los campos necesarios
    id: null,
    area_id: null,
    institucion_id: null,
    sede_id: null,
    cedula: null,
    nombres: null,
    apellidos: null,
    // hora_voto: null,
    observaciones: null,
  };
  editDialog.value = true;
  isEditing.value = false;
};

// Función para abrir el modal de edición
const openEditModal = async (server) => {
  try {
    const response = await axios.get(`${servidorDetailURL}${server.cedula}`);
    editForm.value = { ...response.data };
    editDialog.value = true;
    isEditing.value = true;
  } catch (error) {
    console.error('Error al obtener los datos del servidor:', error);
  }
};

// Función para cerrar el modal de edición
const closeEditModal = () => {
  editDialog.value = false;
};

const saveChanges = async () => {
  try {
    const formData = new FormData();
    formData.append('area_id', isEditing.value ? editForm.value.area_id : editForm.value.area?.value);
    formData.append('institucion_id', isEditing.value ? editForm.value.institucion_id : editForm.value.institucion?.value);
    formData.append('sede_id', isEditing.value ? editForm.value.sede_id : editForm.value.sede?.value);
    formData.append('cargo_id', isEditing.value ? editForm.value.cargo_id : editForm.value.cargo?.value);
    formData.append('cedula', editForm.value.cedula);
    formData.append('nombres', editForm.value.nombres?.toUpperCase() ?? '');
    formData.append('apellidos', editForm.value.apellidos?.toUpperCase() ?? '');
    if (editForm.value.foto) {
      formData.append('foto', editForm.value.foto);
    }
    if (isEditing.value) {
      // Modo edición (no se sube foto aquí)
      await axios.patch(`${updateServerURL}${editForm.value.cedula}`, Object.fromEntries(formData));
      Notify.create({
        type: 'positive',
        message: 'Los cambios se han guardado correctamente.'
      });
    } else {
      // Modo creación, se sube foto si existe
      await axios.post(insertServerURL, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
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
// Manejar rechazo de archivo
const onFileRejected = (rejectedFiles) => {
  Notify.create({
    type: 'negative',
    message: 'Solo se permite subir archivos PNG.'
  });
};
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

    await axios.patch(`${updateServerURL}${row.cedula}`, servidorData);

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
    await axios.patch(`${deleteServerURL}${servidor.cedula}`);

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
  fetchServers();
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
