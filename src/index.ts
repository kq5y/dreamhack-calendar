import ical from "ical-generator";

interface Season {
  id: number;
  abbreviated_name: string;
  title: string;
}

interface CTFEvent {
  id: number;
  title: string;
  organized_by: string;
  season: Season | null;
  ctf_type: string;
  starts_at: string;
  ends_at: string;
}

function buildDescription(event: CTFEvent): string {
  const lines: string[] = [];
  lines.push(`Organized by: ${event.organized_by}`);
  lines.push(`Type: ${event.ctf_type}`);
  if (event.season) {
    lines.push(`Season: ${event.season.title}`);
  }
  lines.push(`URL: https://dreamhack.io/ctf/${event.id}`);
  return lines.join("\n");
}

function generateICal(events: CTFEvent[]): string {
  const calendar = ical({ name: "DreamHack CTF" });

  for (const event of events) {
    const url = `https://dreamhack.io/ctf/${event.id}`;
    const categories: string[] = [event.ctf_type];

    if (event.season) {
      categories.push(event.season.abbreviated_name);
    }

    calendar.createEvent({
      id: `ctf-${event.id}@dreamhack.io`,
      start: new Date(event.starts_at),
      end: new Date(event.ends_at),
      summary: event.title,
      description: buildDescription(event),
      url,
      categories: categories.map((name) => ({ name })),
    });
  }

  return calendar.toString();
}

async function fetchWithCache(
  scope: string,
  filterings: string | null,
  cache: Cache
): Promise<CTFEvent[]> {
  const apiUrl = `https://dreamhack.io/api/v1/ctf/ctfs/?scope=${scope}&ordering=-ends_at&limit=25&offset=0${filterings ? `&filterings=${filterings}` : ""}`;

  const cached = await cache.match(apiUrl);
  if (cached) {
    const data = await cached.json<{ results: CTFEvent[] }>();
    return data.results;
  }

  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`API error: ${res.status}`);

  const data = await res.json<{ results: CTFEvent[] }>();

  const cacheRes = new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=1800",
    },
  });
  await cache.put(apiUrl, cacheRes);

  return data.results;
}

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/calendar.ics") {
      const scope = url.searchParams.get("scope") ?? "ongoing,waiting,ended";
      const filterings = url.searchParams.get("filterings");

      try {
        const cache = await caches.open("api");
        const events = await fetchWithCache(scope, filterings, cache);
        return new Response(generateICal(events), {
          headers: {
            "Content-Type": "text/calendar;charset=utf-8",
            "Cache-Control": "public,max-age=21600",
          },
        });
      } catch (e) {
        return new Response(
          `Error: ${e instanceof Error ? e.message : "Unknown"}`,
          { status: 500 }
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
