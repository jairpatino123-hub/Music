(() => {
  'use strict';

  const MODULE_NAME = 'SynthetiqAudiusMusicV130';
  const API_BASE = 'https://api.audius.co/v1';

  function getConfig() {
    return globalThis.SYNTHETIQ_CONFIG || {};
  }

  function apiUrl(path, params = {}) {
    const url = new URL(API_BASE + path);
    const config = getConfig();
    const apiKey = config.audiusApiKey || config.AUDIUS_API_KEY;

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });

    if (apiKey) {
      url.searchParams.set('api_key', apiKey);
      url.searchParams.set('app_name', 'SynthetiqMusic');
    }

    return url.toString();
  }

  async function request(path, params = {}) {
    const response = await fetch(apiUrl(path, params));
    if (!response.ok) {
      throw new Error(`Audius request failed: ${response.status}`);
    }
    return response.json();
  }

  function artistName(track) {
    return track?.user?.name || track?.user?.handle || 'Unknown Artist';
  }

  function artwork(track) {
    const image = track?.artwork;
    if (!image) return '';
    if (typeof image === 'string') return image;
    return image['150x150'] || image['480x480'] || image['1000x1000'] || '';
  }

  function normalizeTrack(track) {
    if (!track) return null;

    return {
      id: String(track.id),
      title: track.title || 'Unknown Title',
      artist: artistName(track),
      album: track?.album?.name || '',
      artwork: artwork(track),
      durationSeconds: Number(track.duration) || 0,
      quality: 'mp3',
      source: 'Audius'
    };
  }

  async function searchResults(query, page = 1) {
    const q = String(query || '').trim();
    if (!q) return [];

    const limit = 25;
    const offset = Math.max(0, Number(page || 1) - 1) * limit;
    const result = await request('/tracks/search', {
      query: q,
      limit,
      offset
    });

    return (result.data || []).map(normalizeTrack).filter(Boolean);
  }

  async function homeSections() {
    const [trending, latest] = await Promise.all([
      request('/tracks/trending', { limit: 25 }),
      request('/tracks/latest', { limit: 25 })
    ]);

    return [
      {
        title: 'Trending',
        items: (trending.data || []).map(normalizeTrack).filter(Boolean)
      },
      {
        title: 'Latest',
        items: (latest.data || []).map(normalizeTrack).filter(Boolean)
      }
    ];
  }

  async function extractDetails(item) {
    const id = typeof item === 'object' ? item?.id : item;
    if (!id) return null;

    const result = await request(`/tracks/${encodeURIComponent(id)}`);
    return normalizeTrack(result.data);
  }

  async function extractTracks(item) {
    if (!item) return [];

    if (Array.isArray(item)) {
      return item.map(normalizeTrack).filter(Boolean);
    }

    if (Array.isArray(item.tracks)) {
      return item.tracks.map(normalizeTrack).filter(Boolean);
    }

    const track = normalizeTrack(item);
    return track ? [track] : [];
  }

  async function extractAudioUrl(item) {
    const track = normalizeTrack(item);
    if (!track?.id) return null;

    const url = apiUrl(`/tracks/${encodeURIComponent(track.id)}/stream`);

    return {
      url,
      headers: {},
      mimeType: 'audio/mpeg',
      extension: 'mp3',
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork: track.artwork,
      durationSeconds: track.durationSeconds,
      quality: track.quality
    };
  }

  globalThis[MODULE_NAME] = {
    searchResults,
    homeSections,
    extractDetails,
    extractTracks,
    extractAudioUrl
  };

  globalThis.searchResults = searchResults;
  globalThis.homeSections = homeSections;
  globalThis.extractDetails = extractDetails;
  globalThis.extractTracks = extractTracks;
  globalThis.extractAudioUrl = extractAudioUrl;
})();
