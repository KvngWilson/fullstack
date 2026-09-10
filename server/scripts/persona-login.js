#!/usr/bin/env node

require("dotenv").config();

const fs = require("fs/promises");
const http = require("http");
const https = require("https");
const path = require("path");

const { PERSONAS, getPersonaByKey } = require("./personaDefinitions");

const DEFAULT_API_BASE_URL = process.env.API_URL || "http://localhost:5000";
const DEFAULT_CLIENT_BASE_URL =
  process.env.CLIENT_URL || "http://localhost:5173";
const OUTPUT_DIR = path.resolve(__dirname, "..", ".persona-sessions");

function parseArgs(argv) {
  const args = {
    all: false,
    personaKey: null,
    apiBaseUrl: DEFAULT_API_BASE_URL,
    clientBaseUrl: DEFAULT_CLIENT_BASE_URL,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--all") {
      args.all = true;
      continue;
    }
    if (value === "--persona") {
      args.personaKey = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (value === "--api-base-url") {
      args.apiBaseUrl = argv[index + 1] || args.apiBaseUrl;
      index += 1;
      continue;
    }
    if (value === "--client-base-url") {
      args.clientBaseUrl = argv[index + 1] || args.clientBaseUrl;
      index += 1;
      continue;
    }
  }

  return args;
}

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function normalizeApiBaseUrl(value) {
  return normalizeBaseUrl(value).replace(/\/api\/v1$/, "");
}

function parseJsonBody(body) {
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    return null;
  }
}

function requestJson(urlString, { method = "GET", headers = {}, body } = {}) {
  const url = new URL(urlString);
  const transport = url.protocol === "https:" ? https : http;
  const payload = body ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method,
        headers: {
          Accept: "application/json",
          ...(payload
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
              }
            : {}),
          ...headers,
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const rawBody = Buffer.concat(chunks).toString("utf8");
          resolve({
            status: response.statusCode || 0,
            headers: response.headers,
            rawBody,
            body: parseJsonBody(rawBody),
          });
        });
      },
    );

    request.on("error", reject);

    if (payload) {
      request.write(payload);
    }

    request.end();
  });
}

function applySetCookies(cookieStore, setCookieHeaders = [], urlString) {
  const url = new URL(urlString);
  const normalizedHeaders = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : [setCookieHeaders];

  for (const setCookie of normalizedHeaders) {
    const parts = String(setCookie)
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean);
    const [nameValue, ...attributes] = parts;
    const separatorIndex = nameValue.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const name = nameValue.slice(0, separatorIndex);
    const value = nameValue.slice(separatorIndex + 1);
    const cookie = {
      name,
      value,
      domain: url.hostname,
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: null,
      expires: null,
      maxAge: null,
    };

    for (const attribute of attributes) {
      const [rawKey, rawValue] = attribute.split("=");
      const key = rawKey.toLowerCase();
      if (key === "httponly") {
        cookie.httpOnly = true;
      } else if (key === "secure") {
        cookie.secure = true;
      } else if (key === "path" && rawValue) {
        cookie.path = rawValue;
      } else if (key === "domain" && rawValue) {
        cookie.domain = rawValue;
      } else if (key === "samesite" && rawValue) {
        cookie.sameSite = rawValue;
      } else if (key === "expires" && rawValue) {
        cookie.expires = rawValue;
      } else if (key === "max-age" && rawValue) {
        cookie.maxAge = Number(rawValue);
      }
    }

    cookieStore.set(name, cookie);
  }
}

function buildCookieHeader(cookieStore) {
  return Array.from(cookieStore.values())
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

async function loginPersona(persona, apiBaseUrl, clientBaseUrl) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const normalizedClientBaseUrl = normalizeBaseUrl(clientBaseUrl);
  const cookieStore = new Map();

  const csrfResponse = await requestJson(
    `${normalizedApiBaseUrl}/api/v1/auth/csrf-token`,
  );
  if (csrfResponse.status !== 200 || !csrfResponse.body?.token) {
    throw new Error(
      `Failed to fetch CSRF token (${csrfResponse.status}): ${csrfResponse.rawBody}`,
    );
  }

  applySetCookies(
    cookieStore,
    csrfResponse.headers["set-cookie"] || [],
    `${normalizedApiBaseUrl}/api/v1/auth/csrf-token`,
  );

  const loginResponse = await requestJson(
    `${normalizedApiBaseUrl}/api/v1/auth/login`,
    {
      method: "POST",
      headers: {
        Cookie: buildCookieHeader(cookieStore),
        "X-CSRF-Token": csrfResponse.body.token,
      },
      body: {
        email: persona.email,
        password: persona.demoCredential,
      },
    },
  );

  if (loginResponse.status !== 200 || !loginResponse.body?.user) {
    throw new Error(
      `Failed to log in ${persona.key} (${loginResponse.status}): ${loginResponse.rawBody}`,
    );
  }

  applySetCookies(
    cookieStore,
    loginResponse.headers["set-cookie"] || [],
    `${normalizedApiBaseUrl}/api/v1/auth/login`,
  );

  return {
    personaKey: persona.key,
    email: persona.email,
    password: persona.demoCredential,
    authRole: persona.authRole,
    employeeRoleCode: persona.employee?.roleCode || null,
    expectedPath: persona.expectedPath,
    apiBaseUrl: normalizedApiBaseUrl,
    clientBaseUrl: normalizedClientBaseUrl,
    loginUrl: `${normalizedClientBaseUrl}/login`,
    workspaceUrl: `${normalizedClientBaseUrl}${persona.expectedPath}`,
    csrfToken: csrfResponse.body.token,
    cookieHeader: buildCookieHeader(cookieStore),
    cookies: Array.from(cookieStore.values()),
    loginResponse: loginResponse.body,
    savedAt: new Date().toISOString(),
  };
}

async function writeSessionArtifacts(sessions) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  for (const session of sessions) {
    const filePath = path.join(OUTPUT_DIR, `${session.personaKey}.json`);
    await fs.writeFile(
      filePath,
      `${JSON.stringify(session, null, 2)}\n`,
      "utf8",
    );
  }

  await fs.writeFile(
    path.join(OUTPUT_DIR, "sessions.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sessions,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function logoutPersona(session, apiBaseUrl) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);

  if (!session?.personaKey) {
    throw new Error("logoutPersona requires a session with personaKey");
  }
  if (!session?.cookieHeader) {
    throw new Error(
      `logoutPersona requires cookieHeader for ${session.personaKey}`,
    );
  }

  const logoutResponse = await requestJson(
    `${normalizedApiBaseUrl}/api/v1/auth/logout`,
    {
      method: "POST",
      headers: {
        Cookie: session.cookieHeader,
        ...(session.csrfToken ? { "X-CSRF-Token": session.csrfToken } : {}),
      },
    },
  );

  if (logoutResponse.status !== 200) {
    throw new Error(
      `Failed to log out ${session.personaKey} (${logoutResponse.status}): ${logoutResponse.rawBody}`,
    );
  }

  return logoutResponse.body;
}

async function logoutPersonaByKey(sessions, personaKey, apiBaseUrl) {
  if (!personaKey) {
    throw new Error("personaKey is required to logout a single persona");
  }

  const session = sessions.find((s) => s.personaKey === personaKey);
  if (!session) {
    throw new Error(`No authenticated session found for "${personaKey}"`);
  }

  return logoutPersona(session, apiBaseUrl); // uses session.cookieHeader + session.csrfToken
}

async function logoutAllPersonas(sessions, apiBaseUrl) {
  for (const session of sessions) {
    await logoutPersona(session, apiBaseUrl);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const personas = args.all
    ? PERSONAS
    : [getPersonaByKey(args.personaKey || "customer")].filter(Boolean);

  if (personas.length === 0) {
    console.error(
      `Unknown persona key "${args.personaKey}". Valid options: ${PERSONAS.map((persona) => persona.key).join(", ")}`,
    );
    process.exit(1);
  }

  const sessions = [];
  try {
    for (const persona of personas) {
      sessions.push(
        await loginPersona(persona, args.apiBaseUrl, args.clientBaseUrl),
      );
    }
  } catch (error) {
    console.error("Persona login failed:", error.message);
    process.exit(1);
  }

  await writeSessionArtifacts(sessions);

  console.log("Prepared authenticated persona session files:\n");
  for (const session of sessions) {
    console.log(
      `- ${session.personaKey} -> ${path.join(OUTPUT_DIR, `${session.personaKey}.json`)} (${session.workspaceUrl})`,
    );
  }

  if (args.personaKey && !args.all) {
    await logoutPersonaByKey(sessions, args.personaKey, args.apiBaseUrl);
  } else {
    await logoutAllPersonas(sessions, args.apiBaseUrl);
  }
}

main();
