import type { CapacitorConfig } from '@capacitor/cli';

/**
 * M8 — Identidad personal de la app.
 *   appId   = cr.ac.ucr.if0009.<carné en minúscula>
 *   appName = "Préstamos <primer apellido>"
 * La misma identidad se repite en android/app/build.gradle (namespace y applicationId),
 * en android/app/src/main/res/values/strings.xml y en el paquete de MainActivity.java.
 */
const config: CapacitorConfig = {
  appId: 'cr.ac.ucr.if0009.c1893',
  appName: 'Préstamos Castro',
  webDir: 'dist',
  android: {
    // Solo para el examen: la API local corre en http://10.0.2.2.
    // La excepción de texto en claro está acotada en res/xml/network_security_config.xml
    allowMixedContent: true,
  },
};

export default config;
