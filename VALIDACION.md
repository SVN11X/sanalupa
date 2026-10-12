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

## Ejecución del 8 de octubre de 2026 (Node 22.22.0, Chromium de Playwright 1.63)

| Comando | Resultado real |
|---|---|
| `npm run validate` | `{"valid":true,"professionals":0,"sites":18,"ratings":0,"publishedAt":"2026-10-07"}` |
| `npm run build` | Compilación correcta (`✓ built`) |
| `npm test` | 44 pruebas, 44 aprobadas, 0 fallidas |
| `npm run test:e2e` | 15 aprobadas (incluye axe a 360, 768 y 1280 px, catálogo FICTICIO con valoraciones, mapa de profesionales y aviso de respaldo con `index.html` sin compilar) |
| `SCRAPE_LIMIT_LISTINGS=1 npm run scrape:ratings` | Doctoralia y Top Doctors `skipped` con motivo `terms_review_required`, 0 consultas, catálogo sin cambios |

No verificado: el extractor contra las páginas reales (el entorno de mantenimiento no tiene acceso de red a esas plataformas y la revisión de términos está pendiente) ni el sitio desplegado en Pages.

## Ejecución del 12 de octubre de 2026: recorrido completo de Doctoralia (Node 22.22.0, Chromium de Playwright)

| Comando | Resultado real |
|---|---|
| `npm run build` | Compilación correcta (`✓ built`) |
| `npm test` | 59 pruebas, 59 aprobadas, 0 fallidas. Incluye el lector completo de perfiles, el recorrido con sitemaps, prioridades, reanudación, 403, 429, presupuesto de tiempo, exclusiones y una prueba de rendimiento con 40.000 profesionales |
| `npm run validate` | Catálogo válido. Índice de Doctoralia vacío y válido (0 filas, 0 fichas) hasta la primera ejecución real |
| `npm run test:e2e` | 16 aprobadas. La nueva prueba recorre tarjetas, atención online y la ficha completa con axe a 1280 y 360 px, sin imágenes de terceros ni nombres de pacientes |
| Lector contra páginas reales | En un navegador, sobre 11 perfiles reales de Doctoralia (un cardiólogo y diez psicólogos de Providencia): nombre, título, especialidades, consultas, previsiones, pagos, teléfonos, precios, opiniones con respuesta y preguntas se leyeron sin errores (unos 23 ms por perfil). Las direcciones del tipo «Sesión Online» se reconocieron como atención online |

Rendimiento medido con 45.000 profesionales sintéticos: leer y validar el índice 0,6 s, convertirlo al catálogo 0,3 s, ordenar por opiniones 0,2 s, primera búsqueda escrita 0,2 s y las siguientes menos de 0,05 s.

No verificado: el recorrido completo contra Doctoralia real (este entorno no resuelve el dominio, la ejecución de prueba terminó con `network_error` sin escribir datos) ni el comportamiento de Doctoralia frente a los servidores de GitHub Actions. Tampoco el sitio desplegado en Pages.
