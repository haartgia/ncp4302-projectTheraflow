<?php
// Lightweight compatibility route: keep old/new links working.
$view = isset($_GET['view']) ? (string) $_GET['view'] : '';
$target = 'recovery.php';
if ($view !== '') {
    $target .= '?view=' . rawurlencode($view);
}
header('Location: ' . $target, true, 302);
exit;
