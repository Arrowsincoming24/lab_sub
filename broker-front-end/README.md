<!-- Watermark: Aarav Joshi -->
# Broker Front-End

Angular 13 single-page application for the FIX Trading Simulator Broker platform.

## Features

- Order placement and management
- Real-time order execution updates via WebSocket
- Session management (logon/logout to exchange)
- Portfolio overview
- Event logs

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

The app will be served at `http://localhost:4200` and will proxy API calls to `http://localhost:8080`

## Build

```bash
npm run build
```

Output will be in `dist/broker-front-end/`
