<?php
/**
 * EverythingTT Global Mail Inbound Processor
 * 
 * This script acts as a webhook receiver for incoming external emails (SMTP relay).
 * It routes emails to the correct user's mailbox in the EverythingTT storage.
 */

header('Content-Type: application/json');

// 1. Configuration & Security
$config = [
    'storage_base' => '../../news/mail-storage/',
    'email_map_base' => '../../news/mail-accounts-storage/email-map/',
    'allowed_relay_ips' => ['*'], // In production, restrict to your SMTP provider IPs
];

// 2. Capture Inbound Data (Expected from SMTP relay service like SendGrid, Mailgun, or custom postfix)
$raw_data = file_get_contents('php://input');
$data = json_decode($raw_data, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid payload']);
    exit;
}

// 3. Extract Core Fields
$to_email = $data['to'] ?? '';
$from_email = $data['from'] ?? '';
$subject = $data['subject'] ?? '(No Subject)';
$content = $data['content'] ?? $data['text'] ?? '';
$html_content = $data['html'] ?? '';

if (!$to_email || !$from_email) {
    http_response_code(422);
    echo json_encode(['error' => 'Missing sender or recipient']);
    exit;
}

// 4. Resolve Internal Mailbox
// Example: user@ett.mail
$prefix = strtolower(explode('@', $to_email)[0]);
$map_file = $config['email_map_base'] . $prefix . '.json';

if (!file_exists($map_file)) {
    http_response_code(404);
    echo json_encode(['error' => 'Recipient mailbox not found']);
    exit;
}

$map_data = json_decode(file_get_contents($map_file), true);
$mailbox_id = $map_data['mailboxId'] ?? null;

if (!$mailbox_id) {
    http_response_code(500);
    echo json_encode(['error' => 'Internal routing error']);
    exit;
}

// 5. Create Mail Object
$mail_id = 'ext_' . time() . '_' . bin2hex(random_bytes(4));
$mail_data = [
    'id' => $mail_id,
    'sender' => $from_email,
    'recipientId' => $to_email,
    'subject' => $subject,
    'content' => $content,
    'htmlContent' => $html_content,
    'timestamp' => date('c'),
    'type' => 'incoming',
    'isRead' => false,
    'source' => 'external'
];

// 6. Save to Storage
// Note: In this architecture, the PHP script writes directly to the shared storage folder.
// For GitHub-hosted sites, this would typically trigger a background push to the repo.
$target_dir = $config['storage_base'] . $mailbox_id . '/';
if (!is_dir($target_dir)) {
    mkdir($target_dir, 0777, true);
}

$save_path = $target_dir . $mail_id . '.json';
if (file_put_contents($save_path, json_encode($mail_data, JSON_PRETTY_PRINT))) {
    echo json_encode(['success' => true, 'mailId' => $mail_id]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save email to storage']);
}
