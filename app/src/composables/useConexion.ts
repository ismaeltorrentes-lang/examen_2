import { ref, onUnmounted } from 'vue';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * useConexion() — M7.
 *  - Valor inicial con Network.getStatus().
 *  - Se actualiza solo con Network.addListener('networkStatusChange', ...).
 *  - El oyente se libera (handle.remove()) en onUnmounted.
 * Las páginas Equipos y Formulario ya muestran el aviso "Sin conexión" y
 * deshabilitan Guardar con `conectado`.
 */
export function useConexion() {
  // Partimos en "conectado/unknown" y el estado real llega enseguida con getStatus().
  const conectado = ref(true);
  const tipo = ref<string>('unknown');

  // 1. Estado inicial.
  void Network.getStatus()
    .then((estado) => {
      conectado.value = estado.connected;
      tipo.value = estado.connectionType;
    })
    .catch(() => {
      /* sin plugin (navegador sin implementar): se queda en el valor por defecto */
    });

  // 2. Oyente de cambios. El handle llega como promesa, así que guardamos el que
  //    devuelva y, si el componente ya se desmontó antes, lo liberamos de inmediato.
  let handle: PluginListenerHandle | null = null;
  let desmontado = false;

  void Network.addListener('networkStatusChange', (estado) => {
    conectado.value = estado.connected;
    tipo.value = estado.connectionType;
  })
    .then((h) => {
      if (desmontado) void h.remove();
      else handle = h;
    })
    .catch(() => {
      /* no hay plugin de red: la app sigue funcionando sin el aviso */
    });

  // 3. Liberar el oyente al desmontar la página que lo usa (evita fugas).
  onUnmounted(() => {
    desmontado = true;
    if (handle) {
      void handle.remove();
      handle = null;
    }
  });

  return { conectado, tipo };
}

/**
 * vibrar() — M7: vibración breve de confirmación con
 * Haptics.impact({ style: ImpactStyle.Light }). En el navegador NO hace nada
 * (Capacitor.isNativePlatform()). Se llama después de guardar y de eliminar con éxito.
 */
export async function vibrar() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* dispositivo sin vibrador: nunca debe romper el flujo de la app */
  }
}
