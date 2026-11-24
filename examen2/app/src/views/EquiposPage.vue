<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Equipos</ion-title>
        <ion-buttons slot="end">
          <ion-button router-link="/tabs/equipos/nuevo" aria-label="Nuevo equipo">
            <ion-icon slot="icon-only" :icon="add" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar v-model="q" :debounce="400" placeholder="Buscar por código o nombre" @ion-input="buscar" />
      </ion-toolbar>
      <!-- YA IMPLEMENTADO: depende de useConexion() [M7] -->
      <ion-toolbar v-if="!conectado" color="warning">
        <ion-title size="small">Sin conexión: los datos pueden estar desactualizados</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="refrescar">
        <ion-refresher-content pulling-text="Deslice para actualizar" refreshing-text="Actualizando..." />
      </ion-refresher>

      <ion-list v-if="equipos.length">
        <ion-item-sliding v-for="equipo in equipos" :key="equipo.id">
          <ion-item :router-link="`/tabs/equipos/${equipo.id}/editar`" detail>
            <ion-label>
              <h2>{{ equipo.nombre }}</h2>
              <p>{{ equipo.codigo }} · {{ equipo.categoria.nombre }}</p>
            </ion-label>
            <ion-badge slot="end" :color="colorEstado[equipo.estado]">{{ equipo.estado }}</ion-badge>
          </ion-item>
          <ion-item-options side="end">
            <ion-item-option color="danger" @click="confirmarEliminacion(equipo, $event)">
              <ion-icon slot="start" :icon="trashOutline" />
              Eliminar
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>

      <ion-list v-else-if="cargando && !error">
        <ion-item v-for="n in 5" :key="n">
          <ion-label>
            <ion-skeleton-text :animated="true" style="width: 55%" />
            <ion-skeleton-text :animated="true" style="width: 35%" />
          </ion-label>
        </ion-item>
      </ion-list>

      <div v-if="error" class="ion-padding estado-vacio" role="alert">
        <ion-icon :icon="cloudOfflineOutline" aria-hidden="true" />
        <p>{{ error }}</p>
        <ion-button @click="cargar(true)">Reintentar</ion-button>
      </div>

      <div v-else-if="!cargando && equipos.length === 0" class="estado-vacio">
        <ion-icon :icon="searchOutline" aria-hidden="true" />
        <p>No hay equipos que mostrar.</p>
      </div>

      <ion-infinite-scroll :disabled="!hayMas || cargando" @ionInfinite="cargarMas">
        <ion-infinite-scroll-content loading-text="Cargando más equipos..." />
      </ion-infinite-scroll>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonSearchbar, IonContent,
  IonRefresher, IonRefresherContent, IonList, IonItem, IonLabel, IonSkeletonText, IonBadge,
  IonItemSliding, IonItemOptions, IonItemOption, IonInfiniteScroll, IonInfiniteScrollContent,
  alertController, onIonViewWillEnter,
} from '@ionic/vue';
import type { InfiniteScrollCustomEvent, RefresherCustomEvent } from '@ionic/vue';
import { add, cloudOfflineOutline, searchOutline, trashOutline } from 'ionicons/icons';
import { eliminar, listar, type Equipo, type Estado } from '@/services/equipos';
import { ErrorApi } from '@/services/errores';
import { mostrarToast } from '@/services/avisos';
import { useConexion, vibrar } from '@/composables/useConexion';

const colorEstado: Record<Estado, string> = { disponible: 'success', prestado: 'warning', mantenimiento: 'medium' };

const { conectado } = useConexion();

const equipos = ref<Equipo[]>([]);
const pagina = ref(0);
const ultimaPagina = ref(1);
const q = ref('');
const cargando = ref(false);
const error = ref('');
const hayMas = computed(() => pagina.value < ultimaPagina.value);

async function cargar(reiniciar = false) {
  if (cargando.value) return;
  cargando.value = true;
  error.value = '';
  const numeroPagina = reiniciar ? 1 : pagina.value + 1;
  try {
    const resultado = await listar(numeroPagina, q.value);
    equipos.value = reiniciar ? resultado.data : [...equipos.value, ...resultado.data];
    pagina.value = resultado.meta.current_page;
    ultimaPagina.value = resultado.meta.last_page;
  } catch {
    error.value = 'No fue posible cargar los equipos.';
  } finally {
    cargando.value = false;
  }
}

onIonViewWillEnter(() => cargar(true));

const buscar = () => {
  pagina.value = 0;
  return cargar(true);
};

async function refrescar(evento: RefresherCustomEvent) {
  try {
    await cargar(true);
  } finally {
    await evento.target.complete();
  }
}

async function cargarMas(evento: InfiniteScrollCustomEvent) {
  try {
    if (hayMas.value) await cargar(false);
  } finally {
    await evento.target.complete();
  }
}

async function confirmarEliminacion(equipo: Equipo, evento: Event) {
  const elemento = evento.currentTarget as HTMLElement;
  const sliding = elemento.closest('ion-item-sliding') as HTMLIonItemSlidingElement | null;
  await sliding?.close();

  const alerta = await alertController.create({
    header: 'Eliminar equipo',
    message: `¿Desea eliminar ${equipo.nombre}?`,
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Eliminar', role: 'destructive' },
    ],
  });
  await alerta.present();
  const { role } = await alerta.onDidDismiss();
  if (role !== 'destructive') return;

  try {
    await eliminar(equipo.id);
    equipos.value = equipos.value.filter((actual) => actual.id !== equipo.id);
    await vibrar();
    await mostrarToast('Equipo eliminado correctamente.', 'success');
  } catch (error) {
    if (error instanceof ErrorApi && error.status === 409) {
      await mostrarToast(error.message, 'warning');
    } else if (error instanceof ErrorApi && error.status === 404) {
      equipos.value = equipos.value.filter((actual) => actual.id !== equipo.id);
      await mostrarToast('El equipo ya no existe.', 'warning');
    } else {
      await mostrarToast('No fue posible eliminar el equipo.', 'danger');
    }
  }
}
</script>
