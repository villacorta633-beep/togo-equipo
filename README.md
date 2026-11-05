# togo-equipo

## Restablecer la contraseña de `admin`

Si nadie puede entrar como `admin`:

1. En Render, abre el servicio **togo-equipo** → **Environment** y agrega la variable
   `ADMIN_RESET_PASSWORD` con la contraseña nueva (mínimo 8 caracteres). Guarda: Render reinicia el servicio.
2. Cuando termine de reiniciar, entra con el usuario `admin` y esa contraseña.
3. **Borra la variable `ADMIN_RESET_PASSWORD`** en Render. Mientras exista, cada reinicio vuelve a
   aplicar esa contraseña y cierra las sesiones de `admin`.

En los registros (Logs) de Render aparece `Contraseña de admin restablecida desde ADMIN_RESET_PASSWORD`
cuando se aplicó.
