# QR Scanner Présence

Page : `/app/qr-scanner`.

## Flux
QR → token → validation → anti-duplication → présence → notification.

## Format recommandé
`QR_TOKEN|student_id|schedule_id|expires_at|signature`

Le format legacy `SN|id|nom|prenom|formation` est accepté uniquement en compatibilité.

## Anti-fraude
- `duplicate_scan`
- `late_scan`
- `invalid_token`
- `expired_token`
- `outside_session`

## Offline
Les scans hors ligne sont placés dans une file locale `sn_qr_offline_queue_v1` puis synchronisés.
