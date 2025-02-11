import { startFlowServer } from '@genkit-ai/express';
import vertexAI, { gemini20Flash001 } from '@genkit-ai/vertexai';
import { genkit, SessionData, SessionStore, z, Session } from 'genkit/beta';
import { Storage } from '@google-cloud/storage';


const bucket = "lon-next.firebasestorage.app";
const storage = new Storage({ projectId: 'lon-next' })

// used for managing session storage
// start session management
class GcsSessionStorage<S = any> implements SessionStore<S> {
  async get(sessionId: string): Promise<SessionData<S> | undefined> {
    try {
      const file = await storage.bucket(bucket).file(sessionId).download();
      return JSON.parse(file[0].toString("utf-8"));
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }

  async save(sessionId: string, data: Omit<SessionData<S>, 'id'>): Promise<void> {
    try {
      await storage.bucket(bucket).file(sessionId).save(JSON.stringify(data));
      console.log('file written to GCS');
    }
    catch (error) {
      console.error(error);
    }
  }
}
// end session management

interface ChatHistory {
  messages: string[],
};

// start genkit declaration
const ai = genkit({
  plugins: [
    vertexAI({
      location: 'us-central1',
      projectId: 'lon-next'
    })
  ],
  model: gemini20Flash001
});
// end genkit declaration

// start defining flows
export const entryFlow = ai.defineFlow({
  name: 'entryFlow',
  inputSchema: z.object({
    text: z.string(),
    sessionId: z.string().optional(),
  }),
  outputSchema: z.object({
    out: z.string(),
    sessionId: z.string()
  }),
},
  async (input) => {
    let session: Session<ChatHistory>;
    if (input.sessionId) {
      session = await ai.loadSession(input.sessionId, {
        store: new GcsSessionStorage(),
      })
    } else {
      session = ai.createSession({
        store: new GcsSessionStorage(),
      })
    }

    const chat = session.chat({
      system: 'talk like a pirate',
    });

    const result = await chat.send({
      model: gemini20Flash001,
      // system: 'talk like a pirate',
      prompt: input.text,
      config: {
        temperature: 1.0,
      }
    });
    return { out: result.text, sessionId: session.id }
  }
);
// end defining flows

// start express server startup
startFlowServer({
  port: 2222,
  cors: {
    origin: "*",
  },
  flows: [entryFlow],
});
// end express server startup
