# togo-equipo

## Mi taller (mecánico virtual)

`/taller.html` reúne todo lo del taller; el tablero solo muestra un resumen con el botón **Abrir Mi taller**.

- **Hoy**: mantenimientos pendientes por vehículo y lo que conviene revisar.
- **Vehículos**: semáforo de cada placa y, al abrirla, el diagnóstico: por qué suele fallar cada pieza,
  qué otras piezas arrastra, qué revisar y qué preguntarle al taller y al conductor.
- **Lo que el mecánico preguntaría**: arreglos que normalmente van juntos y no aparecen en los gastos
  (embrague sin rectificar el volante, dirección sin alineación, baterías o focos repetidos sin medir la carga…).
- **Plan de mantenimiento**: última vez que se hizo cada tarea y si ya toca.
- **Biblioteca**: la base de conocimiento por pieza para motos CB160, APV 1.6 y RAM 700 (`public/mecanico.js`).

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
