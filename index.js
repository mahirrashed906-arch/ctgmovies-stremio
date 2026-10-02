const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://ctgmovies.com";

const manifest = {
  id: "org.ctgmovies.bdix",
  version: "1.0.0",
  name: "CTG Movies BDIX",
  description: "Fetches BDIX FTP streams directly from CTG Movies",
  resources: ["stream"],
  types: ["movie", "series"],
  idPrefixes: ["tt"]
};

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async ({ type, id }) => {
  const [imdbId, season, episode] = id.split(":");

  try {
    const metaRes = await axios.get(
      `https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`
    );
    const title = metaRes.data?.meta?.name;
    if (!title) return { streams: [] };

    const searchUrl = `${BASE_URL}/search?q=${encodeURIComponent(title)}`;
    const searchRes = await axios.get(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: BASE_URL,
      },
    });

    const $ = cheerio.load(searchRes.data);
    const watchPath = $(".movie-card a, .content-item a").first().attr("href");

    if (!watchPath) return { streams: [] };

    const watchUrl = watchPath.startsWith("http")
      ? watchPath
      : `${BASE_URL}${watchPath}`;

    const watchRes = await axios.get(watchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: BASE_URL,
      },
    });

    const $watch = cheerio.load(watchRes.data);
    let streamUrl =
      $watch("video source").attr("src") \vert{}\vert{} $watch("iframe").attr("src");

    if (streamUrl) {
      if (streamUrl.startsWith("/")) streamUrl = `${BASE_URL}${streamUrl}`;

      return {
        streams: [
          {
            name: "CTG Movies",
            title: `BDIX High-Speed Stream\n${
              type === "series" ? `S${season} E${episode}` : "HD Video"
            }`,
            url: streamUrl,
          },
        ],
      };
    }
  } catch (err) {
    console.error("Error fetching stream:", err.message);
  }

  return { streams: [] };
});

const PORT = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port: PORT });
