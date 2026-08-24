<template>
  <q-page style="margin-left:5%;">
    <div class="header">
      <div class="image-container">
        <img class="responsive-image" src="/img/logo_nobg1.png" alt="Electoral MINAAMP - INASS" />
      </div>
    </div>
    <h4 class="q-mb-md" style="font-weight:bold;">TABLERO</h4>
    <!-- Contenido principal: Mapa -->
    <div class="map-container" style="margin-top: 5%;;">
      <MapComponent />
    </div>
    <div class="map-container">
      <MapServerComponent />
    </div>

    <!-- Contenido principal: Gráficos -->
    <div class="charts-container row justify-center flex flex-center">
      <div class="row" style="width: 100%; max-width: 1600px; margin: 0 auto">
        <TotalChartComponent />
        <MovilizacionChartComponent />
        <InstAreasTableComponent />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { Notify } from "quasar";
import axios from "axios";
import ChartComponent from "src/components/ChartComponent.vue";
import TotalChartComponent from 'src/components/TotalChartComponent.vue';
import MovilizacionChartComponent from "src/components/MovilizacionChartComponent.vue";
import MapComponent from 'src/components/MapComponent.vue';
import MapServerComponent from 'src/components/MapServerComponent.vue';
import socket from "src/services/websocket.js";
import InstAreasTableComponent from "src/components/InstAreasTableComponent.vue";

// Variables de entorno
const grAreasUrl = import.meta.env.VITE_GR_AREAS_URL;
const grIndicesUrl = import.meta.env.VITE_GR_INDICES_URL;
const grIdiomasUrl = import.meta.env.VITE_GR_IDIOMAS_URL;
const grEditorialesUrl = import.meta.env.VITE_GR_EDITORIALES_URL;
const grPeriodicidadesUrl = import.meta.env.VITE_GR_PERIODICIDADES_URL;
const grFormatosUrl = import.meta.env.VITE_GR_FORMATOS_URL;
const grEstadosUrl = import.meta.env.VITE_GR_ESTADOS_URL;

// Variables reactivas para las cards
const data = ref({});

// Mapeo de claves a títulos personalizados
const customTitles = {
  revistas: "REVISTAS REGISTRADAS",
  cant_area: "ÁREAS DE CONOCIMIENTO",
  cant_indices: "ÍNDICES",
  cant_idiomas: "IDIOMAS",
  cant_editoriales: "EDITORIALES",
};
const customTitles1 = {
  revistas: "REVISTA REGISTRADA",
  cant_area: "ÁREA DE CONOCIMIENTO",
  cant_indices: "ÍNDICE",
  cant_idiomas: "IDIOMA",
  cant_editoriales: "EDITORIAL",
};
// Mapeo de claves a imágenes
const imageMap = {
  revistas: "/img/cant_revistas.png",
  cant_area: "/img/cant_areas.png",
  cant_indices: "/img/cant_indices.png",
  cant_editoriales: "/img/cant_editoriales.png",
  cant_estados: "/img/cant_estados2.png",
  cant_idiomas: "/img/cant_idiomas.png",
};

// Función para obtener los datos desde la API (para las cards)
/*
const fetchData = async () => {
  try {
    const response = await axios.get("https://poi-r.vps.co.ve:3000/cantidades");
    // Asignar el primer objeto del array a data.value
    const newData = response.data[0];
    // Actualizar cada clave de data.value individualmente para forzar la reactividad
    Object.keys(newData).forEach((key) => {
      data.value[key] = newData[key];
    });
    Notify.create({
      message: "Datos actualizados.",
      color: "positive",
      position: "top",
      timeout: 3000,
    });
  } catch (error) {
    Notify.create({
      message: "Error al obtener los datos.",
      color: "negative",
      position: "top",
      timeout: 3000,
    });
  }
};
*/
// Función para obtener el título personalizado basado en el valor
const getCustomTitle = (key, value) => {
  if (value === "1") {
    return customTitles1[key] || formatKey(key); // Usar customTitles1 si value es 1
  } else {
    return customTitles[key] || formatKey(key); // Usar customTitles si value es mayor a 1
  }
};
// Función para formatear las claves del objeto (fallback)
const formatKey = (key) => key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

// Columnas de las tablas
const tableColumns1 = [
  { name: 'area_conocimiento', label: 'Área de Conocimiento', field: 'area_conocimiento', align: 'left' },
  { name: 'cant_area', label: 'Cantidad', field: 'cant_area' },
];

const tableColumns2 = [
  { name: 'indice', label: 'Índice', field: 'indice', align: 'left' },
  { name: 'cant_inddice', label: 'Cantidad', field: 'cant_inddice' },
];

const tableColumns3 = [
  { name: 'idioma', label: 'Idioma', field: 'idioma', align: 'left' },
  { name: 'cant_idioma', label: 'Cantidad', field: 'cant_idioma' },
];

const tableColumns4 = [
  { name: 'editorial', label: 'Editorial', field: 'editorial', align: 'left' },
  { name: 'cant_editorial', label: 'Cantidad', field: 'cant_editorial' },
];

const tableColumns5 = [
  { name: 'periodicidad', label: 'Periodicidad', field: 'periodicidad', align: 'left' },
  { name: 'cant_periodicidad', label: 'Cantidad', field: 'cant_periodicidad' },
];

const tableColumns6 = [
  { name: 'formato', label: 'Formato', field: 'formato', align: 'left' },
  { name: 'cant_formato', label: 'Cantidad', field: 'cant_formato' },
];

const tableColumns7 = [
  { name: 'estado', label: 'Estado', field: 'estado', align: 'left' },
  { name: 'cant_estado', label: 'Cantidad', field: 'cant_estado' },
];

// Ciclo de vida
onMounted(() => {
  // const qBtns = document.querySelectorAll('.q-btn');
  // // Itera sobre cada elemento seleccionado y modifica el padding
  // qBtns.forEach(btn => {
  //   btn.style.cssText += 'padding: 4px 4px !important;';
  // });
  fetchData(); // Obtener los datos iniciales

  // Escuchar eventos del WebSocket para actualizar los datos en tiempo real
  socket.addEventListener("message", async (event) => {
    try {
      // Notify.create({
      //   message: "Actualización recibida de la Base e Datos",
      //   color: "positive",
      //   position: "top",
      //   timeout: 3000,
      // });
      await fetchData(); // Consultar el endpoint para obtener los datos actualizados
    } catch (error) {
      Notify.create({
        message: "Error al procesar la notificación o al obtener los datos.",
        color: "negative",
        position: "top",
        timeout: 3000,
      });
    }
  });
});

onUnmounted(() => {
  // Limpiar el listener del WebSocket al desmontar el componente
  // socket.removeEventListener("message");

});
</script>

<style scoped>
.leaflet-control-attribution {
  display: none !important;
}

.leaflet-control-zoom.leaflet-bar.leaflet-control {
  display: none !important;
}

.map-container {
  height: 400px;
  width: 100%;
  margin-bottom: 20px;
}

.charts-container {
  margin-top: 20px;
  /* Separación vertical de 5px */
}

@media (max-width: 767px) {
  .map-container {
    margin-bottom: 300px;
    width: 95%;
  }
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
