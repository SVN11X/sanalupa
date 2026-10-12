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

Hay un recorrido completo para Doctoralia y un adaptador de agregados para Top Doctors (ver las secciones siguientes). No hay adaptadores para RedSalud, UC CHRISTUS, Opinión Médica, Google, Apify u Outscraper.

## Retiro y correcciones

- Un elemento que desaparece de la extracción detiene la actualización y genera `missing_records_require_retirement_review`. No debe ignorarse indefinidamente.
- Verificar si fue eliminado, movido, duplicado o renombrado. Buscar evidencia sin acceder a portales de pacientes. Pedir aclaración al titular/fuente cuando corresponda.
- Si el retiro se confirma, retirar la sede, sus valoraciones y enlaces; actualizar `siteIds` del profesional. Retirar la organización solo si ninguna sede la necesita. Añadir el ID a `removedIds`.
- Crear candidato revisado y publicar con `scripts/import-catalog.ts`. Si se reduce el catálogo >25%, revisar manualmente el cambio; para un retiro masivo intencional ajustar el límite de `atomicPublish` de forma consciente en esa revisión, no desactivar la validación.
- Antes de un commit, ejecutar validación/build/pruebas y revisar `git diff`. Si no existe permiso de retención, no mantener datos vencidos en una versión pública ni en artefactos.

Los reportes de usuarios son archivos locales que no se envían automáticamente. Configura un canal real de recepción antes de ofrecer envío; no se incluye uno inventado.

## Doctoralia: recorrido completo

### Términos de uso

El recorrido no consulta Doctoralia si `termsReviewedAt` en `scripts/doctoralia.json` está vacío o tiene más de 365 días. La revisión vigente es del 12-10-2026. Para renovarla, una persona abre en su navegador las condiciones (<https://www.doctoralia.cl/terminos-y-condiciones>, enlace al PDF «Condiciones generales»), confirma que siguen permitiendo este uso y actualiza la fecha y `termsNote`.

### Qué hace cada ejecución

1. Lee robots.txt y descarta toda ruta prohibida.
2. Lee el índice de sitemaps (`/sitemap.xml`) y los sitemaps de perfiles. Registra los perfiles nuevos y la fecha de cambio de cada uno.
3. Arma la cola en este orden: perfiles que cambiaron desde la última lectura (o que tienen opiniones recientes), perfiles nuevos, perfiles que desaparecieron del sitemap (para confirmar si se dieron de baja), reintentos de errores, perfiles de la RM consultados hace más de 14 días y perfiles de fuera de la RM consultados hace más de 120 días.
4. Lee perfiles hasta agotar el tiempo (300 minutos) o la cuota (8.000 consultas). Cada 250 perfiles guarda el avance.
5. Por cada perfil: si tiene una consulta presencial en la RM o atiende online declarando una comuna de la RM, escribe su ficha (solo si cambió) y actualiza su fila del índice. Si no, lo marca «fuera» y retira lo publicado. Un 404 lo da de baja.
6. Al final retira las filas que llevan más de 60 días sin actualizarse y registra la fuente en `catalog.json`.

Un 403 detiene todo y un 429 respeta `Retry-After`. En ambos casos se guarda el avance y la ejecución siguiente sigue donde quedó.

### Retiros a pedido

Agrega el slug del perfil (la parte final de `https://www.doctoralia.cl/perfil/{slug}`) a `estado/doctoralia-excluidos.json`, haz commit y ejecuta el workflow. La fila y la ficha se retiran, el perfil queda «baja» en el estado y no se vuelve a consultar. La validación falla si un perfil excluido sigue publicado.

### Ejecutar desde tu computador

Si Doctoralia bloquea los servidores de GitHub (`suspended` con `access_denied` en `reports/ratings.json`), ejecútalo desde un computador en Chile con la misma configuración. No cambies el user-agent ni uses VPN o proxies para disfrazar el origen.

```bash
git pull
npm ci
SCRAPE_SOURCES=doctoralia SCRAPE_LIMIT_PROFILES=20 npm run scrape:ratings   # prueba corta (1 a 2 minutos)
cat reports/doctoralia.json                                                 # revisa estado, cola y conteos
SCRAPE_SOURCES=doctoralia npm run scrape:ratings                            # hasta 300 minutos, se puede repetir
npm run validate && npm run build && npm test
git add -A public/data/catalog.json public/data/doctoralia estado
git commit -m "datos: actualizar perfiles y valoraciones de Doctoralia"
git push
```

El push a `main` dispara el workflow de Pages, que valida y publica. Si un 403 aparece también desde Chile, la plataforma no permite este acceso: no reintentes y vuelve a dejar `termsReviewedAt` vacío.

### Identificadores

`doctoralia:{slug}` (profesional), `doctoralia:site:{hash}` (consulta, tipo `practice`), `org:doctoralia:{hash}` (centro) y `doctoralia:rating:{slug}` (valoración). La clave de una consulta es la calle con número y la comuna, así que dos profesionales en la misma dirección comparten sede. Las consultas no aparecen en la pestaña «Centros». Dos fichas de plataformas distintas se muestran juntas solo si coinciden nombre con ambos apellidos, profesión, especialidad y una dirección (calle y número), o un número de registro oficial del RNPI con evidencia oficial.

## Top Doctors

El adaptador de Top Doctors (listados y sitemap, solo datos agregados) sigue desactivado: `termsReviewedAt` es `null` en `scripts/topdoctors.json`. El 08-10-2026 su robots.txt y sus términos respondieron 404 a la herramienta de lectura. Una persona debe revisar <https://www.topdoctors.cl/info/terminos-legales/> en su navegador antes de activarlo, igual que con Doctoralia.
