<?php
declare(strict_types=1);
define('CAPA_API_LIBRARY',true);
define('CAPA_MOBILE_REQUEST',true);
require_once __DIR__.'/api.php';
try {
 origin();mobileSchema();$route=trim((string)($_GET['route']??''),'/');$method=$_SERVER['REQUEST_METHOD']??'GET';
 if($route==='config'&&$method==='GET')answer(['apiVersion'=>1,'firebase'=>mobileFirebase(),'store'=>'CAPA 3D']);
 if($route==='login'&&$method==='POST'){
  rate('mobile-login',8,900);$b=data();$email=strtolower(val($b,'email',200,true));$password=val($b,'password',128,true);$a=one('SELECT * FROM admins WHERE email=?',[$email]);$hash=passhash($password,$a['salt']??'invalid-user-timing-salt');if(!$a||!hash_equals($a['password_hash'],$hash))fail(401,'Correo o contraseña incorrectos.');
  $token=bin2hex(random_bytes(32));$id=bin2hex(random_bytes(16));$expires=time()+90*86400;run('DELETE FROM mobile_sessions WHERE expires_at<?',[time()]);run('INSERT INTO mobile_sessions(id,token_hash,admin_id,password_version,device,expires_at,created_at) VALUES(?,?,?,?,?,?,?)',[$id,hash('sha256',$token),$a['id'],hash('sha256',$a['password_hash']),val($b,'device',100)?:'Android',$expires,gmdate('c')]);answer(['token'=>$token,'expiresAt'=>$expires,'user'=>['id'=>$a['id'],'email'=>$a['email']],'firebase'=>mobileFirebase()]);
 }
 if($route==='preview'&&$method==='GET'){
  $key=(string)($_GET['key']??'');if(!preg_match('/^[a-f0-9]{64}$/D',$key))fail(404,'Vista previa no disponible.');
  $preview=one('SELECT data FROM mobile_previews WHERE token_hash=? AND expires_at>?',[hash('sha256',$key),time()]);if(!$preview)fail(404,'La vista previa caducó. Ábrela de nuevo desde Android.');
  header('Content-Type: text/html; charset=utf-8');header('Referrer-Policy: no-referrer');header('X-Robots-Tag: noindex, nofollow');
  $json=json_encode(json_decode($preview['data'],true),JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_UNESCAPED_UNICODE);
  echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vista previa CAPA 3D</title><link rel="stylesheet" href="/mobile-preview/preview.css"></head><body><div id="root"></div><script type="application/json" id="preview-data">'.$json.'</script><script type="module" src="/mobile-preview/preview.js"></script></body></html>';exit;
 }
 $user=mobileAdmin();
 if($route==='preview'&&$method==='POST'){
  rate('mobile-preview',30,900);$p=validProduct(data());$category=one('SELECT name FROM categories WHERE id=?',[$p['categoryId']]);$key=bin2hex(random_bytes(32));
  run('DELETE FROM mobile_previews WHERE expires_at<?',[time()]);
  run('INSERT INTO mobile_previews(token_hash,data,expires_at) VALUES(?,?,?)',[hash('sha256',$key),json_encode(['product'=>$p,'category'=>$category['name']??'','color'=>settings()['primaryColor']??''],JSON_UNESCAPED_UNICODE),time()+600]);
  answer(['url'=>'/mobile.php?route=preview&key='.$key],201);
 }
 if($route==='logout'&&$method==='POST'){run('DELETE FROM mobile_sessions WHERE id=?',[$user['sessionId']]);answer(['ok'=>true]);}
 if($route==='snapshot'&&$method==='GET'){
  $products=products(true);foreach($products as &$p)$p['version']=hash('sha256',json_encode($p));unset($p);$orders=orders();
  $snapshot=['products'=>$products,'orders'=>$orders,'categories'=>categories(),'settings'=>settings(),'maintenance'=>maintenanceEnabled(),'customers'=>mobileCustomers($orders),'conversations'=>mobileConversations($user['id']),'movements'=>rows('SELECT * FROM inventory_movements ORDER BY id DESC LIMIT 100'),'notifications'=>rows('SELECT id,kind,entity_id entityId,title,body,created_at createdAt FROM mobile_events ORDER BY id DESC LIMIT 100'),'notificationRead'=>(int)(one('SELECT last_id FROM mobile_notification_reads WHERE admin_id=?',[$user['id']])['last_id']??0),'pushConfigured'=>count(mobileFirebase())===4&&is_file(__DIR__.'/database/firebase-service-account.json'),'user'=>['id'=>$user['id'],'email'=>$user['email']]];
  $etag='"'.hash('sha256',json_encode($snapshot)).'"';header('ETag: '.$etag);if(($_SERVER['HTTP_IF_NONE_MATCH']??'')===$etag){http_response_code(304);exit;}answer($snapshot);
 }
 if($route==='device'&&$method==='POST'){$b=data();$token=val($b,'token',4096,true);if(!preg_match('/^[A-Za-z0-9_:.-]{20,4096}$/D',$token))fail(400,'Token de notificación inválido.');run('INSERT INTO mobile_devices(token,session_id,updated_at) VALUES(?,?,?) ON CONFLICT(token) DO UPDATE SET session_id=excluded.session_id,updated_at=excluded.updated_at',[$token,$user['sessionId'],gmdate('c')]);answer(['ok'=>true]);}
 if($route==='notifications/read'&&$method==='POST'){$b=data();$last=(int)num($b,'lastId',0,PHP_INT_MAX);run('INSERT INTO mobile_notification_reads(admin_id,last_id) VALUES(?,?) ON CONFLICT(admin_id) DO UPDATE SET last_id=MAX(last_id,excluded.last_id)',[$user['id'],$last]);answer(['ok'=>true]);}
 if(preg_match('~^chat/(\d+)$~',$route,$m)){
  $id=(int)$m[1];if(!one('SELECT id FROM orders WHERE id=?',[$id]))fail(404,'El pedido ya no existe.');
  if($method==='GET'){$messages=rows('SELECT id,sender,body,created_at createdAt FROM order_messages WHERE order_id=? ORDER BY id DESC LIMIT 200',[$id]);$last=$messages?(int)$messages[0]['id']:0;run('INSERT INTO mobile_reads(admin_id,order_id,message_id) VALUES(?,?,?) ON CONFLICT(admin_id,order_id) DO UPDATE SET message_id=MAX(message_id,excluded.message_id)',[$user['id'],$id,$last]);answer(['messages'=>array_reverse($messages),'customerRead'=>(int)(one('SELECT message_id FROM mobile_customer_reads WHERE order_id=?',[$id])['message_id']??0)]);}
  if($method==='POST'){rate('mobile-chat',90,900);$b=data();$body=val($b,'message',1000,true);$request=val($b,'requestId',80,true);if(!preg_match('/^[a-f0-9-]{36}$/iD',$request))fail(400,'Identificador inválido.');$pdo=sql();$pdo->exec('BEGIN IMMEDIATE');try{$found=one('SELECT message_id FROM mobile_chat_requests WHERE request_id=? AND admin_id=?',[$request,$user['id']]);if(!$found){run('INSERT INTO order_messages(order_id,sender,body,created_at) VALUES(?,?,?,?)',[$id,'admin',$body,gmdate('c')]);$messageId=(int)$pdo->lastInsertId();run('INSERT INTO mobile_chat_requests(request_id,admin_id,message_id) VALUES(?,?,?)',[$request,$user['id'],$messageId]);}$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}if(!$found)sendPushForOrder($id);answer(['ok'=>true]);}
 }
 if($route==='orders/create'&&$method==='POST'){
  $b=data();$request=val($b,'requestId',80,true);if(!preg_match('/^[a-f0-9-]{36}$/iD',$request))fail(400,'Identificador inválido.');$key=hash('sha256',$request);$customer=val($b,'customer',100,true);$phone=val($b,'phone',25);$productId=val($b,'productId',80);$quantity=num($b,'quantity',1,100);if($quantity!=(int)$quantity)fail(400,'Cantidad inválida.');$quantity=(int)$quantity;$comment=val($b,'comment',2000);$pdo=sql();$pdo->exec('BEGIN IMMEDIATE');
  try{$existing=one('SELECT id FROM orders WHERE request_key=?',[$key]);if($existing){$pdo->commit();answer(['ok'=>true,'id'=>(int)$existing['id']]);}$p=$productId?one('SELECT * FROM products WHERE id=?',[$productId]):null;if($productId&&!$p)fail(404,'Producto no encontrado.');if($p&&!$p['unlimited']&&$p['stock']<$quantity)fail(409,'No hay stock suficiente.');$name=$p?$p['name']:val($b,'productName',150,true);$total=$p?$p['price']*$quantity/100:num($b,'total',0,1000000);$now=gmdate('c');$d=['customer'=>$customer,'phone'=>$phone,'comment'=>$comment,'total'=>$total,'productName'=>$name,'image'=>$p?(one('SELECT url FROM product_images WHERE product_id=? ORDER BY sort LIMIT 1',[$productId])['url']??''):'','categoryId'=>$p['category_id']??'','dimensions'=>'','reference'=>'','notes'=>'','delivery'=>val($b,'delivery',200)];run('INSERT INTO orders(request_key,token_hash,type,product_id,quantity,status,data,created_at) VALUES(?,?,?,?,?,?,?,?)',[$key,hash('sha256',random_bytes(32)),$p?'product':'custom',$p?$productId:null,$quantity,'Nuevo',json_encode($d,JSON_UNESCAPED_UNICODE),$now]);$id=(int)$pdo->lastInsertId();run('INSERT INTO order_history(order_id,status,note,created_at) VALUES(?,?,?,?)',[$id,'Nuevo','Creado desde Android',$now]);if($p){run('INSERT INTO order_items(order_id,product_id,quantity,unit_price,product_name) VALUES(?,?,?,?,?)',[$id,$productId,$quantity,$p['price'],$name]);if(!$p['unlimited']){run('UPDATE products SET stock=stock-? WHERE id=?',[$quantity,$productId]);run('INSERT INTO inventory_movements(product_id,order_id,delta,reason,created_at) VALUES(?,?,?,?,?)',[$productId,$id,-$quantity,'Apartado Android',$now]);}}$pdo->commit();answer(['ok'=>true,'id'=>$id],201);}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
 }
 // Reuse the shop's validated business rules for all existing administrative operations.
 $allowed=['admin/products'=>['POST'],'admin/categories'=>['POST'],'admin/upload'=>['POST'],'admin/maintenance'=>['POST'],'admin/settings'=>['POST'],'admin/filament-profiles'=>['GET','POST'],'admin/import-makerworld'=>['POST'],'admin/ai'=>['GET'],'admin/ai/chat'=>['POST'],'admin/ai/draft'=>['POST'],'admin/ai/approve'=>['POST'],'admin/ai/publish'=>['POST'],'admin/ai/price'=>['POST']];
 if(preg_match('~^admin/(products|categories|orders)/[a-zA-Z0-9-]+$~D',$route,$m))$allowed[$route]=$m[1]==='orders'?['PATCH','DELETE']:['DELETE'];
 if(!in_array($method,$allowed[$route]??[],true))fail(404,'Ruta móvil no encontrada.');

 $_GET['route']=$route;apiDispatch();
}catch(ApiError $e){answer(['error'=>$e->getMessage()],$e->status);}catch(Throwable $e){error_log('CAPA Android API: '.$e->getMessage());answer(['error'=>'No fue posible completar la operación. Tus cambios siguen guardados en el teléfono.'],500);}
