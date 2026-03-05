# DreamHack CTF Calendar

DreamHack CTFイベントをiCal形式で配信するCloudflare Worker。

## 使い方

カレンダーURL: `https://<your-domain>/calendar.ics`

Google Calendar: 設定 > カレンダーを追加 > URLで追加

## エンドポイント

| Path | 説明 |
|------|------|
| `/` | カレンダーURL取得ページ |
| `/calendar.ics` | iCalフィード |

## パラメータ

### scope

取得するCTFの状態（カンマ区切りで複数指定可）

- `ongoing` - 開催中
- `waiting` - 開始前
- `ended` - 終了済み

例: `?scope=ongoing,waiting`

### filterings

- `dreamhack` - Dreamhack公式CTFのみ

例: `?filterings=dreamhack`

## 開発

```bash
pnpm install
pnpm dev
```

## デプロイ

```bash
pnpm deploy
```
