interface CTFEvent {
  id: number;
  title: string;
  organized_by: string;
  starts_at: string;
  ends_at: string;
  ctf_type: string;
}

const ICAL_HEADER =
  "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//DreamHack CTF Calendar//dreamhack-calendar//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:DreamHack CTF\r\n";

function escapeICal(text: string): string {
  return text.replace(/[\\;,\n]/g, (c) => (c === "\n" ? "\\n" : `\\${c}`));
}

function toICalDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function generateICal(events: CTFEvent[]): string {
  const now = toICalDate(new Date().toISOString());
  let ical = ICAL_HEADER;

  for (const e of events) {
    const url = `https://dreamhack.io/ctf/${e.id}`;
    ical += `BEGIN:VEVENT\r\nUID:ctf-${e.id}@dreamhack.io\r\nDTSTAMP:${now}\r\nDTSTART:${toICalDate(e.starts_at)}\r\nDTEND:${toICalDate(e.ends_at)}\r\nSUMMARY:${escapeICal(e.title)}\r\nDESCRIPTION:${escapeICal(`Organized by: ${e.organized_by}\\nType: ${e.ctf_type}\\nURL: ${url}`)}\r\nURL:${url}\r\nEND:VEVENT\r\n`;
  }

  return `${ical}END:VCALENDAR\r\n`;
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
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=1800" },
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
        return new Response(`Error: ${e instanceof Error ? e.message : "Unknown"}`, { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
