import { useEffect, useState } from "react";
import { CloudSun, Loader2 } from "lucide-react";

interface WeatherData {
  temp: number;
  code: number;
  label: string;
}

const CODE_LABELS: Record<number, string> = {
  0: "Clear sky",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Fog",
  51: "Light drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  95: "Thunderstorm",
};

export default function Weather({ locationName }: { locationName?: string }) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error" | "denied">("idle");
  const [data, setData] = useState<WeatherData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchByCoords(lat: number, lon: number) {
      setState("loading");
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`
        );
        const json = await res.json();
        if (cancelled) return;
        const code = json.current?.weather_code ?? 0;
        setData({
          temp: Math.round(json.current?.temperature_2m ?? 0),
          code,
          label: CODE_LABELS[code] || "—",
        });
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    }

    async function fetchByName(name: string) {
      setState("loading");
      try {
        const geo = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1`
        ).then((r) => r.json());
        const place = geo?.results?.[0];
        if (!place) return setState("error");
        await fetchByCoords(place.latitude, place.longitude);
      } catch {
        if (!cancelled) setState("error");
      }
    }

    if (locationName) {
      fetchByName(locationName);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchByCoords(pos.coords.latitude, pos.coords.longitude),
        () => setState("denied"),
        { timeout: 5000 }
      );
    } else {
      setState("error");
    }

    return () => {
      cancelled = true;
    };
  }, [locationName]);

  if (state === "loading" || state === "idle") {
    return (
      <div className="flex items-center gap-2 text-sm text-dusk">
        <Loader2 size={14} className="animate-spin" /> Checking the sky…
      </div>
    );
  }

  if (state === "denied") {
    return (
      <p className="text-xs text-dusk">
        Add a city in Settings to see weather here, or allow location access.
      </p>
    );
  }

  if (state === "error" || !data) {
    return <p className="text-xs text-dusk">Weather unavailable right now.</p>;
  }

  return (
    <div className="flex items-center gap-3">
      <CloudSun size={28} className="text-signal" strokeWidth={1.5} />
      <div>
        <div className="font-display text-2xl leading-none text-ink">{data.temp}°</div>
        <div className="text-xs text-dusk">{data.label}</div>
      </div>
    </div>
  );
}
