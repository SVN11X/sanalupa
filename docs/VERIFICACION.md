# Verificación manual de un profesional

Este procedimiento es para quien mantiene el catálogo, no para recibir información de pacientes.

1. Antes de crear el perfil, confirmar una fuente de identidad y derecho para publicar nombre, profesión y lugares de consulta. Mantener constancia del permiso/licencia y su alcance.
2. Abrir [RNPI](https://rnpi.superdesalud.gob.cl/) mediante su interfaz oficial. Buscar por nombre y contrastar homónimos con datos del profesional. No resolver por coincidencia aproximada de nombre.
3. Leer el título inscrito y, por separado, especialidades/subespecialidades registradas. Una especialidad anunciada por el profesional no se transforma en registrada.
4. Registrar alcance concreto, fecha, fuente y enlace oficial de evidencia. Un número público de registro puede ayudar a desambiguar; no publicar RUT ni copiar respuestas oficiales completas, fecha de nacimiento, sexo o nacionalidad.
5. Solo usar `credentials.status: "verified"` con evidencia `statement: "official"`, `checkedAt` y `scope` no nulos. El título puede verificarse sin que todas las especialidades lo estén. Si no hay permiso para publicar la evidencia necesaria, conservar `pending` o `insufficient`.
6. Revisar el vínculo profesional–sede con una fuente autorizada. Las credenciales del registro no prueban que una persona siga atendiendo en cierta dirección o que acepte determinado seguro.
7. Si hay homónimos o discrepancias, no fusionar, no atribuir valoraciones y no marcar como verificado. Abrir revisión de identidad.
8. Para actualización/retirada, revisar el alcance y las condiciones de retención. La verificación es una comprobación a una fecha, no garantía permanente de habilitación.

## API RNPI

No está configurada. No se obtuvo apikey ni aprobación. La [documentación](https://apis-documentacion.superdesalud.gob.cl/_sections/02-intro.html) y la [Circular IP 52](https://www.superdesalud.gob.cl/normativa/circular-ip-n52/) explican la solicitud formal y el procedimiento para entidades que cumplen funciones en salud. Confirmar elegibilidad, fines y permiso de publicación con la Superintendencia antes de construir un adaptador activo. Si se autoriza, procesar la respuesta en el entorno de mantenimiento y proyectar solo campos concedidos; nunca exponer la respuesta privada en el frontend.

La entrega no presenta a ningún profesional como oficialmente verificado. No se consultó ni guardó un RUT de un médico.
