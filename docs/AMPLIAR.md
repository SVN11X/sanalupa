# Ampliar y corregir el catálogo sin cambiar la interfaz

## Nuevas sedes OSM

Obtén una extracción local acorde con la licencia ODbL y las políticas del proveedor de lectura. Incluye metadata `license: "ODbL-1.0"`, `checkedAt` real y `elements`. La importación no inventa fechas de reseñas, servicios o profesionales. Un snapshot no requiere claves para la web.

Ejecuta `OSM_INPUT=/ruta/snapshot.json npm run update:data`. Se revisan esquema, geografía, trazabilidad, referencias y grandes bajas. El adaptador solo acepta lugares de tipo `clinic`, `hospital`, `doctors` o `dentist` con nombre. No se convierte `doctor` en una persona. Campos desconocidos quedan nulos. Coordenadas de edificios son aproximadas.

La importación OSM agrega organizaciones/centros, conservando colecciones personales de otras fuentes. Mantén `public/data/osm-selection.json` al día si posteriormente activas la consulta Overpass por IDs.

## Contactos

No publicar automáticamente todos los atributos `website` de una extracción. Cotejar nombre, sede y dirección con la fuente institucional, comprobar que es un destino público seguro y documentar el resultado en `docs/contact-checks.json`. El normalizador solo admite contactos expresamente cotejados cuando recibe su lista. Se puede conservar un contacto anterior si identidad y dirección siguen coincidiendo; su evidencia mantiene su fecha original.

Para añadir un contacto nuevo al catálogo en mantenimiento, conserva evidencia del campo/licencia y ejecuta la validación. No deducir teléfonos, agendas, tarifas, seguros o disponibilidad.

## Profesionales o valoraciones autorizadas

1. Obtener autorización concreta y documentarla en `FUENTES.md`. El permiso debe cubrir los campos, almacenamiento, publicación, atribución y, si se desea ranking, derivación.
2. Añadir una entrada de `sources` con `status: enabled`, licencia/permiso, flags efectivos y fecha de revisión. Estos flags expresan un permiso documentado; editarlos no crea ese permiso.
3. Crear organizaciones y sedes con IDs estables y evidencia por campo. Crear profesionales separados con identidad comprobada, profesión y relación de sedes. No publicar RUT ni información de pacientes.
4. Usar especialidad `advertised` o `registered` según el origen real. Aplicar `docs/VERIFICACION.md` para títulos/especialidades oficiales.
5. Para opiniones agregadas, registrar `entityType`, `entityId`, `sourceId`, media/escala, `totalCount`, `sampleCount`, `extractedAt` y `latestReviewAt`. No atribuir reseñas de centros a profesionales; no incluir relatos o nombres de pacientes. `mayDerive` solo si el proveedor lo permite.
6. Definir `comparableGroup` y documentar criterios homogéneos (fuente, especialidad/territorio). El ajuste exige misma escala y al menos 3 profesionales; una muestra de reseñas no reemplaza el conteo informado.
7. Generar un catálogo completo candidato y usar el importador local:

```bash
node --import tsx scripts/import-catalog.ts /ruta/catalogo-autorizado.json
npm run validate
npm run build
npm test
```

La interfaz mostrará automáticamente las profesiones/especialidades disponibles, fichas y sedes múltiples. El orden por opiniones se habilita solo cuando hay una fuente con permiso de derivación. La selección de la fuente evita mezclar plataformas. No se necesita un backend o IA remota.

Hay adaptadores para Doctoralia y Top Doctors (ver la sección siguiente). No hay adaptadores para RedSalud, UC CHRISTUS, Opinión Médica, Google, Apify u Outscraper.

## Retiro y correcciones

- Un elemento que desaparece de la extracción detiene la actualización y genera `missing_records_require_retirement_review`. No debe ignorarse indefinidamente.
- Verificar si fue eliminado, movido, duplicado o renombrado. Buscar evidencia sin acceder a portales de pacientes. Pedir aclaración al titular/fuente cuando corresponda.
- Si el retiro se confirma, retirar la sede, sus valoraciones y enlaces; actualizar `siteIds` del profesional. Retirar la organización solo si ninguna sede la necesita. Añadir el ID a `removedIds`.
- Crear candidato revisado y publicar con `scripts/import-catalog.ts`. Si se reduce el catálogo >25%, revisar manualmente el cambio; para un retiro masivo intencional ajustar el límite de `atomicPublish` de forma consciente en esa revisión, no desactivar la validación.
- Antes de un commit, ejecutar validación/build/pruebas y revisar `git diff`. Si no existe permiso de retención, no mantener datos vencidos en una versión pública ni en artefactos.

Los reportes de usuarios son archivos locales que no se envían automáticamente. Configura un canal real de recepción antes de ofrecer envío; no se incluye uno inventado.

## Valoraciones de Doctoralia y Top Doctors

### Antes de la primera ejecución: revisar los términos

El extractor no consulta ninguna plataforma mientras `termsReviewedAt` sea `null` en `scripts/{fuente}.json`. El 08-10-2026 no fue posible leer los términos de forma automática (Doctoralia los publica en un PDF que su propio robots.txt prohíbe a programas; Top Doctors respondió 404). Una persona debe:

1. Abrir los términos en el navegador: Doctoralia en <https://www.doctoralia.cl/terminos-y-condiciones> (enlace al PDF «Condiciones generales»); Top Doctors en <https://www.topdoctors.cl/info/terminos-legales/>.
2. Buscar cláusulas sobre extracción automática, copia o reutilización de contenidos y bases de datos.
3. Si los términos **no** lo prohíben, escribir la fecha de revisión (`"termsReviewedAt": "AAAA-MM-DD"`) y resumir la conclusión en `termsNote` y en `FUENTES.md`. Si lo prohíben, dejar `null` y pedir autorización a la plataforma.

La revisión vence a los 365 días.

### Ejecutar localmente desde Chile

Si la plataforma bloquea los servidores de GitHub (403 o 429 en `reports/ratings.json`), puedes ejecutarlo desde tu computador. Usa la misma configuración; no cambies el user-agent ni uses VPN o proxies para disfrazar el origen.

```bash
git pull
npm ci
SCRAPE_SOURCES=doctoralia SCRAPE_LIMIT_LISTINGS=2 npm run scrape:ratings   # prueba corta (unos minutos)
cat reports/ratings.json                                                   # revisa estado y motivo
npm run scrape:ratings                                                     # ejecución completa (hasta 700 consultas, ~30 min)
npm run validate && npm run build && npm test
git add public/data/catalog.json
git commit -m "datos: actualizar valoraciones agregadas"
git push
```

El push a `main` dispara el workflow de Pages, que valida y publica. Si un 403 aparece también desde Chile, la plataforma no permite este acceso: no reintentes; marca la fuente como pendiente.

### Qué hace una ejecución

1. Lee robots.txt y descarta toda ruta prohibida (gana la regla más larga; los comodines `*` y `$` se respetan).
2. Recorre los listados `/{especialidad}/{comuna}` configurados (rotando el punto de partida cada semana), hasta `maxPagesPerListing` páginas y `maxProfilesPerListing` perfiles por listado.
3. Lee cada perfil y extrae, en este orden: JSON-LD `aggregateRating`, microdatos `itemprop`, atributos `data-score` y el texto «N opiniones».
4. Si no obtiene ninguna valoración, no modifica el catálogo y guarda hasta 3 páginas de muestra (con RUT borrados) en `reports/` para revisar si cambió la estructura.
5. Si obtiene datos: reemplaza los registros renovados de esa fuente, conserva los no visitados consultados hace 45 días o menos, borra los más antiguos y no toca otras fuentes. La fuente queda `enabled` con licencia «Términos de uso de {plataforma} (no es una licencia abierta)».
6. Un 403 suspende la fuente y deja el catálogo intacto. Un 429 respeta `Retry-After` y detiene la fuente en esa ejecución.

### Identificadores

`doctoralia:{slug}` (profesional), `doctoralia:site:{hash}` (consulta, tipo `practice`), `org:doctoralia:{hash}` (centro) y `doctoralia:rating:{slug}` (valoración). Las consultas no aparecen en la pestaña «Centros». Dos fichas de plataformas distintas se muestran juntas solo si coinciden nombre con ambos apellidos, profesión, especialidad y una dirección (calle y número), o un número de registro oficial del RNPI con evidencia oficial.
