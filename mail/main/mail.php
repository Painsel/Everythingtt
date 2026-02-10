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
    // [FIX] Correctly route to the storage folders in the root of the repo
    $clean_path = ltrim($path, '/');
    if (strpos($clean_path, 'news/') === 0) {
        $clean_path = substr($clean_path, 5);
    }
    
    // [FIX] Ensure mail-relay paths are also cleaned if they have news/ prefix
    if (strpos($clean_path, 'mail-relay/') === 0) {
        // Already root
    }

    $url = "https://api.github.com/repos/{$config['owner']}/{$config['repo']}/contents/" . $clean_path;
    
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

// 9. Index in Global Email Storage (for Admin/Security logs)
$history_path = "mail-accounts-storage/email-history.json";
$history_res = github_request($history_path);
$history_list = [];

if ($history_res['status'] === 200) {
    $history_content = decode_github_content($history_res['data']['content']);
    $history_list = json_decode($history_content, true) ?: [];
}

// Keep only metadata in global history for privacy, but enough for tracking
$history_entry = [
    'id' => $mail_id,
    'sender' => $from_email,
    'recipient' => $to_email,
    'mailboxId' => $mailbox_id,
    'subject' => $subject,
    'timestamp' => $mail_data['timestamp'],
    'isDiscord' => (strpos(strtolower($from_email), 'discord.com') !== false),
    'path' => $save_path
];

array_unshift($history_list, $history_entry);
if (count($history_list) > 1000) array_pop($history_list); // Cap history size

$history_json = json_encode($history_list, JSON_PRETTY_PRINT);
$history_encoded = 'ett_enc_v1:' . base64_encode($history_json);

github_request($history_path, 'PUT', [
    'message' => "Mail: Updated global history for {$to_email}",
    'content' => base64_encode($history_encoded),
    'sha' => $history_res['data']['sha'] ?? null
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
