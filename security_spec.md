# Security Specification for WM Constructora

## Data Invariants
- Todos los documentos deben pertenecer a un usuario (`ownerId`).
- Solo el dueño (`ownerId`) puede leer o escribir sus propios datos.
- Las fechas de creación y actualización deben ser del servidor.
- Los IDs de los documentos deben ser válidos y seguros.

## The Dirty Dozen Payloads (Rechazados por Reglas)
1. **Suplantación de Identidad**: Intentar crear un proyecto con un `ownerId` de otro usuario.
2. **Lectura Indiscreta**: Intentar listar proyectos sin estar autenticado.
3. **Escalada de Privilegios**: Intentar cambiar el `ownerId` de un proyecto existente.
4. **Envenenamiento de ID**: Intentar crear un proyecto con un ID de 2KB lleno de basura.
5. **Shadow Fields**: Intentar inyectar campos no definidos como `isVerified: true` en un perfil.
6. **Bypass de Validación**: Intentar crear un ítem de inventario con stock negativo.
7. **Manipulación de Timestamps**: Intentar enviar una fecha `createdAt` del futuro.
8. **Lectura Blanket**: Intentar leer todos los clientes de la base de datos sin filtro de usuario.
9. **Update Gap**: Intentar actualizar un proyecto sin pasar por el helper de validación estricta.
10. **Ataque de Costo**: Realizar consultas recursivas complejas que agoten la cuota.
11. **Orphaned Writes**: Intentar borrar un proyecto que aún tiene dependencias (si aplica).
12. **Inyección de Tipos**: Enviar un string donde se espera un número en `directCosts`.
