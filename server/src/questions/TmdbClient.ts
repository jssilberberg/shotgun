export interface TmdbMovieSummary {
  id: number;
  title: string;
  popularity: number;
  release_date?: string;
}

export interface TmdbMovieDetails extends TmdbMovieSummary {
  revenue?: number;
}

export interface TmdbCastMember {
  name: string;
  character: string;
  order: number;
}

export interface TmdbCrewMember {
  name: string;
  job: string;
}

export interface TmdbCredits {
  cast: TmdbCastMember[];
  crew: TmdbCrewMember[];
}

export interface TmdbClient {
  discoverMovies(opts: { sortBy: "popularity.desc" | "popularity.asc"; page: number }): Promise<TmdbMovieSummary[]>;
  getMovieDetails(movieId: number): Promise<TmdbMovieDetails>;
  getMovieCredits(movieId: number): Promise<TmdbCredits>;
}

export class FetchTmdbClient implements TmdbClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  public constructor(options: { apiKey: string; baseUrl?: string; fetchImpl?: typeof fetch }) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.themoviedb.org/3";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async discoverMovies(opts: { sortBy: "popularity.desc" | "popularity.asc"; page: number }): Promise<TmdbMovieSummary[]> {
    const url = new URL(`${this.baseUrl}/discover/movie`);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("sort_by", opts.sortBy);
    url.searchParams.set("include_adult", "false");
    url.searchParams.set("include_video", "false");
    url.searchParams.set("language", "en-US");
    url.searchParams.set("page", String(opts.page));
    // The "obscure" (popularity.asc) tier must still be real, recognizable films,
    // not zero-vote stubs — require a healthy vote count and a decent rating so
    // "hard" questions are about lesser-known films, not garbage entries.
    url.searchParams.set("vote_count.gte", opts.sortBy === "popularity.desc" ? "300" : "500");
    url.searchParams.set("vote_average.gte", opts.sortBy === "popularity.desc" ? "6.0" : "6.5");

    const payload = await this.getJson(url);
    if (!isRecord(payload) || !Array.isArray(payload.results)) {
      throw new Error("TMDB discover response was malformed");
    }

    return payload.results.map((movie) => normalizeMovieSummary(movie));
  }

  public async getMovieDetails(movieId: number): Promise<TmdbMovieDetails> {
    const url = new URL(`${this.baseUrl}/movie/${movieId}`);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("language", "en-US");

    const payload = await this.getJson(url);
    return normalizeMovieDetails(payload);
  }

  public async getMovieCredits(movieId: number): Promise<TmdbCredits> {
    const url = new URL(`${this.baseUrl}/movie/${movieId}/credits`);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("language", "en-US");

    const payload = await this.getJson(url);
    if (!isRecord(payload) || !Array.isArray(payload.cast) || !Array.isArray(payload.crew)) {
      throw new Error("TMDB credits response was malformed");
    }

    return {
      cast: payload.cast.map((member) => normalizeCastMember(member)).filter(isPresent),
      crew: payload.crew.map((member) => normalizeCrewMember(member)).filter(isPresent)
    };
  }

  private async getJson(url: URL): Promise<unknown> {
    const response = await this.fetchImpl(url);
    if (!response.ok) {
      throw new Error(`TMDB request failed with ${response.status}`);
    }

    return response.json();
  }
}

function normalizeMovieSummary(value: unknown): TmdbMovieSummary {
  if (!isRecord(value) || typeof value.id !== "number" || typeof value.title !== "string") {
    throw new Error("TMDB movie summary was malformed");
  }

  const summary: TmdbMovieSummary = {
    id: value.id,
    title: value.title,
    popularity: typeof value.popularity === "number" ? value.popularity : 0
  };

  if (typeof value.release_date === "string") {
    summary.release_date = value.release_date;
  }

  return summary;
}

function normalizeMovieDetails(value: unknown): TmdbMovieDetails {
  const summary = normalizeMovieSummary(value);
  const details: TmdbMovieDetails = { ...summary };

  if (isRecord(value) && typeof value.revenue === "number") {
    details.revenue = value.revenue;
  }

  return details;
}

function normalizeCastMember(value: unknown): TmdbCastMember | null {
  if (!isRecord(value) || typeof value.name !== "string" || typeof value.character !== "string") {
    return null;
  }

  return {
    name: value.name,
    character: value.character,
    order: typeof value.order === "number" ? value.order : 999
  };
}

function normalizeCrewMember(value: unknown): TmdbCrewMember | null {
  if (!isRecord(value) || typeof value.name !== "string" || typeof value.job !== "string") {
    return null;
  }

  return {
    name: value.name,
    job: value.job
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}
