# Validación de la entrega

Fecha: 07-10-2026. Node.js 24.19.0 / npm 11.9.0. Resultado registrado después de las correcciones y la compilación final.

## Ejecutado

| Comprobación | Evidencia real | Resultado |
|---|---|---|
| Instalación | `npm install --no-fund --no-audit`, dependencias y lockfile generados | 38 paquetes instalados |
| TypeScript y bundle | `npm run build` (`tsc --noEmit && vite build`) | Compilación correcta; Vite 8.3.3 |
| Unidad / integración de datos | `npm test` | **28 pruebas pasaron, 0 fallaron, 0 omitidas** |
| Catálogo público | `npm run validate` | 18 sedes, 0 profesionales, 0 valoraciones; esquema válido |
| Actualización sin proveedor | `npm run update:data` | `validate_only`, 18 procesados, 0 altas/cambios/retiros; fecha conservada |
| Calidad básica | `npm run report` | 0 sedes sin comuna, 0 sin coordenadas; 4 fuentes pendientes |
| Preparación de pruebas de navegador | `npm run test:e2e -- --list` | 10 casos identificados; **no equivale a ejecución** |
| Recursos bajo subdirectorio | Prueba de referencias en `dist/index.html` y archivos reales | URLs relativas, recursos presentes, sin fixtures sintéticos en bundles |
| Permisos / ausencia de datos sensibles | Esquema estricto, chequeo de fixtures/secrets/IDs y prueba sobre catálogo público | Sin RUT ni datos de pacientes; fixtures separados |

Cobertura de las 28 pruebas: comunas/tildes, interpretación y búsqueda, entidades separadas, homónimos (nombre o URL genérica no fusionan), no heredar reseñas de clínica, campos nulos, puntuación bayesiana y pocos datos, escalas/conteos, distancia, fuentes sin permiso, evidencia oficial, estructura vacía/cambiada, URLs privadas/inseguras, DNS/domino permitido, 403/429/timeout/cuotas/tamaño, publicación atómica con fallo de rename, retención, bajas masivas y bloqueo de datos sintéticos incluso si se copian fuera de fixtures.

La prueba de publicación atómica utiliza datos sintéticos y un directorio temporal. Las pruebas de fallos de proveedores usan mocks, no respuestas privadas. No se publican capturas o métricas inventadas.

## Fuentes efectivamente recuperadas

Se obtuvo un extracto real pequeño de OSM y dos elementos de sede adicionales. Se sanitizó para eliminar usuarios/UIDs, fotografías, teléfonos y metadatos irrelevantes. El extracto reproducible está en `docs/osm-extract.json`; cada registro tiene su URL y fecha de edición de origen. Esto verifica existencia cartográfica, no atención clínica actual.

Se revisaron documentos oficiales de licencias/políticas OSM, fuentes sanitarias, Google, Apify, Outscraper, GitHub y normativa chilena; sus URLs y fecha están en `FUENTES.md`. Dos contactos se cotejaron con fuentes institucionales indexadas. No se solicitaron accesos privados ni se utilizó un RUT.

## No ejecutado / sin comprobar

- **Navegador real y revisión visual 360/768/1280:** la apertura de navegador quedó sin respuesta y fue interrumpida; la instalación de Chromium automatizado falló porque la descarga no produjo un ZIP válido. No hay capturas reales que entregar.
- **Playwright / axe:** suite incluida, configuración cargada y 10 pruebas enumeradas, pero no ejecutadas. No se declara cumplimiento WCAG ni ausencia de errores de consola en ejecución real.
- **Mapa completo:** sin comprobación de teselas, clics y sincronización en navegador. La suite bloquea descargas reales de teselas en QA por política del proveedor.
- **GitHub Pages / Actions:** no desplegado ni probado en una cuenta externa; archivos incluidos para hacerlo. La compatibilidad de recursos relativos se comprobó en el bundle local, no en una URL pública.
- **Overpass remoto:** 504/timeouts observados. Actualizador desactivado; revisión operativa/robots pendiente. No se declara extracción periódica funcionando.
- **API RNPI, directorios personales y agregación de reseñas:** sin autorizaciones/credenciales. No se probaron ni activaron. El catálogo personal real queda vacío.
- **Contactos:** identidad y dirección cotejadas mediante fuentes institucionales indexadas; las cargas HTTP directas no se pudieron completar. Sin prueba de reservas.
- **Comunas/precisión física:** no cotejo punto-en-polígono por cada sede ni verificación presencial de entradas; coordenadas rotuladas aproximadas.

## Continuar las comprobaciones

En un entorno de desarrollo con navegador disponible:

```bash
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

También se incluye el workflow manual **Comprobar navegador** para un repositorio público. Revisa la consola, red y teselas durante una visita humana; confirma contacto/dirección en la fuente. No reintroduzcas descargas de teselas por bots.

La evidencia disponible demuestra compilación y lógica de datos correctas. **No demuestra todavía el flujo completo en navegador ni un catálogo real de profesionales con opiniones.**
