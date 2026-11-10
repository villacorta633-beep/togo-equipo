# togo-equipo

## Taller: consejos e informe por placa

El panel lee los gastos de mantenimiento como un mecánico (`public/taller.js`) y se recalcula solo
cada vez que se cargan gastos nuevos:

- **Tablero → Taller · consejos**: cambios de aceite que ya tocan y lo que conviene revisar del último año
  (piezas que se cambian antes de tiempo, reparaciones de motor tras meses sin cambio de aceite,
  arreglos que no duraron, pinchazos frecuentes, golpes y filas que parecen cargadas dos veces).
- **Informes** (`/informe.html?placa=XXX&periodo=2026`): informe técnico de una placa para imprimir o
  guardar como PDF, con la conclusión (desgaste, posible mal uso, falta de mantenimiento…), de dónde viene
  el gasto, hallazgos con su evidencia, recomendaciones y próximo cambio de aceite.
- **Observaciones del responsable**: cada placa tiene una nota que escribe un `admin` y leen todos.

Los hallazgos son indicios que salen de las descripciones, fechas y montos del Excel; se confirman
con el taller y el conductor. Los meses en que casi ninguna placa tiene su cambio de aceite registrado
se toman como datos faltantes, no como descuido.

## Restablecer la contraseña de `admin`

Si nadie puede entrar como `admin`:

1. En Render, abre el servicio **togo-equipo** → **Environment** y agrega la variable
   `ADMIN_RESET_PASSWORD` con la contraseña nueva (mínimo 8 caracteres). Guarda: Render reinicia el servicio.
2. Cuando termine de reiniciar, entra con el usuario `admin` y esa contraseña.
3. **Borra la variable `ADMIN_RESET_PASSWORD`** en Render. Mientras exista, cada reinicio vuelve a
   aplicar esa contraseña y cierra las sesiones de `admin`.

En los registros (Logs) de Render aparece `Contraseña de admin restablecida desde ADMIN_RESET_PASSWORD`
cuando se aplicó.
