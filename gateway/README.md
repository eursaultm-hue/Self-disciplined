# V0.4 AI Gateway

The APK must never contain an LLM provider API key. V0.4 therefore talks to a small server-side gateway.

The gateway receives:
- `message`
- `store`
- `memory`

and returns only this contract:

```json
{
  "reply": "string",
  "actions": [
    { "type": "UPDATE_TASK", "taskId": "existing-id", "status": "DONE" },
    { "type": "SET_AVAILABILITY", "date": "YYYY-MM-DD", "minutes": 60 },
    {
      "type": "CREATE_TASK",
      "task": {
        "title": "25分钟补理解缺口",
        "priorityTier": "SHOULD",
        "plannedMinutes": 25,
        "plannedDate": "YYYY-MM-DD"
      }
    }
  ],
  "memory": {
    "summary": "short durable memory",
    "issues": ["optional issue"]
  },
  "model": "provider-model"
}
```

The gateway owns the provider secret. A deployment can use any OpenAI-compatible provider by setting server-side environment variables.

Required environment:
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL` (optional, defaults to the provider's compatible endpoint)
- `OPENAI_MODEL`

The Android app stores only the gateway URL, never the provider key.

## Security boundary

The gateway is the untrusted LLM boundary. The APK still validates every returned action against the local Store before applying it. Unknown task IDs, invalid statuses, impossible time values, and unknown course/goal IDs are discarded.

## Deployment

This folder is intentionally provider-neutral. Deploy it to a server/worker with HTTPS and configure the three environment variables above. Do not put secrets in the repository or APK.
