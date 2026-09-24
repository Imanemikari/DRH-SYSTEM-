// DRH SMTP send helper (Windows PowerShell, System.Net.Mail).
// Config via env vars; UTF-8 header/text/HTML values passed base64 (no quoting issues).
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
function E($k) { [Environment]::GetEnvironmentVariable($k) }
function D($b) { [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b)) }

$hostPort = E 'DRH_SMTP_HOST'
$smtpPort = [int](E 'DRH_SMTP_PORT')
$smtp = New-Object System.Net.Mail.SmtpClient($hostPort, $smtpPort)
$smtp.EnableSsl = ((E 'DRH_SMTP_SECURE') -eq 'true') -or ($smtpPort -eq 587)
$smtp.Timeout = 45000

$user = E 'DRH_SMTP_USER'
if ($user) {
  $smtp.Credentials = New-Object System.Net.NetworkCredential($user, (E 'DRH_SMTP_PASS'))
  $smtp.UseDefaultCredentials = $false
}

$msg = New-Object System.Net.Mail.MailMessage
$msg.From = (D (E 'DRH_MAIL_FROM'))
(D (E 'DRH_MAIL_TO')) -split ';' | ForEach-Object { if ($_) { $msg.To.Add($_.Trim()) } }
$msg.Subject = (D (E 'DRH_MAIL_SUBJECT'))
$msg.Body = (D (E 'DRH_MAIL_HTML'))
$msg.IsBodyHtml = $true

(E 'DRH_MAIL_FILES') -split ';' | ForEach-Object {
  if ($_ -and (Test-Path -LiteralPath $_)) {
    $att = New-Object System.Net.Mail.Attachment($_)
    $msg.Attachments.Add($att)
  }
}

try {
  $smtp.Send($msg)
  Write-Output 'SEND_OK'
} catch {
  Write-Error ("SEND_ERR: " + $_.Exception.Message)
  exit 1
} finally {
  try { $smtp.Dispose() } catch {}
}
