<template>
  <div>
    <q-input v-model="cedula" label="Buscar por cédula" @keyup.enter="buscarTrabajador" class="q-mb-md" />
  <q-btn label="Buscar" color="primary" @click="buscarTrabajador" class="q-mb-lg" />
  <q-btn v-if="trabajador" label="Imprimir" color="secondary" @click="imprimirCredencial" class="q-mb-lg" />
    <div v-if="trabajador" class="credencial-preview">
      <img :src="fondoUrl" class="fondo-img" alt="Fondo carnet" />
  <img :src="getFotoUrl(trabajador.foto_url)" class="foto-trabajador" alt="Foto trabajador" />
  <div class="nombre">{{ trabajador.nombres }} {{ trabajador.apellidos }}</div>
  <div class="cargo">{{ trabajador.cargo }}</div>
  <div class="cedula">{{ trabajador.cedula }}</div>
    </div>
  </div>
</template>
<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
const imprimiendo = ref(false)

function ocultarElementos() {
  imprimiendo.value = true
  document.body.classList.add('solo-credencial')
}
function restaurarElementos() {
  imprimiendo.value = false
  document.body.classList.remove('solo-credencial')
}
function imprimirCredencial() {
  ocultarElementos()
  setTimeout(() => {
    window.print()
  }, 10000)
}
onMounted(() => {
  window.addEventListener('afterprint', restaurarElementos)
})
onBeforeUnmount(() => {
  window.removeEventListener('afterprint', restaurarElementos)
})
const backendBase = 'http://localhost:3001'
function getFotoUrl(url) {
  if (!url) return ''
  if (url.startsWith('/uploads') || url.startsWith('/img')) {
    return backendBase + url
  }
  return url
}
import { ref } from 'vue'
import axios from 'axios'
const cedula = ref('')
const trabajador = ref(null)
const fondoUrl = '/img/frontal_carnet.png'
const apiBase = import.meta.env.VITE_API_URL || ''
const buscarTrabajador = async () => {
  if (!cedula.value) return
  try {
    const res = await axios.get(`${apiBase}/auth/credencial/${cedula.value}`)
    trabajador.value = res.data
  } catch (err) {
    trabajador.value = null
  }
}
</script>
<style scoped>
.credencial-preview {
  width: 55mm;
  height: 85mm;
  position: relative;
  border: 1px solid #ccc;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  background: #fff;
}
@media print {
  body.solo-credencial * {
    display: none !important;
  }
  body.solo-credencial .credencial-preview, body.solo-credencial .credencial-preview * {
    display: block !important;
    visibility: visible !important;
  }
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
  left: 19mm;
  top: 28mm;
  object-fit: cover;
  z-index: 2;
  border-radius: 3mm;
  border: 1px solid #888;
}
.nombre {
  position: absolute;
  top: 50mm;
  left: 0;
  width: 55mm;
  text-align: center;
  font-size: 4mm;
  font-weight: bold;
  z-index: 2;
}
.cedula {
  position: absolute;
  top: 71mm;
  left: 0;
  width: 55mm;
  text-align: center;
  font-size: 4mm;
  z-index: 2;
}
.cargo {
  position: absolute;
  top: 61mm;
  left: 0;
  width: 55mm;
  text-align: center;
  font-size: 4mm;
  z-index: 2;
}
</style>
