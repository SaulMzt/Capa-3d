# CAPA 3D — publicación FTP

La tienda pública está en https://capa3d.site.je/ y el panel en https://capa3d.site.je/admin. Se usa la API PHP de `ftp-site/api.php` con SQLite. El acceso inicial está guardado en `.private/ACCESO-ADMIN.txt`; cambia la contraseña desde Configuración.

El directorio del dominio en este alojamiento es **`capa3d.site.je/htdocs`**. El directorio de primer nivel `htdocs` pertenece a otro sitio; no lo uses para publicar este dominio.

El 24 de septiembre de 2026 se publicaron los archivos en el directorio correcto. Se comprobaron la portada, `/api/shop`, el inicio de sesión y una subida de imagen al servidor. La imagen de prueba se eliminó después.

Para actualizar la interfaz, ejecuta desde `tienda`:

```powershell
node node_modules/vite/bin/vite.js build --config ftp-site/vite.config.ts
Copy-Item ftp-site/api.php ftp-dist/api.php -Force
python scripts/deploy-ftp.py
python scripts/verify-ftp.py
```

`deploy-ftp.py` conserva `database/capa.sqlite` cuando ya existe en el servidor, para no sobrescribir pedidos y cambios del panel. **No ejecutes `prepare-ftp.py` para una actualización normal:** recrea la base local inicial. Si cambias `ftp-site/api.php`, cópialo a `ftp-dist/api.php` antes de desplegar.

El importador local de MakerWorld está documentado en [README-IMPORTAR-MAKERWORLD.md](README-IMPORTAR-MAKERWORLD.md). No se sube al servidor porque contiene acceso de administrador durante su ejecución.
