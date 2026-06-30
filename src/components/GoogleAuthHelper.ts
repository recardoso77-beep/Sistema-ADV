import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Safely initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

/**
 * Triggers a Google Calendar OAuth popup with the requested scopes.
 * If an emailHint is provided, Google will suggest/select that email by default.
 */
export async function signInWithGoogleCalendar(emailHint?: string) {
  const provider = new GoogleAuthProvider();
  
  // Scopes requested by the user and configured in set_up_oauth
  provider.addScope("https://www.googleapis.com/auth/calendar");
  provider.addScope("https://www.googleapis.com/auth/calendar.events");
  
  const params: Record<string, string> = {
    prompt: "select_account"
  };

  if (emailHint && emailHint.trim() !== "") {
    params.login_hint = emailHint.trim();
  }

  provider.setCustomParameters(params);

  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential || !credential.accessToken) {
      throw new Error("Não foi possível obter o token de acesso da conta Google.");
    }
    return {
      user: result.user,
      accessToken: credential.accessToken,
    };
  } catch (error: any) {
    console.error("Erro ao autenticar com o Google:", error);
    throw error;
  }
}

/**
 * Fetches events from the user's Google Calendar.
 */
export async function fetchGoogleCalendarEvents(accessToken: string) {
  try {
    const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Erro na API do Google Calendar: ${response.statusText}`);
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error("Erro ao carregar eventos do Google Calendar:", error);
    return [];
  }
}

/**
 * Creates a new event in the user's Google Calendar.
 */
export async function createGoogleCalendarEvent(accessToken: string, event: {
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
}) {
  try {
    const body = {
      summary: event.title,
      description: event.description,
      start: {
        dateTime: new Date(event.start_date).toISOString(),
      },
      end: {
        dateTime: new Date(event.end_date).toISOString(),
      },
    };

    const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro ao criar evento no Google Calendar:", errorText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Erro ao salvar compromisso no Google Calendar:", error);
    return null;
  }
}
