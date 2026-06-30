import { DB } from "../db";

// Base64 JWT parser for extracting email and google user id (sub) from id_token
function parseIdToken(idToken: string): { email?: string; sub?: string } {
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return {};
    const payload = Buffer.from(parts[1], "base64").toString("utf-8");
    return JSON.parse(payload);
  } catch (err) {
    console.error("[GOOGLE_CALENDAR] Error parsing id_token:", err);
    return {};
  }
}

// Google Calendar Category Mapping
export const CALENDAR_CATEGORIES = [
  { type: "deadline", name: "LegalOne - Prazos Judiciais", colorId: "20" }, // Red/Tomato
  { type: "hearing", name: "LegalOne - Audiências", colorId: "18" },       // Tangerine/Amber
  { type: "meeting", name: "LegalOne - Reuniões", colorId: "9" },          // Blueberry/Indigo
  { type: "reminder", name: "LegalOne - Lembretes", colorId: "13" },       // Graphite/Slate
  { type: "default", name: "LegalOne - Compromissos", colorId: "3" },      // Grape/Purple
];

export const GoogleCalendarService = {
  /**
   * Generates the authentic Google OAuth URL for Google Calendar.
   */
  getAuthUrl(userId: string, lawFirmId: string, appUrl: string): string {
    const client_id = process.env.GOOGLE_CLIENT_ID;
    if (!client_id) {
      throw new Error("GOOGLE_CLIENT_ID não está configurado nas variáveis de ambiente.");
    }

    const redirectUri = `${appUrl.replace(/\/$/, "")}/api/google-calendar/callback`;
    const state = `${userId}_${lawFirmId}`;
    
    // Scopes for Google Calendar
    const scopes = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
      "openid",
      "email",
      "profile"
    ];

    const params = new URLSearchParams({
      client_id,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      access_type: "offline",
      prompt: "consent", // Force consent screen to always get refresh_token
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },

  /**
   * Exchanges authorization code for access and refresh tokens.
   */
  async exchangeCode(code: string, redirectUri: string, userId: string, lawFirmId: string): Promise<any> {
    const client_id = process.env.GOOGLE_CLIENT_ID;
    const client_secret = process.env.GOOGLE_CLIENT_SECRET;

    if (!client_id || !client_secret) {
      throw new Error("Credenciais do Google OAuth não configuradas.");
    }

    console.log(`[GOOGLE_CALENDAR] Exchanging authorization code for userId: ${userId}`);

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id,
        client_secret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro na troca de token do Google: ${errText}`);
    }

    const data = await response.json() as any;
    const { email, sub: googleUserId } = parseIdToken(data.id_token || "");

    const expiresAt = Date.now() + (data.expires_in || 3600) * 1000;

    const accountData = {
      user_id: userId,
      provider: "google_calendar",
      email: email || "usuario-google@email.com",
      storage_name: "Google Calendar",
      access_token: data.access_token,
      refresh_token: data.refresh_token || "", // Store refresh_token
      expires_at: expiresAt.toString(),
      connected: 1,
      google_user_id: googleUserId || "",
      sync_status: "connected",
      updated_at: new Date().toISOString()
    };

    // Find if there is an existing calendar connection
    const existing = await DB.table("cloud_accounts").findOne(
      (a) => a.user_id === userId && a.provider === "google_calendar"
    );

    let connectionId = "";
    if (existing) {
      connectionId = existing.id;
      // Preserve existing refresh_token if the new payload doesn't return a new one
      if (!accountData.refresh_token && existing.refresh_token) {
        accountData.refresh_token = existing.refresh_token;
      }
      await DB.table("cloud_accounts").update(existing.id, accountData);
      console.log(`[GOOGLE_CALENDAR] Updated existing OAuth credentials for user: ${userId}`);
    } else {
      const inserted = await DB.table("cloud_accounts").insert({
        id: Math.random().toString(36).substr(2, 9),
        ...accountData,
        created_at: new Date().toISOString()
      });
      connectionId = inserted.id;
      console.log(`[GOOGLE_CALENDAR] Inserted new OAuth credentials for user: ${userId}`);
    }

    // Trigger asynchronous initialization of custom calendars and first sync
    setTimeout(async () => {
      try {
        const token = await this.getValidToken(userId);
        if (token) {
          const mapping = await this.initializeCalendars(token, userId);
          console.log(`[GOOGLE_CALENDAR] Separate Calendars initialized for user ${userId}:`, mapping);
          await this.sync(userId, lawFirmId);
        }
      } catch (err: any) {
        console.error("[GOOGLE_CALENDAR] Async init calendars error:", err.message);
      }
    }, 100);

    return accountData;
  },

  /**
   * Retrieves a valid, non-expired access token for the user.
   * If expired, automatically renews it using the refresh token.
   */
  async getValidToken(userId: string): Promise<string | null> {
    const existing = await DB.table("cloud_accounts").findOne(
      (a) => a.user_id === userId && a.provider === "google_calendar" && a.connected === 1
    );

    if (!existing || !existing.access_token) {
      return null;
    }

    const expiresAt = Number(existing.expires_at || 0);
    // Refresh token if it will expire within 5 minutes (300 seconds)
    if (expiresAt && Date.now() > expiresAt - 300000) {
      console.log(`[GOOGLE_CALENDAR] Token expired or about to expire for user: ${userId}. Refreshing...`);
      if (!existing.refresh_token) {
        console.warn(`[GOOGLE_CALENDAR] No refresh token available for user: ${userId}. Re-authentication required.`);
        return null;
      }

      const client_id = process.env.GOOGLE_CLIENT_ID;
      const client_secret = process.env.GOOGLE_CLIENT_SECRET;

      if (!client_id || !client_secret) {
        throw new Error("Credenciais do Google OAuth não configuradas para renovação.");
      }

      try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id,
            client_secret,
            refresh_token: existing.refresh_token,
            grant_type: "refresh_token",
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Falha ao renovar token de acesso: ${errText}`);
        }

        const data = await response.json() as any;
        const newExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;

        const updateData: any = {
          access_token: data.access_token,
          expires_at: newExpiresAt.toString(),
          updated_at: new Date().toISOString(),
        };

        // If Google returns a new refresh token (rare but possible), update it too
        if (data.refresh_token) {
          updateData.refresh_token = data.refresh_token;
        }

        await DB.table("cloud_accounts").update(existing.id, updateData);
        console.log(`[GOOGLE_CALENDAR] Token refreshed successfully for user: ${userId}`);
        return data.access_token;
      } catch (err: any) {
        console.error(`[GOOGLE_CALENDAR] Refresh token failed for user ${userId}:`, err.message);
        return null;
      }
    }

    return existing.access_token;
  },

  /**
   * Verifies if separate calendars exist in the user's Google Calendar account.
   * If they don't, it creates them and sets their color to keep the visual identity.
   * Stores the calendar mapping in the database.
   */
  async initializeCalendars(accessToken: string, userId: string): Promise<Record<string, string>> {
    console.log(`[GOOGLE_CALENDAR] Initializing calendars for user: ${userId}`);

    // Fetch existing calendar list from user
    const listRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listRes.ok) {
      throw new Error(`Failed to fetch calendarList: ${await listRes.text()}`);
    }

    const listData = await listRes.json() as any;
    const existingList = listData.items || [];

    const existingRow = await DB.table("cloud_accounts").findOne(
      (a) => a.user_id === userId && a.provider === "google_calendar"
    );

    let currentMapping: Record<string, string> = {};
    if (existingRow && existingRow.calendar_id) {
      try {
        currentMapping = JSON.parse(existingRow.calendar_id);
      } catch {
        currentMapping = {};
      }
    }

    const updatedMapping: Record<string, string> = { ...currentMapping };

    for (const cat of CALENDAR_CATEGORIES) {
      // Check if calendar already mapped and still exists
      const mappedId = updatedMapping[cat.type];
      const stillExists = mappedId && existingList.some((item: any) => item.id === mappedId);

      if (stillExists) {
        continue;
      }

      // Check if calendar exists by matching name
      const foundInGoogle = existingList.find((item: any) => item.summary === cat.name);
      if (foundInGoogle) {
        updatedMapping[cat.type] = foundInGoogle.id;
        continue;
      }

      // Create secondary calendar
      console.log(`[GOOGLE_CALENDAR] Creating secondary calendar "${cat.name}" for category "${cat.type}"`);
      const createRes = await fetch("https://www.googleapis.com/calendar/v3/calendars", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: cat.name,
          timeZone: "America/Sao_Paulo",
        }),
      });

      if (!createRes.ok) {
        console.error(`[GOOGLE_CALENDAR] Failed to create calendar ${cat.name}:`, await createRes.text());
        continue;
      }

      const newCalendar = await createRes.json() as any;
      const calendarId = newCalendar.id;
      updatedMapping[cat.type] = calendarId;

      // Set custom color in calendarList
      try {
        await fetch(`https://www.googleapis.com/calendar/v3/users/me/calendarList/${calendarId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            colorId: cat.colorId,
            selected: true,
          }),
        });
        console.log(`[GOOGLE_CALENDAR] Set colorId ${cat.colorId} for calendar ${cat.name}`);
      } catch (colorErr: any) {
        console.warn(`[GOOGLE_CALENDAR] Failed to set color for calendar ${cat.name}:`, colorErr.message);
      }
    }

    if (existingRow) {
      await DB.table("cloud_accounts").update(existingRow.id, {
        calendar_id: JSON.stringify(updatedMapping),
        updated_at: new Date().toISOString()
      });
    }

    return updatedMapping;
  },

  /**
   * Performs complete bidirectional synchronization (System <-> Google Calendar)
   */
  async sync(userId: string, lawFirmId: string): Promise<any> {
    console.log(`[GOOGLE_CALENDAR] Initiating bidirectional sync for userId: ${userId}, lawFirmId: ${lawFirmId}`);
    
    const startTime = Date.now();
    const token = await this.getValidToken(userId);
    if (!token) {
      console.warn(`[GOOGLE_CALENDAR] No valid token found for sync for userId: ${userId}`);
      return { success: false, reason: "Unauthorized" };
    }

    const mapping = await this.initializeCalendars(token, userId);
    
    // Fetch local events
    const localEvents = await DB.table("events").find((e) => e.law_firm_id === lawFirmId);
    
    const stats = {
      uploaded: 0,
      downloaded: 0,
      updated_local: 0,
      updated_google: 0,
      deleted_local: 0,
      deleted_google: 0,
      failures: 0
    };

    // Helper map of Google events gathered across all categories to detect deletions from Google side
    const googleEventIdsInCalendars: Record<string, string> = {}; // google_id -> category/type
    const allFetchedGoogleEvents: Record<string, any> = {};

    // 1. Loop through each category to download events from Google Calendar
    for (const cat of CALENDAR_CATEGORIES) {
      const calendarId = mapping[cat.type] || "primary";
      
      console.log(`[GOOGLE_CALENDAR] Fetching events from Google Calendar ID: ${calendarId} (${cat.name})`);
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?maxResults=250`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        console.error(`[GOOGLE_CALENDAR] Error fetching events from ${cat.name}:`, await response.text());
        stats.failures++;
        continue;
      }

      const data = await response.json() as any;
      const googleEvents = data.items || [];

      for (const gEv of googleEvents) {
        if (gEv.status === "cancelled") {
          continue;
        }

        googleEventIdsInCalendars[gEv.id] = cat.type;
        allFetchedGoogleEvents[gEv.id] = gEv;

        // Try to match with local event using google_event_id
        const localMatch = localEvents.find((e) => e.google_event_id === gEv.id);

        if (!localMatch) {
          // Google -> Local (Created on Google Calendar, pull to LegalOne)
          console.log(`[GOOGLE_CALENDAR] Pulling new event from Google: ${gEv.summary}`);

          // Extract dates
          const start_date = gEv.start?.dateTime || gEv.start?.date || new Date().toISOString();
          const end_date = gEv.end?.dateTime || gEv.end?.date || new Date().toISOString();

          // Create local event
          await DB.table("events").insert({
            title: gEv.summary || "Sem título",
            description: gEv.description || "",
            type: cat.type === "default" ? "meeting" : cat.type,
            start_date,
            end_date,
            status: "Pendente",
            location: gEv.location || "",
            google_event_id: gEv.id,
            calendar_id: calendarId,
            sync_status: "synced",
            law_firm_id: lawFirmId,
            assigned_to: ["Rodrigo Cardoso"], // Fallback assignment
          });

          stats.downloaded++;
        } else {
          // Both exist: check if Google was updated more recently
          const localUpdated = new Date(localMatch.created_at || 0).getTime();
          const googleUpdated = new Date(gEv.updated || 0).getTime();

          if (googleUpdated > localUpdated) {
            console.log(`[GOOGLE_CALENDAR] Google event is newer. Updating local event: ${gEv.summary}`);
            const start_date = gEv.start?.dateTime || gEv.start?.date || localMatch.start_date;
            const end_date = gEv.end?.dateTime || gEv.end?.date || localMatch.end_date;

            await DB.table("events").update(localMatch.id, {
              title: gEv.summary || localMatch.title,
              description: gEv.description || localMatch.description,
              start_date,
              end_date,
              location: gEv.location || localMatch.location,
              sync_status: "synced",
            });

            stats.updated_local++;
          }
        }
      }
    }

    // 2. Local -> Google Sync: find local events to push or update
    // Fetch refreshed list of local events to prevent double modifications
    const freshLocalEvents = await DB.table("events").find((e) => e.law_firm_id === lawFirmId);

    for (const locEv of freshLocalEvents) {
      const catType = locEv.type === "meeting" || locEv.type === "hearing" || locEv.type === "deadline" || locEv.type === "reminder" ? locEv.type : "default";
      const calendarId = mapping[catType] || "primary";

      if (!locEv.google_event_id) {
        // Local -> Google (Created in LegalOne, push to Google)
        console.log(`[GOOGLE_CALENDAR] Pushing new local event to Google: ${locEv.title}`);

        const body = await this.buildGoogleEventBody(locEv, lawFirmId);
        const createRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (createRes.ok) {
          const newGev = await createRes.json() as any;
          await DB.table("events").update(locEv.id, {
            google_event_id: newGev.id,
            calendar_id: calendarId,
            sync_status: "synced",
          });
          stats.uploaded++;
        } else {
          console.error(`[GOOGLE_CALENDAR] Failed to upload event ${locEv.title}:`, await createRes.text());
          stats.failures++;
        }
      } else {
        // Exists on Google. Check if Google event was deleted by checking if its ID is missing in the list
        // of active google events we just fetched.
        const isStillInGoogle = googleEventIdsInCalendars[locEv.google_event_id];
        if (!isStillInGoogle) {
          // Google -> Local Delete (Deleted on Google, so delete locally)
          console.log(`[GOOGLE_CALENDAR] Google event was deleted. Removing local event: ${locEv.title}`);
          await DB.table("events").delete(locEv.id);
          stats.deleted_local++;
        } else {
          // Update event on Google if it has been updated locally
          // (To avoid loop: we check if local status is "pending_update" or simply keep Google updated with local attributes)
          if (locEv.sync_status === "pending_update") {
            console.log(`[GOOGLE_CALENDAR] Syncing updated local event to Google: ${locEv.title}`);
            const body = await this.buildGoogleEventBody(locEv, lawFirmId);
            const updateRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${locEv.google_event_id}`, {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
            });

            if (updateRes.ok) {
              await DB.table("events").update(locEv.id, { sync_status: "synced" });
              stats.updated_google++;
            } else {
              console.error(`[GOOGLE_CALENDAR] Failed to update event on Google ${locEv.title}:`, await updateRes.text());
              stats.failures++;
            }
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[GOOGLE_CALENDAR] Sync completed in ${duration}ms. Stats:`, stats);

    // Write a beautiful log entry of this sync operation in the audit_logs
    await DB.table("audit_logs").insert({
      id: Math.random().toString(36).substr(2, 9),
      user_id: userId,
      user_name: "Google Calendar Sync",
      action: "Sincronizou Agenda",
      table_name: "events",
      record_id: userId,
      details: `Sincronização bidirecional do Google Agenda finalizada em ${duration}ms. Baixados: ${stats.downloaded}, Enviados: ${stats.uploaded}, Atualizados Localmente: ${stats.updated_local}, Atualizados Google: ${stats.updated_google}, Excluídos Localmente: ${stats.deleted_local}, Falhas: ${stats.failures}`,
      created_at: new Date().toISOString()
    });

    return { success: true, stats, duration };
  },

  /**
   * Deletes an event from Google Calendar during local deletion.
   */
  async deleteFromGoogle(userId: string, googleEventId: string, calendarId: string): Promise<boolean> {
    const token = await this.getValidToken(userId);
    if (!token || !googleEventId || !calendarId) return false;

    console.log(`[GOOGLE_CALENDAR] Deleting event ${googleEventId} from Google Calendar ${calendarId}`);
    try {
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${googleEventId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const text = await response.text();
        console.warn(`[GOOGLE_CALENDAR] Failed to delete event on Google:`, text);
        return false;
      }
      return true;
    } catch (err: any) {
      console.error("[GOOGLE_CALENDAR] Error deleting from Google:", err.message);
      return false;
    }
  },

  /**
   * Constructs Google Event description incorporating critical business details
   * requested by the user: client, related process, responsible lawyer, and attendees.
   */
  async buildGoogleEventBody(locEv: any, lawFirmId: string): Promise<any> {
    let clientName = "Nenhum";
    let processCnj = "Nenhum";

    if (locEv.process_id) {
      const process = await DB.table("processes").findOne((p) => p.id === locEv.process_id);
      if (process) {
        processCnj = process.cnj;
        if (process.client_id) {
          const client = await DB.table("clients").findOne((c) => c.id === process.client_id);
          if (client) {
            clientName = client.name;
          }
        }
      }
    }

    const assignedLawyers = Array.isArray(locEv.assigned_to) ? locEv.assigned_to.join(", ") : "Nenhum";

    const descriptiveBody = `⚖️ LEGALONE - COMPROMISSO PROFISSIONAL
--------------------------------------------------
📝 Descrição: ${locEv.description || "Nenhuma descrição informada."}

👤 Cliente: ${clientName}
📂 Processo Relacionado: ${processCnj}
👨‍⚖️ Advogado Responsável: ${assignedLawyers}
⏳ Status no Sistema: ${locEv.status}

Sincronizado automaticamente via LegalOne Agenda.`;

    return {
      summary: locEv.title,
      description: descriptiveBody,
      location: locEv.location || "",
      start: {
        dateTime: new Date(locEv.start_date).toISOString(),
        timeZone: "America/Sao_Paulo",
      },
      end: {
        dateTime: new Date(locEv.end_date).toISOString(),
        timeZone: "America/Sao_Paulo",
      },
    };
  }
};
