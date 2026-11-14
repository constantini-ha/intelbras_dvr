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

## A página Câmeras e o card

A integração coloca **Câmeras** no menu lateral. Ela abre em uma câmera, ao
vivo, com a linha do tempo do dia embaixo; **Mosaico** mostra todos os canais de
uma vez e um toque em qualquer um abre aquela câmera. Administradores também têm
ali o formulário de credenciais e o botão **Adicionar ao painel**.

A mesma tela é um card de dashboard. Escolha **Câmeras do DVR Intelbras** no
seletor de cards, ou escreva à mão:

```yaml
type: custom:intelbras-dvr-card
columns: 2            # opcional
default_view: grid    # opcional: grid (padrão) ou timeline
title: Câmeras        # opcional
entities:             # opcional, o padrão são todos os canais do DVR
  - camera.dvr_canal_1
```

A linha do tempo funciona como no aplicativo do próprio DVR: arraste a régua
sob o ponteiro para voltar ou avançar e solte para assistir daquele momento. Os
trechos gravados aparecem pintados nela. Mude a escala (10 min, 1 h, 6 h, 24 h),
pause, pule um minuto, escolha outro dia e toque em **Ao vivo** para voltar ao
presente. Uma gravação pode rodar em 2x, 4x ou 8x.

As gravações são convertidas para H.264 pelo Home Assistant enquanto você
assiste, por isso tocam em qualquer navegador e no iPhone. Isso usa o
processador da máquina do Home Assistant enquanto uma gravação estiver tocando.

Nenhuma outra biblioteca de card é necessária. A página e o card falam
português, inglês e espanhol, seguindo o Home Assistant.

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
- **HEVC.** O stream principal ao vivo pode ser H.265, que o Firefox toca mal; o
  substream, usado por padrão, é H.264. As gravações são convertidas, então o
  codec gravado no disco não importa.
- **Janela de navegação.** Os últimos 7 dias, normalmente em blocos de 30 minutos.

Para o painel, o [advanced-camera-card](https://github.com/dermotduffy/advanced-camera-card)
aceita `folders:` apontando para `media-source://intelbras_dvr`.

## Licença

[MIT](LICENSE).
