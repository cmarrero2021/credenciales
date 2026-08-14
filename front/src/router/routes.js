const routes = [
  {
    path: "/credencial",
    component: () => import("layouts/MainLayout.vue"),
    meta: { requiresAuth: true },
    children: [
      {
        path: "",
        component: () => import("pages/CredencialPage.vue"),
        // Solo los usuarios que puedan imprimir credenciales deberían acceder a este módulo.
        meta: { requiredPermission: 'print_credencial' },
      },
      {
        path: "rrhh-carnets",
        component: () => import("pages/credencial/ManageCarnets.vue"),
        // RRHH necesita poder habilitar/deshabilitar (historico), preferiblemente con el permiso 'update_historico'.
        meta: { requiredPermission: 'update_historico' }
      },
      {
        path: "manage",
        component: () => import("pages/credencial/ManageCarnets.vue"),
        meta: { requiredPermission: 'list_historico' }
      },
    ],
  },
  {
    path: "/admin",
    component: () => import("layouts/MainLayout.vue"),
    meta: { requiresAuth: true },
    children: [
      {
        path: "users",
        component: () => import("pages/admin/ManageUsers.vue"),
        meta: { requiredPermission: 'list_users' }
      }
    ]
  },
  {
    path: "/",
    component: () => import("pages/login/LoginPage.vue"),
    meta: { requiresGuest: true },
  },
  {
    path: "/servers",
    component: () => import("layouts/MainLayout.vue"),
    meta: { requiresAuth: true, requiredPermission: 'read_servidor' },
    children: [
      {
        path: "",
        component: () => import("pages/revistas_private/MantenedorPage.vue"),
      },
    ],
  },
  // DEBUG: ruta temporal para ver la página de Servidores sin autenticación
  {
    path: "/debug_servers",
    component: () => import("layouts/MainLayout.vue"),
    // No requiere auth: solo para depuración local
    children: [
      {
        path: "",
        component: () => import("pages/revistas_private/MantenedorPage.vue"),
      },
    ],
  },
  {
    path: "/massive_servers",
    component: () => import("layouts/MainLayout.vue"),
    meta: { requiresAuth: true },
    children: [
      {
        path: "",
        component: () => import("pages/revistas_private/ServidoresMasivosPage.vue"),
      },
    ],
  },
  {
    path: "/massive_elders",
    component: () => import("layouts/MainLayout.vue"),
    meta: { requiresAuth: true },
    children: [
      {
        path: "",
        component: () => import("pages/revistas_private/AdultosMasivosPage.vue"),
      },
    ],
  },

  // {
  //   path: "/inicio",
  //   component: () => import("layouts/MainLayout.vue"),
  //   meta: { requiresAuth: true },
  //   children: [
  //     {
  //       path: "",
  //       component: () => import("pages/revistas_public/EstadisticasPage.vue"),
  //     },
  //   ],
  // },
  // {
  //   path: "/inicio",
  //   component: () => import("layouts/MainLayout.vue"),
  //   meta: { requiresAuth: true },
  //   children: [
  //     {
  //       path: "",
  //       component: () => import("pages/revistas_private/InicioPage.vue"),
  //     },
  //   ],
  // },
  {
    path: "/catalogos",
    component: () => import("layouts/MainLayout.vue"),
    meta: { requiresAuth: true, requiredPermission: 'view_admin' },
    children: [
      {
        path: "",
        component: () => import("pages/CatalogosPage.vue"),
      },
    ],
  },
  {
    path: "/:catchAll(.*)*",
    component: () => import("pages/login/LoginPage.vue"),
    // meta: { requiresGuest: true },
    // component: () => import("layouts/InitialLayout.vue"),
  },
];

export default routes;
