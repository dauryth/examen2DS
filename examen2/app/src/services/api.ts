import { ErrorApi } from './errores';
import { obtenerToken, olvidarSesion } from '@/composables/useAuth';
import router from '@/router';

const BASE_URL = import.meta.env.VITE_API_URL;
const TIEMPO_MAXIMO_MS = 10_000;

export interface OpcionesApi {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | undefined>;
}

export async function api<T = unknown>(ruta: string, opciones: OpcionesApi = {}): Promise<T> {
  const url = new URL(`${BASE_URL.replace(/\/+$/, '')}/${ruta.replace(/^\/+/, '')}`);
  for (const [clave, valor] of Object.entries(opciones.params ?? {})) {
    if (valor !== undefined && valor !== '') url.searchParams.set(clave, String(valor));
  }

  const encabezados = new Headers({ Accept: 'application/json' });
  const token = obtenerToken();
  if (token) encabezados.set('Authorization', `Bearer ${token}`);

  const cuerpo = opciones.body === undefined ? undefined : JSON.stringify(opciones.body);
  if (cuerpo !== undefined) encabezados.set('Content-Type', 'application/json');

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_MS);

  try {
    const respuesta = await fetch(url, {
      method: opciones.method ?? 'GET',
      headers: encabezados,
      body: cuerpo,
      signal: controlador.signal,
    });

    if (respuesta.status === 204) return null as T;

    const texto = await respuesta.text();
    let cuerpoRespuesta: unknown = null;
    if (texto) {
      try {
        cuerpoRespuesta = JSON.parse(texto);
      } catch {
        cuerpoRespuesta = texto;
      }
    }

    if (!respuesta.ok) {
      if (respuesta.status === 401 && !/\/login\/?$/.test(new URL(ruta, url).pathname)) {
        try {
          await olvidarSesion();
        } catch (error) {
          console.error('No fue posible limpiar la sesión segura después de un 401.', error);
        } finally {
          await router.replace('/login');
        }
      }
      throw new ErrorApi(respuesta.status, cuerpoRespuesta);
    }

    return cuerpoRespuesta as T;
  } catch (error) {
    if (error instanceof ErrorApi) throw error;
    throw new ErrorApi(0, { mensaje: 'No fue posible conectar con la API.' });
  } finally {
    clearTimeout(temporizador);
  }
}
