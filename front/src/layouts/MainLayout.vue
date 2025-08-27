<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-btn dense flat round icon="menu" @click="toggleLeftDrawer" />
        <q-toolbar-title>Gestión de Credenciales MINAAMP</q-toolbar-title>
        <q-space />
        <q-btn flat round dense icon="logout" @click="logout" title="Presione para cerrar la sesión" />
      </q-toolbar>
    </q-header>
    <q-drawer show-if-above v-model="leftDrawerOpen" side="left" elevated>
      <q-list>
        <q-item-label header>Menú Principal</q-item-label>
        <q-item clickable v-ripple to="/inicio" v-if="hasPermission('view_admin1')">
          <q-item-section avatar><q-icon name="home" /></q-item-section>
          <q-item-section>Inicio</q-item-section>
        </q-item>
        <q-item clickable v-ripple to="/servers" v-if="hasPermission('view_admin')">
          <q-item-section avatar><q-icon name="person" /></q-item-section>
          <q-item-section>Servidores</q-item-section>
        </q-item>
        <q-item clickable v-ripple to="/massive_servers" v-if="hasPermission('view_admin1')">
          <q-item-section avatar><q-icon name="people" /></q-item-section>
          <q-item-section>Carga masiva servidores</q-item-section>
        </q-item>
        <q-item clickable v-ripple to="/massive_elders" v-if="hasPermission('view_admin1')">
          <q-item-section avatar><q-icon name="elderly" /></q-item-section>
          <q-item-section>Carga masiva adultos mayores</q-item-section>
        </q-item>
        <q-item clickable v-ripple to="/credencial" v-if="hasPermission('view_admin')">
          <q-item-section avatar><q-icon name="badge" /></q-item-section>
          <q-item-section>Carnets</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
onMounted(() => {
  window.addEventListener('toggle-drawer', toggleLeftDrawer)
})
onBeforeUnmount(() => {
  window.removeEventListener('toggle-drawer', toggleLeftDrawer)
})
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { LocalStorage, Notify } from 'quasar'
import axios from 'axios'

const leftDrawerOpen = ref(false)
const router = useRouter()
const logoutUrl = import.meta.env.VITE_LOGOUT_URL

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value
}

function hasPermission(permissionName) {
  const permissions = LocalStorage.getItem('permissions') || []
  return permissions.some(p => p.name === permissionName)
}

async function logout() {
  try {
    const token = LocalStorage.getItem('token')
    await axios.post(logoutUrl, {}, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    Notify.create({
      message: 'Sesión cerrada correctamente',
      color: 'positive'
    })
  } catch (error) {
    console.error('Error al cerrar sesión:', error)
  } finally {
    LocalStorage.remove('token')
    LocalStorage.remove('permissions')
    router.push('/')
  }
}
</script>

<style>
.image-container {
  width: 100%;
  max-width: 666px;
  height: auto;
  display: flex;
  justify-content: left;
  align-items: left;
}
.responsive-image {
  width: 10%;
  height: auto;
  max-width: 100%;
  max-height: 375px;
}
</style>
