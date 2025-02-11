/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { startFlowServer } from '@genkit-ai/express';
import vertexAI, { gemini20Flash001 } from '@genkit-ai/vertexai';
import { genkit, SessionData, SessionStore, z, Session } from 'genkit/beta';
import { Storage } from '@google-cloud/storage';

let servingPort = 2222;
if (process.env.PORT) {
  servingPort = parseInt(process.env.PORT)
}

const projectId = "lon-next";
const bucket = "lon-next.firebasestorage.app";
const storage = new Storage({ projectId: projectId })

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

interface ChatSessionInfo {
  // Use this if you want to store some very specific state such as User Preferences
};

// start genkit declaration
const ai = genkit({
  plugins: [
    vertexAI({
      location: 'us-central1',
      projectId: projectId,
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
    let session: Session<ChatSessionInfo>;
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
      tools: [],
    });

    const result = await chat.send({
      model: gemini20Flash001,
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
  port: servingPort,
  cors: {
    origin: "*",
  },
  flows: [entryFlow],
});
// end express server startup
