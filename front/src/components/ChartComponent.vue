<template>
  <div class="col-12 col-md-6 q-pa-md">
    <ChartToolbar @change-chart-type="changeChartType" @export-excel="exportToExcel" @export-png="exportToPng"
      @export-pdf="exportToPdf" @toggle-table="toggleTable" />
    <div v-if="!isTableVisible">
      <div ref="chartContainer"
        style="width: 100%; background-color: white; padding: 20px; border-radius: 10px; position: relative;">
        <div style="width: 100%; height: 400px; position: relative">
          <canvas ref="chartCanvas" style="width: 100%; height: 600px"></canvas>
        </div>
      </div>
    </div>
    <div v-else>
      <q-card>
        <q-table :title="title" :rows="chartData" :columns="tableColumns" row-key="id"
          :pagination="{ rowsPerPage: 10 }" />
      </q-card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import axios from "axios";
import { Chart, registerables } from "chart.js";
import "chartjs-plugin-datalabels";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from 'xlsx';
import { useQuasar } from 'quasar';
import ChartToolbar from "src/components/ChartToolbar.vue";
import socket from "src/services/websocket.js"; // Importar el servicio de WebSocket

// Inicializar Quasar
const $q = useQuasar();

// Registrar todas las funcionalidades necesarias de Chart.js
Chart.register(...registerables);

// Props
const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  endpoint: {
    type: String,
    required: true,
  },
  dataKey: {
    type: String,
    required: true,
  },
  valueKey: {
    type: String,
    required: true,
  },
  tableColumns: {
    type: Array,
    required: true,
  },
});

// Variables reactivas
const chartData = ref([]);
const chartCanvas = ref(null);
const chartContainer = ref(null);
let chartInstance = null;
const currentChartType = ref("bar");
const isTableVisible = ref(false);

// Función para generar el timestamp en formato YYYYMMDDHHmmss
const generateTimestamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

// Renderizar la gráfica
const renderChart = (type) => {
  if (!chartCanvas.value) return;

  // Destruir instancia anterior
  if (chartInstance) {
    chartInstance.destroy();
  }

  const ctx = chartCanvas.value.getContext("2d");

  // Configuración del gráfico
  const isBarChart = type === "bar" || type === "column";
  const chartType = isBarChart ? "bar" : type; // "bar" para barras, otro tipo para pie/doughnut
  const indexAxis = type === "bar" ? "y" : type === "column" ? "x" : undefined; // "y" para barras horizontales, "x" para columnas
  const labels = chartData.value.map((item) => item[props.dataKey] || "Sin datos");
  const dataValues = chartData.value.map((item) => parseInt(item[props.valueKey], 10) || 0);
  // const backgroundColors = chartData.value.map((_, index) => predefinedColors[index % predefinedColors.length]);
  const formattedDate = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  const backgroundColors = generateGradientColors(dataValues);
  chartInstance = new Chart(ctx, {
    type: chartType,
    data: {
      labels,
      datasets: [{
        label: "",
        data: dataValues,
        backgroundColor: backgroundColors,
        borderWidth: 1,
      }],
    },
    options: {
      indexAxis, // Configura el eje de las barras (horizontal o vertical)
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `${props.title}\n${formattedDate}`,
        },
      },
    },
  });
};

// Obtener datos para la gráfica
const fetchChartData = async () => {
  try {
    const response = await axios.get(props.endpoint); // Usar props.endpoint
    chartData.value = response.data;
    await nextTick(); // Esperar a que Vue actualice el DOM
    renderChart(currentChartType.value);
  } catch (error) {
    console.error(`Error al obtener los datos de la gráfica (${props.title}):`, error);
  }
};

// Cambiar tipo de gráfica
const changeChartType = (type) => {
  currentChartType.value = type;
  isTableVisible.value = false; // Ocultar la tabla si está visible
  nextTick(() => renderChart(type));
};

// Toggle tabla
const toggleTable = () => {
  isTableVisible.value = !isTableVisible.value;
};

// Exportar a Excel
const exportToExcel = () => {
  try {
    const timestamp = generateTimestamp();
    const ws = XLSX.utils.json_to_sheet(chartData.value);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${timestamp}_${props.title.toLowerCase().replace(/ /g, '_')}.xlsx`);
    $q.notify({
      type: 'positive',
      message: `Exportación a Excel exitosa (${props.title})`,
      position: 'top',
    });
  } catch (error) {
    console.error("Error exportando a Excel:", error);
    $q.notify({
      type: 'negative',
      message: `Error al exportar a Excel (${props.title})`,
      position: 'top',
    });
  }
};

// Exportar a PNG
const exportToPng = () => {
  if (!chartContainer.value || isTableVisible.value) {
    $q.notify({
      type: 'negative',
      message: `No se puede exportar la tabla a PNG (${props.title})`,
      position: 'top',
    });
    return;
  }

  try {
    html2canvas(chartContainer.value.querySelector("canvas")).then((canvas) => {
      if (!canvas) {
        $q.notify({
          type: 'negative',
          message: `No se encontró el gráfico para exportar (${props.title})`,
          position: 'top',
        });
        return;
      }

      const imgData = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const timestamp = generateTimestamp();
      link.download = `${timestamp}_${props.title.toLowerCase().replace(/ /g, '_')}.png`;
      link.href = imgData;
      link.click();
      $q.notify({
        type: 'positive',
        message: `Exportación a PNG exitosa (${props.title})`,
        position: 'top',
      });
    });
  } catch (error) {
    console.error("Error generando imagen:", error);
    $q.notify({
      type: 'negative',
      message: `Error al exportar a PNG (${props.title})`,
      position: 'top',
    });
  }
};

// Exportar a PDF
const exportToPdf = () => {
  if (!chartContainer.value || isTableVisible.value) {
    $q.notify({
      type: 'negative',
      message: `No se puede exportar la tabla a PDF (${props.title})`,
      position: 'top',
    });
    return;
  }

  try {
    html2canvas(chartContainer.value.querySelector("canvas")).then((canvas) => {
      if (!canvas) {
        $q.notify({
          type: 'negative',
          message: `No se encontró el gráfico para exportar (${props.title})`,
          position: 'top',
        });
        return;
      }

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF();
      const timestamp = generateTimestamp();
      pdf.addImage(imgData, "PNG", 15, 40, 180, 0, null, "FAST");
      pdf.save(`${timestamp}_${props.title.toLowerCase().replace(/ /g, '_')}.pdf`);
      $q.notify({
        type: 'positive',
        message: `Exportación a PDF exitosa (${props.title})`,
        position: 'top',
      });
    });
  } catch (error) {
    console.error("Error generando PDF:", error);
    $q.notify({
      type: 'negative',
      message: `Error al exportar a PDF (${props.title})`,
      position: 'top',
    });
  }
};


// Función para generar colores degradados desde #273984 (más oscuro, valores altos) hasta #a0b1fa (más claro, valores bajos)
const generateGradientColors = (values) => {
  if (!values || values.length === 0) return [];

  // Obtenemos valores únicos ordenados de mayor a menor
  const uniqueValues = [...new Set(values)].sort((a, b) => b - a);

  // Si todos los valores son iguales, todos tendrán el color más oscuro
  if (uniqueValues.length === 1) {
    return Array(values.length).fill('rgba(39, 57, 132, 0.7)');
  }

  // Color inicial (#273984 - azul oscuro para valores altos)
  const darkColor = { r: 39, g: 57, b: 132 };

  // Color final (#a0b1fa - azul claro para valores bajos)
  const lightColor = { r: 160, g: 177, b: 250 };

  // Mapeo de cada valor único a su color correspondiente
  const valueColorMap = {};
  uniqueValues.forEach((value, index) => {
    // Calculamos la intensidad basada en la posición en los valores únicos ordenados
    const intensity = index / (uniqueValues.length - 1);

    // Interpolamos entre el color oscuro y claro
    const r = Math.round(darkColor.r + (lightColor.r - darkColor.r) * intensity);
    const g = Math.round(darkColor.g + (lightColor.g - darkColor.g) * intensity);
    const b = Math.round(darkColor.b + (lightColor.b - darkColor.b) * intensity);

    valueColorMap[value] = `rgba(${r}, ${g}, ${b}, 0.7)`;
  });

  // Asignamos a cada valor original su color correspondiente
  return values.map(value => valueColorMap[value]);
};
///////////////
// Ciclo de vida
onMounted(() => {
  fetchChartData(); // Obtener los datos iniciales

  // Escuchar eventos de actualización desde WebSocket
  socket.addEventListener("message", async (event) => {
    // console.log('cambio bd');
    // $q.notify({
    //   message: "Cambio detectado en la base de datos. Actualizando gráfico.",
    //   color: "positive",
    //   position: "top",
    //   timeout: 3000,
    // });
    await fetchChartData(); // Volver a consultar los datos del gráfico
  });
});

onUnmounted(() => {
  // Limpiar el listener del WebSocket
  // socket.removeEventListener("message");
});
</script>

<style scoped>
canvas {
  width: 100%;
  height: 400px;
}
</style>
