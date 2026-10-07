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

No hay adaptadores activos para Doctoralia, RedSalud, UC CHRISTUS, Google, Apify u Outscraper. Su configuración deja el motivo explícito. No hay extractores HTML con selectores especulativos: Cheerio/Playwright para proveedores se añadirían únicamente después de obtener acceso/reutilización autorizados.

## Retiro y correcciones

- Un elemento que desaparece de la extracción detiene la actualización y genera `missing_records_require_retirement_review`. No debe ignorarse indefinidamente.
- Verificar si fue eliminado, movido, duplicado o renombrado. Buscar evidencia sin acceder a portales de pacientes. Pedir aclaración al titular/fuente cuando corresponda.
- Si el retiro se confirma, retirar la sede, sus valoraciones y enlaces; actualizar `siteIds` del profesional. Retirar la organización solo si ninguna sede la necesita. Añadir el ID a `removedIds`.
- Crear candidato revisado y publicar con `scripts/import-catalog.ts`. Si se reduce el catálogo >25%, revisar manualmente el cambio; para un retiro masivo intencional ajustar el límite de `atomicPublish` de forma consciente en esa revisión, no desactivar la validación.
- Antes de un commit, ejecutar validación/build/pruebas y revisar `git diff`. Si no existe permiso de retención, no mantener datos vencidos en una versión pública ni en artefactos.

Los reportes de usuarios son archivos locales que no se envían automáticamente. Configura un canal real de recepción antes de ofrecer envío; no se incluye uno inventado.
