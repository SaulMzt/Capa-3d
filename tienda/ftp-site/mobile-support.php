<?php
declare(strict_types=1);

/** Additive Android integration. The web routes and their response formats stay intact. */
function mobileSchema():void {
 static $ready=false;if($ready)return;$ready=true;ensureConversationSchema();
 sql()->exec("CREATE TABLE IF NOT EXISTS mobile_sessions(id TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,password_version TEXT NOT NULL,device TEXT NOT NULL,expires_at INTEGER NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS mobile_devices(token TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES mobile_sessions(id) ON DELETE CASCADE,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS mobile_events(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,entity_id TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),sent INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS mobile_reads(admin_id TEXT NOT NULL,order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,message_id INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(admin_id,order_id));
 CREATE TABLE IF NOT EXISTS mobile_customer_reads(order_id INTEGER PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,message_id INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS mobile_chat_requests(request_id TEXT PRIMARY KEY,admin_id TEXT NOT NULL,message_id INTEGER NOT NULL REFERENCES order_messages(id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS mobile_notification_reads(admin_id TEXT PRIMARY KEY,last_id INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS mobile_push_deliveries(event_id INTEGER NOT NULL REFERENCES mobile_events(id) ON DELETE CASCADE,token_hash TEXT NOT NULL,PRIMARY KEY(event_id,token_hash));
 CREATE INDEX IF NOT EXISTS mobile_events_pending ON mobile_events(sent,id);
 CREATE TABLE IF NOT EXISTS mobile_previews(token_hash TEXT PRIMARY KEY,data TEXT NOT NULL,expires_at INTEGER NOT NULL);
 CREATE TRIGGER IF NOT EXISTS mobile_order_event_details AFTER INSERT ON mobile_events WHEN NEW.kind='order' AND NEW.title='Nuevo apartado' BEGIN UPDATE mobile_events SET body=COALESCE((SELECT COALESCE(json_extract(data,'$.customer'),'Cliente')||' · '||quantity||' × '||COALESCE(json_extract(data,'$.productName'),'Pedido')||' · $'||printf('%.2f',COALESCE(json_extract(data,'$.total'),0))||' MXN' FROM orders WHERE id=CAST(NEW.entity_id AS INTEGER)),NEW.body) WHERE id=NEW.id; END;
 CREATE TRIGGER IF NOT EXISTS mobile_stock_status AFTER UPDATE OF status ON products WHEN NEW.status='Agotado' AND OLD.status!='Agotado' AND NEW.stock=OLD.stock BEGIN INSERT INTO mobile_events(kind,entity_id,title,body) VALUES('product',NEW.id,'Producto agotado',NEW.name); END;
 CREATE TRIGGER IF NOT EXISTS mobile_order_insert AFTER INSERT ON orders BEGIN INSERT INTO mobile_events(kind,entity_id,title,body) VALUES('order',CAST(NEW.id AS TEXT),'Nuevo apartado',COALESCE(json_extract(NEW.data,'$.productName'),'Revisa el pedido')); END;
 CREATE TRIGGER IF NOT EXISTS mobile_order_cancel AFTER UPDATE OF status ON orders WHEN NEW.status='Cancelado' AND OLD.status!='Cancelado' BEGIN INSERT INTO mobile_events(kind,entity_id,title,body) VALUES('order',CAST(NEW.id AS TEXT),'Pedido cancelado',COALESCE(json_extract(NEW.data,'$.productName'),'')); END;
 CREATE TRIGGER IF NOT EXISTS mobile_message_insert AFTER INSERT ON order_messages WHEN NEW.sender='customer' BEGIN INSERT INTO mobile_events(kind,entity_id,title,body) VALUES('chat',CAST(NEW.order_id AS TEXT),'Nuevo mensaje',substr(NEW.body,1,160)); END;
 CREATE TRIGGER IF NOT EXISTS mobile_customer_insert AFTER INSERT ON customer_accounts BEGIN INSERT INTO mobile_events(kind,entity_id,title,body) VALUES('customer',NEW.id,'Nuevo cliente','Se registró una cuenta en la tienda'); END;
 CREATE TRIGGER IF NOT EXISTS mobile_stock_update AFTER UPDATE OF stock,status ON products WHEN NEW.unlimited=0 AND NEW.stock!=OLD.stock AND (NEW.stock=0 OR (NEW.stock<=COALESCE(json_extract(NEW.data,'$.lowStock'),3) AND OLD.stock>COALESCE(json_extract(NEW.data,'$.lowStock'),3))) BEGIN INSERT INTO mobile_events(kind,entity_id,title,body) VALUES('product',NEW.id,CASE WHEN NEW.stock=0 THEN 'Producto agotado' ELSE 'Inventario bajo' END,NEW.name||': '||NEW.stock||' unidades'); END;");
}
function mobileAdmin():array {
 mobileSchema();$header=$_SERVER['HTTP_AUTHORIZATION']??$_SERVER['REDIRECT_HTTP_AUTHORIZATION']??'';
 if(!preg_match('/^Bearer ([a-f0-9]{64})$/D',$header,$m))fail(401,'Inicia sesión en CAPA 3D Admin.');
 $user=one('SELECT a.id,a.email,a.password_hash,s.password_version,s.id sessionId,s.expires_at FROM mobile_sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=? AND s.expires_at>?',[hash('sha256',$m[1]),time()]);
 if(!$user||!hash_equals($user['password_version'],hash('sha256',$user['password_hash'])))fail(401,'Tu sesión ha caducado. Inicia sesión de nuevo.');
 unset($user['password_hash'],$user['password_version']);return $user;
}
function mobileFirebase():array {
 $file=__DIR__.'/database/firebase-public.json';$config=is_file($file)?json_decode((string)file_get_contents($file),true):[];
 return is_array($config)?array_intersect_key($config,array_flip(['apiKey','applicationId','projectId','senderId'])):[];
}
function mobileAfterResponse(int $status):void {
 if($status>=400||($_SERVER['REQUEST_METHOD']??'GET')==='GET')return;
 if(($_GET['route']??'')==='order-chat'){try{mobileSchema();$order=clientOrder(data());$last=(int)(one('SELECT MAX(id) n FROM order_messages WHERE order_id=?',[$order['id']])['n']??0);run('INSERT INTO mobile_customer_reads(order_id,message_id) VALUES(?,?) ON CONFLICT(order_id) DO UPDATE SET message_id=MAX(message_id,excluded.message_id)',[$order['id'],$last]);}catch(Throwable){}}
 // Push delivery is best effort and never changes an existing successful web response.
 if(!is_file(__DIR__.'/database/firebase-service-account.json'))return;
 register_shutdown_function(function(){try{if(function_exists('fastcgi_finish_request'))fastcgi_finish_request();mobileFlushPush();}catch(Throwable $e){error_log('CAPA Android push: '.$e->getMessage());}});
}
/** Called inside the product write transaction, so concurrent edits cannot overwrite silently. */
function mobileCheckProductVersion(string $id):void {
 $version=$_SERVER['HTTP_X_PRODUCT_VERSION']??'';if($version==='')return;
 foreach(products(true) as $product)if($product['id']===$id){
  if(!hash_equals(hash('sha256',json_encode($product)),$version))fail(409,'El producto cambió en la web. Actualiza los datos y revisa tus cambios antes de guardar.');return;
 }
 fail(409,'El producto fue eliminado. Revisa tus cambios antes de crear otra pieza.');
}
/** Bounded delivery, serialized by a file lock; retry from cron without incoming web traffic. */
function mobileFlushPush():void {
 mobileSchema();$credentialFile=__DIR__.'/database/firebase-service-account.json';if(!is_file($credentialFile)||!function_exists('curl_init'))return;
 $credentials=json_decode((string)file_get_contents($credentialFile),true);if(!is_array($credentials)||empty($credentials['private_key'])||empty($credentials['client_email'])||empty($credentials['project_id']))return;
 $lock=fopen(__DIR__.'/database/mobile-push.lock','c');if(!$lock||!flock($lock,LOCK_EX|LOCK_NB)){if($lock)fclose($lock);return;}
 try {
  $deadline=microtime(true)+(PHP_SAPI==='cli'?45:8);
  $devices=rows('SELECT d.token,s.password_version,a.password_hash FROM mobile_devices d JOIN mobile_sessions s ON s.id=d.session_id JOIN admins a ON a.id=s.admin_id WHERE s.expires_at>?',[time()]);
  $devices=array_values(array_filter($devices,fn($d)=>hash_equals($d['password_version'],hash('sha256',$d['password_hash']))));if(!$devices)return;
  $events=rows("SELECT * FROM mobile_events WHERE sent=0 AND attempts<5 AND created_at>strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day') ORDER BY id LIMIT 20");if(!$events)return;
  $cache=__DIR__.'/database/firebase-oauth.json';$saved=is_file($cache)?json_decode((string)file_get_contents($cache),true):[];$access=$saved['token']??'';
  if(!$access||($saved['expires']??0)<time()+60){
   $now=time();$claims=['iss'=>$credentials['client_email'],'scope'=>'https://www.googleapis.com/auth/firebase.messaging','aud'=>'https://oauth2.googleapis.com/token','iat'=>$now,'exp'=>$now+3600];$input=base64url('{"alg":"RS256","typ":"JWT"}').'.'.base64url(json_encode($claims));if(!openssl_sign($input,$signature,$credentials['private_key'],OPENSSL_ALGO_SHA256))return;
   $ch=curl_init('https://oauth2.googleapis.com/token');curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query(['grant_type'=>'urn:ietf:params:oauth:grant-type:jwt-bearer','assertion'=>$input.'.'.base64url($signature)]),CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>5]);$response=json_decode((string)curl_exec($ch),true);$http=curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);if($http!==200||empty($response['access_token']))return;
   $access=$response['access_token'];file_put_contents($cache,json_encode(['token'=>$access,'expires'=>$now+(int)($response['expires_in']??3600)]),LOCK_EX);chmod($cache,0600);
  }
  foreach($events as $event){
   $ok=true;
   foreach($devices as $device){
    $hash=hash('sha256',$device['token']);
    if(one('SELECT 1 FROM mobile_push_deliveries WHERE event_id=? AND token_hash=?',[$event['id'],$hash]))continue;
    if(microtime(true)>=$deadline)return;
    $payload=['message'=>['token'=>$device['token'],'data'=>['eventId'=>(string)$event['id'],'kind'=>$event['kind'],'entityId'=>$event['entity_id'],'title'=>$event['title'],'body'=>$event['body']],'android'=>['priority'=>'HIGH','ttl'=>'86400s']]];
    $ch=curl_init('https://fcm.googleapis.com/v1/projects/'.rawurlencode($credentials['project_id']).'/messages:send');
    curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($payload,JSON_UNESCAPED_UNICODE),CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_TIMEOUT_MS=>max(100,(int)min(5000,($deadline-microtime(true))*1000)),CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$access,'Content-Type: application/json']]);
    $raw=curl_exec($ch);$http=curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);
    if($http===200)run('INSERT OR IGNORE INTO mobile_push_deliveries(event_id,token_hash) VALUES(?,?)',[$event['id'],$hash]);
    elseif($http===404&&str_contains((string)$raw,'UNREGISTERED'))run('DELETE FROM mobile_devices WHERE token=?',[$device['token']]);
    else {$ok=false;if($http===401)@unlink($cache);error_log('CAPA Android FCM HTTP '.$http.' event '.(int)$event['id']);}
   }
   run('UPDATE mobile_events SET sent=?,attempts=attempts+1 WHERE id=?',[(int)$ok,$event['id']]);
  }
 }finally{flock($lock,LOCK_UN);fclose($lock);}
}
function mobileCustomers(array $orders):array {
 $customers=[];foreach(rows('SELECT id,contact_type,contact,created_at FROM customer_accounts ORDER BY created_at DESC') as $r)$customers[$r['id']]=['id'=>$r['id'],'name'=>$r['contact'],'contact'=>$r['contact'],'phone'=>$r['contact_type']==='phone'?$r['contact']:'','registeredAt'=>$r['created_at'],'orders'=>[],'spent'=>0];
 $links=[];foreach(rows('SELECT * FROM customer_orders') as $r)$links[$r['order_id']]=$r['customer_id'];
 foreach($orders as $order){$phone=preg_replace('/\D+/','',(string)($order['phone']??''));$id=$links[$order['id']]??'guest-'.hash('sha256',$phone!==''?$phone:strtolower((string)($order['customer']??'')).':'.$order['id']);
  if(!isset($customers[$id]))$customers[$id]=['id'=>$id,'name'=>$order['customer'],'contact'=>$order['phone']??'','phone'=>$order['phone']??'','registeredAt'=>null,'orders'=>[],'spent'=>0];
  if(!$customers[$id]['orders']){$customers[$id]['name']=$order['customer'];$customers[$id]['phone']=$order['phone']??'';}$customers[$id]['orders'][]=$order['id'];if($order['status']==='Entregado')$customers[$id]['spent']+=(float)$order['total'];
 }return array_values($customers);
}
function mobileConversations(string $adminId):array {
 return rows("SELECT o.id orderId,json_extract(o.data,'$.customer') customer,json_extract(o.data,'$.productName') productName,o.status,
 (SELECT body FROM order_messages WHERE order_id=o.id ORDER BY id DESC LIMIT 1) lastMessage,
 (SELECT created_at FROM order_messages WHERE order_id=o.id ORDER BY id DESC LIMIT 1) lastAt,
 (SELECT COUNT(*) FROM order_messages WHERE order_id=o.id AND sender='customer' AND id>COALESCE(r.message_id,0)) unread
 FROM orders o LEFT JOIN mobile_reads r ON r.order_id=o.id AND r.admin_id=? ORDER BY COALESCE(lastAt,o.created_at) DESC",[$adminId]);
}
