<template>
  <div class="q-pa-md">
      <div class="image-container">
        <img class="responsive-image" src="/img/logo_nobg1.png" alt="Electoral MINAAMP - INASS" />
      </div>

    <h4 class="q-mb-md" style="color:violet;font-weight:bold;">CARGA MASIVA DE SERVIDORES</h4>

    <!-- Input principal para cédulas -->
    <q-input
      v-model="cedulasInput"
      type="textarea"
      autogrow
      filled
      outline
      borderless
      rounded
      dense
      label="Introducir cédulas aquí"
      placeholder="Cédulas separadas por espacios, comas o saltos de línea..."
      class="q-mb-md"
    />

    <!-- Botón de envío -->
    <div class="row justify-end q-mb-md">
      <q-btn
        color="primary"
        label="Procesar cédulas"
        @click="procesarCedulas"
        :loading="loading"
        :disable="!cedulasInput.trim()"
      />
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
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import axios from 'axios';

const $q = useQuasar();

// Estado del componente
const cedulasInput = ref('');
const loading = ref(false);
const resultados = ref(null);
const showDialog = ref(false);
const dialogTitle = ref('');
const dialogMessage = ref('');

// Computed properties para los resultados
const cedulasActualizadas = computed(() => {
  return resultados.value?.actualizadas.cedulas?.join(', ') || '';
});

const cedulasRechazadas = computed(() => {
  return resultados.value?.rechazadas.cedulas?.join(', ') || '';
});

const cedulasPreviamenteCargadas = computed(() => {
  return resultados.value?.previamente_cargadas.cedulas?.join(', ') || '';
});

// Función para procesar las cédulas
const procesarCedulas = async () => {
  try {
    loading.value = true;

    // Limpiar y formatear las cédulas exactamente como espera el backend
    const cedulas = cedulasInput.value
      .split(/[\n,\s]+/)
      .map(c => c.trim().replace(/\D/g, ''))
      .filter(c => c.length > 0)
      .join(' ');

    if (!cedulas) {
      throw new Error('No se detectaron cédulas válidas en el input');
    }
    // Enviar al endpoint con el formato EXACTO que espera el backend
    const response = await axios.post(
      import.meta.env.VITE_MU_SERVER_URL,
      { cedulas: cedulas }, // Enviamos como objeto con propiedad cedulas
      {
        headers: {
          'Content-Type': 'application/json' // Cambiamos a JSON
        }
      }
    );

    // Procesar respuesta
    resultados.value = response.data;

    // Mostrar notificación de éxito
    showDialog.value = true;
    dialogTitle.value = 'Proceso completado';
    dialogMessage.value = response.data.message || 'Las cédulas se procesaron correctamente';

  } catch (error) {
    console.error('Error al procesar cédulas:', error);

    // Mostrar notificación de error
    showDialog.value = true;
    dialogTitle.value = 'Error en el proceso';

    if (error.response) {
      if (error.response.status === 400) {
        dialogMessage.value = error.response.data?.error ||
                           'Formato incorrecto de cédulas. Deben ser números separados por espacios.';
      } else {
        dialogMessage.value = error.response.data?.error ||
                             `Error del servidor: ${error.response.status}`;
      }
    } else {
      dialogMessage.value = error.message ||
                          'Error al conectar con el servidor';
    }
  } finally {
    loading.value = false;
  }
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
