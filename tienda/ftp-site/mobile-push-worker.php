<?php
declare(strict_types=1);
// Schedule once per minute on a PHP hosting provider that supports cron.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('CAPA_API_LIBRARY', true);
require_once __DIR__.'/api.php';
mobileFlushPush();
