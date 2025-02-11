# Genkit Chat

This is a really basic example of using chat feature in Genkit with a GCS State Saver for the chat.

You will need to supply your own project id and bucket to use this.

# Invoking the chat using curl

```
curl -X POST http://127.0.0.1:2222/entryFlow -H "Content-Type: application/json" -d '{"data":{"text":"Time in London England"}}'
```

Subsequent requests should use the same session Id that was originally provided


