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

      <!-- M4: listado · M6: cada ítem con deslizar para eliminar -->
      <ion-list v-else>
        <ion-item-sliding v-for="equipo in equipos" :key="equipo.id">
          <ion-item :router-link="`/tabs/equipos/${equipo.id}/editar`">
            <ion-label>
              <h2>{{ equipo.nombre }}</h2>
              <p>{{ equipo.codigo }} · {{ equipo.categoria.nombre }}</p>
            </ion-label>
            <ion-badge slot="end" :color="colorEstado[equipo.estado]">{{ equipo.estado }}</ion-badge>
          </ion-item>

          <!-- M6: opción que se despliega al deslizar el ítem hacia la izquierda -->
          <ion-item-options side="end">
            <ion-item-option color="danger" @click="confirmarEliminacion(equipo, $event)">
              <ion-icon slot="icon-only" :icon="trashOutline" aria-hidden="true" />
              Eliminar
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
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
 * confirmarEliminacion(equipo, evento) — M6.
 *  1. Cierra el ion-item-sliding (desde el elemento que recibió el clic).
 *  2. alertController con botones 'cancel' y 'destructive'; el role se lee con onDidDismiss().
 *  3. eliminar(equipo.id):
 *       204 → quita el equipo de la lista (sin recargar todo), vibrar() y toast de éxito.
 *       409 → toast con el mensaje de la API (regla R1); el equipo permanece en la lista.
 *       404 → lo quita de la lista y avisa que ya no existe.
 */
async function confirmarEliminacion(equipo: Equipo, evento: Event) {
  // 1. Cerrar el sliding antes de abrir el alert.
  const sliding = (evento.currentTarget as HTMLElement | null)?.closest('ion-item-sliding');
  if (sliding) await (sliding as HTMLIonItemSlidingElement).close();

  // 2. Confirmación con roles.
  const alert = await alertController.create({
    header: 'Eliminar equipo',
    message: `¿Desea eliminar "${equipo.nombre}" (${equipo.codigo})?`,
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Eliminar', role: 'destructive' },
    ],
  });
  await alert.present();
  const { role } = await alert.onDidDismiss();
  if (role !== 'destructive') return;

  // 3. Borrar en la API.
  try {
    await eliminar(equipo.id);
    quitarDeLaLista(equipo.id);   // 204: sin recargar todo
    await vibrar();
    mostrarToast('Equipo eliminado.', 'success');
  } catch (e) {
    if (e instanceof ErrorApi && e.status === 409) {
      // Regla R1 (equipo prestado): el mensaje lo manda la API y el ítem permanece.
      mostrarToast(e.message, 'warning');
    } else if (e instanceof ErrorApi && e.status === 404) {
      // Ya no existe: sacarlo de la lista y avisar.
      quitarDeLaLista(equipo.id);
      mostrarToast('El equipo ya no existe.', 'warning');
    } else if (e instanceof ErrorApi && e.status === 401) {
      // api.ts ya olvidó la sesión y navegó a /login.
    } else {
      mostrarToast('No fue posible eliminar el equipo.', 'danger');
    }
  }
}

/** M6: quita un equipo de la lista en memoria, sin volver a pedir la página. */
function quitarDeLaLista(id: number) {
  const antes = equipos.value.length;
  equipos.value = equipos.value.filter((e) => e.id !== id);
  // Si se borró el último de la página y había más, recargamos la actual para no dejar un hueco.
  if (equipos.value.length === antes - 1 && equipos.value.length === 0 && hayMas.value) void cargar(true);
}
</script>
