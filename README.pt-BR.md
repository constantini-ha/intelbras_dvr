<p align="center">
  <img src="custom_components/intelbras_dvr/brand/logo.png" width="240" alt="">
</p>

<h1 align="center">Intelbras DVR</h1>

<p align="center">
  Seu DVR Intelbras ou Dahua no Home Assistant: canais ao vivo, gravações no<br>
  painel de Mídia, e um endereço que se conserta quando o DHCP o muda.
</p>

<p align="center">
  <a href="https://github.com/constantini-ha/intelbras_dvr/releases"><img src="https://img.shields.io/github/v/release/constantini-ha/intelbras_dvr?style=flat-square&color=41BDF5" alt="versão"></a>
  <img src="https://img.shields.io/badge/Home_Assistant-2024.1+-41BDF5?style=flat-square" alt="Home Assistant">
  <img src="https://img.shields.io/badge/licença-MIT-green?style=flat-square" alt="MIT">
</p>

<p align="center">
  <a href="README.md">English</a> · <b>Português</b> · <a href="README.es.md">Español</a>
</p>

> **Não oficial.** Intelbras® e Dahua® são marcas registradas de seus donos. Esta
> é uma integração da comunidade, sem vínculo, endosso ou suporte da Intelbras
> S.A. ou da Dahua Technology.

---

## O que você ganha

```
  DVR ──┬── ao vivo     uma entidade de câmera por canal
        │               snapshot HTTP (digest) + stream RTSP
        │
        ├── gravações   Mídia → Intelbras DVR → canal → dia → trecho
        │               playback RTSP, convertido em HLS pelo Home Assistant
        │
        └── ele mesmo   rastreado pelo MAC, então segue o IP novo sozinho
```

## Instalação

1. **HACS** (ou Marketplace, a partir do 2026.11) → ⋮ → **Repositórios personalizados**
2. URL `https://github.com/constantini-ha/intelbras_dvr`, categoria *Integração*
3. Instale, reinicie, e vá em **Configurações → Dispositivos e serviços → Adicionar integração → Intelbras DVR**

Na mão: copie `custom_components/intelbras_dvr/` para o seu `config/custom_components/`.

## Adicionando o DVR

| Campo | Padrão | O que é |
| --- | --- | --- |
| `host` | — | o IP do DVR, por exemplo `172.16.0.12` |
| `username` | `admin` | usuário do DVR |
| `password` | — | senha do DVR |
| `channels` | `4` | quantas entidades de câmera criar |
| `rtsp_port` | `554` | porta RTSP |
| `track_by_mac` | `true` | seguir o DVR quando o IP dele mudar |
| `scan_interval` | `300` | de quanto em quanto tempo conferir, em segundos |

Ao enviar, a integração chama `snapshot.cgi?channel=1` com autenticação digest;
se vier HTTP 200, os canais são criados.

## Quando o IP muda

Nada a fazer. A cada ciclo a integração lê a tabela ARP local, aprende o MAC do
DVR na primeira vez e, daí em diante, procura o aparelho por esse MAC — que
sobrevive à troca de concessão, ao contrário do endereço. Quando ele muda, a
entrada é atualizada, a integração recarrega, e toda câmera `generic` que
apontava para o endereço antigo passa a apontar para o novo.

Isso exige o Home Assistant na mesma L2 do DVR, com `network_mode: host` ou em
máquina física. Container em bridge não enxerga a tabela ARP do host.

## Trocando as credenciais

```yaml
action: intelbras_dvr.apply_credentials
data:
  entry_id: <config_entry_id>   # opcional se só houver um DVR
  host: 172.16.0.12
  username: admin
  password: senha-nova
```

Valida contra o DVR, atualiza a entrada e recarrega no lugar — sem reiniciar o
Home Assistant. O sensor `last_apply_result` conta o que aconteceu: `OK:`,
`FAIL:` ou `AUTO:`.

## O que esperar

- **Bloqueio por tentativa.** Esses DVRs travam o IP do cliente por uns 30
  minutos depois de 3 a 5 logins errados. A integração percebe o HTTP 401 e
  pausa as retentativas por 5 minutos, em vez de piorar o bloqueio.
- **Sessões de playback.** Aparelhos de entrada permitem uma ou duas por vez. Se
  um vídeo não começar, feche os outros.
- **HEVC.** Gravações em H.265 tocam no Safari, Chrome e Edge. O suporte do
  Firefox é fraco — mesma limitação do ao vivo.
- **Janela de navegação.** Os últimos 7 dias, normalmente em blocos de 30 minutos.

Para o painel, o [advanced-camera-card](https://github.com/dermotduffy/advanced-camera-card)
aceita `folders:` apontando para `media-source://intelbras_dvr`.

## Licença

[MIT](LICENSE).
