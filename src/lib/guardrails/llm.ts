import ZAI from "z-ai-web-dev-sdk";

let zaiInstance: InstanceType<typeof ZAI> | null = null;

async function getZAI(): Promise<InstanceType<typeof ZAI>> {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chat(
  messages: LLMMessage[],
  options?: { temperature?: number }
): Promise<string> {
  const zai = await getZAI();

  const response = await zai.chat.completions.create({
    messages,
    temperature: options?.temperature ?? 0.3,
  });

  return response.choices?.[0]?.message?.content || "";
}