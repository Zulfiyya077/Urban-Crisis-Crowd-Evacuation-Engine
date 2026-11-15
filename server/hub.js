export function createHub() {
  const clients = new Set();
  return {
    add(res) {
      clients.add(res);
      return () => clients.delete(res);
    },
    publish(event, data) {
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      for (const res of clients) {
        try {
          res.write(payload);
        } catch {
          clients.delete(res);
        }
      }
    },
  };
}
