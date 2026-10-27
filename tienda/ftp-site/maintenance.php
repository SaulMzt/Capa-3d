<?php
declare(strict_types=1);
if(!is_file(__DIR__.'/maintenance.flag')){header('Location: /',true,302);exit;}
http_response_code(503);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('Retry-After: 3600');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
?>
<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Volvemos pronto · CAPA 3D</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f5ef;color:#283026;font-family:Arial,Helvetica,sans-serif;padding:24px}.card{width:min(100%,560px);padding:clamp(28px,7vw,56px);background:#fff;border:1px solid #dfe6d8;border-radius:20px;box-shadow:0 24px 70px #26351d12;text-align:center}.mark{width:64px;height:64px;margin:0 auto 24px;display:grid;place-items:center;border-radius:16px;background:#f26036;color:#fff;font-size:34px;font-weight:700}.eyebrow{color:#ec5d36;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase}h1{font-size:clamp(30px,7vw,44px);line-height:1.08;letter-spacing:-1.5px;margin:15px 0}p{color:#687363;font-size:16px;line-height:1.7;margin:0 0 28px}.line{width:54px;height:3px;background:#f26036;border-radius:3px;margin:0 auto 28px}.foot{font-size:12px;color:#98a192}
</style></head><body><main class="card"><div class="mark" aria-hidden="true">3D</div><span class="eyebrow">CAPA 3D</span><h1>Estamos preparando algo para ti.</h1><div class="line"></div><p>La tienda está en mantenimiento por un momento. Vuelve pronto para descubrir nuestras piezas y consultar tus pedidos.</p><span class="foot">Gracias por tu paciencia · CAPA 3D</span></main></body></html>
