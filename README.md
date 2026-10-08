# Salud Cerca Santiago

Aplicación estática React + TypeScript para buscar atención de salud con evidencia visible, fichas, comparación, favoritos locales y mapa Leaflet. Compatible con GitHub Pages y sin backend permanente, claves privadas ni servicios de pago obligatorios.

**Estado real (8-10-2026):** 18 centros cartografiados, 0 profesionales y 0 valoraciones publicadas. El extractor de valoraciones de Doctoralia y Top Doctors está implementado y probado con páginas simuladas, pero **no se activa hasta que una persona revise los términos de uso** de cada plataforma (ver `FUENTES.md` y `docs/AMPLIAR.md`). Los centros no se presentan como médicos. La licencia abierta de OSM no equivale a validación clínica ni confirmación de atención actual.

## Publicar en GitHub Pages

El repositorio **no** incluye una carpeta `dist/` compilada (está en `.gitignore`). El sitio se compila en GitHub Actions. Si Pages publica la rama directamente («Deploy from a branch»), el navegador recibe el código sin compilar y la página queda en blanco; ahora aparece un aviso «La página no pudo cargar» con instrucciones.

1. En **Settings → Pages → Build and deployment → Source**, selecciona **GitHub Actions**.
2. Ejecuta el workflow **Validar y publicar Pages** o haz un commit a `main`. El workflow comprueba primero que Pages esté en modo GitHub Actions y falla con un mensaje claro si no lo está.
3. La dirección resultante usa la ruta de tu repositorio.

Para servir el sitio por tu cuenta: `npm ci && npm run build` y publica el contenido de `dist/` (incluye `.nojekyll`). Abrir `dist/index.html` con doble clic (`file://`) no funciona: el navegador bloquea la carga de módulos y JSON.

## Desarrollo (para quien administra el proyecto)

Node.js 24 recomendado; requisito mínimo 22.12. Las dependencias están fijadas en `package-lock.json`.

```bash
npm ci
npm run build
npm test
npm run validate
npm run dev
```

`npm run dev` muestra una URL local. `npm run preview` sirve `dist/`. Los visitantes nunca ejecutan estos comandos. Vite usa `base: './'` y rutas hash; fichas, filtros, recursos y recargas funcionan dentro del subdirectorio del repositorio. No necesita redirects SPA del servidor.

## Pruebas

```bash
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

`npm test` cubre el lector de robots.txt, los adaptadores de valoraciones (con páginas simuladas FICTICIAS), la fusión por fuente, normalización, homónimos, entidad valorada, fórmula bayesiana, búsqueda, coordenadas ausentes, permisos de datos, 403/429/timeout/cuotas y publicación atómica. Dos pruebas revisan además el `dist/` existente: compila antes de ejecutarlas.

Las pruebas Playwright incluyen 360, 768 y 1280 px, accesibilidad con axe, fichas, regreso con filtros, favoritos, comparación, geolocalización denegada y mapa. Bloquean las teselas reales para no generar descargas de mapas por bots. `QA_URL` permite usar un servidor ya disponible; `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` permite indicar Chromium instalado. El workflow **Comprobar navegador** es manual. Véase `VALIDACION.md`: estas pruebas visuales no pudieron ejecutarse en el entorno de entrega.

## Valoraciones de médicos

```bash
npm run scrape:ratings                                   # todas las fuentes configuradas
SCRAPE_SOURCES=doctoralia SCRAPE_LIMIT_LISTINGS=1 npm run scrape:ratings   # prueba corta
```

- Configuración por fuente en `scripts/doctoralia.json` y `scripts/topdoctors.json` (especialidades, comunas, páginas, perfiles por listado, pausa, cuota y días de retención).
- Respeta robots.txt (lector propio en `scripts/robots.ts`), una consulta cada 2,5 s por dominio como mínimo, tope de 700 consultas por ejecución, se detiene ante 429 o 403. No usa proxies, CAPTCHA ni navegadores automatizados.
- Si no obtiene ninguna valoración, no toca el catálogo y deja muestras en `reports/` (`reports/ratings.json` explica el motivo).
- El workflow **Actualizar valoraciones** (`.github/workflows/ratings.yml`) corre cada semana y a pedido, guarda el catálogo solo si cambió y vuelve a lanzar la publicación de Pages.

## Actualización y ampliación

```bash
npm run update:data
npm run report
```

Sin configuración, `update:data` valida el catálogo y escribe `reports/update.json`; no consulta proveedores ni cambia las fechas. La carga de datos es una tarea de mantenimiento; el navegador de visitantes no ejecuta scraping.

Para importar una extracción nueva de OSM ya obtenida conforme a su licencia y a las políticas del proveedor:

```bash
OSM_INPUT=/ruta/absoluta/snapshot.json npm run update:data
```

El archivo debe tener `license: "ODbL-1.0"`, `checkedAt` (fecha real de consulta) y `elements` compatibles con OSM. Las desapariciones de registros detienen la publicación y requieren revisión. No uses fixtures. `docs/AMPLIAR.md` explica altas, retiros, contactos y profesionales autorizados.

El adaptador Overpass está implementado pero **desactivado** en `scripts/providers.json`: hubo timeouts y no se confirmó la consulta operativa/robots del endpoint. No se usa la API de edición de OSM para actualizaciones recurrentes. Tras revisar acceso y políticas, se puede habilitar solo ese endpoint y la variable `ENABLE_OVERPASS=true`; nunca se habilitan proveedores con facturación.

El workflow semanal genera una propuesta revisable cuando existe un proveedor habilitado. No escribe directamente al repositorio ni publica un catálogo nuevo por sí solo. Usa permisos `contents: read`. Para aceptar una actualización, revisa el archivo propuesto, reemplaza `public/data/catalog.json` y realiza un commit; el workflow Pages volverá a validarlo. La programación de Actions puede retrasarse y se desactiva tras inactividad según las condiciones de GitHub.

## Funciones y límites

- Búsqueda local por nombre, especialidad/servicio y comuna, tolerante a tildes y algunos errores. Reconoce “cardiólogo en Ñuñoa”; no convierte síntomas en diagnósticos.
- Gran Santiago operativo: 37 comunas del criterio funcional INE 2020; ampliación opcional a las 52 de la RM. El catálogo inicial cubre mayormente Providencia, más Santiago y Recoleta.
- La comparación admite 3 registros del mismo tipo. Las credenciales de profesionales, las opiniones y la ubicación se muestran por separado.
- Favoritos: solo IDs en localStorage, con eliminación desde Privacidad. La comparación y la geolocalización son temporales.
- Distancia en línea recta, local. El mapa no se centra en la ubicación del visitante ni la envía a proveedores.
- Contactos: dos sitios web identificados en OSM y cotejados con fuentes institucionales indexadas. Su carga HTTP directa no pudo comprobarse. Sin agenda en tiempo real, precios ni convenios inferidos.
- Valoraciones: promedio y cantidad de opiniones por fuente, con su escala propia. Nunca se mezclan fuentes en un solo número. El orden «Mejor valorados» ajusta por cantidad de opiniones dentro de la misma fuente y especialidad. No se copian textos de opiniones.
- Reportes: borrador descargable y vínculo para corregir OSM. No hay correo de recepción inventado ni envío automático.

## Documentación

`FUENTES.md`: matriz, políticas y costos revisados el 07-10-2026.
`METODOLOGIA.md`: geografía, identidad, filtros, orden y coordenadas.
`LIMITACIONES.md`: cobertura y funciones pendientes.
`VALIDACION.md`: pruebas efectivamente ejecutadas y pendientes.
`docs/VERIFICACION.md`: proceso de credenciales oficiales.
`docs/AMPLIAR.md`: publicación de datos autorizados y retiros.
`src/schema.ts`: esquema Zod estricto y tipos públicos.

## Licencias y privacidad

Código: MIT (`LICENSE`). Datos OSM y base derivada: ODbL 1.0 (`DATA-LICENSE.md`). Mantén ambas atribuciones al redistribuir el ZIP o el catálogo. El extracto mínimo conserva procedencia sin publicar los usuarios de OSM ni sus metadatos personales. La página Privacidad describe localStorage, geolocalización y solicitudes de mapas. La revisión normativa no constituye una declaración de cumplimiento legal completo.

Empaquetado opcional para mantenedores: `npm run package` usa Python 3 y genera un ZIP junto al proyecto. No es necesario para publicar el sitio.
