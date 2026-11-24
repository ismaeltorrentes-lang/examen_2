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
      <!-- M4: refresher que vuelve a la página 1 -->
      <ion-refresher slot="fixed" @ionRefresh="refrescar">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- M4: primera carga → esqueleto (no un spinner a pantalla completa) -->
      <div v-if="cargando && equipos.length === 0" class="ion-padding" aria-busy="true">
        <ion-skeleton-text :animated="true" style="width: 60%"></ion-skeleton-text>
        <ion-skeleton-text :animated="true" style="width: 85%"></ion-skeleton-text>
        <ion-skeleton-text :animated="true" style="width: 75%"></ion-skeleton-text>
        <ion-skeleton-text :animated="true" style="width: 80%"></ion-skeleton-text>
      </div>

      <!-- M4: falló la carga → mensaje + Reintentar -->
      <div v-else-if="error" class="estado-vacio">
        <ion-icon :icon="cloudOfflineOutline" aria-hidden="true" />
        <p>{{ error }}</p>
        <ion-button class="ion-margin-top" @click="cargar(true)">Reintentar</ion-button>
      </div>

      <!-- M4: sin resultados -->
      <div v-else-if="equipos.length === 0" class="estado-vacio">
        <ion-icon :icon="searchOutline" aria-hidden="true" />
        <p>No se encontraron equipos.</p>
      </div>

      <!-- M4: listado -->
      <ion-list v-else>
        <ion-item v-for="equipo in equipos" :key="equipo.id"
          :router-link="`/tabs/equipos/${equipo.id}/editar`">
          <ion-label>
            <h2>{{ equipo.nombre }}</h2>
            <p>{{ equipo.codigo }} · {{ equipo.categoria.nombre }}</p>
          </ion-label>
          <ion-badge slot="end" :color="colorEstado[equipo.estado]">{{ equipo.estado }}</ion-badge>
        </ion-item>
      </ion-list>

      <!-- M4: siguiente página; se apaga cuando current_page === last_page -->
      <ion-infinite-scroll @ionInfinite="cargarMas" :disabled="!hayMas">
        <ion-infinite-scroll-content></ion-infinite-scroll-content>
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

// Importaciones que aún no se usan en el template (se usan en M6)
void [IonItemSliding, IonItemOptions, IonItemOption, trashOutline];

const colorEstado: Record<Estado, string> = { disponible: 'success', prestado: 'warning', mantenimiento: 'medium' };

const { conectado } = useConexion();

const equipos = ref<Equipo[]>([]);
const pagina = ref(0);
const ultimaPagina = ref(1);
const q = ref('');
const cargando = ref(false);
const error = ref('');
const hayMas = computed(() => pagina.value < ultimaPagina.value);

/**
 * cargar(reiniciar) — M4.
 *  - reiniciar = true  → pide la página 1 y REEMPLAZA la lista.
 *  - reiniciar = false → pide la página siguiente y la AGREGA al final.
 *  - Usa listar(pagina, q) de services/equipos.ts y actualiza pagina/ultimaPagina con meta.
 *  - Maneja cargando y error (un 401 ya lo resuelve api.ts).
 */
async function cargar(reiniciar = false) {
  cargando.value = true;
  error.value = '';
  try {
    const numeroPagina = reiniciar ? 1 : pagina.value + 1;
    const respuesta = await listar(numeroPagina, q.value);
    equipos.value = reiniciar
      ? respuesta.data
      : [...equipos.value, ...respuesta.data];
    pagina.value = respuesta.meta.current_page;
    ultimaPagina.value = respuesta.meta.last_page;
  } catch (e) {
    // En un 401 api.ts ya olvidó la sesión y navegó a /login: no hay nada que avisar.
    if (e instanceof ErrorApi && e.status === 401) return;
    error.value = e instanceof ErrorApi ? e.message : 'No fue posible cargar los equipos.';
  } finally {
    cargando.value = false;
  }
}

// M4: recargar CADA VEZ que se vuelve a esta página (p. ej. al regresar del formulario).
// onIonViewWillEnter, no onMounted: Ionic mantiene la vista viva al navegar de vuelta.
onIonViewWillEnter(() => {
  void cargar(true);
});

const buscar = () => cargar(true);

/** M4: recarga desde la página 1 y cierra el refresher siempre, aunque falle. */
async function refrescar(evento: RefresherCustomEvent) {
  try {
    await cargar(true);
  } finally {
    evento.target.complete();
  }
}

/** M4: carga la siguiente página y cierra el infinite scroll siempre, aunque falle. */
async function cargarMas(evento: InfiniteScrollCustomEvent) {
  try {
    // Guarda contra disparos repetidos mientras una carga está en curso.
    if (!cargando.value && hayMas.value) await cargar(false);
  } finally {
    evento.target.complete();
  }
}

/**
 * TODO [M6] confirmarEliminacion(equipo, evento)
 *  1. Cierre el ion-item-sliding.
 *  2. alertController con dos botones: role 'cancel' y role 'destructive'.
 *     Lea el role con onDidDismiss(); si no es 'destructive', no haga nada.
 *  3. eliminar(equipo.id):
 *       204 → quitar el equipo de la lista (sin recargar todo), vibrar() y toast de éxito.
 *       409 → toast con el mensaje que envía la API (regla R1: equipo prestado). El equipo sigue en la lista.
 *       404 → quitarlo de la lista y avisar que ya no existe.
 */
async function confirmarEliminacion(equipo: Equipo, evento: Event) {
  void [equipo, evento, alertController, ErrorApi, mostrarToast, vibrar, eliminar];
}

void [confirmarEliminacion]; // M6, aún pendiente
</script>
