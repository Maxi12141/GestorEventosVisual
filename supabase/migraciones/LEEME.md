# Migraciones de la base de datos (versión 6)

Se corren **en orden**, pegando cada archivo completo en **Supabase → SQL Editor → New query → Run**.
Todas se pueden correr más de una vez sin romper nada.

| Archivo | ¿Cuándo? | Qué hace |
|---|---|---|
| `001_usuarios_y_roles.sql` | **Siempre** | Usuarios y roles (admin / coordinación / apoyo). Si venís de la v5, convierte los roles viejos solos |
| `002_modelo_de_eventos.sql` | **Siempre** | Crea las tablas nuevas: clientes, sedes, proveedores, solicitudes, propuestas, eventos, servicios, tareas, cambios, incidentes, observaciones e historial |
| `003_funciones.sql` | **Siempre** | Operaciones que tocan varias tablas a la vez (aceptar propuesta, registrar cambios, cerrar evento…) |
| `004_importar_datos_v5.sql` | Opcional | Si venís de la v4/v5: copia tus boliches → *sedes* y tus artistas → *proveedores*. No borra nada |
| `005_datos_demo.sql` | Ya no se recomienda | Datos de ejemplo (clientes, proveedores y eventos en todos los estados) para ver el panel con vida |
| `007_paquetes.sql` | **Siempre** | Crea los paquetes (3 de ejemplo) y la relación con las solicitudes |
| `008_paquetes_con_detalle.sql` | **Siempre** | Agrega detalle a los paquetes (qué incluye, duración, ideal para), carga 9 paquetes más y el total estimado para paquetes armados por el cliente |
| `009_borrar_datos_demo.sql` | **Si ya cargaste el 005** | Borra los datos de ejemplo (clientes `[DEMO]`, sus solicitudes y eventos) para empezar con la base limpia. No toca lo que crearon ustedes |
| `010_tipo_de_cuenta.sql` | **Siempre** | Agrega el tipo de cuenta del usuario: Cliente (solo contrata paquetes armados) o Admin (solo arma el suyo) |
| `011_dos_roles_y_pedidos.sql` | **Siempre** | Deja solo 2 roles (Super Admin y Usuario) y agrega el aviso de pedidos nuevos para los Super Admin |
| `012_topes_de_seguridad.sql` | **Siempre** | Topes en la base: máx. 50.000 personas, capacidades y precios con sentido |
| `006_borrar_tablas_de_la_version_anterior_OPCIONAL.sql` | Casi nunca | Borra las tablas del gestor viejo. Viene **todo comentado** para que no se ejecute por accidente |

**Importante:** la v6 usa tablas nuevas y **no toca** las de la versión anterior (`boliches`, `artistas`, `eventos`, etc.). Siguen ahí por si querés consultarlas.

Para borrar solo los datos de demo, las 3 líneas están al final del archivo `005`.

> Si la app dice *"Could not find the table … in the schema cache"*, corré una vez: `notify pgrst, 'reload schema';`
