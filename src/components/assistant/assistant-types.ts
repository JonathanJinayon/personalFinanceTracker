export type AssistantRole = "assistant" | "user";

export type AssistantMessage = {
  id: string;
  role: AssistantRole;
  content: string;
};
