// Worker

export default {
  async fetch(request, env) {
    return await handleRequest(request, env);
  }
}

async function handleRequest(request, env) {
  console.log(env.COUNTER)

  let id = env.COUNTER.idFromName("B");
  let obj = env.COUNTER.get(id);
  let resp = await obj.fetch(request.url);
  let count = await resp.text();

  return new Response(count);
}

// Durable Object

export class Counter {
  constructor(state, env) {
    this.state = state;
    // `blockConcurrencyWhile()` ensures no requests are delivered until
    // initialization completes.
    this.state.blockConcurrencyWhile(async () => {
      let stored = await this.state.storage.get("value");
      let events = await this.state.storage.get("events");
      this.value = stored || 0;
      this.events = events || []
    })
  }

  // Handle HTTP requests from clients.
  async fetch(request) {
    // Apply requested action.
    let url = new URL(request.url);
    let currentValue = this.value;
    let events = this.events;
    switch (url.pathname) {
      case "/increment":
        currentValue = ++this.value;
        events.push('incremented')
        await this.state.storage.put("value", this.value);
        await this.state.storage.put("events", events);
        break;
      case "/decrement":
        currentValue = --this.value;
        events.push('decremented')
        await this.state.storage.put("value", this.value);
        await this.state.storage.put("events", events);
        break;

      case "/":
        // Just serve the current value. No storage calls needed!
        break;
      default:
        return new Response("Not found", {status: 404});
    }

    // Return `currentValue`. Note that `this.value` may have been
    // incremented or decremented by a concurrent request when we
    // yielded the event loop to `await` the `storage.put` above!
    // That's why we stored the counter value created by this
    // request in `currentValue` before we used `await`.
    return new Response(JSON.stringify({
      currentValue,
      events
    }));
  }
}
