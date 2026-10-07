# Metodología

## Tres dimensiones independientes

Credenciales: evidencia oficial sobre título y especialidad. Experiencias: satisfacción agregada informada por una fuente autorizada para una entidad concreta. Conveniencia: dirección, comuna, sede, distancia, contacto y datos de esa consulta. No se afirma excelencia clínica ni “mejores médicos” objetivamente.

El catálogo inicial contiene 18 **lugares de atención**, no profesionales. OSM `healthcare=doctor` describe una consulta; el normalizador no lo transforma en una persona. Tampoco convierte el nombre de un hospital que contiene “Doctor” en un perfil.

## Geografía

Criterio operativo basado en la [publicación INE–Subdere–Sectra de 2020](https://www.ine.gob.cl/sala-de-prensa/prensa/general/noticia/2020/09/04/ine-subdere-y-sectra-presentan-metodolog%C3%ADa-para-definir-las-%C3%A1reas-funcionales-en-chile): comunas de provincia de Santiago más San Bernardo, Puente Alto, Padre Hurtado, Peñaflor y Colina. Se usan comunas completas para filtrar, decisión del proyecto, sin afirmar que toda su superficie sea urbana ni que sea una delimitación oficial nueva de 2026.

**37 comunas iniciales:** Santiago, Cerrillos, Cerro Navia, Conchalí, El Bosque, Estación Central, Huechuraba, Independencia, La Cisterna, La Florida, La Granja, La Pintana, La Reina, Las Condes, Lo Barnechea, Lo Espejo, Lo Prado, Macul, Maipú, Ñuñoa, Pedro Aguirre Cerda, Peñalolén, Providencia, Pudahuel, Quilicura, Quinta Normal, Recoleta, Renca, San Joaquín, San Miguel, San Ramón, Vitacura, Puente Alto, San Bernardo, Padre Hurtado, Peñaflor, Colina.

**15 adicionales, solo al ampliar a RM:** Alhué, Buin, Calera de Tango, Curacaví, El Monte, Isla de Maipo, Lampa, María Pinto, Melipilla, Paine, Pirque, San José de Maipo, San Pedro, Talagante, Tiltil. Cambiar el alcance no añade automáticamente datos.

## Modelo y procedencia

`src/schema.ts` valida colecciones separadas: organizaciones, sedes, profesionales, credenciales, fuentes y valoraciones. Se rechazan IDs repetidos, referencias inexistentes, sedes duplicadas, campos privados extra, escalas erróneas y publicaciones sin fuente habilitada con licencia. Cada hecho tiene evidencia propia; fechas de consulta y edición son diferentes. Fecha de la última reseña es `null` cuando no se conoce. Datos ausentes son `null`, sin sustitución por cero.

OSM es una fuente comunitaria: `source_record` significa que un atributo existe en ese registro; no significa que se verificó clínicamente. `declared` identifica información anunciada, `official` evidencia oficial y `pending` información pendiente. La interfaz rotula los servicios y las coordenadas de centros como cartográficos.

## Identidad y especialidades

No hay fusiones automáticas por nombre. `sameIdentity` requiere evidencia oficial de la misma fuente, un número de registro oficial coincidente, nombre y profesión. Una URL genérica de RNPI no basta. Un caso ambiguo conserva registros separados hasta revisión. No se publica el RUT; un identificador sensible necesario para consulta se mantiene en trabajo privado transitorio.

Especialidad `advertised`: anunciada y atribuida; no implica inscripción oficial. `registered`: solo con evidencia oficial. Estado `verified` exige alcance y fecha; puede referirse solo al título, por lo que no se deducen especialidades adicionales. No se infiere experiencia desde titulación, convenios desde la clínica o tarifas desde otra sede.

## Búsqueda

Normalización local de tildes, mayúsculas y puntuación. Un catálogo controlado reconoce especialidades y comunas; hasta un error de edición en términos de seis caracteres o más. Fuse.js tolera errores en nombres/direcciones con umbral 0,34. La consulta original y su interpretación son visibles. “Dolor de pecho” no selecciona una especialidad: no hay diagnóstico ni LLM remoto.

Filtros explícitos prevalecen sobre la comuna/especialidad reconocidas en texto. La categoría centros usa servicios solo si el atributo OSM los indica. La lista es completa aunque el mapa no cargue; registros sin coordenadas no tienen marcador y continúan en la lista.

## Orden y opiniones

Nombre A–Z es el orden predeterminado; distancia requiere una ubicación otorgada de forma explícita. El control de valoraciones está desactivado en el catálogo inicial. No se suma automáticamente entre plataformas, no se transfiere una puntuación de organización/sede a una persona y no se utiliza texto de opiniones.

Con fuente autorizada para publicación **y derivación**, se utiliza:

`S = [v/(v+m)] R + [m/(v+m)] C`

- `R`: media del profesional, `v`: total informado por la fuente.
- `C`: media ponderada por conteo de al menos 3 profesionales con conteo positivo de la misma fuente, escala y grupo comparable definido al importar. Ese grupo debe documentar criterios coherentes como especialidad/territorio, nunca depender de la consulta del visitante.
- `m = 20`: regularización elegida por diseño para reducir influencia de pocos votos; no recomendación clínica ni parámetro científicamente calibrado.
- Mínimo inicial de 5 opiniones para puntuar, configurable 1–1000. El mínimo es una preferencia de orden, no elimina profesionales de la búsqueda.

Si faltan permisos, grupo comparable, volumen o escala válida, no se calcula S. Sin puntuación se ordena después de los comparables por nombre y permanece encontrable por otros órdenes. No se normalizan ni mezclan escalas automáticamente; cada fuente se elige por separado. Una muestra pequeña no sirve para inferir tendencias o fecha reciente de todas las opiniones.

## Coordenadas, mapa y privacidad

Todas las coordenadas iniciales son aproximadas. Los nodos OSM tienen precisión física desconocida; los edificios usan promedio de vértices únicos, no entrada de pacientes. Se comprueba formato, rango RM y comuna del atributo de origen. No se ejecutó cotejo poligonal de cada comuna ni inspección física; se documenta como límite.

Distancia Haversine con radio terrestre 6371 km, redondeada a 0,1 km; línea recta. Sin ambas coordenadas, `null`. La geolocalización queda en memoria y no se centra el mapa en el visitante. Las teselas encuadran sedes y el navegador envía su IP/Referer al proveedor. Se cargan tras pulsar Ver mapa, sin precarga ni mapas offline. El proveedor se configura en `public/data/map-config.json`; actualmente solo se permite OSMF. Cambiarlo exige revisar política, atribución y lista permitida.

## Fallos, antigüedad y retiro

Validación antes de escritura y reemplazo con archivo temporal y rename en el mismo directorio. Fallos conservan el último catálogo únicamente si todas sus fuentes permiten retenerlo. La fecha no se actualiza al fallar ni al ejecutar solo validación. Antigüedad >30 días produce aviso; evidencia por campo mantiene sus propias fechas.

403/401/406 suspenden el proveedor. 429 conserva Retry-After como fin de suspensión y no hace más solicitudes en esa tarea. Timeouts/5xx tienen un reintento; cuotas y bytes están limitados. Sin rotación de IP, identidad o endpoint, ni acceso a login/CAPTCHA. El log guarda códigos de fallo, IDs y conteos, sin respuestas privadas.

Un elemento desaparecido o una baja >25% detiene la actualización. El administrador revisa el cambio y, si confirma retiro, elimina relaciones, añade su ID a `removedIds` y publica un catálogo autorizado mediante el importador. No debe mantenerlo activo indefinidamente. Véase `docs/AMPLIAR.md`.
