type Env = {
  OPENAI_API_KEY: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL: string;
  ALLOWED_ORIGIN?: string;
};

const headers = (origin: string) => ({
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

const systemPrompt = `You are the decision engine for a Personal Learning OS.
Convert a user's real-world update into a concise reply, durable memory, and safe actions.
Never invent task IDs, course IDs, or goal IDs. Only use IDs present in the supplied Store.
Prefer updating existing tasks over creating new tasks. Create a task only when a concrete missing action is necessary.
Do not moralize. Distinguish unfinished work, lack of time, and learning difficulty.
Return JSON only with keys: reply, actions, memory, model.
Allowed action types:
UPDATE_TASK {taskId,status?,plannedMinutes?,plannedDate?}
SET_AVAILABILITY {date,minutes}
CREATE_TASK {task:{title,courseId?,goalId?,priorityTier,plannedDate?,dueDate?,plannedMinutes}}
Allowed status: TODO, IN_PROGRESS, DONE, OVERDUE, SKIPPED, BLOCKED, CANCELLED.
Priority tier: MUST, SHOULD, COULD.
Keep plannedMinutes between 5 and 180 for new tasks and 5 and 480 for updates.`;

function json(body: unknown, origin: string, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}

export default {
  async fetch(request: Request, env: Env) {
    const origin = env.ALLOWED_ORIGIN || "*";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin) });
    if (request.method !== "POST") return json({ error: "POST required" }, origin, 405);

    try {
      const input = await request.json() as any;
      if (typeof input.message !== "string" || input.message.length > 2000) return json({ error: "Invalid message" }, origin, 400);

      const base = (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
      const response = await fetch(base + "/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.OPENAI_API_KEY },
        body: JSON.stringify({
          model: env.OPENAI_MODEL,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: JSON.stringify(input) }
          ]
        })
      });
      if (!response.ok) return json({ error: "LLM provider error" }, origin, 502);
      const provider = await response.json() as any;
      const content = provider?.choices?.[0]?.message?.content;
      if (typeof content !== "string") return json({ error: "Invalid model response" }, origin, 502);
      let parsed: any;
      try { parsed = JSON.parse(content); } catch { return json({ error: "Model did not return JSON" }, origin, 502); }
      return json({ ...parsed, model: env.OPENAI_MODEL }, origin);
    } catch {
      return json({ error: "Gateway request failed" }, origin, 500);
    }
  }
};
