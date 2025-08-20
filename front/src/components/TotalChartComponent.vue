<template>
  <div class="row q-col-gutter-md q-pa-md items-stretch">
    <!-- Gráfico Total Adultos Mayores -->
    <div class="col-md-6 col-12">
      <q-card flat  class="card-fixed-height">
        <ChartToolbar
          title="Movilización Total Adultos Mayores"
          :is-line-chart="false"
          :is-table-visible="isTableVisible1"
          @change-chart-type="(type) => changeChartType(type, 1)"
          @export-excel="() => exportToExcel(1)"
          @export-png="() => exportToPng(1)"
          @export-pdf="() => exportToPdf(1)"
          @toggle-table="() => toggleTable(1)"
        />
        <q-separator />
        <div class="card-content">
          <div v-if="!isTableVisible1" class="chart-wrapper">
            <div class="chart-container">
              <canvas ref="chartCanvas1"></canvas>
            </div>
          </div>
          <div v-else class="table-wrapper">
            <q-table
              flat
              title="Datos Total Adultos Mayores"
              :rows="chartData1"
              :columns="tableColumnsTotal"
              row-key="meta"
              :pagination="{ rowsPerPage: 10 }"
              class="full-height-table"
            />
          </div>
        </div>
      </q-card>
    </div>

    <!-- Gráfico Total Servidores Públicos -->
    <div class="col-md-6 col-12">
      <q-card flat  class="card-fixed-height">
        <ChartToolbar
          title="Movilización Total Servidores Públicos"
          :is-line-chart="false"
          :is-table-visible="isTableVisible2"
          @change-chart-type="(type) => changeChartType(type, 2)"
          @export-excel="() => exportToExcel(2)"
          @export-png="() => exportToPng(2)"
          @export-pdf="() => exportToPdf(2)"
          @toggle-table="() => toggleTable(2)"
        />
        <q-separator />
        <div class="card-content">
          <div v-if="!isTableVisible2" class="chart-wrapper">
            <div class="chart-container">
              <canvas ref="chartCanvas2"></canvas>
            </div>
          </div>
          <div v-else class="table-wrapper">
            <q-table
              flat
              title="Datos Total Servidores Públicos"
              :rows="chartData2"
              :columns="tableColumnsTotal"
              row-key="meta"
              :pagination="{ rowsPerPage: 10 }"
              class="full-height-table"
            />
          </div>
        </div>
      </q-card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import axios from "axios";

import { Chart, registerables } from 'chart.js';
import "chartjs-plugin-datalabels";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from 'xlsx';
import { useQuasar } from 'quasar';
import ChartToolbar from "src/components/ChartToolbar.vue";
import socket from "src/services/websocket.js";

const $q = useQuasar();
const observers = ref([]);
Chart.register(...registerables);
let xAxis1 = 'x'; // 'x' para vertical, 'y' para horizontal
let xAxis2 = 'x';
// Columnas para la tabla
const tableColumnsTotal = ref([
  {
    name: 'movilizados',
    required: true,
    label: 'Movilizados',
    align: 'center',
    field: 'movilizados',
    sortable: true
  },
  {
    name: 'por_movilizar',
    label: 'Por Movilizar',
    align: 'center',
    field: 'por_movilizar',
    sortable: true
  },
  {
    name: 'meta',
    label: 'Meta',
    align: 'center',
    field: 'meta',
    sortable: true
  }
]);

// Variables reactivas
const chartData1 = ref([]); // Adultos mayores total
const chartData2 = ref([]); // Servidores públicos total
const chartCanvas1 = ref(null);
const chartCanvas2 = ref(null);
const chartContainer1 = ref(null);
const chartContainer2 = ref(null);
let chartInstance1 = null;
let chartInstance2 = null;
const currentChartType1 = ref("pie");
const currentChartType2 = ref("pie");
const isTableVisible1 = ref(false);
const isTableVisible2 = ref(false);

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

// Configuración común para gráficos
const getChartOptions = (title) => {
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
      legend: {
        position: 'top'
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = Math.round((value / total) * 100);
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      },
      datalabels: {
        formatter: (value, ctx) => {
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
          const percentage = Math.round((value / total) * 100);
          return `${value} - ${percentage}%`;
        },
        color: '#fff',
        font: {
          weight: 'bold'
        }
      }
    }
  };
};

// Renderizar gráfica Total Adultos Mayores
const renderChart1 = () => {
  if (!chartCanvas1.value || chartData1.value.length === 0) return;

  if (chartInstance1) {
    chartInstance1.destroy();
  }

  const ctx = chartCanvas1.value.getContext("2d");
  const data = chartData1.value[0];
  const isHorizontalBar = currentChartType1.value === 'bar' && xAxis1 === 'y';

  // Configuración específica para gráficos de barras
  if (currentChartType1.value === 'bar') {
    chartInstance1 = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Movilizados', 'Por Movilizar'],
        datasets: [{
          label: 'Cantidad',
          data: [parseInt(data.movilizados), parseInt(data.por_movilizar)],
          backgroundColor: ['#273984', '#a0b1fa'],
          borderColor: ['#1a2661', '#7d8fc8'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: xAxis1, // Usamos la variable de orientación
        plugins: {
          title: {
            display: true,
            text: `Movilización Total Adultos Mayores\n${formatDateTime()}`,
            font: {
              size: 16
            }
          },
          legend: {
            display: false
          },
          datalabels: {
            formatter: (value) => value,
            color: '#fff',
            font: {
              weight: 'bold'
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: isHorizontalBar ? 'Cantidad' : 'Categoría'
            },
            grid: {
              display: false
            },
            beginAtZero: true
          },
          y: {
            title: {
              display: true,
              text: isHorizontalBar ? 'Categoría' : 'Cantidad'
            },
            grid: {
              display: !isHorizontalBar
            }
          }
        }
      }
    });
  } else {
    // Configuración para otros tipos de gráficos (pie, doughnut)
    chartInstance1 = new Chart(ctx, {
      type: currentChartType1.value,
      data: {
        labels: ['Movilizados', 'Por Movilizar'],
        datasets: [{
          data: [parseInt(data.movilizados), parseInt(data.por_movilizar)],
          backgroundColor: ['#273984', '#a0b1fa'],
          borderColor: ['#1a2661', '#7d8fc8'],
          borderWidth: 1
        }]
      },
      options: getChartOptions("Movilización Total Adultos Mayores")
    });
  }
};
// Renderizar gráfica Total Servidores Públicos
const renderChart2 = () => {
  if (!chartCanvas2.value || chartData2.value.length === 0) return;

  if (chartInstance2) {
    chartInstance2.destroy();
  }

  const ctx = chartCanvas2.value.getContext("2d");
  const data = chartData2.value[0];
  const isHorizontalBar = currentChartType2.value === 'bar' && xAxis2 === 'y';

  // Configuración específica para gráficos de barras
  if (currentChartType2.value === 'bar') {
    chartInstance2 = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Movilizados', 'Por Movilizar'],
        datasets: [{
          label: 'Cantidad',
          data: [parseInt(data.movilizados), parseInt(data.por_movilizar)],
          backgroundColor: ['#8E44AD', '#d5a8e4'],
          borderColor: ['#6c3483', '#b388c3'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: xAxis2, // Usamos la variable de orientación
        plugins: {
          title: {
            display: true,
            text: `Movilización Total Servidores Públicos\n${formatDateTime()}`,
            font: {
              size: 16
            }
          },
          legend: {
            display: false
          },
          datalabels: {
            formatter: (value) => value,
            color: '#fff',
            font: {
              weight: 'bold'
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: isHorizontalBar ? 'Cantidad' : 'Categoría'
            },
            grid: {
              display: false
            },
            beginAtZero: true
          },
          y: {
            title: {
              display: true,
              text: isHorizontalBar ? 'Categoría' : 'Cantidad'
            },
            grid: {
              display: !isHorizontalBar
            }
          }
        }
      }
    });
  } else {
    // Configuración para otros tipos de gráficos (pie, doughnut)
    chartInstance2 = new Chart(ctx, {
      type: currentChartType2.value,
      data: {
        labels: ['Movilizados', 'Por Movilizar'],
        datasets: [{
          data: [parseInt(data.movilizados), parseInt(data.por_movilizar)],
          backgroundColor: ['#8E44AD', '#d5a8e4'],
          borderColor: ['#6c3483', '#b388c3'],
          borderWidth: 1
        }]
      },
      options: getChartOptions("Movilización Total Servidores Públicos")
    });
  }
}
// Obtener datos para las gráficas
const fetchChartData = async () => {
  try {
    // Adultos Mayores total
    const response1 = await axios.get(import.meta.env.VITE_GR_TOTALA_URL);
    chartData1.value = response1.data;

    // Servidores Públicos total
    const response2 = await axios.get(import.meta.env.VITE_GR_TOTALS_URL);
    chartData2.value = response2.data;

    await nextTick();
    renderChart1();
    renderChart2();
  } catch (error) {
    console.error("Error al obtener los datos:", error);
    $q.notify({
      type: 'negative',
      message: 'Error al cargar los datos',
      position: 'top'
    });
  }
};

// Cambiar tipo de gráfica (1: Adultos total, 2: Servidores total)

const changeChartType = (type, chartNumber) => {
  if (chartNumber === 1) {
    if (type === 'column') {
      currentChartType1.value = 'bar';
      xAxis1 = 'x';
    } else if (type === 'bar') {
      currentChartType1.value = 'bar';
      xAxis1 = 'y';
    } else {
      currentChartType1.value = type;
    }
    isTableVisible1.value = false;
    nextTick(() => {
      renderChart1();
      // Forzar recálculo del layout
      window.dispatchEvent(new Event('resize'));
    });
  } else if (chartNumber === 2) {
    if (type === 'column') {
      currentChartType2.value = 'bar';
      xAxis2 = 'x';
    } else if (type === 'bar') {
      currentChartType2.value = 'bar';
      xAxis2 = 'y';
    } else {
      currentChartType2.value = type;
    }
    isTableVisible2.value = false;
    nextTick(() => {
      renderChart2();
      // Forzar recálculo del layout
      window.dispatchEvent(new Event('resize'));
    });
  }
};
// Toggle tabla (1: Adultos total, 2: Servidores total)
const toggleTable = (chartNumber) => {
  if (chartNumber === 1) {
    isTableVisible1.value = !isTableVisible1.value;
    nextTick(() => {
      if (!isTableVisible1.value) {
        renderChart1();
      }
      // Forzar recálculo del layout
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
    });
  } else if (chartNumber === 2) {
    isTableVisible2.value = !isTableVisible2.value;
    nextTick(() => {
      if (!isTableVisible2.value) {
        renderChart2();
      }
      // Forzar recálculo del layout
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
    });
  }
};
// Exportar a Excel (1: Adultos total, 2: Servidores total)
const exportToExcel = (chartNumber) => {
  try {
    const timestamp = generateTimestamp();
    let data, title, head, orderedKeys;

    if (chartNumber === 1) {
      data = chartData1.value;
      title = 'total_adultos_mayores';
      head = 'MINAAMP - Movilización Total Adultos Mayores al ';
      orderedKeys = data.length > 0 ? Object.keys(data[0]) : [];
    } else {
      data = chartData2.value;
      title = 'total_servidores_publicos';
      head = 'MINAAMP - Movilización Total Servidores Públicos al ';
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
      message: `Exportación a Excel exitosa (${chartNumber === 1 ? 'Adultos Mayores' : 'Servidores Públicos'})`,
      position: 'top',
    });
  } catch (error) {
    console.error("Error exportando a Excel:", error);
    $q.notify({
      type: 'negative',
      message: `Error al exportar a Excel (${chartNumber === 1 ? 'Adultos Mayores' : 'Servidores Públicos'})`,
      position: 'top',
    });
  }
};

// Exportar a PNG (1: Adultos total, 2: Servidores total)
const exportToPng = (chartNumber) => {
  const container = chartNumber === 1 ? chartContainer1.value : chartContainer2.value;
  const isTableVisible = chartNumber === 1 ? isTableVisible1.value : isTableVisible2.value;
  const title = chartNumber === 1 ? 'total_adultos_mayores' : 'total_servidores_publicos';

  if (!container || isTableVisible) {
    $q.notify({
      type: 'negative',
      message: `No se puede exportar la tabla a PNG (${chartNumber === 1 ? 'Adultos Mayores' : 'Servidores Públicos'})`,
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
        message: `Exportación a PNG exitosa (${chartNumber === 1 ? 'Adultos Mayores' : 'Servidores Públicos'})`,
        position: 'top',
      });
    });
  } catch (error) {
    console.error("Error generando imagen:", error);
    $q.notify({
      type: 'negative',
      message: `Error al exportar a PNG (${chartNumber === 1 ? 'Adultos Mayores' : 'Servidores Públicos'})`,
      position: 'top',
    });
  }
};

// Exportar a PDF (1: Adultos total, 2: Servidores total)
const exportToPdf = (chartNumber) => {
  const container = chartNumber === 1 ? chartContainer1.value : chartContainer2.value;
  const isTableVisible = chartNumber === 1 ? isTableVisible1.value : isTableVisible2.value;
  const title = chartNumber === 1 ? 'Adultos Mayores Total' : 'Servidores Públicos Total';

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
      pdf.save(`${timestamp}_${chartNumber === 1 ? 'total_adultos_mayores' : 'total_servidores_publicos'}.pdf`);

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

  // Configurar observers para los contenedores
  if (chartContainer1.value) {
    const observer1 = new ResizeObserver(() => {
      if (chartInstance1) {
        chartInstance1.resize();
      }
    });
    observer1.observe(chartContainer1.value);
    observers.value.push(observer1);
  }

  if (chartContainer2.value) {
    const observer2 = new ResizeObserver(() => {
      if (chartInstance2) {
        chartInstance2.resize();
      }
    });
    observer2.observe(chartContainer2.value);
    observers.value.push(observer2);
  }

  socket.addEventListener("message", async () => {
    await fetchChartData();
  });
});

onUnmounted(() => {
  // Limpiar observers
  observers.value.forEach(observer => observer.disconnect());
  if (chartInstance1) chartInstance1.destroy();
  if (chartInstance2) chartInstance2.destroy();
});
</script>

<style scoped>
/* Contenedor principal */
.row {
  width: 100%;
}

/* Tarjeta con altura fija */
.card-fixed-height {
  height: 100%;
  min-height: 500px;
  display: flex;
  flex-direction: column;
}

/* Contenido de la tarjeta (gráfico o tabla) */
.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 8px;
}

/* Contenedor del gráfico */
.chart-wrapper {
  flex: 1;
  display: flex;
  position: relative;
}

.chart-container {
  width: 99%;
  height: 99%;
  min-height: 200px;
  position: relative;
}

canvas {
  width: 100% !important;
  height: 100% !important;
}

/* Contenedor de la tabla */
.table-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.full-height-table {
  flex: 1;
}

/* Asegurar que las columnas mantengan su ancho */
.col-md-6 {
  width: 50%;
  flex: 0 0 50%;
  max-width: 50%;
}

@media (max-width: 767px) {
  .col-md-6 {
    width: 100%;
    flex: 0 0 100%;
    max-width: 100%;
    margin-bottom: 20px;
  }

  .card-fixed-height {
    min-height: auto;
  }
}
</style>
