<template>
  <div id="chartToolbar" :style="{
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '5px',
    marginBottom: '15px',
    backgroundColor: showButtons ? '#bdbebe' : 'transparent',
    transition: 'background-color 0.3s'
  }">
    <!-- Botones de tipo de gráfico (ocultos para gráficos de línea) -->
    <template v-if="!isLineChart">
      <q-btn icon="bar_chart" round color="primary" class="boton" size="sm" @click="emit('change-chart-type', 'column')">
        <q-tooltip>Gráfico de columnas verticales</q-tooltip>
      </q-btn>

      <q-btn round color="primary" class="boton" size="sm" @click="emit('change-chart-type', 'bar')">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20">
          <rect x="2" y="5" width="18" height="3" fill="currentColor" />
          <rect x="2" y="10" width="14" height="3" fill="currentColor" />
          <rect x="2" y="15" width="10" height="3" fill="currentColor" />
        </svg>
        <q-tooltip>Gráfico de barras horizontales</q-tooltip>
      </q-btn>

      <q-btn icon="pie_chart" round color="primary" class="boton" size="sm" @click="emit('change-chart-type', 'pie')">
        <q-tooltip>Gráfico de torta</q-tooltip>
      </q-btn>

      <q-btn icon="donut_large" round color="primary" class="boton" size="sm"
        @click="emit('change-chart-type', 'doughnut')">
        <q-tooltip>Gráfico de anillo</q-tooltip>
      </q-btn>
    </template>

    <!-- Botón de tabla/gráfico (cambia ícono según el estado) -->
    <q-btn
      :icon="isTableVisible ? (isLineChart ? 'show_chart' : 'table_view') : 'table_view'"
      round
      color="primary"
      class="boton"
      size="sm"
      @click="toggleTable"
    >
      <q-tooltip>{{ isTableVisible ? 'Mostrar gráfico' : 'Mostrar tabla de datos' }}</q-tooltip>
    </q-btn>

    <!-- Botones de exportación -->
    <q-btn icon="file_download" round color="primary" class="boton" size="sm" @click="emit('export-excel')">
      <q-tooltip>Exportar a Excel</q-tooltip>
    </q-btn>

    <q-btn icon="photo" round color="primary" class="boton" size="sm" @click="emit('export-png')">
      <q-tooltip>Exportar a PNG</q-tooltip>
    </q-btn>

    <q-btn icon="picture_as_pdf" round color="primary" class="boton" size="sm" @click="emit('export-pdf')">
      <q-tooltip>Exportar a PDF</q-tooltip>
    </q-btn>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  isLineChart: {
    type: Boolean,
    default: false
  },
  isTableVisible: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'change-chart-type',
  'toggle-table',
  'export-excel',
  'export-png',
  'export-pdf',
]);

const showButtons = ref(false);

const toggleButtonsVisibility = () => {
  showButtons.value = !showButtons.value;
};

const toggleTable = () => {
  emit('toggle-table');
};

const applyPadding = () => {
  const qBtns = document.querySelectorAll('.q-btn');
  const isSmallScreen = window.innerWidth < 767;

  qBtns.forEach(btn => {
    if (isSmallScreen) {
      btn.style.setProperty('padding', '4px 4px', 'important');
    } else {
      btn.style.setProperty('padding', '8px 10px', 'important');
    }
  });
};

onMounted(() => {
  applyPadding();
  const observer = new MutationObserver(applyPadding);
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  const handleResize = () => {
    applyPadding();
  };

  window.addEventListener('resize', handleResize);

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    observer.disconnect();
  });
});
</script>
