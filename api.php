<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$dataFile = __DIR__ . '/data.json';
$heartbeatToken = getenv('CODEXIFY_HEARTBEAT_TOKEN') ?: '';
if ($heartbeatToken === '' && is_file(__DIR__ . '/config.local.php')) {
  $localConfig = include __DIR__ . '/config.local.php';
  if (is_array($localConfig) && !empty($localConfig['heartbeatToken'])) {
    $heartbeatToken = $localConfig['heartbeatToken'];
  }
}
$heartbeatWindow = 120;

$defaultData = [
  'users' => [
    ['id' => 'admin', 'name' => 'Admin', 'username' => 'admin', 'password' => 'admin123', 'role' => 'admin'],
    ['id' => 'usuario', 'name' => 'Usuario Demo', 'username' => 'usuario', 'password' => 'usuario123', 'role' => 'user'],
  ],
  'pcs' => [
    ['id' => 'pc-1', 'userId' => 'usuario', 'name' => 'PC Demo', 'ip' => '192.168.1.25', 'status' => 'Conectada', 'earning' => 0],
  ],
  'withdrawals' => [],
  'pcRequests' => [],
  'registrationRequests' => [],
  'heartbeats' => [],
  'maintenance' => [
    'enabled' => false,
    'badge' => 'Mantenimiento programado',
    'title' => 'Volvemos muy pronto',
    'highlight' => 'pronto',
    'description' => 'Estamos realizando mejoras en Codexify para ofrecerte una experiencia mas rapida, segura y estable.',
    'etaTitle' => 'Tiempo estimado',
    'etaText' => 'Esperamos volver en 2 a 4 horas.',
    'contactTitle' => 'Contacto',
    'contactText' => 'Si necesitas ayuda urgente, escribe al administrador.',
    'contactEmail' => 'soporte@codexify.com',
    'updateTitle' => 'Estado',
    'updateText' => 'El equipo esta trabajando en la actualizacion.',
    'metricOneValue' => '24/7',
    'metricOneLabel' => 'Monitoreo',
    'metricTwoValue' => '99%',
    'metricTwoLabel' => 'Avance',
    'metricThreeValue' => '2-4h',
    'metricThreeLabel' => 'Estimado',
  ],
];

function respond($payload, $status = 200) {
  http_response_code($status);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE);
  exit;
}

function loadData($dataFile, $defaultData) {
  if (!file_exists($dataFile)) {
    file_put_contents($dataFile, json_encode($defaultData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
  }

  $contents = file_get_contents($dataFile);
  $data = json_decode($contents, true);

  if (!is_array($data) || !isset($data['users']) || !isset($data['pcs'])) {
    $data = $defaultData;
    file_put_contents($dataFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
  }

  if (!isset($data['withdrawals']) || !is_array($data['withdrawals'])) {
    $data['withdrawals'] = [];
    file_put_contents($dataFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
  }

  if (!isset($data['pcRequests']) || !is_array($data['pcRequests'])) {
    $data['pcRequests'] = [];
    file_put_contents($dataFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
  }

  if (!isset($data['registrationRequests']) || !is_array($data['registrationRequests'])) {
    $data['registrationRequests'] = [];
    file_put_contents($dataFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
  }

  if (!isset($data['heartbeats']) || !is_array($data['heartbeats'])) {
    $data['heartbeats'] = [];
    file_put_contents($dataFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
  }

  if (!isset($data['maintenance']) || !is_array($data['maintenance'])) {
    $data['maintenance'] = $defaultData['maintenance'];
    file_put_contents($dataFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
  } else {
    $mergedMaintenance = array_merge($defaultData['maintenance'], $data['maintenance']);
    if ($mergedMaintenance !== $data['maintenance']) {
      $data['maintenance'] = $mergedMaintenance;
      file_put_contents($dataFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    }
  }

  return $data;
}

function saveData($dataFile, $data) {
  file_put_contents($dataFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function currentUser($data) {
  $sessionId = $_SESSION['user_id'] ?? null;
  if (!$sessionId) return null;

  foreach ($data['users'] as $user) {
    if ($user['id'] === $sessionId) return $user;
  }

  return null;
}

function requireAdmin($user) {
  if (!$user || $user['role'] !== 'admin') {
    respond(['ok' => false, 'message' => 'Acceso no autorizado.'], 403);
  }
}

function totalEarnings($data, $userId) {
  $total = 0;
  foreach ($data['pcs'] as $pc) {
    if ($pc['userId'] === $userId) {
      $total += (float)($pc['earning'] ?? 0);
    }
  }
  return $total;
}

function totalWithdrawals($data, $userId) {
  $total = 0;
  foreach ($data['withdrawals'] as $withdrawal) {
    if ($withdrawal['userId'] === $userId && ($withdrawal['status'] ?? '') !== 'Rechazado') {
      $total += (float)($withdrawal['amount'] ?? 0);
    }
  }
  return $total;
}

function cleanHost($host) {
  $host = trim((string)$host);
  $host = preg_replace('/^https?:\/\//', '', $host);
  $host = preg_replace('/[:\/].*$/', '', $host);
  return $host;
}

function sshStatus($host) {
  $host = cleanHost($host);
  if ($host === '') return 'Sin verificar';

  $connection = @fsockopen($host, 22, $errno, $errstr, 1.5);
  if ($connection) {
    fclose($connection);
    return 'Conectada';
  }

  return 'Apagada';
}

function pcLiveStatus($data, $pc, $heartbeatWindow) {
  $pcId = $pc['id'] ?? '';
  $lastSeen = $data['heartbeats'][$pcId] ?? null;

  if ($lastSeen !== null) {
    return (time() - (int)$lastSeen) <= $heartbeatWindow ? 'Conectada' : 'Apagada';
  }

  return sshStatus($pc['ip'] ?? '');
}

function publicMaintenance($data) {
  $maintenance = $data['maintenance'] ?? [];
  $maintenance['enabled'] = !empty($maintenance['enabled']);
  return $maintenance;
}

function maintenanceEnabled($data) {
  return !empty($data['maintenance']['enabled']);
}

$action = $_POST['action'] ?? $_GET['action'] ?? 'state';
$data = loadData($dataFile, $defaultData);

if ($action === 'login') {
  $username = trim($_POST['username'] ?? '');
  $password = trim($_POST['password'] ?? '');

  foreach ($data['users'] as $user) {
    if ($user['username'] === $username && $user['password'] === $password) {
      if (maintenanceEnabled($data) && $user['role'] !== 'admin') {
        respond(['ok' => false, 'message' => 'La plataforma esta en mantenimiento.', 'maintenance' => publicMaintenance($data)], 503);
      }

      $_SESSION['user_id'] = $user['id'];
      respond(['ok' => true, 'user' => $user]);
    }
  }

  respond(['ok' => false, 'message' => 'Usuario o password incorrecto.'], 401);
}

if ($action === 'logout') {
  $_SESSION = [];
  session_destroy();
  respond(['ok' => true]);
}

if ($action === 'register_user') {
  $name = trim($_POST['name'] ?? '');
  $username = trim($_POST['username'] ?? '');
  $password = trim($_POST['password'] ?? '');
  $confirmPassword = trim($_POST['confirmPassword'] ?? '');
  $option = trim($_POST['option'] ?? 'economica');
  $allowedOptions = ['economica', 'cuerpo-completo', 'ventiladores'];

  if ($name === '' || $username === '' || $password === '' || $confirmPassword === '') {
    respond(['ok' => false, 'message' => 'Completa todos los campos del registro.'], 422);
  }

  if ($password !== $confirmPassword) {
    respond(['ok' => false, 'message' => 'La contraseña y la confirmacion no coinciden.'], 422);
  }

  if (!in_array($option, $allowedOptions, true)) {
    respond(['ok' => false, 'message' => 'Selecciona una opcion valida.'], 422);
  }

  foreach ($data['users'] as $existing) {
    if (($existing['username'] ?? '') === $username) {
      respond(['ok' => false, 'message' => 'Ese nombre de inicio de sesion ya existe.'], 409);
    }
  }

  $optionLabels = [
    'economica' => 'Opcion Economica',
    'cuerpo-completo' => 'Opcion con disipador de cuerpo completo',
    'ventiladores' => 'Opcion con ventiladores silenciosos',
  ];

  $userId = 'user-' . time() . '-' . random_int(1000, 9999);
  $newUser = [
    'id' => $userId,
    'name' => $name,
    'username' => $username,
    'password' => $password,
    'role' => 'user',
  ];
  $data['users'][] = $newUser;

  array_unshift($data['registrationRequests'], [
    'id' => 'registration-' . time() . '-' . random_int(1000, 9999),
    'userId' => $userId,
    'userName' => $name,
    'username' => $username,
    'option' => $option,
    'optionLabel' => $optionLabels[$option],
    'status' => 'Pendiente',
    'createdAt' => date('d/m/Y H:i'),
  ]);

  saveData($dataFile, $data);
  $_SESSION['user_id'] = $userId;
  respond(['ok' => true, 'user' => $newUser]);
}

if ($action === 'heartbeat') {
  $token = trim($_POST['token'] ?? $_GET['token'] ?? '');
  if (!hash_equals($heartbeatToken, $token)) {
    respond(['ok' => false, 'message' => 'Token no valido.'], 403);
  }

  $pcId = trim($_POST['pcId'] ?? $_GET['pcId'] ?? '');
  $ip = cleanHost($_POST['ip'] ?? $_GET['ip'] ?? '');
  $matchedPcId = '';

  foreach ($data['pcs'] as $pc) {
    if (($pcId !== '' && ($pc['id'] ?? '') === $pcId) || ($ip !== '' && cleanHost($pc['ip'] ?? '') === $ip)) {
      $matchedPcId = $pc['id'];
      break;
    }
  }

  if ($matchedPcId === '') {
    respond(['ok' => false, 'message' => 'PC no encontrada.'], 404);
  }

  $data['heartbeats'][$matchedPcId] = time();
  saveData($dataFile, $data);
  respond(['ok' => true, 'status' => 'Conectada']);
}

if ($action === 'maintenance_state') {
  respond(['ok' => true, 'maintenance' => publicMaintenance($data)]);
}

$user = currentUser($data);

if ($action === 'state') {
  if (!$user) respond(['ok' => false, 'message' => 'Sin sesion.'], 401);

  if (maintenanceEnabled($data) && $user['role'] !== 'admin') {
    respond(['ok' => false, 'message' => 'La plataforma esta en mantenimiento.', 'maintenance' => publicMaintenance($data)], 503);
  }

  if ($user['role'] === 'admin') {
    respond(['ok' => true, 'user' => $user, 'users' => $data['users'], 'pcs' => $data['pcs'], 'withdrawals' => $data['withdrawals'], 'pcRequests' => $data['pcRequests'], 'registrationRequests' => $data['registrationRequests'], 'maintenance' => publicMaintenance($data)]);
  }

  $pcs = array_values(array_filter($data['pcs'], function ($pc) use ($user) {
    return $pc['userId'] === $user['id'];
  }));

  $withdrawals = array_values(array_filter($data['withdrawals'], function ($withdrawal) use ($user) {
    return $withdrawal['userId'] === $user['id'];
  }));

  $pcRequests = array_values(array_filter($data['pcRequests'], function ($request) use ($user) {
    return $request['userId'] === $user['id'];
  }));

  $registrationRequests = array_values(array_filter($data['registrationRequests'], function ($request) use ($user) {
    return $request['userId'] === $user['id'];
  }));

  respond(['ok' => true, 'user' => $user, 'users' => [], 'pcs' => $pcs, 'withdrawals' => $withdrawals, 'pcRequests' => $pcRequests, 'registrationRequests' => $registrationRequests, 'maintenance' => publicMaintenance($data)]);
}

if ($action === 'pc_statuses') {
  if (!$user) respond(['ok' => false, 'message' => 'Sin sesion.'], 401);

  if (maintenanceEnabled($data) && $user['role'] !== 'admin') {
    respond(['ok' => false, 'message' => 'La plataforma esta en mantenimiento.', 'maintenance' => publicMaintenance($data)], 503);
  }

  $visiblePcs = $user['role'] === 'admin'
    ? $data['pcs']
    : array_values(array_filter($data['pcs'], function ($pc) use ($user) {
      return $pc['userId'] === $user['id'];
    }));

  $statuses = [];
  foreach ($visiblePcs as $pc) {
    $statuses[$pc['id']] = pcLiveStatus($data, $pc, $heartbeatWindow);
  }

  respond(['ok' => true, 'statuses' => $statuses]);
}

if ($action === 'create_withdrawal') {
  if (!$user) respond(['ok' => false, 'message' => 'Sin sesion.'], 401);

  $method = trim($_POST['method'] ?? '');
  $amount = (float)($_POST['amount'] ?? 0);

  if ($method === 'transferencia') {
    respond(['ok' => false, 'message' => 'Los retiros por transferencia estaran disponibles proximamente.'], 422);
  }

  if ($method !== 'efectivo' || $amount <= 0) {
    respond(['ok' => false, 'message' => 'Solicitud de retiro no valida.'], 422);
  }

  $available = max(totalEarnings($data, $user['id']) - totalWithdrawals($data, $user['id']), 0);
  if ($amount > $available) {
    respond(['ok' => false, 'message' => 'No tienes fondos suficientes para retirar ese monto.'], 422);
  }

  array_unshift($data['withdrawals'], [
    'id' => 'withdrawal-' . time() . '-' . random_int(1000, 9999),
    'userId' => $user['id'],
    'method' => 'Efectivo',
    'amount' => $amount,
    'status' => 'Pendiente',
    'createdAt' => date('d/m/Y'),
  ]);

  saveData($dataFile, $data);
  respond(['ok' => true]);
}

if ($action === 'create_pc_request') {
  if (!$user) respond(['ok' => false, 'message' => 'Sin sesion.'], 401);

  if (maintenanceEnabled($data) && $user['role'] !== 'admin') {
    respond(['ok' => false, 'message' => 'La plataforma esta en mantenimiento.', 'maintenance' => publicMaintenance($data)], 503);
  }

  $wifiName = (string)($_POST['wifiName'] ?? '');
  $wifiPassword = (string)($_POST['wifiPassword'] ?? '');

  if ($wifiName === '' || $wifiPassword === '') {
    respond(['ok' => false, 'message' => 'Completa el nombre de WiFi y la contraseña exactamente como son.'], 422);
  }

  array_unshift($data['pcRequests'], [
    'id' => 'pc-request-' . time() . '-' . random_int(1000, 9999),
    'userId' => $user['id'],
    'userName' => $user['name'],
    'username' => $user['username'],
    'wifiName' => $wifiName,
    'wifiPassword' => $wifiPassword,
    'status' => 'Pendiente',
    'createdAt' => date('d/m/Y H:i'),
  ]);

  saveData($dataFile, $data);
  respond(['ok' => true]);
}

if ($action === 'update_pc_request') {
  if (!$user) respond(['ok' => false, 'message' => 'Sin sesion.'], 401);

  if (maintenanceEnabled($data) && $user['role'] !== 'admin') {
    respond(['ok' => false, 'message' => 'La plataforma esta en mantenimiento.', 'maintenance' => publicMaintenance($data)], 503);
  }

  $requestId = trim($_POST['requestId'] ?? '');
  $wifiName = (string)($_POST['wifiName'] ?? '');
  $wifiPassword = (string)($_POST['wifiPassword'] ?? '');

  if ($requestId === '' || $wifiName === '' || $wifiPassword === '') {
    respond(['ok' => false, 'message' => 'Completa el nombre de WiFi y la contraseña exactamente como son.'], 422);
  }

  foreach ($data['pcRequests'] as &$request) {
    if (($request['id'] ?? '') === $requestId && ($request['userId'] ?? '') === $user['id']) {
      $request['wifiName'] = $wifiName;
      $request['wifiPassword'] = $wifiPassword;
      $request['edited'] = true;
      $request['editedAt'] = date('d/m/Y H:i');
      saveData($dataFile, $data);
      respond(['ok' => true]);
    }
  }

  respond(['ok' => false, 'message' => 'Solicitud no encontrada.'], 404);
}

requireAdmin($user);

if ($action === 'create_user') {
  $name = trim($_POST['name'] ?? '');
  $username = trim($_POST['username'] ?? '');
  $password = trim($_POST['password'] ?? '');

  if ($name === '' || $username === '' || $password === '') {
    respond(['ok' => false, 'message' => 'Completa todos los campos.'], 422);
  }

  foreach ($data['users'] as $existing) {
    if ($existing['username'] === $username) {
      respond(['ok' => false, 'message' => 'Ese usuario ya existe.'], 409);
    }
  }

  $data['users'][] = [
    'id' => 'user-' . time() . '-' . random_int(1000, 9999),
    'name' => $name,
    'username' => $username,
    'password' => $password,
    'role' => 'user',
  ];

  saveData($dataFile, $data);
  respond(['ok' => true]);
}

if ($action === 'delete_user') {
  $userId = trim($_POST['userId'] ?? '');

  if ($userId === '' || $userId === 'admin') {
    respond(['ok' => false, 'message' => 'No puedes eliminar este usuario.'], 422);
  }

  $targetUser = null;
  foreach ($data['users'] as $existing) {
    if (($existing['id'] ?? '') === $userId) {
      $targetUser = $existing;
      break;
    }
  }

  if (!$targetUser) {
    respond(['ok' => false, 'message' => 'Usuario no encontrado.'], 404);
  }

  if (($targetUser['role'] ?? '') === 'admin') {
    respond(['ok' => false, 'message' => 'No puedes eliminar una cuenta admin.'], 422);
  }

  $data['users'] = array_values(array_filter($data['users'], function ($item) use ($userId) {
    return ($item['id'] ?? '') !== $userId;
  }));
  $data['pcs'] = array_values(array_filter($data['pcs'], function ($item) use ($userId) {
    return ($item['userId'] ?? '') !== $userId;
  }));
  $data['withdrawals'] = array_values(array_filter($data['withdrawals'], function ($item) use ($userId) {
    return ($item['userId'] ?? '') !== $userId;
  }));
  $data['pcRequests'] = array_values(array_filter($data['pcRequests'], function ($item) use ($userId) {
    return ($item['userId'] ?? '') !== $userId;
  }));
  $data['registrationRequests'] = array_values(array_filter($data['registrationRequests'], function ($item) use ($userId) {
    return ($item['userId'] ?? '') !== $userId;
  }));

  saveData($dataFile, $data);
  respond(['ok' => true]);
}

if ($action === 'create_pc') {
  $userId = trim($_POST['userId'] ?? '');
  $name = trim($_POST['name'] ?? '');
  $ip = trim($_POST['ip'] ?? '');
  $earning = (float)($_POST['earning'] ?? 0);

  if ($userId === '' || $name === '' || $ip === '') {
    respond(['ok' => false, 'message' => 'Completa todos los campos.'], 422);
  }

  $data['pcs'][] = [
    'id' => 'pc-' . time() . '-' . random_int(1000, 9999),
    'userId' => $userId,
    'name' => $name,
    'ip' => $ip,
    'status' => 'Verificando',
    'earning' => $earning,
  ];

  saveData($dataFile, $data);
  respond(['ok' => true]);
}

if ($action === 'update_earning') {
  $pcId = trim($_POST['pcId'] ?? '');
  $earning = (float)($_POST['earning'] ?? 0);

  foreach ($data['pcs'] as &$pc) {
    if ($pc['id'] === $pcId) {
      $pc['earning'] = $earning;
      saveData($dataFile, $data);
      respond(['ok' => true]);
    }
  }

  respond(['ok' => false, 'message' => 'PC no encontrada.'], 404);
}

if ($action === 'update_withdrawal_status') {
  $withdrawalId = trim($_POST['withdrawalId'] ?? '');
  $status = trim($_POST['status'] ?? '');
  $allowed = ['Pendiente', 'En proceso', 'Completado', 'Rechazado'];

  if (!in_array($status, $allowed, true)) {
    respond(['ok' => false, 'message' => 'Estado no valido.'], 422);
  }

  foreach ($data['withdrawals'] as &$withdrawal) {
    if ($withdrawal['id'] === $withdrawalId) {
      $withdrawal['status'] = $status;
      saveData($dataFile, $data);
      respond(['ok' => true]);
    }
  }

  respond(['ok' => false, 'message' => 'Retiro no encontrado.'], 404);
}

if ($action === 'update_maintenance') {
  $fields = [
    'badge',
    'title',
    'highlight',
    'description',
    'etaTitle',
    'etaText',
    'contactTitle',
    'contactText',
    'contactEmail',
    'updateTitle',
    'updateText',
    'metricOneValue',
    'metricOneLabel',
    'metricTwoValue',
    'metricTwoLabel',
    'metricThreeValue',
    'metricThreeLabel',
  ];

  $maintenance = $data['maintenance'] ?? $defaultData['maintenance'];
  $maintenance['enabled'] = ($_POST['enabled'] ?? '') === '1';

  foreach ($fields as $field) {
    if (isset($_POST[$field])) {
      $maintenance[$field] = trim((string)$_POST[$field]);
    }
  }

  $data['maintenance'] = array_merge($defaultData['maintenance'], $maintenance);
  saveData($dataFile, $data);
  respond(['ok' => true, 'maintenance' => publicMaintenance($data)]);
}

if ($action === 'delete_pc_request') {
  $requestId = trim($_POST['requestId'] ?? '');

  $before = count($data['pcRequests']);
  $data['pcRequests'] = array_values(array_filter($data['pcRequests'], function ($request) use ($requestId) {
    return ($request['id'] ?? '') !== $requestId;
  }));

  if (count($data['pcRequests']) === $before) {
    respond(['ok' => false, 'message' => 'Solicitud no encontrada.'], 404);
  }

  saveData($dataFile, $data);
  respond(['ok' => true]);
}

if ($action === 'update_registration_request_status') {
  $requestId = trim($_POST['requestId'] ?? '');
  $status = trim($_POST['status'] ?? '');
  $allowed = ['Pendiente', 'Confirmada', 'Denegada'];

  if (!in_array($status, $allowed, true)) {
    respond(['ok' => false, 'message' => 'Estado no valido.'], 422);
  }

  foreach ($data['registrationRequests'] as &$request) {
    if (($request['id'] ?? '') === $requestId) {
      $request['status'] = $status;
      $request['updatedAt'] = date('d/m/Y H:i');
      saveData($dataFile, $data);
      respond(['ok' => true]);
    }
  }

  respond(['ok' => false, 'message' => 'Solicitud no encontrada.'], 404);
}

respond(['ok' => false, 'message' => 'Accion no valida.'], 400);
?>
