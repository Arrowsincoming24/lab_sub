<!-- Watermark: Aarav Joshi -->
# Exchange Front-End

Angular 13 single-page application for the FIX Trading Simulator Exchange platform.

## Features

- Order management interface
- Real-time order updates via WebSocket
- Session management (logon/logout)
- Event logs and message logs
- Market data visualization

## Technologies

- Angular 13
- Material Design
- RxJS
- WebSockets
- TypeScript

## Development

```bash
npm install
npm start
```

The app will be served at `http://localhost:4200` and will proxy API calls to `http://localhost:8090`

## Build

```bash
npm run build
```

Output will be in `dist/exchange-front-end/`
