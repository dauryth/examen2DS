import { onUnmounted, ref } from 'vue';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Network } from '@capacitor/network';

export function useConexion() {
  const conectado = ref(true);
  const tipo = ref('unknown');
  let cancelado = false;
  let recibioCambio = false;
  let quitarListener: (() => Promise<void>) | undefined;

  void Network.getStatus().then((estado) => {
    if (!cancelado && !recibioCambio) {
      conectado.value = estado.connected;
      tipo.value = estado.connectionType;
    }
  }).catch((error: unknown) => console.error('No fue posible consultar la conexión de red.', error));

  void Network.addListener('networkStatusChange', (estado) => {
    recibioCambio = true;
    conectado.value = estado.connected;
    tipo.value = estado.connectionType;
  }).then((listener) => {
    if (cancelado) {
      void listener.remove().catch((error: unknown) => console.error('No fue posible liberar el listener de red.', error));
    }
    else quitarListener = () => listener.remove();
  }).catch((error: unknown) => console.error('No fue posible escuchar cambios de conexión.', error));

  onUnmounted(() => {
    cancelado = true;
    if (quitarListener) {
      void quitarListener().catch((error: unknown) => console.error('No fue posible liberar el listener de red.', error));
    }
  });

  return { conectado, tipo };
}

export async function vibrar() {
  if (!Capacitor.isNativePlatform()) return;
  await Haptics.impact({ style: ImpactStyle.Light });
}
