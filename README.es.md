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

## La página Cámaras y la tarjeta

La integración añade **Cámaras** al menú lateral. Se abre en una cámara, en
vivo, con la línea de tiempo del día debajo; **Mosaico** muestra todos los
canales a la vez y un toque en cualquiera abre esa cámara. Los administradores
también tienen ahí el formulario de credenciales y el botón **Añadir al panel**.

La misma vista es una tarjeta de panel. Elige **Cámaras del DVR Intelbras** en
el selector de tarjetas, o escríbela a mano:

```yaml
type: custom:intelbras-dvr-card
columns: 2            # opcional
default_view: grid    # opcional: grid (por defecto) o timeline
title: Cámaras        # opcional
entities:             # opcional, por defecto todos los canales del DVR
  - camera.dvr_canal_1
```

La línea de tiempo funciona como en la app del propio DVR: arrastra la regla
bajo la aguja para retroceder o avanzar y suelta para ver desde ese momento. Los
tramos grabados aparecen pintados en ella. Cambia la escala (10 min, 1 h, 6 h,
24 h), pausa, salta un minuto, elige otro día y toca **En vivo** para volver al
presente. Una grabación puede ir a 2x, 4x u 8x.

Home Assistant convierte las grabaciones a H.264 mientras las ves, por eso
funcionan en cualquier navegador y en el iPhone. Eso usa el procesador de la
máquina de Home Assistant mientras haya una grabación en reproducción.

No hace falta ninguna otra biblioteca de tarjetas. La página y la tarjeta
hablan español, portugués e inglés, siguiendo a Home Assistant.

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
- **HEVC.** El stream principal en directo puede ser H.265, que Firefox
  reproduce mal; el substream, usado por defecto, es H.264. Las grabaciones se
  convierten, así que el códec del disco no importa.
- **Ventana de navegación.** Los últimos 7 días, normalmente en bloques de 30 minutos.

Para el panel, [advanced-camera-card](https://github.com/dermotduffy/advanced-camera-card)
acepta `folders:` apuntando a `media-source://intelbras_dvr`.

## Licencia

[MIT](LICENSE).
