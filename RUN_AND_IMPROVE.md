<!-- Watermark: Aarav Joshi -->
# Fix Trading Simulator — Run Everything + Improve UI/Features

This is a **single command guide** to run every part of the project and keep improving it safely.

---

## 0) Prerequisites

Install these first:

- Java 11+
- Node.js 18+
- npm 9+
- Python 3.10+
- Docker Desktop (optional, only for Docker mode)

Open PowerShell in:

```powershell
cd c:\Users\Aarav\OneDrive\Desktop\cmltest\fix-trading-simulator
```

---

## 1) Source Mode (Recommended for active feature/UI development)

Use this when changing UI/features because it runs current local code.

### 1.1 Start Exchange Back-End (Terminal 1)

```powershell
cd c:\Users\Aarav\OneDrive\Desktop\cmltest\fix-trading-simulator\exchange-back-end
.\mvnw.cmd clean package -DskipTests
java -jar target\quarkus-app\quarkus-run.jar
```

Expected: service on `http://localhost:8090`

---

### 1.2 Start Broker Back-End (Terminal 2)

```powershell
cd c:\Users\Aarav\OneDrive\Desktop\cmltest\fix-trading-simulator\broker-back-end
.\mvnw.cmd clean package -DskipTests
java -jar target\quarkus-app\quarkus-run.jar
```

Expected: service on `http://localhost:8080`

---

### 1.3 Start Exchange Front-End (Terminal 3)

```powershell
cd c:\Users\Aarav\OneDrive\Desktop\cmltest\fix-trading-simulator\exchange-front-end
npm install
npm start -- --port 4300
```

Open: `http://localhost:4300`

---

### 1.4 Start Broker Front-End (Terminal 4)

```powershell
cd c:\Users\Aarav\OneDrive\Desktop\cmltest\fix-trading-simulator\broker-front-end
npm install
npm start -- --port 4200
```

Open: `http://localhost:4200`

---

## 2) Quick Health Checks

Run from root `fix-trading-simulator` in a new terminal.

```powershell
python -c "import urllib.request;print('broker', urllib.request.urlopen('http://localhost:8080/api/orders').status)"
python -c "import urllib.request;print('exchange', urllib.request.urlopen('http://localhost:8090/api/orders').status)"
python -c "import urllib.request;print('broker-ui', urllib.request.urlopen('http://localhost:4200').status)"
python -c "import urllib.request;print('exchange-ui', urllib.request.urlopen('http://localhost:4300').status)"
```

All should print `200`.

---

## 3) Submit a Test Order (validate data flow)

```powershell
$body = '{"clOrdId":"ORD-' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + '","symbol":"AAPL","side":"1","quantity":100,"price":150.25,"orderType":"LIMIT","status":"NEW"}'
Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/orders" -ContentType "application/json" -Body $body

Invoke-RestMethod -Method Get -Uri "http://localhost:8080/api/orders"
Invoke-RestMethod -Method Get -Uri "http://localhost:8090/api/orders"
```

If broker and exchange both show the order, the stack is connected.

---

## 3.1 Trigger Exchange QuickFIX/J Response (manual)

After sending an order, you can force Exchange to send a FIX response to Broker:

```powershell
$clOrdId = "ORD-<use-the-id-you-submitted>"

$body = @{
	clOrdId = $clOrdId
	responseType = "STATUS"   # ACK | STATUS | CANCEL | REJECT
	text = "Manual response from Session API"
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://localhost:8090/api/session/respond" -ContentType "application/json" -Body $body
```

To inspect recent FIX session events:

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:8090/api/session/events?limit=50"
```

---

## 4) Load Testing + Dashboard

### 4.1 Run load test directly (from root)

```powershell
python .\tests\fix_async_load_test.py --host 127.0.0.1 --port 9878 --users 1000 --output-file .\loadtest-dashboard\public\loadtest-results.json
```

### 4.2 Run loadtest dashboard (Terminal 5)

```powershell
cd c:\Users\Aarav\OneDrive\Desktop\cmltest\fix-trading-simulator\loadtest-dashboard
npm install
npm run dev
```

Open URL printed by Vite (usually `http://localhost:5173`).

---

## 5) Docker Mode (Optional)

Use only when you want the prebuilt images quickly.

```powershell
cd c:\Users\Aarav\OneDrive\Desktop\cmltest\fix-trading-simulator
docker compose up -d
```

Default ports in Docker mode:

- Broker UI: `http://localhost:80`
- Exchange UI: `http://localhost:90`
- Broker API: `http://localhost:8080`
- Exchange API: `http://localhost:8090`
- Postgres: `localhost:5432`

Stop:

```powershell
docker compose down
```

Full reset (remove volumes too):

```powershell
docker compose down -v
```

---

## 6) Keep Improving Features/UI (Repeatable Workflow)

Run this loop for every improvement pass.

### 6.1 Build before editing (baseline)

```powershell
cd c:\Users\Aarav\OneDrive\Desktop\cmltest\fix-trading-simulator\broker-front-end
npm run build

cd c:\Users\Aarav\OneDrive\Desktop\cmltest\fix-trading-simulator\exchange-front-end
npm run build
```

### 6.2 Make UI/feature changes

Target files typically:

- `broker-front-end/src/app/app.component.ts`
- `broker-front-end/src/app/app.component.html`
- `broker-front-end/src/app/app.component.scss`
- `exchange-front-end/src/app/app.component.ts`
- `exchange-front-end/src/app/app.component.html`
- `exchange-front-end/src/app/app.component.scss`

### 6.3 Validate responsive behavior after each change

At minimum test widths in browser devtools:

- 1920
- 1536
- 1366
- 1280
- 1024
- 768

### 6.4 Rebuild both frontends

```powershell
cd c:\Users\Aarav\OneDrive\Desktop\cmltest\fix-trading-simulator\broker-front-end
npm run build

cd c:\Users\Aarav\OneDrive\Desktop\cmltest\fix-trading-simulator\exchange-front-end
npm run build
```

### 6.5 Run quick E2E smoke

- Open Broker + Exchange UI
- Place an order in Broker
- Confirm it appears in both order views
- Confirm no panel/table goes off-screen at tested widths

---

## 7) Common Fixes

### Port already in use

Find process:

```powershell
Get-NetTCPConnection -LocalPort 8080,8090,4200,4300 | Select-Object LocalPort,State,OwningProcess
```

Kill process:

```powershell
Stop-Process -Id <PID> -Force
```

### Clean backend build

```powershell
cd c:\Users\Aarav\OneDrive\Desktop\cmltest\fix-trading-simulator\broker-back-end
.\mvnw.cmd clean

cd c:\Users\Aarav\OneDrive\Desktop\cmltest\fix-trading-simulator\exchange-back-end
.\mvnw.cmd clean
```

### Reinstall frontend deps

```powershell
cd c:\Users\Aarav\OneDrive\Desktop\cmltest\fix-trading-simulator\broker-front-end
Remove-Item -Recurse -Force node_modules,package-lock.json
npm install

cd c:\Users\Aarav\OneDrive\Desktop\cmltest\fix-trading-simulator\exchange-front-end
Remove-Item -Recurse -Force node_modules,package-lock.json
npm install
```

---

## 8) Suggested Daily Start (Fast Path)

1. Start Exchange BE
2. Start Broker BE
3. Start Exchange FE (`--port 4300`)
4. Start Broker FE (`--port 4200`)
5. Run health checks
6. Build after each UI/feature batch

This gives stable development with current code (not stale Docker images).