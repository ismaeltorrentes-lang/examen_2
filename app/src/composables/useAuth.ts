import { computed, ref } from 'vue';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Device } from '@capacitor/device';
import { api } from '@/services/api';

export interface Usuario { id: number; nombre: string }

const CLAVE_TOKEN = 'token';
const CLAVE_USUARIO = 'usuario';

// Estado compartido por toda la app (fuera de la función = un solo valor) — YA IMPLEMENTADO
const token = ref<string | null>(null);
const usuario = ref<Usuario | null>(null);
let tokenCargado = false;

/** YA IMPLEMENTADO — lo usa services/api.ts para armar el encabezado Authorization. */
export const obtenerToken = () => token.value;

/**
 * Sesión segura (M2) — 10 pts en total para este archivo.
 *
 * El token y el usuario se guardan con SecureStorage (@aparajita/capacitor-secure-storage):
 * Keystore en Android, Keychain en iOS.  NO use localStorage ni @capacitor/preferences.
 *   await SecureStorage.set(clave, valor)   ·   await SecureStorage.get(clave)   ·   await SecureStorage.remove(clave)
 */

/** Borrar token y usuario de la memoria (refs) y del almacenamiento cifrado. */
export async function olvidarSesion() {
  token.value = null;
  usuario.value = null;
  // Se borran las dos claves; si alguna falla (p. ej. clave inexistente),
  // la otra igual se elimina y no se lanza error hacia el llamador.
  await Promise.allSettled([
    SecureStorage.remove(CLAVE_TOKEN),
    SecureStorage.remove(CLAVE_USUARIO),
  ]);
}

export function useAuth() {
  const estaAutenticado = computed(() => token.value !== null);

  /**
   * login(email, password) — M2.
   *  1. device_name = `${plataforma} ${modelo}` usando Device.getInfo() (máx. 60 caracteres).
   *  2. POST /login con { email, password, device_name } usando api().
   *     Respuesta 200: { token: "1|abc...", usuario: { id, nombre } }   ·   Error: 422 con errors.email
   *  3. Guardar token y usuario en los refs y en SecureStorage.
   *  No se atrapa el error: LoginPage.vue ya muestra los 422.
   */
  async function login(email: string, password: string) {
    // 1. device_name para la API (Keystore/Keychain no aplican aquí: va en el cuerpo).
    const info = await Device.getInfo();
    const device_name = `${info.platform} ${info.model}`.slice(0, 60);

    // 2. Autenticar. Si responde 422/429, el ErrorApi sube a LoginPage.vue.
    const respuesta = await api<{ token: string; usuario: Usuario }>('/login', {
      method: 'POST',
      body: { email, password, device_name },
    });

    // 3. Persistir primero en SecureStorage y solo entonces activar la sesión en
    //    memoria: si el cifrado fallara, no queda una sesión "a medias".
    await SecureStorage.set(CLAVE_TOKEN, respuesta.token);
    await SecureStorage.set(CLAVE_USUARIO, JSON.stringify(respuesta.usuario));
    token.value = respuesta.token;
    usuario.value = respuesta.usuario;
  }

  /**
   * cargarToken() — M2.
   *  Al abrir la app, recupera token y usuario de SecureStorage y los pone en los refs.
   *  Debe ejecutarse una sola vez (use la bandera tokenCargado).
   */
  async function cargarToken() {
    if (tokenCargado) return;
    tokenCargado = true; // se marca antes de leer: dos navegaciones no deben repetirla
    try {
      const guardado = await SecureStorage.get(CLAVE_TOKEN);
      if (typeof guardado === 'string' && guardado) {
        token.value = guardado;
        const usuarioGuardado = await SecureStorage.get(CLAVE_USUARIO);
        if (typeof usuarioGuardado === 'string') {
          usuario.value = JSON.parse(usuarioGuardado) as Usuario;
        }
      }
    } catch {
      // Almacenamiento ilegible: se queda sin sesión y se vuelve a entrar por /login.
      token.value = null;
      usuario.value = null;
    }
  }

  /**
   * cerrarSesion() — M2.
   *  POST /logout para revocar el token en el servidor y SIEMPRE borrar la sesión local,
   *  aunque la API falle (sin red o token vencido).
   */
  async function cerrarSesion() {
    try {
      await api('/logout', { method: 'POST' });
    } catch {
      // Sin red o token vencido: se ignora; la sesión local se borra igual.
    } finally {
      await olvidarSesion();
    }
  }

  return { usuario, estaAutenticado, login, cargarToken, cerrarSesion };
}
