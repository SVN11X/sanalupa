# Límites materiales de la entrega

Fecha: 07-10-2026, actualizada el 12-10-2026 (recorrido completo de Doctoralia).

| Aspecto | Implementado | Pendiente / límite |
|---|---|---|
| Catálogo real | 18 centros OSM con procedencia y licencia; 16 en Providencia, 1 en Santiago, 1 en Recoleta | Sin cobertura completa de las 37 comunas |
| Profesionales individuales | Recorrido completo de Doctoralia en la RM, índice compacto, ficha completa por profesional, búsqueda, comparación y estados de credenciales | La primera vuelta toma cerca de dos semanas de ejecuciones diarias. Los datos son los que declara cada profesional en la plataforma: no hay verificación oficial de títulos. Quien atiende solo online no aparece en el filtro por comuna |
| Valoraciones | Nota y cantidad por profesional, las 10 opiniones visibles con respuesta, estrellas por fuente, orden «Mejor valorados» con ajuste por volumen | Las opiniones anteriores a las 10 visibles no se leen (robots.txt prohíbe la ruta que las carga). El promedio de Doctoralia viene redondeado. Top Doctors sigue sin revisión de términos. Opinión Médica bloquea bots; Doctor-Reviews descartada |
| Credenciales | Procedimiento manual, validación de evidencia y enlace RNPI | No se verificó ningún profesional; API oficial pendiente de solicitud y elegibilidad |
| Contacto | Dos sitios web cotejados con fuentes institucionales indexadas | Carga HTTP directa no comprobada. Resto: vínculo a fuente original y directorios; sin agendas ni disponibilidad real |
| Precio / convenios | Campos tipados y presentación CLP. La ficha de cada profesional muestra los precios y previsiones que declara en Doctoralia | Centros OSM sin precios. No hay filtro por precio ni por previsión. Los precios son los publicados por cada profesional y pueden cambiar |
| Mapa | Leaflet lazy, agrupación de sedes compartidas, coordenadas aproximadas y atribución | Teselas reales y flujo visual no comprobados por falta de navegador operativo. Sin garantía del proveedor |
| Geografía | Lista controlada 37 + 15 comunas; coordenadas en rango RM | Sin control punto-en-polígono de cada comuna; comuna tomada de fuente comunitaria |
| Actualización | Importación local licenciada, publicación atómica, fallos y reporte; Overpass implementado apagado | Timeouts al consultar Overpass; robots/revisión operativa pendientes. API de edición OSM excluida del programador |
| GitHub Pages / Actions | Compilación relativa, rutas hash y workflows incluidos | No se ejecutaron en una cuenta externa ni se publicó el sitio |
| Pruebas | Pruebas Node de datos, lógica, lector de perfiles y recorrido (59). Playwright con axe a 360, 768 y 1280 px (16) | El recorrido contra Doctoralia real no se ejecutó desde el entorno de mantenimiento. Ver `VALIDACION.md` |
| Reportes | Borrador descargable y enlace de corrección OSM | Sin recepción central ni correo configurado; no se envía nada automáticamente |
| Privacidad | Sin pacientes/RUT, favoritos por ID, coordenadas temporales; aviso de proveedores | Revisión jurídica final a cargo del responsable antes de publicar datos personales |

## Pasos que no requieren pagar

Publicar el bundle en un repositorio público con GitHub Pages, consultar manualmente RNPI, utilizar búsqueda local/mapa/favoritos y mantener un extracto OSM licenciado. Ampliar sedes con extractos obtenidos conforme a políticas. Las cuotas de alojamiento/proveedores siguen existiendo; “$0 inicial” no significa capacidad ilimitada.

## Dependencias de aprobación externa

Acceso a API RNPI y permiso de uso/publicación aplicable. Revisión de términos de Top Doctors y autorización de instituciones para los datos que se quieran reutilizar. Suscribir una API o usar un scraper externo no resuelve esos permisos. Doctoralia quedó habilitada el 12-10-2026 tras la revisión humana de sus términos, que vence a los 365 días.

## Revisión legal

Se consultaron [Ley 19.628](https://www.bcn.cl/leychile/Navegar?dt=open&idLey=19628) y [Ley 21.719](https://www.bcn.cl/leychile/Navegar?idNorma=1209272). A la fecha de revisión, la primera rige y la segunda tiene vigencia diferida al 1 de diciembre de 2026. No se declara cumplimiento integral; publicar perfiles personales o recibir información añade obligaciones que deben revisarse. El proyecto no diagnostica ni ofrece atención de urgencia.

Publicar perfiles con nombre, opiniones y precios de miles de profesionales es tratamiento de datos personales. Se excluyen los nombres de pacientes y los RUT, y existe una lista de exclusión para quien pida salir (`estado/doctoralia-excluidos.json`). Antes de difundir el sitio conviene una revisión legal breve. La Ley 21.719 tiene vigencia prevista el 1 de diciembre de 2026, y un proyecto ingresado al Senado en septiembre de 2026 propone postergarla un año.

El lector de perfiles se probó contra 11 perfiles reales en un navegador. El recorrido completo no pudo ejecutarse desde el entorno de mantenimiento (sin acceso de red a Doctoralia), así que su primera ejecución real será en GitHub Actions. Si Doctoralia bloquea esos servidores, el informe lo dirá y se puede ejecutar desde un computador en Chile.
