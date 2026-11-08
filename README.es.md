<p align="center">
  <img src="custom_components/intelbras_dvr/brand/logo.png" width="240" alt="">
</p>

<h1 align="center">Intelbras DVR</h1>

<p align="center">
  Tu DVR Intelbras o Dahua en Home Assistant: canales en vivo, grabaciones en<br>
  el panel de Medios, y una dirección que se arregla sola cuando el DHCP la cambia.
</p>

<p align="center">
  <a href="https://github.com/constantini-ha/intelbras_dvr/releases"><img src="https://img.shields.io/github/v/release/constantini-ha/intelbras_dvr?style=flat-square&color=41BDF5" alt="versión"></a>
  <img src="https://img.shields.io/badge/Home_Assistant-2024.1+-41BDF5?style=flat-square" alt="Home Assistant">
  <img src="https://img.shields.io/badge/licencia-MIT-green?style=flat-square" alt="MIT">
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.pt-BR.md">Português</a> · <b>Español</b>
</p>

> **No oficial.** Intelbras® y Dahua® son marcas registradas de sus dueños. Esta
> es una integración comunitaria, sin vínculo, respaldo ni soporte de Intelbras
> S.A. ni de Dahua Technology.

---

## Qué obtienes

```
  DVR ──┬── en vivo     una entidad de cámara por canal
        │               snapshot HTTP (digest) + stream RTSP
        │
        ├── grabaciones Medios → Intelbras DVR → canal → día → tramo
        │               playback RTSP, convertido a HLS por Home Assistant
        │
        └── él mismo    rastreado por MAC, así sigue solo a su nueva IP
```

## Instalación

1. **HACS** (o Marketplace desde 2026.11) → ⋮ → **Repositorios personalizados**
2. URL `https://github.com/constantini-ha/intelbras_dvr`, categoría *Integración*
3. Instala, reinicia y ve a **Ajustes → Dispositivos y servicios → Añadir integración → Intelbras DVR**

A mano: copia `custom_components/intelbras_dvr/` en tu `config/custom_components/`.

## Añadir el DVR

| Campo | Predeterminado | Qué es |
| --- | --- | --- |
| `host` | — | la IP del DVR, por ejemplo `172.16.0.12` |
| `username` | `admin` | usuario del DVR |
| `password` | — | contraseña del DVR |
| `channels` | `4` | cuántas entidades de cámara crear |
| `rtsp_port` | `554` | puerto RTSP |
| `track_by_mac` | `true` | seguir al DVR cuando cambie su IP |
| `scan_interval` | `300` | cada cuánto comprobar, en segundos |

Al enviar, la integración llama a `snapshot.cgi?channel=1` con autenticación
digest; si responde HTTP 200, se crean los canales.

## Cuando cambia la IP

Nada que hacer. En cada ciclo la integración lee la tabla ARP local, aprende la
MAC del DVR la primera vez y, desde entonces, busca el aparato por esa MAC —
que sobrevive al cambio de concesión, a diferencia de la dirección. Cuando se
mueve, la entrada se actualiza, la integración se recarga, y toda cámara
`generic` que apuntaba a la dirección vieja pasa a apuntar a la nueva.

Requiere Home Assistant en la misma L2 que el DVR, con `network_mode: host` o
en máquina física. Un contenedor en bridge no ve la tabla ARP del host.

## Cambiar credenciales

```yaml
action: intelbras_dvr.apply_credentials
data:
  entry_id: <config_entry_id>   # opcional si solo hay un DVR
  host: 172.16.0.12
  username: admin
  password: nueva-contraseña
```

Valida contra el DVR, actualiza la entrada y recarga en el sitio — sin reiniciar
Home Assistant. El sensor `last_apply_result` cuenta qué pasó: `OK:`, `FAIL:` o
`AUTO:`.

## Qué esperar

- **Bloqueo por intentos.** Estos DVR bloquean la IP del cliente unos 30 minutos
  tras 3 a 5 inicios de sesión fallidos. La integración detecta el HTTP 401 y
  pausa los reintentos 5 minutos, en lugar de empeorar el bloqueo.
- **Sesiones de reproducción.** Los equipos de entrada permiten una o dos a la
  vez. Si un vídeo no arranca, cierra los demás.
- **HEVC.** Las grabaciones en H.265 funcionan en Safari, Chrome y Edge. El
  soporte de Firefox es flojo — igual que en el directo.
- **Ventana de navegación.** Los últimos 7 días, normalmente en bloques de 30 minutos.

Para el panel, [advanced-camera-card](https://github.com/dermotduffy/advanced-camera-card)
acepta `folders:` apuntando a `media-source://intelbras_dvr`.

## Licencia

[MIT](LICENSE).
