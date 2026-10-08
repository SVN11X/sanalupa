# Límites materiales de la entrega

Fecha: 07-10-2026.

| Aspecto | Implementado | Pendiente / límite |
|---|---|---|
| Catálogo real | 18 centros OSM con procedencia y licencia; 16 en Providencia, 1 en Santiago, 1 en Recoleta | Sin cobertura completa de las 37 comunas |
| Profesionales individuales | Esquema, búsqueda, fichas, comparación y estados de credenciales | **0 perfiles reales publicados**: faltan acceso/permiso e identidad comprobada. No se reemplazan con centros o nombres inventados |
| Valoraciones | Adaptadores Doctoralia y Top Doctors, ejecutor semanal, estrellas por fuente, orden «Mejor valorados» con ajuste por volumen | **0 valoraciones reales** publicadas: la extracción espera la revisión humana de términos de cada plataforma. Opinión Médica bloquea bots; Doctor-Reviews descartada |
| Credenciales | Procedimiento manual, validación de evidencia y enlace RNPI | No se verificó ningún profesional; API oficial pendiente de solicitud y elegibilidad |
| Contacto | Dos sitios web cotejados con fuentes institucionales indexadas | Carga HTTP directa no comprobada. Resto: vínculo a fuente original y directorios; sin agendas ni disponibilidad real |
| Precio / convenios | Campos tipados y presentación CLP | Todos desconocidos; sin filtros que aparenten datos ausentes |
| Mapa | Leaflet lazy, agrupación de sedes compartidas, coordenadas aproximadas y atribución | Teselas reales y flujo visual no comprobados por falta de navegador operativo. Sin garantía del proveedor |
| Geografía | Lista controlada 37 + 15 comunas; coordenadas en rango RM | Sin control punto-en-polígono de cada comuna; comuna tomada de fuente comunitaria |
| Actualización | Importación local licenciada, publicación atómica, fallos y reporte; Overpass implementado apagado | Timeouts al consultar Overpass; robots/revisión operativa pendientes. API de edición OSM excluida del programador |
| GitHub Pages / Actions | Compilación relativa, rutas hash y workflows incluidos | No se ejecutaron en una cuenta externa ni se publicó el sitio |
| Pruebas | Pruebas Node de datos/lógica/publicación y revisión de compilación | Playwright/axe y revisión visual en 360/768/1280 no ejecutados; suite incluida para continuar |
| Reportes | Borrador descargable y enlace de corrección OSM | Sin recepción central ni correo configurado; no se envía nada automáticamente |
| Privacidad | Sin pacientes/RUT, favoritos por ID, coordenadas temporales; aviso de proveedores | Revisión jurídica final a cargo del responsable antes de publicar datos personales |

## Pasos que no requieren pagar

Publicar el bundle en un repositorio público con GitHub Pages, consultar manualmente RNPI, utilizar búsqueda local/mapa/favoritos y mantener un extracto OSM licenciado. Ampliar sedes con extractos obtenidos conforme a políticas. Las cuotas de alojamiento/proveedores siguen existiendo; “$0 inicial” no significa capacidad ilimitada.

## Dependencias de aprobación externa

Acceso a API RNPI y permiso de uso/publicación aplicable; autorización de Doctoralia o instituciones para los datos que se quieran reutilizar. Suscribir una API o usar un scraper externo no resuelve esos permisos. Son extensiones prescindibles, todas desactivadas.

## Revisión legal

Se consultaron [Ley 19.628](https://www.bcn.cl/leychile/Navegar?dt=open&idLey=19628) y [Ley 21.719](https://www.bcn.cl/leychile/Navegar?idNorma=1209272). A la fecha de revisión, la primera rige y la segunda tiene vigencia diferida al 1 de diciembre de 2026. No se declara cumplimiento integral; publicar perfiles personales o recibir información añade obligaciones que deben revisarse. El proyecto no diagnostica ni ofrece atención de urgencia.

El objetivo de comparar médicos por valoraciones reales **depende de un paso humano**: revisar los términos de Doctoralia (PDF bloqueado para programas) y registrar la fecha en `scripts/doctoralia.json`. El extractor no se ha ejecutado contra los sitios reales; la estructura de sus páginas puede diferir de la simulada en las pruebas.
