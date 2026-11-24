import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import TabsPage from '@/views/TabsPage.vue';
import { useAuth } from '@/composables/useAuth';

// YA IMPLEMENTADO — rutas. Equipos y Perfil son pestañas con pilas independientes.
const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/tabs/equipos' },
  { path: '/login', component: () => import('@/views/LoginPage.vue'), meta: { soloInvitados: true } },
  {
    path: '/tabs/',
    component: TabsPage,
    meta: { requiereSesion: true },
    children: [
      { path: '', redirect: '/tabs/equipos' },
      { path: 'equipos', component: () => import('@/views/EquiposPage.vue') },
      { path: 'equipos/nuevo', component: () => import('@/views/EquipoFormPage.vue') },
      { path: 'equipos/:id/editar', component: () => import('@/views/EquipoFormPage.vue'), props: true },
      { path: 'perfil', component: () => import('@/views/PerfilPage.vue') },
    ],
  },
];

const router = createRouter({ history: createWebHistory(import.meta.env.BASE_URL), routes });

router.beforeEach(async (to) => {
  const auth = useAuth();
  await auth.cargarToken();
  const requiereSesion = to.matched.some((ruta) => ruta.meta.requiereSesion === true);
  const soloInvitados = to.matched.some((ruta) => ruta.meta.soloInvitados === true);

  if (requiereSesion && !auth.estaAutenticado.value) return '/login';
  if (soloInvitados && auth.estaAutenticado.value) return '/tabs/equipos';
});

export default router;
