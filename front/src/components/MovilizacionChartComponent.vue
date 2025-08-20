<template>
  <div class="col-12 q-pa-md">
    <!-- Gráfico Adultos Mayores por Hora -->
    <div class="q-mb-md">
      <ChartToolbar title="Adultos Mayores" :is-line-chart="true" :is-table-visible="isTableVisible1"
        @export-excel="() => exportToExcel(1)" @export-png="() => exportToPng(1)" @export-pdf="() => exportToPdf(1)"
        @toggle-table="() => toggleTable(1)" />
      <div v-if="!isTableVisible1">
        <div ref="chartContainer1"
          style="width: 100%; background-color: white; padding: 20px; border-radius: 10px; position: relative;">
          <div style="width: 100%; height: 400px; position: relative">
            <canvas ref="chartCanvas1" style="width: 100%; height: 100%"></canvas>
          </div>
        </div>
      </div>
      <div v-else>
        <q-card>
          <q-table title="Adultos Mayores por Estado y Hora"
            :rows="chartDataAE.filter(row => visibleStatesAE.length === 0 ? false : visibleStatesAE.includes(row.estado_nombre))"
            :columns="tableColumnsAE" row-key="estado_nombre" :pagination="{ rowsPerPage: 10 }" />
        </q-card>
      </div>
    </div>
    <div class="q-mb-sm">
      <q-btn icon="visibility" color="primary" dense @click="setAllStatesVisible" class="q-mr-sm"
        title="Mostrar todos los estados" />
      <q-btn icon="visibility_off" color="secondary" dense @click="setNoStatesVisible"
        title="Ocultar todos los estados" />
    </div>
    <!-- Gráfico Adultos Mayores por Estado y Hora -->
    <div class="q-mb-md">
      <ChartToolbar title="Adultos Mayores por Estado y Hora" :is-line-chart="true" :is-table-visible="isTableVisibleAE"
        @export-excel="exportToExcelAE" @export-png="exportToPngAE" @export-pdf="exportToPdfAE"
        @toggle-table="toggleTableAE" />
      <div v-if="!isTableVisibleAE">
        <div ref="chartContainerAE"
          style="width: 100%; background-color: white; padding: 20px; border-radius: 10px; position: relative;">
          <div style="width: 100%; height: 400px; position: relative">
            <canvas ref="chartCanvasAE" style="width: 100%; height: 100%"></canvas>
          </div>
        </div>
      </div>
      <div v-else>
        <q-card>
          <q-table title="Adultos Mayores por Estado y Hora"
            :rows="chartDataAE.filter(row => visibleStatesAE.length === 0 ? false : visibleStatesAE.includes(row.estado_nombre))"
            :columns="tableColumnsAE" row-key="estado_nombre" :pagination="{ rowsPerPage: 10 }" />
        </q-card>
      </div>
    </div>
    <!-- Gráfico Servidores Públicos por Hora -->
    <div class="q-mb-md">
      <ChartToolbar title="Servidores Públicos" :is-line-chart="true" :is-table-visible="isTableVisible2"
        @export-excel="() => exportToExcel(2)" @export-png="() => exportToPng(2)" @export-pdf="() => exportToPdf(2)"
        @toggle-table="() => toggleTable(2)" />
      <div v-if="!isTableVisible2">
        <div ref="chartContainer2"
          style="width: 100%; background-color: white; padding: 20px; border-radius: 10px; position: relative;">
          <div style="width: 100%; height: 400px; position: relative">
            <canvas ref="chartCanvas2" style="width: 100%; height: 100%"></canvas>
          </div>
        </div>
      </div>
      <div v-else>
        <q-card>
          <q-table title="Datos Servidores Públicos" :rows="chartData2" :columns="tableColumnsHours"
            row-key="franja_horaria" :pagination="{ rowsPerPage: 10 }" />
        </q-card>
      </div>
    </div>

    <!-- /////////////////// -->
    <!-- Gráfico Servidores P+ublicos por Estado y Hora -->
    <div class="q-mb-md">
      <div class="q-mb-sm">
        <q-btn icon="visibility" color="primary" dense
          @click="() => { visibleStatesSE = chartDataSE.map(e => e.estado_nombre); updateChartVisibilitySE(); }"
          class="q-mr-sm" title="Mostrar todos los estados" />
        <q-btn icon="visibility_off" color="secondary" dense
          @click="() => { visibleStatesSE = []; updateChartVisibilitySE(); }" title="Ocultar todos los estados" />
      </div>
      <ChartToolbar title="Servidores Públicos por Estado y Hora" :is-line-chart="true"
        :is-table-visible="isTableVisibleSE" @export-excel="exportToExcelSE" @export-png="exportToPngSE"
        @export-pdf="exportToPdfSE" @toggle-table="toggleTableSE" />
      <div v-if="!isTableVisibleSE">
        <div ref="chartContainerSE"
          style="width: 100%; background-color: white; padding: 20px; border-radius: 10px; position: relative;">
          <div style="width: 100%; height: 400px; position: relative">
            <canvas ref="chartCanvasSE" style="width: 100%; height: 100%"></canvas>
          </div>
        </div>
      </div>
      <div v-else>
        <q-card>
          <q-table title="Servidores Públicos por Estado y Hora"
            :rows="chartDataSE.filter(row => visibleStatesSE.length === 0 ? false : visibleStatesSE.includes(row.estado_nombre))"
            :columns="tableColumnsSE" row-key="estado_nombre" :pagination="{ rowsPerPage: 10 }" />
        </q-card>
      </div>
    </div>
    <!-- /////////////////// -->
    <!-- Gráfico de Columnas por Estado - Adultos Mayores -->
    <div class="q-mb-md">
      <ChartToolbar title="Adultos Mayores por Estado" :is-line-chart="false" :is-table-visible="isTableVisible3"
        @change-chart-type="(type) => changeChartType(type, 3)" @export-excel="() => exportToExcel(3)"
        @export-png="() => exportToPng(3)" @export-pdf="() => exportToPdf(3)" @toggle-table="() => toggleTable(3)" />
      <div v-if="!isTableVisible3">
        <div ref="chartContainer3"
          style="width: 100%; background-color: white; padding: 20px; border-radius: 10px; position: relative;">
          <div style="width: 100%; height: 500px; position: relative">
            <canvas ref="chartCanvas3" style="width: 100%; height: 100%"></canvas>
          </div>
        </div>
      </div>
      <div v-else>
        <q-card>
          <q-table title="Datos Adultos Mayores por Estado" :rows="chartData3" :columns="tableColumnsStates"
            row-key="estado" :pagination="{ rowsPerPage: 10 }" />
        </q-card>
      </div>
    </div>

    <!-- Nuevo Gráfico de Columnas por Estado - Servidores Públicos -->
    <div>
      <ChartToolbar title="Servidores Públicos por Estado" :is-line-chart="false" :is-table-visible="isTableVisible4"
        @change-chart-type="(type) => changeChartType(type, 4)" @export-excel="() => exportToExcel(4)"
        @export-png="() => exportToPng(4)" @export-pdf="() => exportToPdf(4)" @toggle-table="() => toggleTable(4)" />
      <div v-if="!isTableVisible4">
        <div ref="chartContainer4"
          style="width: 100%; background-color: white; padding: 20px; border-radius: 10px; position: relative;">
          <div style="width: 100%; height: 500px; position: relative">
            <canvas ref="chartCanvas4" style="width: 100%; height: 100%"></canvas>
          </div>
        </div>
      </div>
      <div v-else>
        <q-card>
          <q-table title="Datos Servidores Públicos por Estado" :rows="chartData4"
            :columns="tableColumnsStatesServidores" row-key="estado" :pagination="{ rowsPerPage: 10 }" />
        </q-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import axios from "axios";

import { Chart, registerables } from 'chart.js';
import "chartjs-plugin-datalabels";
import ChartDataLabels from 'chartjs-plugin-datalabels';
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from 'xlsx';
import { useQuasar } from 'quasar';
import ChartToolbar from "src/components/ChartToolbar.vue";
import socket from "src/services/websocket.js";

const $q = useQuasar();
Chart.register(...registerables);

// Props
const props = defineProps({
  tableColumnsHours: {
    type: Array,
    default: () => [
      {
        name: 'franja_horaria',
        required: true,
        label: 'Franja Horaria',
        align: 'left',
        field: 'franja_horaria',
        sortable: true
      },
      {
        name: 'cantidad',
        label: 'Cantidad',
        align: 'center',
        field: 'cantidad',
        sortable: true
      },
      {
        name: 'acumulado',
        label: 'Acumulado',
        align: 'center',
        field: 'acumulado',
        sortable: true
      }
    ]
  },
  tableColumnsStates: {
    type: Array,
    default: () => [
      {
        name: 'estado',
        required: true,
        label: 'Estado',
        align: 'left',
        field: 'estado',
        sortable: true
      },
      {
        name: 'cant_estado',
        label: 'Movilizados',
        align: 'center',
        field: 'cant_estado',
        sortable: true
      },
      {
        name: 'porcentaje_cantidad_personas',
        label: '% Movilizados',
        align: 'center',
        field: row => `${parseFloat(row.porcentaje_cantidad_personas).toFixed(2)}%`,
        sortable: true
      },
      {
        name: 'porcentaje_por_movilizar',
        label: '% Por Movilizar',
        align: 'center',
        // field: 'por_movilizar',
        field: row => `${parseFloat(row.porcentaje_por_movilizar).toFixed(2)}%`,
        sortable: true
      },
      {
        name: 'adultos_meta',
        label: 'Meta Total',
        align: 'center',
        field: 'adultos_meta',
        sortable: true
      }
    ]
  }
});

// Variables reactivas
const chartData1 = ref([]); // Adultos mayores por hora
const chartData2 = ref([]); // Servidores públicos por hora
const chartData3 = ref([]); // Adultos mayores por estado
const chartData4 = ref([]); // Servidores públicos por estado
const chartCanvas1 = ref(null);
const chartCanvas2 = ref(null);
const chartCanvas3 = ref(null);
const chartCanvas4 = ref(null);
const chartContainer1 = ref(null);
const chartContainer2 = ref(null);
const chartContainer3 = ref(null);
const chartContainer4 = ref(null);
let chartInstance1 = null;
let chartInstance2 = null;
let chartInstance3 = null;
let chartInstance4 = null;
let xAxis3 = 'x';
let xAxis4 = 'x';
const currentChartType1 = ref("line");
const currentChartType2 = ref("line");
const currentChartType3 = ref("bar"); // Tipo bar por defecto
const currentChartType4 = ref("bar"); // Tipo bar por defecto
const isTableVisible1 = ref(false);
const isTableVisible2 = ref(false);
const isTableVisible3 = ref(false);
const isTableVisible4 = ref(false);
const chartDataAE = ref([]); // Data para el nuevo gráfico
const chartCanvasAE = ref(null);
let chartInstanceAE = null;
const isTableVisibleAE = ref(false);
const visibleStatesAE = ref([]);

const chartDataSE = ref([]); // Data para el nuevo gráfico
const chartCanvasSE = ref(null);
let chartInstanceSE = null;
const isTableVisibleSE = ref(false);
const visibleStatesSE = ref([]);


// Columnas para la tabla de Servidores Públicos por Estado
const tableColumnsStatesServidores = ref([
  {
    name: 'estado',
    required: true,
    label: 'Estado',
    align: 'left',
    field: 'estado',
    sortable: true
  },
  {
    name: 'votaron',
    label: 'Votaron',
    align: 'center',
    field: 'votaron',
    sortable: true
  },
  {
    name: 'no_votaron',
    label: 'No Votaron',
    align: 'center',
    field: 'no_votaron',
    sortable: true
  },
  {
    name: 'total',
    label: 'Total',
    align: 'center',
    field: 'total',
    sortable: true
  }
]);

// Función para generar el timestamp
const generateTimestamp = () => {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
};

// Formatear fecha y hora
const formatDateTime = () => {
  return new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
};

// Configuración común para gráficos de línea
const getLineChartOptions = (title) => {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: `${title}\n${formatDateTime()}`,
        font: {
          size: 16
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false
      },
      legend: {
        position: 'top'
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Franja Horaria'
        },
        grid: {
          display: false
        }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Cantidad por hora'
        },
        min: 0
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Acumulado'
        },
        min: 0,
        grid: {
          drawOnChartArea: false
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };
};

// Configuración para gráfico de columnas por estado
const getColumnChartOptions = (title) => {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: `${title}\n${formatDateTime()}`,
        font: {
          size: 16
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false
      },
      legend: {
        display: false
      },
      datalabels: {
        display: false
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Estados'
        },
        grid: {
          display: false
        }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Cantidad'
        },
        min: 0
      }
    },
    indexAxis: 'x', // Para gráfico de columnas verticales
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };
};

// Renderizar gráfica Adultos Mayores por hora
const renderChart1 = () => {
  if (!chartCanvas1.value) return;

  if (chartInstance1) {
    chartInstance1.destroy();
  }

  const ctx = chartCanvas1.value.getContext("2d");

  chartInstance1 = new Chart(ctx, {
    type: currentChartType1.value,
    data: {
      labels: chartData1.value.map(item => item.franja_horaria),
      datasets: [
        {
          label: 'Cantidad por hora',
          data: chartData1.value.map(item => parseInt(item.cantidad)),
          borderColor: '#273984',
          backgroundColor: 'rgba(39, 57, 132, 0.1)',
          borderWidth: 3,
          tension: 0.3,
          fill: true,
          yAxisID: 'y'
        },
        {
          label: 'Acumulado',
          data: chartData1.value.map(item => parseInt(item.acumulado)),
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.1,
          fill: false,
          yAxisID: 'y1'
        }
      ]
    },
    options: getLineChartOptions("Movilización de Adultos Mayores por Hora")
  });
};

// Renderizar gráfica Servidores Públicos por hora
const renderChart2 = () => {
  if (!chartCanvas2.value) return;

  if (chartInstance2) {
    chartInstance2.destroy();
  }

  const ctx = chartCanvas2.value.getContext("2d");

  chartInstance2 = new Chart(ctx, {
    type: currentChartType2.value,
    data: {
      labels: chartData2.value.map(item => item.franja_horaria),
      datasets: [
        {
          label: 'Cantidad por hora',
          data: chartData2.value.map(item => parseInt(item.cantidad)),
          borderColor: '#8E44AD',
          backgroundColor: 'rgba(142, 68, 173, 0.1)',
          borderWidth: 3,
          tension: 0.3,
          fill: true,
          yAxisID: 'y'
        },
        {
          label: 'Acumulado',
          data: chartData2.value.map(item => parseInt(item.acumulado)),
          borderColor: '#E74C3C',
          backgroundColor: 'rgba(231, 76, 60, 0.1)',
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.1,
          fill: false,
          yAxisID: 'y1'
        }
      ]
    },
    options: getLineChartOptions("Movilización de Servidores Públicos por Hora")
  });
};
///////////////

// Columnas para la tabla
const tableColumnsAE = [
  { name: 'estado_nombre', label: 'Estado', field: 'estado_nombre', align: 'left' },
  ...Array.from({ length: 24 }, (_, i) => ({
    name: String(i).padStart(2, '0'),
    label: String(i).padStart(2, '0'),
    field: String(i).padStart(2, '0'),
    align: 'center'
  }))
];
const setAllStatesVisible = () => {
  visibleStatesAE.value = chartDataAE.value.map(e => e.estado_nombre);
  updateChartVisibilityAE();
};
const setNoStatesVisible = () => {
  visibleStatesAE.value = [];
  updateChartVisibilityAE();
};

// Actualiza la visibilidad de las líneas en el gráfico
const updateChartVisibilityAE = () => {
  if (!chartInstanceAE) return;
  chartInstanceAE.data.datasets.forEach(ds => {
    ds.hidden = !visibleStatesAE.value.includes(ds.label);
  });
  chartInstanceAE.update();
};

// Obtener datos del endpoint y preparar para gráfico
const fetchChartDataAE = async () => {
  try {
    const response = await axios.get(import.meta.env.VITE_GR_HORASAE_URL);
    chartDataAE.value = response.data;
    visibleStatesAE.value = chartDataAE.value.map(e => e.estado_nombre); // Mostrar todos por defecto
    renderChartAE();
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Error al cargar los datos de Adultos Mayores por Estado y Hora',
      position: 'top'
    });
  }
};

// Renderizar el gráfico
const renderChartAE = () => {
  if (!chartCanvasAE.value) return;
  if (chartInstanceAE) chartInstanceAE.destroy();

  const ctx = chartCanvasAE.value.getContext("2d");
  const labels = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const datasets = chartDataAE.value.map((estado, idx) => ({
    label: estado.estado_nombre,
    data: labels.map(hora => estado[hora] || 0),
    borderColor: `hsl(${(idx * 360) / chartDataAE.value.length}, 70%, 50%)`,
    backgroundColor: `hsla(${(idx * 360) / chartDataAE.value.length}, 70%, 50%, 0.2)`,
    fill: false,
    tension: 0.3,
    hidden: visibleStatesAE.value.length === 0 ? true : !visibleStatesAE.value.includes(estado.estado_nombre)
  }));

  chartInstanceAE = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Adultos Mayores por Estado y Hora'
        },
        legend: {
          display: true,
          position: 'bottom',
          onClick: (e, legendItem, legend) => {
            // Alternar visibilidad al hacer click en la leyenda
            const state = legendItem.text;
            if (visibleStatesAE.value.includes(state)) {
              visibleStatesAE.value = visibleStatesAE.value.filter(s => s !== state);
            } else {
              visibleStatesAE.value.push(state);
            }
            updateChartVisibilityAE();
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Hora' }
        },
        y: {
          title: { display: true, text: 'Cantidad' },
          beginAtZero: true
        }
      }
    }
  });
};

// Toggle tabla
const toggleTableAE = () => {
  isTableVisibleAE.value = !isTableVisibleAE.value;
  if (!isTableVisibleAE.value) nextTick(() => renderChartAE());
};

// Exportar a Excel
const exportToExcelAE = () => {
  try {
    // Orden deseado de las columnas
    const orderedKeys = [
      "estado_nombre",
      ...Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
    ];

    // Filtrar los estados visibles
    const filteredRows = chartDataAE.value.filter(row =>
      visibleStatesAE.value.length === 0 ? false : visibleStatesAE.value.includes(row.estado_nombre)
    );

    // Reordenar las claves de cada objeto
    const orderedRows = filteredRows.map(row => {
      const newRow = {};
      orderedKeys.forEach(key => {
        newRow[key] = row[key] ?? 0;
      });
      return newRow;
    });

    // Crear encabezado personalizado
    const now = new Date();
    const fecha = now.toLocaleDateString('es-VE');
    const hora = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    const encabezado = [
      [`MINAAMP - Movilización de Adultos Mayores por Estado y Hora al ${fecha} ${hora}`],
      // Fila vacía
    ];

    // Crear hoja de datos
    const ws = XLSX.utils.json_to_sheet(orderedRows, { header: orderedKeys });

    // Insertar encabezado al principio
    XLSX.utils.sheet_add_aoa(ws, encabezado, { origin: 'A1' });

    // Ajustar el inicio de los datos para que los encabezados de columna estén en la fila correcta
    XLSX.utils.sheet_add_aoa(ws, [orderedKeys], { origin: `A${encabezado.length + 1}` });

    // Mover los datos una fila hacia abajo para dejar espacio al encabezado y las columnas
    XLSX.utils.sheet_add_json(ws, orderedRows, { header: orderedKeys, origin: `A${encabezado.length + 2}`, skipHeader: true });

    // Unir celdas del encabezado
    ws['!merges'] = ws['!merges'] || [];
    ws['!merges'].push({
      s: { r: 0, c: 0 },
      e: { r: 0, c: orderedKeys.length - 1 }
    });

    // Crear libro y exportar
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    XLSX.writeFile(wb, `${generateTimestamp()}_adultos_mayores_estado_hora.xlsx`);
    $q.notify({ type: 'positive', message: 'Exportación a Excel exitosa', position: 'top' });
  } catch (error) {
    $q.notify({ type: 'negative', message: 'Error al exportar a Excel', position: 'top' });
  }
};

// Exportar a PNG
const exportToPngAE = () => {
  if (!chartCanvasAE.value || isTableVisibleAE.value) {
    $q.notify({ type: 'negative', message: 'No se puede exportar la tabla a PNG', position: 'top' });
    return;
  }
  html2canvas(chartCanvasAE.value).then((canvas) => {
    const imgData = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `${generateTimestamp()}_adultos_mayores_estado_hora.png`;
    link.href = imgData;
    link.click();
    $q.notify({ type: 'positive', message: 'Exportación a PNG exitosa', position: 'top' });
  });
};

// Exportar a PDF
const exportToPdfAE = () => {
  if (!chartCanvasAE.value || isTableVisibleAE.value) {
    $q.notify({ type: 'negative', message: 'No se puede exportar la tabla a PDF', position: 'top' });
    return;
  }
  html2canvas(chartCanvasAE.value).then((canvas) => {
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF('landscape');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth() - 20;
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, "PNG", 10, 10, pdfWidth, pdfHeight);
    pdf.save(`${generateTimestamp()}_adultos_mayores_estado_hora.pdf`);
    $q.notify({ type: 'positive', message: 'Exportación a PDF exitosa', position: 'top' });
  });
};

//////////Movilización Servidores por Estado y Hora ////////////////
// Columnas para la tabla
const tableColumnsSE = [
  { name: 'estado_nombre', label: 'Estado', field: 'estado_nombre', align: 'left' },
  ...Array.from({ length: 24 }, (_, i) => ({
    name: String(i).padStart(2, '0'),
    label: String(i).padStart(2, '0'),
    field: String(i).padStart(2, '0'),
    align: 'center'
  }))
];
// const setAllStatesVisible = () => {
//   visibleStatesAE.value = chartDataAE.value.map(e => e.estado_nombre);
//   updateChartVisibilityAE();
// };
// const setNoStatesVisible = () => {
//   visibleStatesAE.value = [];
//   updateChartVisibilityAE();
// };

// Actualiza la visibilidad de las líneas en el gráfico
const updateChartVisibilitySE = () => {
  if (!chartInstanceSE) return;
  chartInstanceSE.data.datasets.forEach(ds => {
    ds.hidden = !visibleStatesSE.value.includes(ds.label);
  });
  chartInstanceSE.update();
};

// Obtener datos del endpoint y preparar para gráfico
const fetchChartDataSE = async () => {
  try {
    const response = await axios.get(import.meta.env.VITE_GR_HORASSE_URL);
    chartDataSE.value = response.data;
    visibleStatesSE.value = chartDataSE.value.map(e => e.estado_nombre); // Mostrar todos por defecto
    renderChartSE();
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Error al cargar los datos de Adultos Mayores por Estado y Hora',
      position: 'top'
    });
  }
};

// Renderizar el gráfico
const renderChartSE = () => {
  if (!chartCanvasSE.value) return;
  if (chartInstanceSE) chartInstanceSE.destroy();

  const ctx = chartCanvasSE.value.getContext("2d");
  const labels = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const datasets = chartDataSE.value.map((estado, idx) => ({
    label: estado.estado_nombre,
    data: labels.map(hora => estado[hora] || 0),
    borderColor: `hsl(${(idx * 360) / chartDataSE.value.length}, 70%, 50%)`,
    backgroundColor: `hsla(${(idx * 360) / chartDataSE.value.length}, 70%, 50%, 0.2)`,
    fill: false,
    tension: 0.3,
    hidden: visibleStatesSE.value.length === 0 ? true : !visibleStatesSE.value.includes(estado.estado_nombre)
  }));

  chartInstanceSE = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Servidores Públicos por Estado y Hora'
        },
        legend: {
          display: true,
          position: 'bottom',
          onClick: (e, legendItem, legend) => {
            // Alternar visibilidad al hacer click en la leyenda
            const state = legendItem.text;
            if (visibleStatesSE.value.includes(state)) {
              visibleStatesSE.value = visibleStatesSE.value.filter(s => s !== state);
            } else {
              visibleStatesSE.value.push(state);
            }
            updateChartVisibilitySE();
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Hora' }
        },
        y: {
          title: { display: true, text: 'Cantidad' },
          beginAtZero: true
        }
      }
    }
  });
};

// Toggle tabla
const toggleTableSE = () => {
  isTableVisibleSE.value = !isTableVisibleSE.value;
  if (!isTableVisibleSE.value) nextTick(() => renderChartSE());
};

// Exportar a Excel
const exportToExcelSE = () => {
  try {
    // Orden deseado de las columnas
    const orderedKeys = [
      "estado_nombre",
      ...Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
    ];

    // Filtrar los estados visibles
    const filteredRows = chartDataSE.value.filter(row =>
      visibleStatesSE.value.length === 0 ? false : visibleStatesSE.value.includes(row.estado_nombre)
    );

    // Reordenar las claves de cada objeto
    const orderedRows = filteredRows.map(row => {
      const newRow = {};
      orderedKeys.forEach(key => {
        newRow[key] = row[key] ?? 0;
      });
      return newRow;
    });

    // Crear encabezado personalizado
    const now = new Date();
    const fecha = now.toLocaleDateString('es-VE');
    const hora = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    const encabezado = [
      [`MINAAMP - Movilización de Servidores Públicos por Estado y Hora al ${fecha} ${hora}`],
      // Fila vacía
    ];

    // Crear hoja de datos
    const ws = XLSX.utils.json_to_sheet(orderedRows, { header: orderedKeys });

    // Insertar encabezado al principio
    XLSX.utils.sheet_add_aoa(ws, encabezado, { origin: 'A1' });

    // Ajustar el inicio de los datos para que los encabezados de columna estén en la fila correcta
    XLSX.utils.sheet_add_aoa(ws, [orderedKeys], { origin: `A${encabezado.length + 1}` });

    // Mover los datos una fila hacia abajo para dejar espacio al encabezado y las columnas
    XLSX.utils.sheet_add_json(ws, orderedRows, { header: orderedKeys, origin: `A${encabezado.length + 2}`, skipHeader: true });

    // Unir celdas del encabezado
    ws['!merges'] = ws['!merges'] || [];
    ws['!merges'].push({
      s: { r: 0, c: 0 },
      e: { r: 0, c: orderedKeys.length - 1 }
    });

    // Crear libro y exportar
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    XLSX.writeFile(wb, `${generateTimestamp()}_adultos_mayores_estado_hora.xlsx`);
    $q.notify({ type: 'positive', message: 'Exportación a Excel exitosa', position: 'top' });
  } catch (error) {
    $q.notify({ type: 'negative', message: 'Error al exportar a Excel', position: 'top' });
  }
};

// Exportar a PNG
const exportToPngSE = () => {
  if (!chartCanvasSE.value || isTableVisibleSE.value) {
    $q.notify({ type: 'negative', message: 'No se puede exportar la tabla a PNG', position: 'top' });
    return;
  }
  html2canvas(chartCanvasSE.value).then((canvas) => {
    const imgData = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `${generateTimestamp()}_adultos_mayores_estado_hora.png`;
    link.href = imgData;
    link.click();
    $q.notify({ type: 'positive', message: 'Exportación a PNG exitosa', position: 'top' });
  });
};

// Exportar a PDF
const exportToPdfSE = () => {
  if (!chartCanvasSE.value || isTableVisibleSE.value) {
    $q.notify({ type: 'negative', message: 'No se puede exportar la tabla a PDF', position: 'top' });
    return;
  }
  html2canvas(chartCanvasSE.value).then((canvas) => {
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF('landscape');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth() - 20;
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, "PNG", 10, 10, pdfWidth, pdfHeight);
    pdf.save(`${generateTimestamp()}_adultos_mayores_estado_hora.pdf`);
    $q.notify({ type: 'positive', message: 'Exportación a PDF exitosa', position: 'top' });
  });
};

//////////Movilización Servidores por Estado y Hora ////////////////


///////////////
// Renderizar gráfica Adultos Mayores por estado

const renderChart3 = () => {
  if (!chartCanvas3.value) return;

  if (chartInstance3) {
    chartInstance3.destroy();
  }

  const ctx = chartCanvas3.value.getContext("2d");

  // Ordenar datos por porcentaje movilizado (de mayor a menor)
  const sortedData = [...chartData3.value].sort((a, b) =>
    parseFloat(b.porcentaje_cantidad_personas) - parseFloat(a.porcentaje_cantidad_personas)
  );

  const labels = sortedData.map(item => item.estado);
  const porcentajeMovilizados = sortedData.map(item =>
    parseFloat(item.porcentaje_cantidad_personas)
  );
  const porcentajePorMovilizar = sortedData.map(item =>
    parseFloat(item.porcentaje_por_movilizar)
  );
  const valoresAbsolutosMovilizados = sortedData.map(item => item.cant_estado);
  const valoresAbsolutosPorMovilizar = sortedData.map(item => item.por_movilizar);

  // Determinar si es gráfico de barras horizontales
  const isHorizontalBar = currentChartType3.value === 'bar' && xAxis3 === 'y';

  chartInstance3 = new Chart(ctx, {
    type: currentChartType3.value === 'bar' ? 'bar' : currentChartType3.value,
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Movilizados',
          data: porcentajeMovilizados,
          backgroundColor: 'rgba(39, 57, 132, 0.7)', // Azul oscuro
          borderColor: 'rgba(39, 57, 132, 1)',
          borderWidth: 1,
          order: 1
        },
        {
          label: 'Por Movilizar',
          data: porcentajePorMovilizar,
          backgroundColor: 'rgba(160, 177, 250, 0.7)', // Azul claro
          borderColor: 'rgba(160, 177, 250, 1)',
          borderWidth: 1,
          order: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: xAxis3,
      plugins: {
        title: {
          display: true,
          text: `Porcentaje de Movilización de Adultos Mayores por Estado\n${formatDateTime()}`,
          font: {
            size: 16
          }
        },
        legend: {
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              return `${context.dataset.label}: ${context.raw}%`;
            },
            afterBody: (context) => {
              const dataIndex = context[0].dataIndex;
              const item = sortedData[dataIndex];
              return [
                `Movilizados: ${item.cant_estado}`,
                `Por movilizar: ${item.por_movilizar}`,
                `Meta total: ${item.adultos_meta}`
              ];
            }
          }
        },
        datalabels: {
          display: true,
          color: '#000',
          anchor: 'center',
          align: 'center',
          formatter: (value, context) => {
            // Mostrar valores absolutos según el dataset
            if (context.datasetIndex === 0) {
              return valoresAbsolutosMovilizados[context.dataIndex];
            } else {
              return valoresAbsolutosPorMovilizar[context.dataIndex];
            }
          },
          font: {
            weight: 'bold'
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          title: {
            display: true,
            text: isHorizontalBar ? 'Porcentaje' : 'Estados'
          },
          grid: {
            display: false
          },
          max: 100,
          beginAtZero: true
        },
        y: {
          stacked: true,
          title: {
            display: true,
            text: isHorizontalBar ? 'Estados' : 'Porcentaje'
          },
          grid: {
            display: !isHorizontalBar
          },
          max: 100,
          beginAtZero: true
        }
      }
    },
    plugins: [ChartDataLabels] // Asegúrate de tener este plugin importado
  });
};
// Renderizar gráfica Servidores Públicos por estado
const renderChart4 = () => {
  if (!chartCanvas4.value) return;

  if (chartInstance4) {
    chartInstance4.destroy();
  }

  const ctx = chartCanvas4.value.getContext("2d");

  // Ordenar datos por porcentaje de votaron (de mayor a menor)
  const sortedData = [...chartData4.value].sort((a, b) =>
    parseFloat(b.porcentaje_votaron) - parseFloat(a.porcentaje_votaron)
  );

  const labels = sortedData.map(item => item.estado);

  // Usamos los porcentajes directamente del endpoint
  const porcentajeVotaron = sortedData.map(item =>
    parseFloat(item.porcentaje_votaron)
  );
  const porcentajeNoVotaron = sortedData.map(item =>
    parseFloat(item.porcentaje_no_votaron)
  );

  // Valores absolutos para las etiquetas
  const valoresVotaron = sortedData.map(item => item.votaron);
  const valoresNoVotaron = sortedData.map(item => item.no_votaron);
  const valoresTotales = sortedData.map(item => item.total);

  // Determinar si es gráfico de barras horizontales
  const isHorizontalBar = currentChartType4.value === 'bar' && xAxis4 === 'y';

  chartInstance4 = new Chart(ctx, {
    type: currentChartType4.value === 'bar' ? 'bar' : currentChartType4.value,
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Votaron',
          data: porcentajeVotaron,
          backgroundColor: 'rgba(142, 68, 173, 0.7)', // Violeta oscuro
          borderColor: 'rgba(142, 68, 173, 1)',
          borderWidth: 1,
          order: 1
        },
        {
          label: 'No Votaron',
          data: porcentajeNoVotaron,
          backgroundColor: 'rgba(210, 180, 222, 0.7)', // Violeta claro
          borderColor: 'rgba(210, 180, 222, 1)',
          borderWidth: 1,
          order: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: xAxis4,
      plugins: {
        title: {
          display: true,
          text: `Participación de Servidores Públicos por Estado\n${formatDateTime()}`,
          font: {
            size: 16
          }
        },
        legend: {
          position: 'top',
          labels: {
            color: '#333',
            font: {
              weight: 'bold'
            }
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              return `${context.dataset.label}: ${context.raw.toFixed(2)}%`;
            },
            afterBody: (context) => {
              const dataIndex = context[0].dataIndex;
              const item = sortedData[dataIndex];
              return [
                `Votaron: ${parseInt(item.votaron).toLocaleString('es-ES')}`,
                `No votaron: ${parseInt(item.no_votaron).toLocaleString('es-ES')}`,
                `Total: ${parseInt(item.total).toLocaleString('es-ES')}`
              ];
            }
          }
        },
        datalabels: {
          display: true,
          color: '#000',
          anchor: 'center',
          align: 'center',
          formatter: (value, context) => {
            // Ocultar etiquetas en barras muy pequeñas
            if (value < 5) return '';

            // Mostrar valores absolutos según el dataset
            if (context.datasetIndex === 0) {
              return parseInt(valoresVotaron[context.dataIndex]).toLocaleString('es-ES');
            } else {
              return parseInt(valoresNoVotaron[context.dataIndex]).toLocaleString('es-ES');
            }
          },
          font: {
            weight: 'bold',
            size: 10
          },
          padding: {
            top: 0,
            bottom: 0
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          title: {
            display: true,
            text: isHorizontalBar ? 'Porcentaje' : 'Estados',
            color: '#333',
            font: {
              weight: 'bold'
            }
          },
          grid: {
            display: false
          },
          max: 100,
          beginAtZero: true,
          ticks: {
            color: '#333'
          }
        },
        y: {
          stacked: true,
          title: {
            display: true,
            text: isHorizontalBar ? 'Estados' : 'Porcentaje',
            color: '#333',
            font: {
              weight: 'bold'
            }
          },
          grid: {
            display: !isHorizontalBar,
            color: 'rgba(0, 0, 0, 0.05)'
          },
          max: 100,
          beginAtZero: true,
          ticks: {
            color: '#333',
            callback: function (value) {
              return value + '%';
            }
          }
        }
      }
    },
    plugins: [ChartDataLabels]
  });
};
// Función para generar colores degradados
const generateGradientColors = (values) => {
  if (!values || values.length === 0) return [];

  // Color inicial (#273984 - azul oscuro para valores altos)
  const darkColor = { r: 39, g: 57, b: 132 };
  // Color final (#a0b1fa - azul claro para valores bajos)
  const lightColor = { r: 160, g: 177, b: 250 };

  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);

  return values.map(value => {
    const intensity = (value - minValue) / (maxValue - minValue || 1);
    const r = Math.round(darkColor.r + (lightColor.r - darkColor.r) * (1 - intensity));
    const g = Math.round(darkColor.g + (lightColor.g - darkColor.g) * (1 - intensity));
    const b = Math.round(darkColor.b + (lightColor.b - darkColor.b) * (1 - intensity));
    return `rgba(${r}, ${g}, ${b}, 0.7)`;
  });
};

// Obtener datos para todas las gráficas
const fetchChartData = async () => {
  try {
    // Adultos Mayores por hora
    const response1 = await axios.get(import.meta.env.VITE_GR_HORASA_URL);
    chartData1.value = response1.data;

    // Servidores Públicos por hora
    const response2 = await axios.get(import.meta.env.VITE_GR_HORASS_URL);
    chartData2.value = response2.data;

    // Adultos Mayores por estado
    const response3 = await axios.get(import.meta.env.VITE_MP_ESTADOSA_URL);
    chartData3.value = response3.data;

    // Servidores Públicos por estado
    const response4 = await axios.get(import.meta.env.VITE_MP_ESTADOSS_URL);
    chartData4.value = response4.data;

    await nextTick();
    renderChart1();
    renderChart2();
    renderChart3();
    renderChart4();
  } catch (error) {
    console.error("Error al obtener los datos:", error);
    $q.notify({
      type: 'negative',
      message: 'Error al cargar los datos',
      position: 'top'
    });
  }
};

// Cambiar tipo de gráfica (1: Adultos horas, 2: Servidores horas, 3: Estados AM, 4: Estados SP)
const changeChartType = (type, chartNumber) => {
  if (chartNumber === 1) {
    currentChartType1.value = type;
    isTableVisible1.value = false;
    nextTick(() => renderChart1());
  } else if (chartNumber === 2) {
    currentChartType2.value = type;
    isTableVisible2.value = false;
    nextTick(() => renderChart2());
  } else if (chartNumber === 3) {
    // Para el gráfico de estados, mapear 'column' a 'bar' vertical
    if (type === 'column') {
      currentChartType3.value = 'bar';
      xAxis3 = 'x';
    }
    // 'bar' ya es el tipo por defecto, pero necesitamos saber si es horizontal
    else if (type === 'bar') {
      currentChartType3.value = 'bar'; // Se maneja la orientación en renderChart3
      xAxis3 = 'y';
    }
    else {
      currentChartType3.value = type;
    }
    isTableVisible3.value = false;
    nextTick(() => renderChart3());
  } else if (chartNumber === 4) {
    // Para el gráfico de estados, mapear 'column' a 'bar' vertical
    if (type === 'column') {
      currentChartType4.value = 'bar';
      xAxis4 = 'x';
    }
    // 'bar' ya es el tipo por defecto, pero necesitamos saber si es horizontal
    else if (type === 'bar') {
      currentChartType4.value = 'bar'; // Se maneja la orientación en renderChart4
      xAxis4 = 'y';
    }
    else {
      currentChartType4.value = type;
    }
    isTableVisible4.value = false;
    nextTick(() => renderChart4());
  }
};

// Toggle tabla (1: Adultos horas, 2: Servidores horas, 3: Estados AM, 4: Estados SP)
const toggleTable = (chartNumber) => {
  if (chartNumber === 1) {
    isTableVisible1.value = !isTableVisible1.value;
    if (!isTableVisible1.value) {
      nextTick(() => renderChart1());
    }
  } else if (chartNumber === 2) {
    isTableVisible2.value = !isTableVisible2.value;
    if (!isTableVisible2.value) {
      nextTick(() => renderChart2());
    }
  } else if (chartNumber === 3) {
    isTableVisible3.value = !isTableVisible3.value;
    if (!isTableVisible3.value) {
      nextTick(() => renderChart3());
    }
  } else {
    isTableVisible4.value = !isTableVisible4.value;
    if (!isTableVisible4.value) {
      nextTick(() => renderChart4());
    }
  }
};

// Exportar a Excel (1: Adultos horas, 2: Servidores horas, 3: Estados AM, 4: Estados SP)

const exportToExcel = (chartNumber) => {
  try {
    const timestamp = generateTimestamp();
    let data, title, head, orderedKeys;

    if (chartNumber === 1) {
      data = chartData1.value;
      title = 'adultos_mayores_por_hora';
      head = 'MINAAMP - Movilización Nacional Adultos Mayores por Hora';
      orderedKeys = data.length > 0 ? Object.keys(data[0]) : [];
    } else if (chartNumber === 2) {
      data = chartData2.value;
      title = 'servidores_publicos_por_hora';
      head = 'MINAAMP - Movilización Servidores Públicos por Hora';
      orderedKeys = data.length > 0 ? Object.keys(data[0]) : [];
    } else if (chartNumber === 3) {
      data = chartData3.value;
      title = 'adultos_mayores_por_estado';
      head = 'MINAAMP - Movilización Adultos Mayores por Estado';
      orderedKeys = data.length > 0 ? Object.keys(data[0]) : [];
    } else {
      data = chartData4.value;
      title = 'servidores_publicos_por_estado';
      head = 'MINAAMP - Movilización Servidores Públicos por Estado';
      orderedKeys = data.length > 0 ? Object.keys(data[0]) : [];
    }

    const now = new Date();
    const fecha = now.toLocaleDateString('es-VE');
    const hora = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    const encabezado = [
      [`${head} al ${fecha} ${hora}`],
      // [] // Fila vacía
    ];

    // Crea la hoja vacía
    const ws = XLSX.utils.aoa_to_sheet([]);

    // Inserta el encabezado grande y la fila vacía
    XLSX.utils.sheet_add_aoa(ws, encabezado, { origin: 'A1' });

    // Inserta los títulos de las columnas en la fila 3
    XLSX.utils.sheet_add_aoa(ws, [orderedKeys], { origin: `A${encabezado.length + 1}` });

    // Inserta los datos a partir de la fila 4
    XLSX.utils.sheet_add_json(ws, data, {
      header: orderedKeys,
      origin: `A${encabezado.length + 2}`,
      skipHeader: true
    });

    // Unir celdas del encabezado
    ws['!merges'] = ws['!merges'] || [];
    ws['!merges'].push({
      s: { r: 0, h: 0 },
      e: { r: 0, h: orderedKeys.length - 1 }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    XLSX.writeFile(wb, `${timestamp}_${title}.xlsx`);

    $q.notify({
      type: 'positive',
      message: `Exportación a Excel exitosa (${chartNumber === 1 ? 'Adultos Mayores' : chartNumber === 2 ? 'Servidores Públicos' : chartNumber === 3 ? 'Adultos por Estado' : 'Servidores por Estado'})`,
      position: 'top',
    });
  } catch (error) {
    console.error("Error exportando a Excel:", error);
    $q.notify({
      type: 'negative',
      message: `Error al exportar a Excel (${chartNumber === 1 ? 'Adultos Mayores' : chartNumber === 2 ? 'Servidores Públicos' : chartNumber === 3 ? 'Adultos por Estado' : 'Servidores por Estado'})`,
      position: 'top',
    });
  }
};
// Exportar a PNG (1: Adultos horas, 2: Servidores horas, 3: Estados AM, 4: Estados SP)
const exportToPng = (chartNumber) => {
  const container = chartNumber === 1 ? chartContainer1.value :
    chartNumber === 2 ? chartContainer2.value :
      chartNumber === 3 ? chartContainer3.value : chartContainer4.value;
  const isTableVisible = chartNumber === 1 ? isTableVisible1.value :
    chartNumber === 2 ? isTableVisible2.value :
      chartNumber === 3 ? isTableVisible3.value : isTableVisible4.value;
  const title = chartNumber === 1 ? 'adultos_mayores_por_hora' :
    chartNumber === 2 ? 'servidores_publicos_por_hora' :
      chartNumber === 3 ? 'adultos_mayores_por_estado' : 'servidores_publicos_por_estado';

  if (!container || isTableVisible) {
    $q.notify({
      type: 'negative',
      message: `No se puede exportar la tabla a PNG (${chartNumber === 1 ? 'Adultos Mayores' : chartNumber === 2 ? 'Servidores Públicos' : chartNumber === 3 ? 'Adultos por Estado' : 'Servidores por Estado'})`,
      position: 'top',
    });
    return;
  }

  try {
    html2canvas(container.querySelector("canvas")).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `${generateTimestamp()}_${title}.png`;
      link.href = imgData;
      link.click();

      $q.notify({
        type: 'positive',
        message: `Exportación a PNG exitosa (${chartNumber === 1 ? 'Adultos Mayores' : chartNumber === 2 ? 'Servidores Públicos' : chartNumber === 3 ? 'Adultos por Estado' : 'Servidores por Estado'})`,
        position: 'top',
      });
    });
  } catch (error) {
    console.error("Error generando imagen:", error);
    $q.notify({
      type: 'negative',
      message: `Error al exportar a PNG (${chartNumber === 1 ? 'Adultos Mayores' : chartNumber === 2 ? 'Servidores Públicos' : chartNumber === 3 ? 'Adultos por Estado' : 'Servidores por Estado'})`,
      position: 'top',
    });
  }
};

// Exportar a PDF (1: Adultos horas, 2: Servidores horas, 3: Estados AM, 4: Estados SP)
const exportToPdf = (chartNumber) => {
  const container = chartNumber === 1 ? chartContainer1.value :
    chartNumber === 2 ? chartContainer2.value :
      chartNumber === 3 ? chartContainer3.value : chartContainer4.value;
  const isTableVisible = chartNumber === 1 ? isTableVisible1.value :
    chartNumber === 2 ? isTableVisible2.value :
      chartNumber === 3 ? isTableVisible3.value : isTableVisible4.value;
  const title = chartNumber === 1 ? 'Adultos Mayores por Hora' :
    chartNumber === 2 ? 'Servidores Públicos por Hora' :
      chartNumber === 3 ? 'Adultos Mayores por Estado' : 'Servidores Públicos por Estado';

  if (!container || isTableVisible) {
    $q.notify({
      type: 'negative',
      message: `No se puede exportar la tabla a PDF (${title})`,
      position: 'top',
    });
    return;
  }

  try {
    html2canvas(container.querySelector("canvas")).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF('landscape');
      const timestamp = generateTimestamp();

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth() - 20;
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, "PNG", 10, 10, pdfWidth, pdfHeight);
      pdf.save(`${timestamp}_${chartNumber === 1 ? 'adultos_mayores_por_hora' : chartNumber === 2 ? 'servidores_publicos_por_hora' : chartNumber === 3 ? 'adultos_mayores_por_estado' : 'servidores_publicos_por_estado'}.pdf`);

      $q.notify({
        type: 'positive',
        message: `Exportación a PDF exitosa (${title})`,
        position: 'top',
      });
    });
  } catch (error) {
    console.error("Error generando PDF:", error);
    $q.notify({
      type: 'negative',
      message: `Error al exportar a PDF (${title})`,
      position: 'top',
    });
  }
};

// Ciclo de vida
onMounted(() => {
  fetchChartData();
  fetchChartDataAE();
  fetchChartDataSE();

  socket.addEventListener("message", async () => {
    await fetchChartData();
  });
  socket.addEventListener("message", fetchChartDataAE);
  socket.addEventListener("message", fetchChartDataSE);

});

onUnmounted(() => {
  if (chartInstance1) chartInstance1.destroy();
  if (chartInstance2) chartInstance2.destroy();
  if (chartInstance3) chartInstance3.destroy();
  if (chartInstance4) chartInstance4.destroy();
  if (chartInstanceAE) chartInstanceAE.destroy();
  if (chartInstanceSE) chartInstanceSE.destroy();
  socket.removeEventListener("message", fetchChartDataAE);
  socket.removeEventListener("message", fetchChartDataSE);
});
</script>

<style scoped>
.q-card {
  width: 100%;
}

canvas {
  width: 100%;
  height: 100%;
  min-height: 400px;
}

.q-mb-md {
  margin-bottom: 16px;
}

canvas {
  max-height: 600px !important;
}
</style>
