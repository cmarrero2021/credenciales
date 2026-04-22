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
        <q-item clickable v-ripple to="/servers" v-if="hasPermission('view_admin') || hasPermission('read_servidor') || hasPermission('create_servidor')">
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
        <q-item clickable v-ripple to="/credencial" v-if="showCarnets">
          <q-item-section avatar><q-icon name="badge" /></q-item-section>
          <q-item-section>Carnets</q-item-section>
        </q-item>
        <q-item clickable v-ripple :to="credencialManageLink" v-if="hasPermission('view_admin') || hasPermission('view_admin1') || hasPermission('update_historico')">
          <q-item-section avatar><q-icon name="badge" /></q-item-section>
          <q-item-section>Gestión Carnets</q-item-section>
        </q-item>
        <q-item clickable v-ripple to="/admin/users" v-if="hasPermission('list_users') || hasPermission('view_admin')">
          <q-item-section avatar><q-icon name="supervisor_account" /></q-item-section>
          <q-item-section>Gestión Usuarios</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>
    <q-page-container>
      <router-view :key="$route.fullPath" />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRouter } from 'vue-router'
import { LocalStorage, Notify } from 'quasar'
import axios from 'axios'

const leftDrawerOpen = ref(false)
const router = useRouter()
const logoutUrl = import.meta.env.VITE_LOGOUT_URL

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value
}

function colapsarDrawer() {
  if (leftDrawerOpen.value) leftDrawerOpen.value = false
}

onMounted(() => {
  window.addEventListener('toggle-drawer', toggleLeftDrawer)
  window.addEventListener('collapse-drawer', colapsarDrawer)
})
onBeforeUnmount(() => {
  window.removeEventListener('toggle-drawer', toggleLeftDrawer)
  window.removeEventListener('collapse-drawer', colapsarDrawer)
})

function navigate(path) {
  try {
    router.push(path).catch(() => {})
  } catch (e) {
    // ignore
  }
  // keep the drawer open per user request
}

function hasPermission(permissionName) {
  function hasPermissionName(rawPerms, permissionName){
    if (!rawPerms) return false
    if (Array.isArray(rawPerms)){
      return rawPerms.some(p => {
        if (!p) return false
        if (typeof p === 'string') return p === permissionName
        if (typeof p === 'object') return (p.name === permissionName) || (p.permission_name === permissionName) || (p.permission === permissionName) || (p.key === permissionName)
        return false
      })
    }
    if (typeof rawPerms === 'object'){
      if (rawPerms[permissionName]) return true
      return Object.values(rawPerms).some(v => hasPermissionName(v, permissionName))
    }
    if (typeof rawPerms === 'string'){
      if (rawPerms.includes(',')){
        return rawPerms.split(',').map(s => s.trim()).some(s => s === permissionName)
      }
      return rawPerms === permissionName
    }
    return false
  }

  const permsA = LocalStorage.getItem('permissions')
  const permsB = LocalStorage.getItem('userPermissions')
  if (hasPermissionName(permsA, permissionName)) return true
  if (hasPermissionName(permsB, permissionName)) return true
  return false
}

const credencialManageLink = computed(() => {
  // Admins go to full management; RRHH go to the dedicated RRHH carnets page
  if (hasPermission('view_admin')) return '/credencial/manage'
  if (hasPermission('update_historico')) return '/credencial/rrhh-carnets'
  if (hasPermission('read_credencial') || hasPermission('print_credencial')) return '/credencial'
  return '/'
})

const showCarnets = computed(() => {
  const isAdmin = hasPermission('view_admin') || hasPermission('view_admin1')
  const canPrint = hasPermission('print_credencial')
  const isRRHH = hasPermission('update_historico')
  // If the user is RRHH (can update historico) and is not admin, hide the search module regardless of print permission
  if (isRRHH && !isAdmin) return false
  return isAdmin || canPrint
})

async function logout() {
  try {
    const token = LocalStorage.getItem('token')
    await axios.post(logoutUrl, {}, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    Notify.create({ message: 'Sesión cerrada correctamente', color: 'positive' })
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
