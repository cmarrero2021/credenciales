const routes = [
  {
    path: "/",
        component: () => import("pages/login/LoginPage.vue"),
        meta: { requiresGuest: true },
    // children: [
    //   { path: "", component: () => import("pages/IndexPage.vue") },
    //   {
    //     path: "/revistas",
    //     component: () => import("pages/revistas_public/RevistasPage.vue"),
    //   },
    //   {
    //     path: "/estadisticas",
    //     component: () => import("pages/revistas_public/EstadisticasPage.vue"),
    //   },
    //   {
    //     path: "/login",
    //     component: () => import("pages/login/LoginPage.vue"),
    //     meta: { requiresGuest: true },
    //   },
    // ],
  },
  {
    path: "/servers",
    component: () => import("layouts/MainLayout.vue"),
    meta: { requiresAuth: true },
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

  {
    path: "/inicio",
    component: () => import("layouts/MainLayout.vue"),
    meta: { requiresAuth: true },
    children: [
      {
        path: "",
        component: () => import("pages/revistas_public/EstadisticasPage.vue"),
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
  //       component: () => import("pages/revistas_private/InicioPage.vue"),
  //     },
  //   ],
  // },
  {
    path: "/:catchAll(.*)*",
      component: () => import("pages/login/LoginPage.vue"),
        // meta: { requiresGuest: true },
    // component: () => import("layouts/InitialLayout.vue"),
  },
];

export default routes;
