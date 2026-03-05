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

const ICAL_HEADER = `BEGIN:VCALENDAR\r
VERSION:2.0\r
PRODID:-//DreamHack CTF Calendar//dreamhack-calendar//EN\r
CALSCALE:GREGORIAN\r
METHOD:PUBLISH\r
X-WR-CALNAME:DreamHack CTF\r
X-WR-TIMEZONE:Asia/Seoul\r
BEGIN:VTIMEZONE\r
TZID:Asia/Seoul\r
X-LIC-LOCATION:Asia/Seoul\r
BEGIN:STANDARD\r
TZOFFSETFROM:+0900\r
TZOFFSETTO:+0900\r
TZNAME:KST\r
DTSTART:19700101T000000\r
END:STANDARD\r
END:VTIMEZONE\r
`;

function escapeICal(text: string): string {
  return text.replace(/[\\;,\n]/g, (c) => (c === "\n" ? "\\n" : `\\${c}`));
}

function toICalDate(iso: string): string {
  // "2026-05-02T09:00:00+09:00" → "20260502T090000"
  return iso.slice(0, 19).replace(/[-:]/g, "").replace("T", "T");
}

function buildDescription(event: CTFEvent): string {
  const lines: string[] = [];
  lines.push(`Organized by: ${event.organized_by}`);
  lines.push(`Type: ${event.ctf_type}`);
  if (event.season) {
    lines.push(`Season: ${event.season.title}`);
  }
  lines.push(`URL: https://dreamhack.io/ctf/${event.id}`);
  return lines.join("\\n");
}

function generateICal(events: CTFEvent[]): string {
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  let ical = ICAL_HEADER;

  for (const e of events) {
    const url = `https://dreamhack.io/ctf/${e.id}`;
    const categories = e.season
      ? `${e.ctf_type},${e.season.abbreviated_name}`
      : e.ctf_type;

    ical += `BEGIN:VEVENT\r
UID:ctf-${e.id}@dreamhack.io\r
DTSTAMP:${now}\r
DTSTART;TZID=Asia/Seoul:${toICalDate(e.starts_at)}\r
DTEND;TZID=Asia/Seoul:${toICalDate(e.ends_at)}\r
SUMMARY:${escapeICal(e.title)}\r
DESCRIPTION:${escapeICal(buildDescription(e))}\r
URL:${url}\r
CATEGORIES:${categories}\r
END:VEVENT\r
`;
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
