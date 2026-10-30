# Security hold — V3.2.5

This branch contains an experimental local-LAN phone wallpaper receiver for webOS. It is not security-certified for public deployment.

Threats addressed offline include pairing token expiration, six-digit PIN attempts, Host/Origin checks, JPEG validation, service lifecycle and safe shutdown. The code's actual webOS LS2 registration, process identity, package directory permissions and rollback behavior have **not** been attested on hardware.

Do not expose the receiver port to the Internet or a public reverse proxy. Do not weaken PIN/session or Origin validation. Do not run unreviewed app-update or root scripts against a production TV.

The `native-home*.sh` files at repository root represent a separate experiment; its README retains the SECURITY HOLD and must not be interpreted as approved by this source upload.
