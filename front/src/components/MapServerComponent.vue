<template>
  <q-page>
    <div class="row relative-position">
      <!-- Mapa -->
      <div ref="mapContainer" class="col-xs-12 col-md-6 map-container"></div>

      <!-- Contenedor de la tabla -->
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
            <template v-slot:body-cell-votaron="props">
              <q-td :props="props" :class="{ 'highlight-row': props.selected }">
                {{ props.row.votaron }}
              </q-td>
            </template>
            <template v-slot:body-cell-no_votaron="props">
              <q-td :props="props" :class="{ 'highlight-row': props.selected }">
                {{ props.row.no_votaron }}
              </q-td>
            </template>
            <template v-slot:body-cell-total="props">
              <q-td :props="props" :class="{ 'highlight-row': props.selected }">
                {{ props.row.total }}
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
import socket from 'src/services/websocket';

const mapContainer = ref(null);
const cardsContainer = ref(null);
const VITE_GR_ESTADOS_URL = import.meta.env.VITE_GR_ESTADOS_URL;
const VITE_MP_ESTADOSS_URL = import.meta.env.VITE_MP_ESTADOSS_URL;

const showTable = ref(false);
const estadoData = ref([]);
const estadosData = ref([]);
const selectedRow = ref([]);

let map = null;
let geoJsonLayer = null;

// Columnas para la Q-Table
const columns = [
  {
    name: 'estado',
    required: true,
    label: 'ESTADO',
    align: 'left',
    field: 'estado',
    sortable: true
  },
  {
    name: 'votaron',
    align: 'left',
    label: 'VOTARON',
    field: 'votaron',
    sortable: true
  },
  {
    name: 'no_votaron',
    align: 'left',
    label: 'NO VOTARON',
    field: 'no_votaron',
    sortable: true
  },
  {
    name: 'total',
    align: 'left',
    label: 'TOTAL',
    field: 'total',
    sortable: true
  }
];

// Configuración inicial de paginación
const initialPagination = {
  sortBy: 'total',
  descending: true,
  page: 1,
  rowsPerPage: 0
};

const generateColorScale = () => {
  const colorScale = [];
  const step = 180 / 25;
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
    const response = await axios.get(VITE_MP_ESTADOSS_URL);
    estadosData.value = response.data;
  } catch (error) {
    Notify.create({
      message: "Error al obtener datos de servidores.",
      color: "negative",
      position: "top",
      timeout: 3000,
    });
    estadosData.value = [];
  }
};

// Función para resaltar una fila en la tabla
const highlightStateInTable = async (stateName) => {
  selectedRow.value = [];

  const normalizedStateName = stateName.toLowerCase();
  const stateRow = estadosData.value.find(item =>
    item.estado.toLowerCase() === normalizedStateName
  );

  if (stateRow) {
    selectedRow.value = [stateRow];

    await nextTick();
    await new Promise(resolve => requestAnimationFrame(resolve));

    const tableContainer = document.querySelector('.estados-table .q-table__middle');
    if (tableContainer) {
      const rows = tableContainer.querySelectorAll('tbody tr');
      const index = estadosData.value.indexOf(stateRow);

      if (rows[index]) {
        const rowRect = rows[index].getBoundingClientRect();
        const containerRect = tableContainer.getBoundingClientRect();
        const scrollTop = tableContainer.scrollTop;
        const rowTop = rowRect.top - containerRect.top + scrollTop;
        const rowBottom = rowRect.bottom - containerRect.top + scrollTop;
        const containerHeight = containerRect.height;

        if (rowTop < scrollTop) {
          tableContainer.scrollTo({
            top: rowTop - 10,
            behavior: 'smooth'
          });
        } else if (rowBottom > scrollTop + containerHeight) {
          tableContainer.scrollTo({
            top: rowBottom - containerHeight + 10,
            behavior: 'smooth'
          });
        }
      }
    }
  }
};

// Función para cargar los datos del mapa
const fetchEstadoData = async () => {
  try {
    const response = await axios.get(VITE_MP_ESTADOSS_URL);

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
  if (map) {
    map.remove();
    map = null;
  }

  map = L.map(mapContainer.value).setView([8.0, -66.0], 5);

  // Control de reinicio
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

  // Título del mapa
  const titleControl = L.control({ position: 'topleft' });
  titleControl.onAdd = () => {
    const container = L.DomUtil.create('div', 'map-title-container');
    container.innerHTML = `
      <div class="map-title">
        <strong>MOVILIZACIÓN DE SERVIDORES</strong>
      </div>
    `;
    return container;
  };
  map.addControl(titleControl);

  // Ocultar controles
  const attributionControl = map.getContainer().querySelector('.leaflet-control-attribution');
  if (attributionControl) {
    attributionControl.style.display = 'none';
  }

  const zoomControl = map.getContainer().querySelector('.leaflet-control');
  if (zoomControl) {
    zoomControl.style.display = 'none';
  }
};

// Función para actualizar el mapa
const updateMap = async () => {
  estadoData.value = await fetchEstadoData();
  const estadoMap = estadoData.value.reduce((acc, item) => {
    acc[item.estado.toLowerCase().replace(/ /g, '')] = item.votaron;
    return acc;
  }, {});
  const maxEstadoValue = Math.max(...estadoData.value.map(item => item.votaron || 0)) || 1;

  if (geoJsonLayer) {
    map.removeLayer(geoJsonLayer);
  }

  geoJsonLayer = L.geoJSON(venezuelaGeoJsonData, {
    style(feature) {
      const normalizedEstado = feature.properties.name.toLowerCase().replace(/ /g, '');
      const votaron = estadoMap[normalizedEstado] || 0;
      const normalizedValue = Math.min(votaron / maxEstadoValue, 1);
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
      const votaron = estadoMap[normalizedEstado] || 0;
      const normalizedValue = Math.min(votaron / maxEstadoValue, 1);
      const colorIndex = Math.floor(normalizedValue * 25);
      const fillColor = colorScale[colorIndex] || colorScale[0];

      layer.bindTooltip(`${feature.properties.name} votaron: ${votaron} Servidores Públicos`);
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
        highlightStateInTable(feature.properties.name);
        showTable.value = true;
      });
    }
  }).addTo(map);
};

const getSelectedString = () => {
  return selectedRow.value.length === 0 ? '' : `${selectedRow.value.length} fila seleccionada`;
};

onMounted(async () => {
  initializeMap();
  await updateMap();
  await fetchEstadosTableData();
  showTable.value = true;

  socket.onmessage = async () => {
    await updateMap();
    await fetchEstadosTableData();
  };
});

onUnmounted(() => {
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

.cards-container {
  position: absolute;
  top: 0;
  left: 55%;
  width: 45%;
  max-height: 100%;
  overflow-y: auto;
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
  }
}

.estados-table {
  width: 100%;
}

.highlight-row {
  background-color: rgba(0, 0, 255, 0.1) !important;
  font-weight: bold;
}

.map-title-container {
  text-align: center;
  width: 100%;
  pointer-events: none;
}

.map-title {
  display: inline-block;
  margin: 10px auto;
  padding: 8px 15px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 4px;
  box-shadow: 0 1px 5px rgba(0,0,0,0.2);
  font-weight: bold;
  font-size: 1.2rem;
  color: #1976D2;
  border: 1px solid #ddd;
  text-align: center;
}

.leaflet-control {
  margin: 0 !important;
}

.leaflet-top.leaflet-center {
  width: 100%;
  pointer-events: none;
}

.estados-table .q-table__middle {
  max-height: 60vh;
  overflow-y: auto;
}
</style>
