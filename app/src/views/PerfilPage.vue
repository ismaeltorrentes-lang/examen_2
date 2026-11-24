<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Perfil</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-list>
        <ion-list-header>Sesión</ion-list-header>
        <ion-item>
          <ion-icon slot="start" :icon="personCircleOutline" aria-hidden="true" />
          <ion-label>{{ usuario?.nombre ?? '—' }}</ion-label>
        </ion-item>

        <!-- M7: información del dispositivo y de la red -->
        <ion-list-header>Dispositivo</ion-list-header>

        <ion-item>
          <ion-icon slot="start" :icon="hardwareChipOutline" aria-hidden="true" />
          <ion-label>Plataforma</ion-label>
          <ion-note slot="end">{{ plataforma }}</ion-note>
        </ion-item>

        <ion-item>
          <ion-icon slot="start" :icon="phonePortraitOutline" aria-hidden="true" />
          <ion-label>Modelo</ion-label>
          <ion-note slot="end">{{ dispositivo?.model ?? '—' }}</ion-note>
        </ion-item>

        <ion-item>
          <ion-icon slot="start" :icon="settingsOutline" aria-hidden="true" />
          <ion-label>Sistema</ion-label>
          <ion-note slot="end">
            {{ dispositivo ? `${dispositivo.operatingSystem} ${dispositivo.osVersion}` : '—' }}
          </ion-note>
        </ion-item>

        <ion-item>
          <ion-icon slot="start" :icon="wifiOutline" aria-hidden="true" />
          <ion-label>Conexión</ion-label>
          <ion-badge slot="end" :color="conectado ? 'success' : 'danger'">
            {{ conectado ? tipo : 'sin conexión' }}
          </ion-badge>
        </ion-item>
      </ion-list>

      <div class="ion-padding">
        <ion-button expand="block" color="danger" fill="outline" @click="salir">Cerrar sesión</ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonListHeader, IonItem, IonIcon,
  IonLabel, IonNote, IonBadge, IonButton, onIonViewWillEnter, useIonRouter,
} from '@ionic/vue';
import { personCircleOutline, hardwareChipOutline, phonePortraitOutline, settingsOutline, wifiOutline } from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { Device, type DeviceInfo } from '@capacitor/device';
import { useAuth } from '@/composables/useAuth';
import { useConexion } from '@/composables/useConexion';

const { usuario, cerrarSesion } = useAuth();
const { conectado, tipo } = useConexion();
const ionRouter = useIonRouter();

// M7: plataforma fija (web/android/ios) e info del dispositivo cargada al entrar.
const plataforma = Capacitor.getPlatform();
const dispositivo = ref<DeviceInfo | null>(null);

onIonViewWillEnter(async () => {
  try {
    dispositivo.value = await Device.getInfo();
  } catch {
    dispositivo.value = null; // plugin no disponible: los datos quedan en "—"
  }
});

async function salir() {
  await cerrarSesion();
  ionRouter.navigate('/login', 'root', 'replace');
}
</script>
