import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import cookieParser from "cookie-parser";
import session from "express-session";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extend express-session for TypeScript
declare module 'express-session' {
  interface SessionData {
    tokens: any;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());
  app.use(session({
    secret: process.env.SESSION_SECRET || 'financial-viewer-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { 
      secure: true, // Required for SameSite=None
      sameSite: 'none', // Required for cross-origin iframe
      httpOnly: true,
    }
  }));

  // Google OAuth Client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_URL}/api/auth/google/callback`
  );

  // API Proxy Route
  app.get("/api/cmoney-data", async (req, res) => {
    const etf = req.query.etf || "0050";
    const targetUrl = `https://www.cmoney.tw/api/cm/MobileService/ashx/GetDtnoData.ashx?action=getdtnodata&DtNo=59449513&ParamStr=AssignID%3D${etf}%3BMTPeriod%3D0%3BDTMode%3D0%3BDTRange%3D1%3BDTOrder%3D1%3BMajorTable%3DM722%3B&FilterNo=0`;
    
    try {
      const response = await fetch(targetUrl);
      if (!response.ok) {
        throw new Error(`CMoney API responded with status: ${response.status}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error(`Error fetching CMoney data for ${etf}:`, error);
      res.status(500).json({ error: `Failed to fetch data for ${etf} from CMoney` });
    }
  });

  // Google Auth Routes
  app.get("/api/auth/google/url", (req, res) => {
    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file'
    ];
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
    res.json({ url });
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      req.session.tokens = tokens;
      
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      res.status(500).send('Authentication failed');
    }
  });

  app.get("/api/auth/status", (req, res) => {
    res.json({ isAuthenticated: !!req.session.tokens });
  });

  app.post("/api/export/google-sheet", async (req, res) => {
    const { title, data } = req.body;
    const gasUrl = process.env.GAS_WEB_APP_URL;

    if (!gasUrl) {
      return res.status(400).json({ 
        error: '尚未設定 GAS 網址',
        details: '請在 AI Studio 的 Settings > Environment Variables 中新增 GAS_WEB_APP_URL，並填入您的 Google Apps Script 部署網址。'
      });
    }

    try {
      // Call the Google Apps Script Web App
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, data })
      });

      if (!response.ok) {
        throw new Error(`GAS responded with status: ${response.status}`);
      }

      const result = await response.json();
      res.json(result);
    } catch (error) {
      console.error('Error calling GAS for Google Sheet:', error);
      res.status(500).json({ error: 'Failed to export to Google Sheet via GAS' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
