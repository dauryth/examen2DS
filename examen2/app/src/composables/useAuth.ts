import { computed, ref } from 'vue';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { api } from '@/services/api';

export interface Usuario { id: number; nombre: string }

const CLAVE_TOKEN = 'token';
const CLAVE_USUARIO = 'usuario';

// Estado compartido por toda la app (fuera de la función = un solo valor) — YA IMPLEMENTADO
const token = ref<string | null>(null);
const usuario = ref<Usuario | null>(null);
let tokenCargado = false;
let cargaSesion: Promise<void> | null = null;

/** YA IMPLEMENTADO — lo usa services/api.ts para armar el encabezado Authorization. */
export const obtenerToken = () => token.value;

export async function olvidarSesion() {
  token.value = null;
  usuario.value = null;
  tokenCargado = true;

  if (!Capacitor.isNativePlatform()) return;

  const resultados = await Promise.allSettled([
    SecureStorage.remove(CLAVE_TOKEN),
    SecureStorage.remove(CLAVE_USUARIO),
  ]);
  const fallo = resultados.find((resultado) => resultado.status === 'rejected');
  if (fallo?.status === 'rejected') throw fallo.reason;
}

export function useAuth() {
  const estaAutenticado = computed(() => token.value !== null);

  async function login(email: string, password: string) {
    const dispositivo = await Device.getInfo();
    const device_name = `${dispositivo.platform} ${dispositivo.model}`.slice(0, 60);
    const respuesta = await api<{ token: string; usuario: Usuario }>('/login', {
      method: 'POST',
      body: { email, password, device_name },
    });

    if (Capacitor.isNativePlatform()) {
      await SecureStorage.set(CLAVE_TOKEN, respuesta.token);
      await SecureStorage.set(CLAVE_USUARIO, { ...respuesta.usuario });
    }
    token.value = respuesta.token;
    usuario.value = respuesta.usuario;
    tokenCargado = true;
  }

  async function cargarToken() {
    if (tokenCargado) return;
    if (!Capacitor.isNativePlatform()) {
      tokenCargado = true;
      return;
    }
    if (!cargaSesion) {
      cargaSesion = (async () => {
        try {
          const tokenGuardado = await SecureStorage.get(CLAVE_TOKEN);
          const usuarioGuardado = await SecureStorage.get(CLAVE_USUARIO);
          if (
            typeof tokenGuardado === 'string' &&
            usuarioGuardado !== null &&
            typeof usuarioGuardado === 'object' &&
            'id' in usuarioGuardado &&
            typeof usuarioGuardado.id === 'number' &&
            'nombre' in usuarioGuardado &&
            typeof usuarioGuardado.nombre === 'string'
          ) {
            token.value = tokenGuardado;
            usuario.value = { id: usuarioGuardado.id, nombre: usuarioGuardado.nombre };
          } else {
            await olvidarSesion();
          }
        } finally {
          tokenCargado = true;
          cargaSesion = null;
        }
      })();
    }
    await cargaSesion;
  }

  async function cerrarSesion() {
    try {
      if (token.value) await api<null>('/logout', { method: 'POST' });
    } finally {
      await olvidarSesion();
    }
  }

  return { usuario, estaAutenticado, login, cargarToken, cerrarSesion };
}
