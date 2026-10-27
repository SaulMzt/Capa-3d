# Importar un modelo de MakerWorld

La forma más sencilla es entrar a https://capa3d.site.je/admin/importar, iniciar sesión y pegar el enlace en **Importar desde MakerWorld**. El modelo se añade como borrador al panel con título, descripción, imágenes, fuente y licencia, sin bloquear la importación por tipo de licencia. Después puedes abrir **Editar producto**, poner el precio y decidir si lo publicas.

El script de consola descrito abajo sigue disponible como alternativa.

El script `scripts/import-makerworld.py` lee la página con Playwright y envía el producto directamente a la API REST de esta tienda. No usa CSV ni crea archivos intermedios. Necesita Python y Google Chrome en este equipo.

Desde la carpeta `tienda`:

```powershell
python -m pip install -r requirements-import.txt
python scripts/import-makerworld.py "https://makerworld.com/es/models/3334143-tiny-flexi-skeleton" --price 349
```

El precio se expresa en MXN. Si omites `--price`, el script te lo pedirá. La contraseña de administrador se solicita sin mostrarla en la consola; también puede leerse de la variable de entorno `CAPA_ADMIN_PASSWORD`. Puedes elegir una categoría con `--category-id`. La URL del producto publicado aparece al terminar.

El script extrae título, descripción, imágenes y licencia, descarga las imágenes en memoria, las sube por `/api/admin/upload` y publica el producto por `/api/admin/products`. Usa un ID estable basado en el número del modelo, para actualizarlo si vuelves a importarlo. Añade fuente, diseñador y licencia a la información adicional del producto.

MakerWorld puede mostrar una verificación de seguridad. En ese caso, resuélvela en la ventana de Chrome abierta por Playwright; el script espera hasta dos minutos. Si la página no permite la lectura o no muestra la licencia, termina sin crear el producto.

Para una tienda que vende impresiones, el script solo publica automáticamente cuando identifica claramente `CC0`, `CC BY` o `CC BY-SA` sin restricciones comerciales. Si cuentas con permiso comercial explícito para **el modelo y sus imágenes** bajo otra licencia, agrega `--rights-confirmed`. No uses esa opción si no tienes ese permiso. El script no descarga ni republica los archivos 3D.

Esta conexión usa la API de **CAPA 3D**, no WooCommerce ni Shopify. Si cambias de plataforma, habrá que sustituir la función que crea el producto y el método de autenticación.
