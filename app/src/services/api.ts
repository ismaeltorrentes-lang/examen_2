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

/**
 * Cliente HTTP único de la aplicación (M1).
 *
 * api<T>(ruta, { method, body, params }) debe:
 *  1. Construir la URL como BASE_URL + ruta y agregar como query string solo los params
 *     que tengan valor (ni undefined ni '').           ej. api('/equipos', { params: { page: 2, q: '' } })
 *  2. Enviar siempre "Accept: application/json".
 *  3. Si hay token (obtenerToken()), enviar "Authorization: Bearer <token>". Nunca en la URL.
 *  4. Si hay body, enviarlo como JSON ("Content-Type: application/json" + JSON.stringify).
 *  5. Cancelar la petición si tarda más de TIEMPO_MAXIMO_MS (AbortController).
 *     Si fetch falla sin respuesta (sin red, tiempo agotado, CORS), lanzar
 *     new ErrorApi(0, { mensaje: 'No fue posible conectar con la API.' }).
 *  6. Si la respuesta es 204, devolver null.
 *  7. Si response.ok es false, lanzar new ErrorApi(status, cuerpoJson).
 *     Si el estado es 401 (y la ruta no es /login): await olvidarSesion() y router.replace('/login').
 *  8. En cualquier otro caso, devolver el cuerpo JSON.
 */
export async function api<T = unknown>(ruta: string, opciones: OpcionesApi = {}): Promise<T> {
  const { method = 'GET', body, params } = opciones;

  // 1. URL base + solo los parámetros que tengan valor.
  const url = new URL(BASE_URL + ruta);
  for (const [clave, valor] of Object.entries(params ?? {})) {
    if (valor !== undefined && valor !== '') url.searchParams.set(clave, String(valor));
  }

  // 2-4. Encabezados: Accept siempre, Bearer solo si hay token, JSON solo si hay cuerpo.
  const encabezados: Record<string, string> = { Accept: 'application/json' };
  const token = obtenerToken();
  if (token) encabezados.Authorization = `Bearer ${token}`;
  if (body !== undefined) encabezados['Content-Type'] = 'application/json';

  // 5. Tiempo máximo de espera; si fetch rechaza no hubo respuesta (sin red, timeout, CORS).
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIEMPO_MAXIMO_MS);

  let respuesta: Response;
  try {
    respuesta = await fetch(url.toString(), {
      method,
      headers: encabezados,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: control.signal,
    });
  } catch {
    throw new ErrorApi(0, { mensaje: 'No fue posible conectar con la API.' });
  } finally {
    clearTimeout(reloj);
  }

  // 6. Sin contenido.
  if (respuesta.status === 204) return null as T;

  // Cuerpo JSON (vacío o no parseable → null, para poder informar el status igual).
  const texto = await respuesta.text();
  let cuerpo: unknown = null;
  if (texto) {
    try {
      cuerpo = JSON.parse(texto);
    } catch {
      cuerpo = null;
    }
  }

  // 7. Error HTTP: 401 fuera de /login olvida la sesión y vuelve al login.
  if (!respuesta.ok) {
    if (respuesta.status === 401 && ruta !== '/login') {
      await olvidarSesion();
      await router.replace('/login');
    }
    throw new ErrorApi(respuesta.status, cuerpo);
  }

  // 8. Caso feliz.
  return cuerpo as T;
}
