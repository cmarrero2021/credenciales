<template>
  <q-page>
    <div class="row relative-position">
      <!-- Mapa -->
      <div ref="mapContainer" class="col-xs-12 col-md-6 map-container"></div>

      <!-- Contenedor de cards (fuera del flujo normal) -->
      <div ref="cardsContainer" class="cards-container" :class="{ 'visible': showTable }">
        <q-card class="q-ma-md">
          <!-- Q-Table para mostrar los datos -->
          <q-table
            flat
            bordered
            :rows="estadosData"
            :columns="columns"
            row-key="estado"
            :selected-rows-label="getSelectedString"
            selection="single"
            v-model:selected="selectedRow"
            :pagination="initialPagination"
            hide-pagination
            class="estados-table"
            :rows-per-page-options="[0]"
          >
            <template v-slot:body-cell-estado="props">
              <q-td :props="props" :class="{ 'highlight-row': props.selected }">
                {{ props.row.estado }}
              </q-td>
            </template>
            <template v-slot:body-cell-cant_estado="props">
              <q-td :props="props" :class="{ 'highlight-row': props.selected }">
                {{ props.row.cant_estado }}
              </q-td>
            </template>
          </q-table>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { Notify } from "quasar";
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import venezuelaGeoJsonData from '../geojson/Venezuela.json';
import socket from 'src/services/websocket'; // Importar el servicio de WebSocket

const mapContainer = ref(null);
const cardsContainer = ref(null);
const VITE_GR_ESTADOS_URL = import.meta.env.VITE_GR_ESTADOS_URL;
const VITE_DATA_ESTADOS_BASE_URL = import.meta.env.VITE_DATA_ESTADOS_BASE_URL;
const VITE_DATA_NACIONAL_BASE_URL = import.meta.env.VITE_DATA_NACIONAL_BASE_URL;
const VITE_MP_ESTADOSA = import.meta.env.VITE_MP_ESTADOSA_URL;

const showTable = ref(false);
const selectedStateData = ref({});
const estadoData = ref([]);
const paisData = ref([]);
const estadosData = ref([]); // Datos para la tabla
const selectedRow = ref([]); // Fila seleccionada en la tabla

let map = null; // Referencia al mapa de Leaflet
let geoJsonLayer = null; // Referencia a la capa GeoJSON

// Columnas para la Q-Table
const columns = [
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
    align: 'left',
    label: 'Cantidad',
    field: 'cant_estado',
    sortable: true
  }
];

// Configuración inicial de paginación
const initialPagination = {
  sortBy: 'cant_estado',
  descending: true,
  page: 1,
  rowsPerPage: 0 // Mostrar todos los registros
};

const generateColorScale = () => {
  const colorScale = [];
  const step = 180 / 25; // Increment per step
  for (let i = 0; i < 26; i++) {
    if (i == 0) {
      colorScale.push(`rgb(255,255,255)`);
    } else {
      const green = Math.round(180 - i * step);
      colorScale.push(`rgb(${green}, ${green},255)`);
    }
  }
  return colorScale;
};

const colorScale = generateColorScale();

// Función para cargar los datos de la tabla
const fetchEstadosTableData = async () => {
  try {
    const response = await axios.get(VITE_MP_ESTADOSA);
    estadosData.value = response.data;
  } catch (error) {
    Notify.create({
      message: "Error al obtener datos para la tabla de estados.",
      color: "negative",
      position: "top",
      timeout: 3000,
    });
    estadosData.value = [];
  }
};

// Función para resaltar una fila en la tabla
const highlightStateInTable = (stateName) => {
  // Limpiar selección anterior
  selectedRow.value = [];

  // Buscar el estado en los datos de la tabla
  const normalizedStateName = stateName.toLowerCase();
  const stateRow = estadosData.value.find(item =>
    item.estado.toLowerCase() === normalizedStateName
  );

  if (stateRow) {
    selectedRow.value = [stateRow];

    // Usar nextTick para asegurar que la tabla se haya renderizado
    nextTick(() => {
      // Encontrar la fila en el DOM y hacer scroll hasta ella
      const tableContainer = document.querySelector('.estados-table');
      if (tableContainer) {
        const rows = tableContainer.querySelectorAll('tbody tr');
        const index = estadosData.value.indexOf(stateRow);
        if (rows[index]) {
          rows[index].scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }
    });
  }
};

// Función para cargar los datos del mapa
const fetchEstadoData = async () => {
  try {
    const response = await axios.get(VITE_GR_ESTADOS_URL);
    return response.data;
  } catch (error) {
    Notify.create({
      message: "Error al obtener datos del estado.",
      color: "negative",
      position: "top",
      timeout: 3000,
    });
    return [];
  }
};

// Función para inicializar el mapa
const initializeMap = () => {
  // Destruir el mapa existente si hay uno
  if (map) {
    map.remove();
    map = null;
  }

  // Crear un nuevo mapa
  map = L.map(mapContainer.value).setView([8.0, -66.0], 5);

  // Agregar control de reinicio
  const resetControl = L.control({ position: 'topright' });
  resetControl.onAdd = () => {
    const container = L.DomUtil.create('div', 'reset-icon-container');
    const btn = L.DomUtil.create('button', 'reset-icon-btn', container);
    btn.innerHTML = '<i class="fas fa-map-marker-alt"></i>';
    btn.style = 'background-color: rgb(0, 0, 255) !important; color: rgb(255, 255, 255) !important; padding: 5px !important; cursor: pointer !important';
    btn.title = "Recentrar Mapa";
    L.DomEvent.on(btn, 'click', () => {
      map.setView([8.0, -66.0], 5);
    });
    return container;
  };
  map.addControl(resetControl);

  // Ocultar el control de atribución
  const attributionControl = map.getContainer().querySelector('.leaflet-control-attribution');
  if (attributionControl) {
    attributionControl.style.display = 'none';
  }

  // Ocultar el control de zoom
  const zommControl = map.getContainer().querySelector('.leaflet-control');
  if (zommControl) {
    zommControl.style.display = 'none';
  }
  //////////////////////
    const titleControl = L.control({ position: 'topleft' });

  titleControl.onAdd = () => {
    const container = L.DomUtil.create('div', 'map-title-container');
    container.innerHTML = `
      <div class="map-title">
        MOVILIZACIÓN DE ADULTOS MAYORES
      </div>
    `;
    return container;
  };

  map.addControl(titleControl);
  //////////////////////
};

// Función para actualizar el mapa con nuevos datos
const updateMap = async () => {
  estadoData.value = await fetchEstadoData();
  const estadoMap = estadoData.value.reduce((acc, item) => {
    acc[item.estado.toLowerCase().replace(/ /g, '')] = item.cant_estado;
    return acc;
  }, {});
  const maxEstadoValue = Math.max(...estadoData.value.map(item => item.cant_estado || 0)) || 1;

  // Eliminar la capa GeoJSON existente si hay una
  if (geoJsonLayer) {
    map.removeLayer(geoJsonLayer);
  }

  // Agregar una nueva capa GeoJSON con los datos actualizados
  geoJsonLayer = L.geoJSON(venezuelaGeoJsonData, {
    style(feature) {
      const normalizedEstado = feature.properties.name.toLowerCase().replace(/ /g, '');
      const cant_estado = estadoMap[normalizedEstado] || 0;
      const normalizedValue = Math.min(cant_estado / maxEstadoValue, 1);
      const colorIndex = Math.floor(normalizedValue * 25);
      return {
        fillColor: colorScale[colorIndex] || colorScale[0],
        weight: 1,
        color: '#000000',
        fillOpacity: 0.7
      };
    },
    onEachFeature(feature, layer) {
      const normalizedEstado = feature.properties.name.toLowerCase().replace(/ /g, '');
      const cant_estado = estadoMap[normalizedEstado] || 0;
      const normalizedValue = Math.min(cant_estado / maxEstadoValue, 1);
      const colorIndex = Math.floor(normalizedValue * 25);
      const fillColor = colorScale[colorIndex] || colorScale[0];

      layer.bindTooltip(`${feature.properties.name} votaron: ${cant_estado} Adultos Mayores`);

      layer.on('mouseover', () => {
        layer.setStyle({
          fillColor: 'rgb(0, 0, 255)',
          weight: 1,
          color: '#000000',
          fillOpacity: 1
        });
        layer.bringToFront();
        const bounds = layer.getBounds();
        const centerLatLng = bounds.getCenter();
        const centerPixel = map.latLngToContainerPoint(centerLatLng);
        layer._path.style.transformOrigin = `${centerPixel.x}px ${centerPixel.y}px`;
        layer._path.style.transform = 'scale(1)';
      });

      layer.on('mouseout', () => {
        layer.setStyle({
          fillColor,
          weight: 1,
          color: '#000000',
          fillOpacity: 0.7
        });
        layer._path.style.transform = '';
        layer._path.style.transformOrigin = '';
      });

      layer.on('click', async () => {
        const estadoName = feature.properties.name.toLowerCase();
        const estadoInfo = await fetchEstadoInfo(estadoName);
        const paisInfo = await fetchPaisInfo();

        if (JSON.stringify(estadoInfo).length == 2) {
          selectedStateData.value = paisInfo;
          showTable.value = true;
        } else {
          selectedStateData.value = estadoInfo;
          showTable.value = true;
        }

        // Resaltar el estado en la tabla
        highlightStateInTable(feature.properties.name);
      });
    }
  }).addTo(map);
};

// Función para obtener la información nacional
const fetchPaisInfo = async () => {
  try {
    const response = await axios.get(VITE_DATA_NACIONAL_BASE_URL);
    const paisInfo = response.data[0];
    return paisInfo || {};
  } catch (error) {
    Notify.create({
      message: "Falla al obtener información del estado.",
      color: "negative",
      position: "top",
      timeout: 3000,
    });
    return {};
  }
};

// Función para obtener la información de un estado específico
const fetchEstadoInfo = async (estadoName) => {
  try {
    const response = await axios.get(VITE_DATA_ESTADOS_BASE_URL);
    const estadoInfo = response.data.find(item => item.estado.toLowerCase() === estadoName);
    return estadoInfo || {};
  } catch (error) {
    Notify.create({
      message: "Falla al obtener información del estado.",
      color: "negative",
      position: "top",
      timeout: 3000,
    });
    return {};
  }
};

// Función para formatear la selección (no necesaria pero la dejamos)
const getSelectedString = () => {
  return selectedRow.value.length === 0 ? '' : `${selectedRow.value.length} fila${selectedRow.value.length > 1 ? 's' : ''} seleccionada${selectedRow.value.length > 1 ? 's' : ''}`;
};

onMounted(async () => {
  // Inicializar el mapa
  initializeMap();

  // Cargar los datos iniciales del mapa
  await updateMap();

  // Cargar los datos para la tabla
  await fetchEstadosTableData();

  const paisInfo = await fetchPaisInfo();
  selectedStateData.value = paisInfo;
  showTable.value = true;

  // Escuchar eventos de actualización desde WebSocket
  socket.onmessage = async (event) => {
    await updateMap(); // Actualizar el mapa con los nuevos datos
    await fetchEstadosTableData(); // Actualizar los datos de la tabla
    const updatedPaisInfo = await fetchPaisInfo();
    selectedStateData.value = updatedPaisInfo;
  };
});

onUnmounted(() => {
  // Limpiar el listener del WebSocket
  socket.onmessage = null;
});
</script>

<style scoped>
.map-container {
  height: 300px;
  background-color: #ffffff !important;
}

@media (min-width: 768px) {
  .map-container {
    height: 400px;
  }
}

/* Contenedor de cards (fuera del flujo normal) */
.cards-container {
  position: absolute;
  top: 0;
  left: 55%;
  width: 45%;
  max-height: 100%;
  /* Limita la altura al 100% del contenedor padre */
  overflow-y: auto;
  /* Permite el desplazamiento vertical si el contenido es demasiado grande */
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.3s ease, visibility 0.3s ease;
  z-index: 10;
}

.cards-container.visible {
  visibility: visible;
  opacity: 1;
}

@media (max-width: 767px) {
  .cards-container {
    top: 100%;
    left: 0;
    width: 100%;
    max-height: 300px;
    /* Altura máxima para dispositivos móviles */
  }
}

/* Estilos para la tabla */
.estados-table {
  width: 100%;
}

/* Estilo para resaltar la fila seleccionada */
.highlight-row {
  background-color: rgba(0, 0, 255, 0.1) !important;
  font-weight: bold;
}
</style>
