<?php
/**
 * EverythingTT Global Mail Inbound Processor
 * 
 * This script acts as a webhook receiver for incoming external emails (SMTP relay).
 * It routes emails to the correct user's mailbox in the EverythingTT storage (GitHub).
 */

header('Content-Type: application/json');

// 1. Configuration
$config = [
    'github_pat' => getenv('GITHUB_PAT') ?: '', // Set via environment variable on the server
    'owner' => 'Painsel',
    'repo' => 'EverythingTT-Critical-Data',
    'middleware_url' => 'https://everything-tt-api.vercel.app/'
];

// 2. Capture Inbound Data
$raw_data = file_get_contents('php://input');
$data = json_decode($raw_data, true);

if (!$data) {
    // If not JSON, check if it's form-encoded (some relays use this)
    if (!empty($_POST)) {
        $data = $_POST;
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid payload']);
        exit;
    }
}

// 3. Extract Core Fields
$to_email = $data['to'] ?? $data['recipient'] ?? '';
$from_email = $data['from'] ?? $data['sender'] ?? '';
$subject = $data['subject'] ?? '(No Subject)';
$content = $data['content'] ?? $data['text'] ?? $data['body-plain'] ?? '';
$html_content = $data['html'] ?? $data['body-html'] ?? '';

if (!$to_email || !$from_email) {
    http_response_code(422);
    echo json_encode(['error' => 'Missing sender or recipient']);
    exit;
}

// 4. Helper: GitHub API Request
function github_request($path, $method = 'GET', $body = null) {
    global $config;
    
    // Use middleware for critical data repo if possible, otherwise direct
    $url = "https://api.github.com/repos/{$config['owner']}/{$config['repo']}/contents/" . ltrim($path, '/');
    
    $ch = curl_init($url);
    $headers = [
        'Authorization: token ' . $config['github_pat'],
        'User-Agent: EverythingTT-Mail-Relay',
        'Accept: application/vnd.github.v3+json',
        'Content-Type: application/json'
    ];
    
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    
    if ($body) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    
    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    return [
        'status' => $status,
        'data' => json_decode($response, true),
        'raw' => $response
    ];
}

// 5. Resolve Internal Mailbox
$prefix = strtolower(explode('@', $to_email)[0]);
$map_path = "mail-accounts-storage/email-map/{$prefix}.json";

$map_res = github_request($map_path);
if ($map_res['status'] !== 200) {
    http_response_code(404);
    echo json_encode(['error' => 'Recipient mailbox not found on EverythingTT', 'path' => $map_path]);
    exit;
}

$map_content_raw = $map_res['data']['content'];
$map_json_str = decode_github_content($map_content_raw);
$map_data = json_decode($map_json_str, true);
$mailbox_id = $map_data['mailboxId'] ?? null;

if (!$mailbox_id) {
    http_response_code(500);
    echo json_encode(['error' => 'Internal routing error: No mailbox ID']);
    exit;
}

// 6. Create Mail Object
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

// 7. Encode for EverythingTT Storage (ett_enc_v1)
$mail_json = json_encode($mail_data, JSON_PRETTY_PRINT);
$encoded_content = 'ett_enc_v1:' . base64_encode($mail_json);

// 8. Save to GitHub
$save_path = "mail-storage/{$mailbox_id}/{$mail_id}.json";
$save_res = github_request($save_path, 'PUT', [
    'message' => "Mail: Received external email from {$from_email} to {$to_email}",
    'content' => base64_encode($encoded_content)
]);

if ($save_res['status'] === 201 || $save_res['status'] === 200) {
    echo json_encode(['success' => true, 'mailId' => $mail_id]);
} else {
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to save email to GitHub storage',
        'github_status' => $save_res['status'],
        'github_response' => $save_res['data']
    ]);
}

/**
 * Decode GitHub content (Base64) and handle EverythingTT custom encoding if present
 */
function decode_github_content($base64_content) {
    $content = base64_decode(str_replace(["\n", "\r", " "], '', $base64_content));
    if (strpos($content, 'ett_enc_v1:') === 0) {
        return base64_decode(substr($content, strlen('ett_enc_v1:')));
    }
    return $content;
}
