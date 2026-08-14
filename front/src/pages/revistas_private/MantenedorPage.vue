<template>
  <div class="q-pa-md">
    <div class="image-container">
      <img class="responsive-image" src="/img/logo_nobg1.png" alt="Electoral MINAAMP - INASS" />
    </div>

    <h4 class="q-mb-md">SERVIDORES</h4>

    <q-table title="Lista de Servidores" :rows="filteredServers" :columns="isQuickEditMode ? quickEditColumns : columns"
      :rows-per-page-options="[10, 20, 50]" row-key="id" :pagination="pagination" :loading="loading" virtual-scroll
      class="responsive-table" :class="{ 'editing-mode': isQuickEditMode }">
      <template v-slot:top>
        <div class="full-width q-mb-md">
          <div class="row wrap items-center q-col-gutter-sm q-mb-md">
            <div class="col-12 col-sm-6 col-md-5">
              <q-input outlined dense debounce="300" v-model="searchQuery" label="Búsqueda general"
                placeholder="Buscar en todos los campos">
                <template v-slot:append>
                  <q-icon v-if="searchQuery" name="clear" @click.stop="clearSearch" class="cursor-pointer" size="sm" />
                </template>
              </q-input>
            </div>
            <div class="col-12 col-sm-6 col-md-3">
              <q-toggle
                v-model="photoFilter"
                toggle-indeterminate
                :label="photoFilter === null ? 'Mostrar todos' : (photoFilter ? 'Servidores con foto' : 'Servidores sin foto')"
                color="primary"
                dense
                square
              />
            </div>
            <div class="col-12 col-sm-auto flex items-center q-gutter-sm">
              <q-toggle
                v-model="stateFilter"
                :label="stateFilter ? 'Servidores activos' : 'Servidores inactivos'"
                color="primary"
                dense
                square
              />
              <q-btn icon="fas fa-trash" title="Borrar todos los filtros" @click="clearAllFilters" color="negative" flat size="sm" />
            </div>
          </div>

          <div class="row wrap items-center q-col-gutter-sm q-mb-md" v-if="!isQuickEditMode">
            <div class="col-12 col-sm-6 col-md-3">
              <q-input outlined dense debounce="300" v-model="filters.cedula" label="Cédula" placeholder="Filtrar" clearable @clear="clearFilter('cedula')" />
            </div>
            <div class="col-12 col-sm-6 col-md-3">
              <q-input outlined dense debounce="300" v-model="filters.nombres" label="Nombres" placeholder="Filtrar" clearable @clear="clearFilter('nombres')" />
            </div>
            <div class="col-12 col-sm-6 col-md-3">
              <q-input outlined dense debounce="300" v-model="filters.apellidos" label="Apellidos" placeholder="Filtrar" clearable @clear="clearFilter('apellidos')" />
            </div>
            <div class="col-12 col-sm-6 col-md-3">
              <q-select outlined dense clearable v-model="filters.institucion" label="Institución"
                :options="options.institucion" emit-value map-options @clear="clearFilter('institucion')" />
            </div>
          </div>

          <div class="row wrap items-center q-col-gutter-sm q-mb-md" v-if="!isQuickEditMode">
            <div class="col-12 col-sm-4">
              <q-select outlined dense clearable v-model="filters.sede" label="Sede"
                :options="options.sede" emit-value map-options @clear="clearFilter('sede')" />
            </div>
            <div class="col-12 col-sm-4">
              <q-select outlined dense clearable v-model="filters.area" label="Adscripción"
                :options="options.area" emit-value map-options @clear="clearFilter('area')" />
            </div>
            <div class="col-12 col-sm-4">
              <q-select outlined dense clearable v-model="filters.cargo" label="Cargo"
                :options="options.cargo" emit-value map-options @clear="clearFilter('cargo')" />
            </div>
          </div>

          <div class="row wrap items-center q-col-gutter-sm" v-if="!isQuickEditMode">
            <div class="col-12">
              <div class="row items-center q-col-gutter-sm">
                <div class="col-auto">
                  <q-btn icon="add" title="Agregar nueva revista" @click="openNewModal" color="positive" size="sm" v-if="(hasPermission('create_servidor') || hasPermission('view_admin')) && !isQuickEditMode" />
                </div>
                <div class="col-auto">
                  <q-btn icon="file_upload" label="CARGA MASIVA SERVIDORES" title="Carga masiva de servidores" @click="goToMassive" color="primary" size="sm" v-if="(hasPermission('create_servidor') || hasPermission('view_admin')) && !isQuickEditMode" />
                </div>
                <div class="col-auto">
                  <q-btn icon="upload_file" label="CARGA MASIVA FOTOS" title="Carga masiva de fotos" @click="triggerPhotoUpload" color="info" size="sm" v-if="(hasPermission('update_servidor') || hasPermission('view_admin')) && !isQuickEditMode" />
                </div>
                <div class="col-auto">
                  <q-btn icon="visibility" label="VER ERRORES" title="Ver errores carga masiva" @click="openErrorsModal" color="orange" size="sm" v-if="(hasPermission('update_servidor') || hasPermission('view_admin')) && !isQuickEditMode" />
                </div>
                <input type="file" multiple accept="image/png, image/jpeg, image/jpg" ref="photoInput" style="display: none" @change="handleMassPhotoUpload" />
              </div>
            </div>
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

      <template v-slot:body-cell-fecha_ingreso="props">
        <q-td :props="props">
          <span :class="{ 'text-negative text-bold': isTooRecentIngreso(props.row) }">
            {{ props.row.fecha_ingreso ? new Date(props.row.fecha_ingreso).toLocaleDateString() : '-' }}
          </span>
          <q-icon v-if="isTooRecentIngreso(props.row)" name="warning" color="orange" size="xs" class="q-ml-xs">
            <q-tooltip>Ingreso menor a 3 meses – No se puede imprimir carnet</q-tooltip>
          </q-icon>
        </q-td>
      </template>

      <!-- Botones de acción en cada fila (modo normal) -->
      <template v-slot:body-cell-actions="props" v-if="!isQuickEditMode">
        <q-td :props="props">
          <div class="row items-center">
            <!-- Botón Editar -->
            <q-btn icon="edit" color="primary" title="Editar servidor" size="xs" @click.stop="openEditModal(props.row)"
              class="q-mr-xs" v-if="(hasPermission('update_servidor') || hasPermission('view_admin'))" />

            <!-- Botón Borrar -->
            <q-btn icon="delete" @click.stop="eliminarServidor(props.row)" color="negative" title="Eliminar Servidor"
              size="xs" class="q-mr-xs" v-if="(hasPermission('delete_servidor') || hasPermission('update_historico') || hasPermission('view_admin'))" />
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
                <q-input v-model="editForm.fecha_ingreso" label="Fecha de ingreso" type="date" filled />
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

    <!-- Modal para mostrar errores de carga masiva -->
    <q-dialog v-model="errorsModal" maximized>
      <q-card style="min-width: 600px; max-width: 90vw;">
        <q-card-section class="q-pb-none">
          <div class="text-h6">Errores - Carga Masiva de Fotos</div>
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
import { ref, onMounted, computed, watch } from 'vue'
import { LocalStorage, Notify, useQuasar } from 'quasar'
import axios from 'axios'
import { useRouter } from 'vue-router'

// Ordenamiento múltiple para la tabla
const customSort = (rows, sortBy, descending) => {
  if (!Array.isArray(sortBy)) sortBy = [sortBy]
  if (!Array.isArray(descending)) descending = [descending]
  return rows.slice().sort((a, b) => {
    for (let i = 0; i < sortBy.length; i++) {
      const col = sortBy[i]
      const dir = descending[i] ?? false
      if (a[col] < b[col]) return dir ? 1 : -1
      if (a[col] > b[col]) return dir ? -1 : 1
    }
    return 0
  })
}
// Estado del modal de edición
const editDialog = ref(false)
// Verificar que todos los registros seleccionados tengan foto válida
// Vista previa de la foto
const fotoPreview = ref(null)

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

const router = useRouter()
const photoInput = ref(null)
const $q = useQuasar()

const triggerPhotoUpload = () => {
  if (photoInput.value) {
    photoInput.value.click();
  }
};

const extractCedulaFromFilename = (filename) => {
  const baseName = filename.replace(/\.[^/.]+$/, "").trim();

  // 1. Si es puramente numérico y tiene entre 6 y 9 dígitos
  if (/^\d{6,9}$/.test(baseName)) {
    return baseName;
  }

  // 2. Si es del formato timestamp_cedula (ej: 20260526_085918_6088396)
  if (baseName.includes('_')) {
    const parts = baseName.split('_');
    const lastPart = parts[parts.length - 1].trim();
    if (/^\d{6,9}$/.test(lastPart)) {
      return lastPart;
    }
  }

  // 3. Si tiene prefijo CI o V (ej: CI-6088396, V6088396)
  const cleanPrefix = baseName.replace(/^(ci|v|e)[-_\s]?/i, '');
  if (/^\d{6,9}$/.test(cleanPrefix)) {
    return cleanPrefix;
  }

  // No es una cédula válida
  return null;
};

const getSystemErrorMessage = (row) => {
  if (!row) return '';
  const reason = row.reason;
  const fileName = row.file_name || row.file || '';
  const cleanCedula = row.cedula || extractCedulaFromFilename(fileName) || '';

  if (reason === 'LIMIT_FILE_SIZE') {
    return `El peso de la foto (${fileName}) no coincide, por favor debe cargar la foto que pese igual o menos a 1 mb.`;
  }
  if (reason === 'no_cedula_en_nombre') {
    return `El nombre del archivo "${fileName}" no es una cédula válida. Debe contener solo números.`;
  }
  return `Error al cargar la foto de la cédula ${cleanCedula}.`;
};


const handleMassPhotoUpload = async (event) => {
  const files = Array.from(event.target.files || []);
  event.target.value = '';

  if (files.length === 0) return;

  let successCount = 0;
  let errorCount = 0;

  for (const file of files) {
    const cleanCedula = extractCedulaFromFilename(file.name);
    const fileSizeMB = file.size / (1024 * 1024);

    if (fileSizeMB > 1.0) {
      Notify.create({
        type: 'negative',
        message: `El peso de la foto (${file.name}) no coincide, por favor debe cargar la foto que pese igual o menos a 1 mb.`,
        timeout: 6000
      });
      errorCount++;
      // Registrar error en backend
      try {
        const token = LocalStorage.getItem('token');
        await axios.post(`${apiBase}/auth/cargar_fotos_masivas/log_failed_attempt`, {
          file_name: file.name,
          reason: 'LIMIT_FILE_SIZE',
          cedula: cleanCedula || null
        }, {
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
      } catch (err) {
        console.error('Error logging size limit error:', err);
      }
      continue;
    }

    if (!cleanCedula) {
      Notify.create({
        type: 'warning',
        message: `El nombre del archivo "${file.name}" no es una cédula válida. Debe contener solo números.`,
        timeout: 6000
      });
      errorCount++;
      // Registrar error en backend
      try {
        const token = LocalStorage.getItem('token');
        await axios.post(`${apiBase}/auth/cargar_fotos_masivas/log_failed_attempt`, {
          file_name: file.name,
          reason: 'no_cedula_en_nombre',
          cedula: null
        }, {
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
      } catch (err) {
        console.error('Error logging invalid format error:', err);
      }
      continue;
    }

    try {
      const formData = new FormData();
      formData.append('foto', file);
      const token = LocalStorage.getItem('token');

      await axios.post(`${apiURL}/auth/cargar_foto_masiva/${cleanCedula}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-Original-Filename': encodeURIComponent(file.name),
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      Notify.create({
        type: 'positive',
        message: `Foto de la cédula ${cleanCedula} cargada con éxito.`,
        timeout: 3000
      });
      successCount++;
    } catch (error) {
      errorCount++;
      const serverMsg = error.response?.data?.error;
      const defaultMsg = `Error al cargar la foto de la cédula ${cleanCedula}.`;
      Notify.create({
        type: 'negative',
        message: serverMsg || defaultMsg,
        timeout: 8000
      });
    }
  }

  if (successCount > 0) {
    await fetchServers();
  }

  Notify.create({
    type: 'info',
    message: `Proceso de carga masiva de fotos completado. Exitosas: ${successCount}, Fallidas: ${errorCount}`,
    timeout: 5000
  });
};

// Exportar errores a archivo .txt desde el modal
const exportErrorsToTxt = () => {
  if (!errorsList.value || errorsList.value.length === 0) {
    Notify.create({ type: 'warning', message: 'No hay errores para exportar.' });
    return;
  }
  const lines = [];
  lines.push('=== REPORTE DE ERRORES - CARGA MASIVA DE FOTOS ===');
  lines.push(`Fecha de exportación: ${new Date().toLocaleString()}`);
  lines.push(`Total de archivos con error: ${errorsList.value.length}`);
  lines.push('='.repeat(60));
  lines.push('');
  for (const row of errorsList.value) {
    const fecha = row.created_at ? new Date(row.created_at).toLocaleString() : '-';
    const archivo = row.file_name || '-';
    const usuario = row.user_id || '-';
    const motivo = getSystemErrorMessage(row);
    lines.push(`Fecha: ${fecha}`);
    lines.push(`Archivo: ${archivo}`);
    lines.push(`Usuario: ${usuario}`);
    lines.push(`Motivo: ${motivo}`);
    lines.push('-'.repeat(60));
  }
  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `errores_carga_fotos_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
  Notify.create({ type: 'positive', message: 'Reporte de errores exportado como TXT.' });
};

// Modal / estado para ver errores
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
    const resp = await axios.get(`${apiBase}/auth/cargar_fotos_masivas/errors/history?limit=200`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
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
    const resp = await axios.get(`${apiBase}/auth/cargar_fotos_masivas/errors/latest_db`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
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
    const resp = await axios.get(`${apiBase}/auth/cargar_fotos_masivas/errors/file`, {
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
  { name: 'fecha_ingreso', label: 'Fecha de ingreso', field: 'fecha_ingreso', sortable: true, filterable: false, align: 'left', type: 'date' },
  { name: 'estado', label: 'Estado', field: 'estado', sortable: true, filterable: false, align: 'left', type: 'text' },
];
// Función para obtener la URL de la foto
// Soporta base64 (data:image/...) devuelto por el backend en producción,
// rutas /uploads/... y URLs absolutas.
// El avatar por defecto se sirve desde los estáticos del FRONTEND (/img/no_person.png),
// sin apiBase, para que nginx lo entregue directamente sin proxear al backend.
const DEFAULT_AVATAR = '/img/no_person.png';
function normalizeApiBase(raw) {
  let url = (raw || '').toString().trim();
  if (!url) {
    url = (typeof window !== 'undefined' ? `http://${window.location.hostname}:3001` : 'http://localhost:3001');
  }
  if (url.startsWith(':')) url = `http://localhost${url}`;
  if (/^localhost:/i.test(url)) url = `http://${url}`;
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url.replace(/\/+$/, '');
}
const apiBase = normalizeApiBase(import.meta.env.VITE_API_URL);
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

const getPublicAssetUrl = (path) => {
  if (!path) return path;
  if (typeof window !== 'undefined' && path.startsWith('/')) {
    return `${window.location.origin}${path}`;
  }
  return path;
};

function parseFechaIngreso(item) {
  const raw = item?.fecha_ingreso || item?.fecha_ingreso_str || item?.ingreso || null
  if (!raw) return null
  const date = new Date(raw)
  return Number.isFinite(date.getTime()) ? date : null
}

function isTooRecentIngreso(item) {
  const ingreso = parseFechaIngreso(item)
  if (!ingreso) return false
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 3)
  return ingreso > cutoff
}

// Columnas para el modo edición rápida
const quickEditColumns = [
  { name: 'cedula', label: 'Cédula', field: 'cedula', sortable: true, align: 'left' },
  { name: 'nombres', label: 'Nombre', field: 'nombres', sortable: true, align: 'left' },
  { name: 'hora_voto', label: 'Votó', field: 'hora_voto', sortable: true, align: 'left' },
  // { name: 'observaciones', label: 'Observaciones', field: 'observaciones', sortable: false, align: 'left' },
  { name: 'controles', label: 'Controles', align: 'right' }
];

// URLs de los endpoints
const apiURL = normalizeApiBase(import.meta.env.VITE_API_URL);
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

const isRRHH = computed(() => hasPermission('update_historico'))
const isAdmin = computed(() => hasPermission('view_admin') || hasPermission('view_admin1'))
const stateFilter = ref(true)

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

    const tooRecentSelected = selectedRows.filter(isTooRecentIngreso)
    if (tooRecentSelected.length > 0) {
      const skipped = tooRecentSelected.map(s => s.cedula || s.id).join(', ')
      Notify.create({
        type: 'warning',
        message: `Se excluyen ${tooRecentSelected.length} servidores con fecha de ingreso menor a 3 meses: ${skipped}`
      })
      selectedRows = selectedRows.filter(s => !isTooRecentIngreso(s))
      if (!selectedRows.length) {
        Notify.create({ type: 'negative', message: 'No hay carnets válidos para imprimir tras aplicar la restricción de ingreso.' })
        return
      }
    }

    const pageSize = Number(size || 20)
    const groups = chunkArray(selectedRows, pageSize)

    // --- Nuevo: comprobar si algunos carnets ya fueron impresos ---
    try {
      const enriched = await Promise.all(selectedRows.map(async (s) => {
        try {
          const res = await axios.get(`${apiBase}/auth/credencial/${s.cedula}`)
          if (res && res.data && res.data.cedula) return res.data
        } catch (err) {
          console.warn('printBatchServidores: could not fetch full data for', s.cedula, err && err.message)
        }
        return s
      }))

      const alreadyPrinted = enriched.filter(s => s.ya_impreso === true)
      if (alreadyPrinted.length > 0) {
        // Mostrar diálogo con opciones: reimprimir todo, omitir impresos, cancelar
        const listHtml = alreadyPrinted.map(x => `${x.cedula} - ${(x.nombres || '') + ' ' + (x.apellidos || '')}`).join('<br/>')
        const dlg = $q.dialog({
          title: '⚠️ Carnets ya impresos detectados',
          message: `Se detectaron ${alreadyPrinted.length} carnets ya impresos:<br/>${listHtml}<br/><br/>¿Desea reimprimirlos? Reimprimir marcará el carnet anterior como anulado (inactivo).`,
          html: true,
          ok: { label: 'Reimprimir todos', color: 'warning' },
          cancel: { label: 'Omitir impresos', color: 'primary' },
          persistent: true
        })

        const answer = await dlg.onOk(() => true).onCancel(() => false)
        // onOk resolved -> reprint all, onCancel -> omit printed
        const reprintAll = (answer === true)
        if (!reprintAll) {
          // Omitir impresos: filtrar selectedRows a los que no estaban impresos
          selectedRows = enriched.filter(s => s.ya_impreso !== true)
          if (!selectedRows || selectedRows.length === 0) {
            Notify.create({ type: 'info', message: 'No hay carnets pendientes de impresión después de omitir los ya impresos.' })
            return
          }
        } else {
          // Reimprimir todos: dejamos selectedRows = enriched (incluye todos)
          selectedRows = enriched
        }
        // Recalcular grupos con la nueva selección
        const newPageSize = Number(size || 20)
        groups.length = 0
        const newGroups = chunkArray(selectedRows, newPageSize)
        // replace groups variable content by pushing
        for (let g of newGroups) groups.push(g)
        // Si el usuario eligió reimprimir y tiene permiso RRHH, solicitar al backend marcar historiales previos como anulados
        if (reprintAll) {
          try {
            const token = LocalStorage.getItem('token')
            if (token && hasPermission('update_historico')) {
              // Ejecutar deshabilitado previo de forma secuencial para no saturar la BD
              for (const s of selectedRows) {
                try {
                  await disablePreviousHistorico(s.cedula)
                } catch (e) {
                  console.warn('disablePreviousHistorico error for', s.cedula, e)
                }
              }
            }
          } catch (e) {
            console.warn('Error al deshabilitar historiales previos (frontend):', e)
          }
        }
      }
    } catch (err) {
      console.warn('Error comprobando impresiones previas:', err)
    }

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

    const createdHistoryIds = []
    const reportResults = await Promise.allSettled(
      selectedRows.map(async (s) => {
        if (!s || !s.cedula) return null
        const saved = await bgReportPrint(s.cedula, false)
        if (saved) return saved
        return null
      })
    )

    reportResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) createdHistoryIds.push(result.value)
    })

    const win = window.open('', '_blank')
    if (!win) {
      Notify.create({ type: 'negative', message: 'Bloqueador de ventanas emergentes impide la impresión masiva' })
      return
    }

    // Datos para construir QR
    const qrBaseUrl = 'https://credenciales.minaamp.gob.ve/credenciales/cedula='
    const publicBaseUrl = (typeof window !== 'undefined' ? window.location.origin : '')

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi]
      const html = []
      html.push('<!doctype html><html><head><meta charset="utf-8"><title>Impresión masiva</title>')
      html.push(`<base href="${publicBaseUrl}/">`)
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
        const fondoUrl = getFondoFor_item(r)
        html.push(`<div class="cred"><div class="fondo"><img src="${fondoUrl}" style="width:55mm;height:85mm;position:absolute;left:0;top:0"/>`)
        html.push(`<img class="foto" src="${foto}" alt="foto"/>`)
        html.push(`<div class="nombre">${nombres} ${apellidos}</div>`)
        html.push(`<div class="cedula">${ced}</div>`)
        html.push(`<div class="cargo">${cargo}</div>`)
        html.push('</div></div>')

        // Trasera: usar imagen específica para INASS o el texto + sello para el Ministerio
        const footerImg = getFooterFor_item(r)
        if (isINASS_item(r)) {
          // Para INASS usamos una imagen completa de reverso si está disponible
          html.push(`<div class="cred"><div class="back"><img src="/img/reverso_inass.png" style="width:55mm;height:85mm;position:absolute;left:0;top:0;" /><img class="qr" src="${qrImg}" style="position:absolute;right:6mm;bottom:6mm;width:18mm;height:18mm;"/></div></div>`)
        } else {
          html.push(`<div class="cred"><div class="back"><div style="font-size:2.3mm;color:#2c3e50">• Este carnet es de uso exclusivo para el personal que labora en Ministerio del Poder Popular para los Adultos y Adultas Mayores Abuelos y Abuelas de la Patria</div><div style="position:relative;height:100%"><img src="${footerImg}" style="width:110px;height:100px;object-fit:contain;margin-left:-4mm;margin-top:-1.5mm;max-width:90px;max-height:90px;" /><img class="qr" src="${qrImg}" /></div></div></div>`)
        }
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
    // Preguntar y reportar al backend que se imprimieron (registrar historico)
    try {
      $q.dialog({
        title: 'Confirmar entrega de lote',
        message: `Se registró la impresión de ${selectedRows.length} credenciales. ¿Fueron entregadas o quedan en espera?`,
        ok: { label: 'Entregadas', color: 'positive', icon: 'check' },
        cancel: { label: 'En espera', color: 'warning', icon: 'schedule' },
        persistent: true
      }).onOk(() => {
        markBatchHistoryDelivered(createdHistoryIds, true)
      }).onCancel(() => {
        markBatchHistoryDelivered(createdHistoryIds, false)
      })
    } catch (e) {
      console.warn('Error mostrando diálogo de confirmación de entrega:', e)
    }
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
  width: 200px;
  height: 200px;
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
          <img class="fondo-img" src="${getFondoFor_item(r)}" />
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

// Function to log the print action to the database without stopping the UI
async function bgReportPrint(cedulaStr, entregadoVal) {
  try {
    const token = LocalStorage.getItem('token')
    if (!token) return null
    const res = await axios.post(`${apiBase}/auth/credencial/historico`, { cedula: cedulaStr, entregado: !!entregadoVal }, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return res.data?.historyId || null
  } catch (err) {
    console.error('No se pudo registrar la impresión en el módulo de gestión (batch):', err)
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

// Frontend request to explicitly mark previous historico entries as deshabilitado (Anulado por Reimpresion)
async function disablePreviousHistorico(cedulaStr) {
  try {
    const token = LocalStorage.getItem('token')
    if (!token) return
    if (!hasPermission('update_historico')) return
    await axios.patch(`${apiBase}/auth/eliminar_servidor/${cedulaStr}`, { reason: 'Anulado por Reimpresion' }, {
      headers: { Authorization: `Bearer ${token}` }
    })
  } catch (err) {
    console.error('No se pudo deshabilitar historico previo (frontend):', err)
    throw err
  }
}

// Búsqueda general
const searchQuery = ref('');
const photoFilter = ref(null);

// Filtros para las columnas
const filters = ref({
  cedula: null,
  nombres: null,
  apellidos: null,
  institucion: null,
  sede: null,
  area: null,
  cargo: null
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
  const normalizeId = (value) => (value === undefined || value === null) ? null : String(value);
  editForm.value = {
    ...row,
    institucion: optionsu.value.institucion.find(opt => normalizeId(opt.value) === normalizeId(row.institucion_id)) || null,
    sede: optionsu.value.sede.find(opt => normalizeId(opt.value) === normalizeId(row.sede_id)) || null,
    area: optionsu.value.area.find(opt => normalizeId(opt.value) === normalizeId(row.area_id)) || null,
    cargo: optionsu.value.cargo.find(opt => normalizeId(opt.value) === normalizeId(row.cargo_id)) || null,
    fecha_ingreso: row.fecha_ingreso ? (row.fecha_ingreso instanceof Date ? row.fecha_ingreso.toISOString().slice(0, 10) : row.fecha_ingreso) : null,
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
    const srvUrl = servidoresURL || `${apiBase.replace(/\/+$/, '')}/auth/servidores`
    const response = await axios.get(srvUrl);
    servers.value = response.data.map(item => ({
      ...item,
      estado: (item.trabajador_activo === false || item.activo === false) ? 'Inactivo' : 'Activo',
      trabajador_activo: typeof item.trabajador_activo !== 'undefined' ? item.trabajador_activo : item.activo,
      activo: typeof item.activo !== 'undefined' ? item.activo : item.trabajador_activo
    }));
    console.log("servers:", servers.value)
  } catch (error) {
    console.error('Error al obtener las revistas:', error);
    const status = error.response?.status;
    if (status === 403) {
      Notify.create({ type: 'negative', message: 'Acceso denegado: no tienes permisos para ver servidores.' })
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
    return getPublicAssetUrl('/img/inass_sello_firma.png');
  }
  return getPublicAssetUrl('/img/ministerio_sello_firma.png');
};

// Selección dinámica del frontal del carnet según institución y adscripción (seguridad / comunicaciones).
// Se esperan las siguientes imágenes en `front/public/img`:
// - frontal_carnet.png (frontal por defecto - Ministerio)
// - frontal_carnet_inass1.png (frontal por defecto - INASS)
// - frontal_seguridad_ministerio.png
// - frontal_comunicaciones_ministerio.png
// - frontal_seguridad_inass.png
// - frontal_comunicaciones_inass.png
const getFondoFor_item = (item) => {
  const rawArea = (item?.area || item?.unidad || item?.adscripcion || '').toString();
  const area = rawArea.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const isInass = isINASS_item(item);

  const seguridadKeywords = ['seguridad', 'direccion general de la oficina de seguridad'];
  const comunicacionKeywords = ['comunic', 'gesti', 'comunicacional', 'comunicaciones', 'gestion comunicacional', 'prensa'];

  if (seguridadKeywords.some(k => area.includes(k))) {
    return getPublicAssetUrl(isInass ? '/img/frontal_seguridad_inass.png' : '/img/frontal_seguridad_ministerio.png');
  }
  if (comunicacionKeywords.some(k => area.includes(k))) {
    return getPublicAssetUrl(isInass ? '/img/frontal_comunicaciones_inass.png' : '/img/frontal_comunicaciones_ministerio.png');
  }

  // Default: INASS has its own frontal image, otherwise use the ministry frontal
  return getPublicAssetUrl(isInass ? '/img/frontal_carnet_inass1.png' : '/img/frontal_carnet.png');
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
    const areaUrl = areasURL || `${apiBase.replace(/\/+$/, '')}/auth/areas`
    const institucionUrl = institucionesURL || `${apiBase.replace(/\/+$/, '')}/auth/instituciones`
    const sedeUrl = sedesURL || `${apiBase.replace(/\/+$/, '')}/auth/sedes`
    const cargosUrl = '/auth/servidores_cargos'

    const areasResponse = await axios.get(areaUrl)
    options.value.area = areasResponse.data.map(item => item.area);
    const areasResponseU = await axios.get(areaUrl);
    optionsu.value.area = areasResponseU.data.map(item => ({
      label: item.area,
      value: item.area_id
    }));

    // Obtener instituciones
    const institucionsResponse = await axios.get(institucionUrl);
    options.value.institucion = institucionsResponse.data.map(item => item.institucion);
    const institucionsResponseU = await axios.get(institucionUrl);
    optionsu.value.institucion = institucionsResponseU.data.map(item => ({
      label: item.institucion,
      value: item.id
    }));
    // Obtener sedes
    const sedesResponse = await axios.get(sedeUrl);
    options.value.sede = sedesResponse.data.map(item => item.sede);
    const sedesResponseU = await axios.get(sedeUrl);
    optionsu.value.sede = sedesResponseU.data.map(item => ({
      label: item.sede,
      value: item.id
    }));

    // Obtener cargos
    const cargosResponse = await axios.get(cargosUrl);
    options.value.cargo = cargosResponse.data.map(item => item.cargo);

    const cargosResponseU = await axios.get(cargosUrl);
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
  photoFilter.value = null;
  stateFilter.value = true;
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
    if (photoFilter.value === null) return true;
    const foto = server.foto_url || '';
    const hasPhoto = foto && !foto.includes('no_person.png') && !foto.includes('no_person.jpg');
    return photoFilter.value ? hasPhoto : !hasPhoto;
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

  // Aplicar el filtro por estado del trabajador antes de los filtros de columna
  if (stateFilter.value === true) {
    searchedServers = searchedServers.filter(server => server.trabajador_activo !== false && server.activo !== false);
  } else if (stateFilter.value === false) {
    searchedServers = searchedServers.filter(server => server.trabajador_activo === false || server.activo === false);
  }

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
    // Fecha de ingreso (YYYY-MM-DD expected)
    const fechaIngresoValue = editForm.value.fecha_ingreso instanceof Date
      ? editForm.value.fecha_ingreso.toISOString().slice(0, 10)
      : editForm.value.fecha_ingreso;
    if (fechaIngresoValue !== undefined && fechaIngresoValue !== null) {
      formData.append('fecha_ingreso', fechaIngresoValue);
    }

    if (editForm.value.foto) {
      formData.append('foto', editForm.value.foto);
    }

    // Leer el token del LocalStorage para incluirlo en el header Authorization
    const token = LocalStorage.getItem('token');
    const authHeaders = {
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
        message: `¿Está seguro que desea eliminar el servidor ${servidor.nombres} (C.I. ${servidor.cedula})? Esta acción lo dejará inactivo en la base de datos.`,
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

    // Realizar la solicitud PATCH para borrado lógico con motivo egreso
    loading.value = true;
    const token = LocalStorage.getItem('token');
    await axios.patch(`${deleteServerURL}${servidor.cedula}`, { reason: 'egreso' }, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });

    Notify.create({
      type: 'positive',
      message: 'Servidor marcado como inactivo correctamente'
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
  try {
    const tokenVal = LocalStorage.getItem('token')
    const permsVal = LocalStorage.getItem('permissions') || LocalStorage.getItem('userPermissions') || []
    console.log('MantenedorPage onMounted, token:', !!tokenVal, 'permissions:', permsVal)
    if (!tokenVal) {
      router.push('/login')
      return
    }
    await fetchOptions()
    // Only fetch servers if the user has permission to read servers
    const canRead = hasPermission('read_servidor') || hasPermission('view_admin')
    console.log('MantenedorPage canRead:', canRead)
    if (canRead) {
      await fetchServers()
    } else {
      loading.value = false
    }
  } catch (err) {
    console.error('Error en onMounted de MantenedorPage:', err)
    Notify.create({ type: 'negative', message: 'Error inicializando la vista de Servidores: ' + (err.message || err) })
  } finally {
    loading.value = false
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
