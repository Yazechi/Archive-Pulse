const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
const youtubedl = require('youtube-dl-exec');
const axios = require('axios');
const { EPub } = require('epub2');
const AdmZip = require('adm-zip');
const mm = require('music-metadata');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const UPLOADS_DIR = process.env.UPLOADS_DIR || './uploads';

const musicUploadDir = path.join(UPLOADS_DIR, 'music');
const booksUploadDir = path.join(UPLOADS_DIR, 'books');
const mangaUploadDir = path.join(UPLOADS_DIR, 'manga');
const thumbUploadDir = path.join(UPLOADS_DIR, 'thumbnails');

if (!fs.existsSync(musicUploadDir)) fs.mkdirSync(musicUploadDir, { recursive: true });
if (!fs.existsSync(booksUploadDir)) fs.mkdirSync(booksUploadDir, { recursive: true });
if (!fs.existsSync(mangaUploadDir)) fs.mkdirSync(mangaUploadDir, { recursive: true });
if (!fs.existsSync(thumbUploadDir)) fs.mkdirSync(thumbUploadDir, { recursive: true });

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, (file.fieldname === 'music' || file.fieldname === 'music_files') ? musicUploadDir : booksUploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
});
const upload = multer({ storage });

const initDb = async () => {
  try {
    const conn = await pool.getConnection();
    await conn.query(`
      CREATE TABLE IF NOT EXISTS songs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT,
        album TEXT,
        duration TEXT,
        source ENUM('local', 'youtube'),
        source_id VARCHAR(255),
        thumbnail_url TEXT,
        last_position FLOAT DEFAULT 0,
        play_count INT DEFAULT 0,
        last_played_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_source (source, source_id)
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS books (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT,
        type VARCHAR(50),
        source ENUM('local', 'external'),
        source_url VARCHAR(500),
        thumbnail_url TEXT,
        progress FLOAT DEFAULT 0,
        last_page VARCHAR(255),
        total_pages INT,
        last_cfi VARCHAR(255),
        last_read_at TIMESTAMP NULL,
        series_id INT NULL,
        volume_number FLOAT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_source_url (source_url(255))
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS book_highlights (
        id INT AUTO_INCREMENT PRIMARY KEY,
        book_id INT NOT NULL,
        format ENUM('epub', 'pdf') NOT NULL,
        locator VARCHAR(512) NOT NULL,
        text_excerpt VARCHAR(1000) NOT NULL,
        color VARCHAR(24) NOT NULL DEFAULT '#fde047',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_book_highlights_book (book_id),
        UNIQUE KEY unique_book_highlight (book_id, format, locator(255), text_excerpt(255)),
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS series (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT,
        description TEXT,
        thumbnail_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        thumbnail_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS playlist_songs (
        playlist_id INT,
        song_id INT,
        PRIMARY KEY (playlist_id, song_id),
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
      )
    `);

    // === BATCH 1 FEATURE TABLES ===

    // Tags System
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        color VARCHAR(24) DEFAULT '#00f2ff',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS content_tags (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tag_id INT NOT NULL,
        content_type ENUM('song', 'book', 'video') NOT NULL,
        content_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_content_tag (tag_id, content_type, content_id),
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `);

    // Activity Log / Watch History
    await conn.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        action_type ENUM('play', 'pause', 'complete', 'read', 'download', 'upload', 'add_to_library', 'remove', 'favorite', 'unfavorite') NOT NULL,
        content_type ENUM('song', 'book', 'video', 'playlist', 'series') NOT NULL,
        content_id INT NOT NULL,
        content_title VARCHAR(500),
        content_thumbnail VARCHAR(500),
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_activity_type (action_type),
        INDEX idx_activity_content (content_type, content_id),
        INDEX idx_activity_time (created_at DESC)
      )
    `);

    // Videos / Movies / Anime
    await conn.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title TEXT NOT NULL,
        original_title TEXT,
        type ENUM('movie', 'anime', 'series', 'other') DEFAULT 'movie',
        source ENUM('local', 'external') DEFAULT 'external',
        source_id VARCHAR(255),
        source_provider VARCHAR(100),
        thumbnail_url TEXT,
        backdrop_url TEXT,
        description TEXT,
        release_year INT,
        duration INT,
        rating FLOAT,
        genres TEXT,
        progress FLOAT DEFAULT 0,
        last_position FLOAT DEFAULT 0,
        last_watched_at TIMESTAMP NULL,
        total_episodes INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_video_source (source, source_id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS video_episodes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        video_id INT NOT NULL,
        episode_number INT NOT NULL,
        season_number INT DEFAULT 1,
        title VARCHAR(500),
        source_id VARCHAR(255),
        source_url TEXT,
        thumbnail_url TEXT,
        duration INT,
        progress FLOAT DEFAULT 0,
        last_position FLOAT DEFAULT 0,
        watched BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_episode (video_id, season_number, episode_number),
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
      )
    `);

    // Favorites System
    await conn.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id INT AUTO_INCREMENT PRIMARY KEY,
        content_type ENUM('song', 'book', 'video') NOT NULL,
        content_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_favorite (content_type, content_id)
      )
    `);

    // Reading Sessions (for statistics)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS reading_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        book_id INT NOT NULL,
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_time TIMESTAMP NULL,
        pages_read INT DEFAULT 0,
        start_page INT,
        end_page INT,
        duration_seconds INT DEFAULT 0,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS chapter_bookmarks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        book_id INT NOT NULL,
        bookmark_type ENUM('manga', 'epub', 'pdf') NOT NULL DEFAULT 'manga',
        chapter_id VARCHAR(255) NULL,
        chapter_title VARCHAR(500) NULL,
        locator VARCHAR(512) NULL,
        note VARCHAR(500) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_chapter_bookmarks_book (book_id),
        UNIQUE KEY unique_chapter_bookmark (book_id, bookmark_type, chapter_id, locator(255)),
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      )
    `);

    // Download Queue
    await conn.query(`
      CREATE TABLE IF NOT EXISTS downloads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        content_type ENUM('manga_chapter', 'video', 'music') NOT NULL,
        content_id VARCHAR(255) NOT NULL,
        title VARCHAR(500) NOT NULL,
        parent_title VARCHAR(500),
        parent_id VARCHAR(255),
        thumbnail_url TEXT,
        status ENUM('pending', 'downloading', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
        progress FLOAT DEFAULT 0,
        downloaded_bytes BIGINT DEFAULT 0,
        total_bytes BIGINT DEFAULT 0,
        error_message TEXT,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP NULL,
        completed_at TIMESTAMP NULL,
        UNIQUE KEY unique_download (content_type, content_id)
      )
    `);

    // Enhanced book_highlights with notes
    try { await conn.query('ALTER TABLE book_highlights ADD COLUMN note TEXT AFTER color'); } catch (e) {}
    
    // Migrations
    try { await conn.query('ALTER TABLE books ADD COLUMN last_cfi VARCHAR(255)'); } catch (e) {}
    try { await conn.query('ALTER TABLE books MODIFY COLUMN last_page VARCHAR(255)'); } catch (e) {}
    try { await conn.query('ALTER TABLE books ADD COLUMN last_read_at TIMESTAMP NULL'); } catch (e) {}
    try { await conn.query('ALTER TABLE books ADD COLUMN series_id INT NULL'); } catch (e) {}
    try { await conn.query('ALTER TABLE books ADD COLUMN volume_number FLOAT NULL'); } catch (e) {}
    try { await conn.query('ALTER TABLE books ADD COLUMN last_chapter_title VARCHAR(255)'); } catch (e) {}
    try { await conn.query('ALTER TABLE songs ADD COLUMN play_count INT DEFAULT 0'); } catch (e) {}

    const [columns] = await conn.query('SHOW COLUMNS FROM books');
    console.log('Books Table Columns:', columns.map(c => c.Field).join(', '));
    const [indices] = await conn.query('SHOW INDEX FROM books');
    console.log('Books Table Indices:', indices.map(i => i.Key_name).join(', '));
    
    conn.release();
    console.log('Archive DB: Verified');
  } catch (err) { console.error('DB Error:', err.message); }
};
initDb();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(morgan('dev'));
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR, {
  setHeaders: (res, path, stat) => {
    if (path.endsWith('.epub')) {
      res.set('Content-Type', 'application/epub+zip');
    }
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
    res.set('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
  }
}));

// --- HELPERS ---

const extractMusicMetadata = async (filePath) => {
  try {
    const metadata = await mm.parseFile(filePath);
    const { common, format } = metadata;
    
    let thumbnailUrl = null;
    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0];
      const filename = path.basename(filePath);
      const thumbFilename = `thumb-${filename}.${pic.format.split('/')[1] || 'jpg'}`;
      const thumbPath = path.join(thumbUploadDir, thumbFilename);
      fs.writeFileSync(thumbPath, pic.data);
      thumbnailUrl = `/uploads/thumbnails/${thumbFilename}`;
    }

    return {
      title: common.title || path.basename(filePath),
      artist: common.artist || 'Unknown Artist',
      album: common.album || 'Unknown Album',
      duration: format.duration ? `${Math.floor(format.duration / 60)}:${Math.floor(format.duration % 60).toString().padStart(2, '0')}` : 'N/A',
      thumbnail_url: thumbnailUrl
    };
  } catch (err) {
    console.error('Metadata extraction failed:', err.message);
    return null;
  }
};

const scanUploads = async () => {
  console.log('Archive Watchdog: Scanning for new artifacts...');
  
  try {
    // Music Scan
    const musicFiles = fs.readdirSync(musicUploadDir).filter(f => /\.(mp3|wav|flac|m4a|ogg)$/i.test(f));
    for (const f of musicFiles) {
      const [existing] = await pool.query('SELECT * FROM songs WHERE source_id = ? AND source = "local"', [f]);
      if (existing.length === 0) {
        console.log(`Auto-cataloging music: ${f}`);
        const meta = await extractMusicMetadata(path.join(musicUploadDir, f));
        if (meta) {
          await pool.query(
            'INSERT INTO songs (title, artist, album, duration, source, source_id, thumbnail_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [meta.title, meta.artist, meta.album, meta.duration, 'local', f, meta.thumbnail_url]
          );
        }
      }
    }

    // Books Scan
    const bookFiles = fs.readdirSync(booksUploadDir).filter(f => /\.(epub|pdf|cbz)$/i.test(f));
    for (const f of bookFiles) {
      const [existing] = await pool.query('SELECT * FROM books WHERE source_url = ? AND source = "local"', [f]);
      if (existing.length === 0) {
        console.log(`Auto-cataloging book: ${f}`);
        let thumb = null;
        if (f.toLowerCase().endsWith('.epub')) thumb = await extractEpubCover(path.join(booksUploadDir, f), f);
        else if (f.toLowerCase().endsWith('.cbz')) thumb = await extractCbzCover(path.join(booksUploadDir, f), f);
        
        await pool.query(
          'INSERT INTO books (title, author, type, source, source_url, thumbnail_url) VALUES (?, ?, ?, ?, ?, ?)',
          [f, 'Unknown', f.endsWith('.cbz') ? 'manga' : 'book', 'local', f, thumb]
        );
      }
    }
  } catch (err) {
    console.error('Watchdog Error:', err.message);
  }
};

// Initial scan and then every 10 minutes
setTimeout(scanUploads, 5000);
setInterval(scanUploads, 10 * 60 * 1000);

const extractEpubCover = async (epubPath, filename) => {
  return new Promise((resolve) => {
    try {
      const epub = new EPub(epubPath);
      epub.on('end', () => {
        let coverId = epub.metadata.cover;
        
        if (!coverId) {
          const manifest = epub.manifest;
          const possibleIds = Object.keys(manifest).filter(id => 
            id.toLowerCase().includes('cover') || 
            (manifest[id].properties && manifest[id].properties.includes('cover-image'))
          );
          if (possibleIds.length > 0) coverId = possibleIds[0];
        }

        if (!coverId) {
          console.log(`No cover found for ${filename}`);
          return resolve(null);
        }

        epub.getImage(coverId, (err, data, mimeType) => {
          if (err || !data) {
            console.log(`Failed to get image for ${coverId} in ${filename}`);
            return resolve(null);
          }
          const extension = mimeType ? mimeType.split('/')[1] || 'jpg' : 'jpg';
          const thumbFilename = `thumb-${filename}.${extension}`;
          const thumbPath = path.join(thumbUploadDir, thumbFilename);
          fs.writeFileSync(thumbPath, data);
          resolve(`/uploads/thumbnails/${thumbFilename}`);
        });
      });

      epub.on('error', (err) => {
        console.error('EPUB Error:', err.message);
        resolve(null);
      });

      epub.parse();
    } catch (err) {
      console.error('EPUB Extraction exception:', err.message);
      resolve(null);
    }
  });
};

const extractCbzCover = async (cbzPath, filename) => {
  try {
    const zip = new AdmZip(cbzPath);
    const zipEntries = zip.getEntries();
    const imageEntries = zipEntries.filter(entry => 
      !entry.isDirectory && /\.(jpg|jpeg|png|webp|gif)$/i.test(entry.entryName)
    );
    
    // Sort to get the first page (usually page_0 or 001)
    imageEntries.sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, {numeric: true, sensitivity: 'base'}));
    
    if (imageEntries.length > 0) {
      const coverEntry = imageEntries[0];
      const data = coverEntry.getData();
      const extension = path.extname(coverEntry.entryName).replace('.', '') || 'jpg';
      const thumbFilename = `thumb-${filename}.${extension}`;
      const thumbPath = path.join(thumbUploadDir, thumbFilename);
      fs.writeFileSync(thumbPath, data);
      return `/uploads/thumbnails/${thumbFilename}`;
    }
    return null;
  } catch (err) {
    console.error('CBZ Cover extraction failed:', err.message);
    return null;
  }
};

const extractCbzPagesAsDataUrls = (cbzPath) => {
  const zip = new AdmZip(cbzPath);
  const entries = zip
    .getEntries()
    .filter((e) => !e.isDirectory && /\.(jpg|jpeg|png|webp)$/i.test(e.entryName))
    .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true, sensitivity: 'base' }));

  return entries.map((entry) => {
    const ext = path.extname(entry.entryName).toLowerCase();
    const mime =
      ext === '.png' ? 'image/png'
      : ext === '.webp' ? 'image/webp'
      : 'image/jpeg';
    const base64 = entry.getData().toString('base64');
    return `data:${mime};base64,${base64}`;
  });
};

const https = require('https');
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({  
    rejectUnauthorized: false
  })
});

const downloadFile = async (url, dest) => {
  const writer = fs.createWriteStream(dest);
  const response = await axiosInstance({
    url,
    method: 'GET',
    responseType: 'stream'
  });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
};

// --- PROVIDERS ---

const searchMangaDex = async (query) => {
  try {
    const res = await axiosInstance.get(`https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&limit=10&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`);
    return (res.data.data || []).map(m => {
      const coverRel = m.relationships.find(r => r.type === 'cover_art');
      const coverUrl = coverRel ? `https://uploads.mangadex.org/covers/${m.id}/${coverRel.attributes.fileName}.256.jpg` : null;
      return {
        id: `md-${m.id}`,
        title: m.attributes.title.en || Object.values(m.attributes.title)[0],
        author: 'MangaDex Artist',
        thumbnail_url: coverUrl,
        source: 'external',
        source_name: 'MangaDex',
        source_url: m.id,
        type: 'manga'
      };
    });
  } catch (err) { 
    console.error('MangaDex search error:', err.message);
    return []; 
  }
};

const parseAnitakuSearchResults = (html, sourceProvider = 'Gogoanime') => {
  const seen = new Set();
  const results = [];
  const itemRegex = /<li>[\s\S]*?<a[^>]+href="\/category\/([^"]+)"[^>]+title="([^"]+)"[\s\S]*?<img[^>]+src="([^"]+)"/gi;
  let match;
  while ((match = itemRegex.exec(html)) !== null) {
    const slug = (match[1] || '').trim();
    const title = (match[2] || '').trim();
    const image = (match[3] || '').trim();
    if (!slug || !title || seen.has(slug)) continue;
    seen.add(slug);
    results.push({
      id: `${sourceProvider.toLowerCase()}-${slug}`,
      title,
      type: 'anime',
      source: 'external',
      source_id: slug,
      source_provider: sourceProvider,
      thumbnail_url: image.startsWith('//') ? `https:${image}` : image,
      total_episodes: null
    });
  }
  return results;
};

const searchAnitaku = async (query, sourceProvider = 'Gogoanime') => {
  try {
    const url = `https://anitaku.to/search.html?keyword=${encodeURIComponent(query)}`;
    const res = await axiosInstance.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    return parseAnitakuSearchResults(res.data, sourceProvider);
  } catch (err) {
    console.error(`Anitaku search error (${sourceProvider}):`, err.message);
    return [];
  }
};

const getGogoEpisodeList = async (animeSlug) => {
  const res = await axiosInstance.get(`https://anitaku.to/category/${encodeURIComponent(animeSlug)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = res.data;
  const episodeListMatches = [...html.matchAll(/<ul id="episode_related"[\s\S]*?<\/ul>/gi)];
  const scope = episodeListMatches.length > 0
    ? episodeListMatches.map((m) => m[0]).join('\n')
    : html;
  const expectedPrefix = `${animeSlug.toLowerCase()}-episode-`;
  const episodes = [];
  const seen = new Set();
  const epRegex = /href="\/([^"\s]*-episode-[^"]+)"[^>]*data-num="([0-9]+(?:\.[0-9]+)?)"/gi;
  let match;
  while ((match = epRegex.exec(scope)) !== null) {
    const slug = (match[1] || '').trim();
    const numRaw = (match[2] || '').trim();
    if (!slug.toLowerCase().startsWith(expectedPrefix)) continue;
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const number = Number(numRaw);
    episodes.push({
      id: slug,
      number: Number.isFinite(number) ? number : null,
      title: number ? `Episode ${number}` : slug.replace(/-/g, ' ')
    });
  }
  if (episodes.length === 0) {
    const looseRegex = /href="\/([^"\s]*-episode-([0-9]+(?:\.[0-9]+)?))"/gi;
    while ((match = looseRegex.exec(scope)) !== null) {
      const slug = (match[1] || '').trim();
      const numRaw = (match[2] || '').trim();
      if (!slug.toLowerCase().startsWith(expectedPrefix)) continue;
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      const number = Number(numRaw);
      episodes.push({
        id: slug,
        number: Number.isFinite(number) ? number : null,
        title: number ? `Episode ${number}` : slug.replace(/-/g, ' ')
      });
    }
  }
  episodes.sort((a, b) => {
    if (a.number == null && b.number == null) return a.id.localeCompare(b.id);
    if (a.number == null) return 1;
    if (b.number == null) return -1;
    return a.number - b.number;
  });
  return episodes;
};

const getGogoWatchSources = async (episodeSlug) => {
  try {
    const res = await axiosInstance.get(`https://anitaku.to/${episodeSlug}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    });
    const html = res.data;
    const seen = new Set();
    const sources = [];
    
    // Try multiple patterns for video sources
    const patterns = [
      /data-video="([^"]+)"/gi,
      /data-src="([^"]+)"/gi,
      /src="(https?:\/\/[^"]*(?:embed|stream|play)[^"]*)"/gi,
      /iframe[^>]*src="([^"]+)"/gi
    ];
    
    for (const regex of patterns) {
      let match;
      while ((match = regex.exec(html)) !== null) {
        let url = (match[1] || '').trim();
        if (!url) continue;
        // Ensure URL starts with protocol
        if (url.startsWith('//')) url = 'https:' + url;
        if (!url.startsWith('http')) continue;
        if (seen.has(url)) continue;
        seen.add(url);
        sources.push({ url, quality: 'auto' });
      }
    }
    return sources;
  } catch (err) {
    console.error('Watch sources error:', err.message);
    return [];
  }
};

const parseVidSrcSourceId = (value) => {
  const sourceId = String(value || '').trim();
  if (!sourceId) return {};
  if (sourceId.startsWith('imdb:')) return { imdb: sourceId.slice(5) };
  if (sourceId.startsWith('tmdb:')) return { tmdb: sourceId.slice(5) };
  if (/^tt\d+$/i.test(sourceId)) return { imdb: sourceId };
  if (/^\d+$/.test(sourceId)) return { tmdb: sourceId };
  return {};
};

const searchVidSrcMovies = async (query, pages = 4) => {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) return [];

  const aggregated = [];
  for (let page = 1; page <= pages; page += 1) {
    try {
      const res = await axiosInstance.get(`https://vidsrc-embed.ru/movies/latest/page-${page}.json`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const list = Array.isArray(res.data?.result) ? res.data.result : [];
      aggregated.push(...list);
    } catch (err) {
      console.error(`VidSrc list page ${page} error:`, err.message);
    }
  }

  return aggregated
    .filter((item) => String(item.title || '').toLowerCase().includes(normalized))
    .slice(0, 40)
    .map((item) => {
      const imdb = item.imdb_id || null;
      const tmdb = item.tmdb_id || null;
      const source_id = imdb ? `imdb:${imdb}` : (tmdb ? `tmdb:${tmdb}` : null);
      return {
        id: `vidsrc-${imdb || tmdb || Buffer.from(item.title || '').toString('hex').slice(0, 10)}`,
        title: item.title,
        type: 'movie',
        source: 'external',
        source_id,
        source_provider: 'VidSrc',
        thumbnail_url: null,
        imdb_id: imdb,
        tmdb_id: tmdb,
        quality: item.quality,
        time_added: item.time_added
      };
    })
    .filter((v) => Boolean(v.source_id));
};

const searchJikan = async (query, type = 'manga') => {
  try {
    const res = await axios.get(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(query)}&limit=10&type=${type}`);
    return (res.data.data || []).map(m => ({
      id: `jk-${m.mal_id}`,
      title: m.title,
      author: m.authors[0]?.name || 'Unknown',
      thumbnail_url: m.images.jpg.image_url,
      source: 'external',
      source_name: 'MyAnimeList',
      source_url: m.url,
      type: type === 'manga' ? 'manga' : 'book'
    }));
  } catch (err) { return []; }
};

const searchFreeNovels = async (query) => {
  try {
    const url = query ? `https://gutendex.com/books/?search=${encodeURIComponent(query)}` : `https://gutendex.com/books/`;
    const res = await axios.get(url);
    return (res.data.results || []).slice(0, 10).map(book => {
      const sourceUrl = book.formats['application/epub+zip'] || 
                       book.formats['text/html; charset=utf-8'] || 
                       book.formats['text/plain; charset=utf-8'];
      return {
        id: `gt-${book.id}`,
        title: book.title,
        author: book.authors[0]?.name || 'Public Domain',
        thumbnail_url: book.formats['image/jpeg'],
        source: 'external',
        source_name: 'Gutenberg',
        source_url: sourceUrl,
        type: 'book'
      };
    });
  } catch (err) { return []; }
};

const searchOpenLibrary = async (query) => {
  try {
    const url = query ? `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&has_fulltext=true&limit=10` : `https://openlibrary.org/search.json?q=subject:fiction&has_fulltext=true&limit=10`;
    const res = await axios.get(url);
    return (res.data.docs || []).map(book => {
      return {
        id: `ol-${book.key.replace('/works/', '')}`,
        title: book.title,
        author: book.author_name ? book.author_name[0] : 'Unknown',
        thumbnail_url: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : null,
        source: 'external',
        source_name: 'OpenLibrary',
        source_url: `https://openlibrary.org${book.key}`,
        type: 'book'
      };
    });
  } catch (err) { return []; }
};

app.get('/api/stats', async (req, res) => {
  try {
    const [songCount] = await pool.query('SELECT COUNT(*) as count FROM songs');
    const [bookCounts] = await pool.query('SELECT type, COUNT(*) as count FROM books GROUP BY type');
    const [songs] = await pool.query('SELECT duration FROM songs');
    const [seriesCount] = await pool.query('SELECT COUNT(*) as count FROM series');
    const [playlistCount] = await pool.query('SELECT COUNT(*) as count FROM playlists');
    
    let totalSeconds = 0;
    songs.forEach(s => {
      if (s.duration && s.duration !== 'N/A') {
        const parts = s.duration.split(':').map(Number);
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          totalSeconds += parts[0] * 60 + parts[1];
        } else if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
          totalSeconds += parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
      }
    });

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const musicDuration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    let totalLocalChapters = 0;
    if (fs.existsSync(mangaUploadDir)) {
      const mangaDirs = fs.readdirSync(mangaUploadDir);
      for (const md of mangaDirs) {
        const dPath = path.join(mangaUploadDir, md);
        if (fs.lstatSync(dPath).isDirectory()) {
          const files = fs.readdirSync(dPath).filter(f => f.endsWith('.cbz'));
          totalLocalChapters += files.length;
        }
      }
    }

    const [recentlyRead] = await pool.query('SELECT * FROM books WHERE last_read_at IS NOT NULL ORDER BY last_read_at DESC LIMIT 4');
    const [progressStats] = await pool.query('SELECT COUNT(*) as completed, (SELECT COUNT(*) FROM books WHERE progress > 0 AND progress < 100) as inProgress FROM books WHERE progress = 100');

    const stats = {
      songs: songCount[0].count,
      musicDuration,
      books: 0,
      mangas: 0,
      localChapters: totalLocalChapters,
      series: seriesCount[0].count,
      playlists: playlistCount[0].count,
      recentlyRead: recentlyRead,
      readingHabits: {
        completed: progressStats[0]?.completed || 0,
        inProgress: progressStats[0]?.inProgress || 0
      }
    };

    bookCounts.forEach(row => {
      if (row.type === 'book') stats.books += row.count;
      else if (row.type === 'manga') stats.mangas += row.count;
    });

    res.json(stats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ROUTES: MUSIC ---

app.get('/api/songs', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM songs ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/songs/add', async (req, res) => {
  const { title, artist, source_id, thumbnail_url, source, duration } = req.body;
  try {
    await pool.query(
      'INSERT INTO songs (title, artist, source_id, thumbnail_url, source, duration) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title)',
      [title, artist, source_id, thumbnail_url, source, duration]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const createSongFromUpload = async (file, { title, artist } = {}) => {
  const filePath = file.path;
  const meta = await extractMusicMetadata(filePath);
  const resolvedTitle = title || meta?.title || file.originalname;
  const resolvedArtist = artist || meta?.artist || 'Unknown';
  await pool.query(
    'INSERT INTO songs (title, artist, album, duration, source, source_id, thumbnail_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      resolvedTitle,
      resolvedArtist,
      meta?.album || 'Unknown',
      meta?.duration || 'N/A',
      'local',
      file.filename,
      meta?.thumbnail_url || null
    ]
  );
  return { title: resolvedTitle, artist: resolvedArtist, filename: file.originalname };
};

app.post('/api/upload/music', upload.single('music'), async (req, res) => {
  try {
    const { title, artist } = req.body;
    await createSongFromUpload(req.file, { title, artist });
    res.json({ success: true });
  } catch (err) { 
    console.error('Music upload error:', err.message);
    res.status(500).json({ error: err.message }); 
  }
});

app.post('/api/upload/music/bulk', upload.array('music_files', 100), async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'No music files provided' });
    }
    const { artist } = req.body;
    const results = [];
    for (const file of files) {
      try {
        const created = await createSongFromUpload(file, { artist });
        results.push({ status: 'success', file: file.originalname, title: created.title });
      } catch (err) {
        results.push({ status: 'failed', file: file.originalname, error: err.message });
      }
    }
    const successCount = results.filter((r) => r.status === 'success').length;
    const failedCount = results.length - successCount;
    res.status(failedCount > 0 ? 207 : 200).json({
      success: failedCount === 0,
      successCount,
      failedCount,
      results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/music/search', async (req, res) => {
  let query = req.query.q || 'popular music hits';
  console.log(`Music search request: "${query}"`);
  
  const { spawn } = require('child_process');
  const sanitizedQuery = query.replace(/"/g, '');
  const args = [
    `ytsearch10:${sanitizedQuery}`,
    '--dump-json',
    '--flat-playlist',
    '--no-warnings',
    '--quiet'
  ];

  const runSearch = (retryWithEdge = false) => {
    const currentArgs = [...args];
    const browser = retryWithEdge ? 'chrome' : process.env.COOKIES_FROM_BROWSER;      
    if (browser) {
      currentArgs.push('--cookies-from-browser', browser);
    } else if (process.env.YT_COOKIES) {
      currentArgs.push('--cookies', process.env.YT_COOKIES);
    }

    const proc = spawn('yt-dlp', currentArgs);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());

    proc.on('close', code => {
      if (code !== 0) {
        if (!retryWithEdge && stderr.includes('Could not copy') && stderr.includes('cookie')) {
          console.warn('Primary browser cookies locked, falling back to msedge...');
          return runSearch(true);
        }
        console.error('Search Stderr:', stderr);
        return res.status(500).json({ error: 'Search Error', details: stderr });
      }
      
      try {
        const lines = stdout.trim().split('\n').filter(Boolean);
        const songs = lines.map(l => {
          const entry = JSON.parse(l);
          return {
            id: entry.id,
            title: entry.title,
            artist: entry.uploader || 'YouTube',
            duration: entry.duration ? `${Math.floor(entry.duration / 60)}:${(entry.duration % 60).toString().padStart(2, '0')}` : 'N/A',
            thumbnail_url: `https://i.ytimg.com/vi/${entry.id}/mqdefault.jpg`,
            source: 'youtube'
          };
        });
        res.json(songs);
      } catch (err) {
        console.error('Parse Error:', err.message);
        res.status(500).json({ error: 'Search Parse Error', details: err.message });
      }
    });
  };

  runSearch();
});

app.delete('/api/songs/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM songs WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Song not found' });
    
    const song = rows[0];
    if (song.source === 'local') {
      const filePath = path.join(musicUploadDir, song.source_id);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    
    await pool.query('DELETE FROM songs WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/songs/:id/progress', async (req, res) => {
  const { id } = req.params;
  const { position } = req.body;
  try {
    await pool.query(
      'UPDATE songs SET last_position = ?, last_played_at = CURRENT_TIMESTAMP WHERE id = ?',
      [position, id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/songs/:id/play', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query(
      'UPDATE songs SET play_count = play_count + 1, last_played_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Song not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/songs/:id/metadata', async (req, res) => {
  const { id } = req.params;
  const { title, artist, album, duration } = req.body;
  try {
    const updates = [];
    const values = [];
    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (artist !== undefined) { updates.push('artist = ?'); values.push(artist); }
    if (album !== undefined) { updates.push('album = ?'); values.push(album); }
    if (duration !== undefined) { updates.push('duration = ?'); values.push(duration); }
    if (updates.length === 0) return res.status(400).json({ error: 'No metadata fields provided' });
    values.push(id);
    const [result] = await pool.query(`UPDATE songs SET ${updates.join(', ')} WHERE id = ?`, values);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Song not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/songs/smart/recently-added', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM songs ORDER BY created_at DESC LIMIT 20');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/songs/smart/recently-played', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM songs WHERE last_played_at IS NOT NULL ORDER BY last_played_at DESC LIMIT 20');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/songs/smart/favorites', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.* FROM songs s
      JOIN favorites f ON f.content_id = s.id
      WHERE f.content_type = 'song'
      ORDER BY f.created_at DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ROUTES: BOOKS ---

app.get('/api/books', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM books ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/books/by-id/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM books WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Book not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/books/add', async (req, res) => {
  let { title, author, thumbnail_url, source, source_url, type } = req.body;
  try {
    const isDirectLink = source_url && (
      source_url.toLowerCase().endsWith('.epub') || 
      source_url.toLowerCase().endsWith('.pdf') ||
      source_url.includes('gutendex.com') ||
      source_url.includes('gutenberg.org')
    );

    if (type === 'book' && source === 'external' && isDirectLink && source_url.startsWith('http')) {
      const extension = source_url.toLowerCase().endsWith('.pdf') ? '.pdf' : '.epub';
      const filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + extension;
      const dest = path.join(booksUploadDir, filename);
      try {
        await downloadFile(source_url, dest);
        if (extension === '.epub') {
          const thumbUrl = await extractEpubCover(dest, filename);
          if (thumbUrl) thumbnail_url = thumbUrl;
        }
        source = 'local';
        source_url = filename;
      } catch (downloadErr) {
        console.error('Download failed', downloadErr.message);
      }
    }

    await pool.query(
      'INSERT INTO books (title, author, thumbnail_url, source, source_url, type) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title)',
      [title, author, thumbnail_url, source, source_url, type || 'book']
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const createBookFromUpload = async (file, payload = {}) => {
  const { title, author, type, series_id, volume_number, genres } = payload;
  const filename = file.filename;
  const filePath = file.path;
  let thumbnail_url = null;

  if (filename.toLowerCase().endsWith('.epub')) {
    thumbnail_url = await extractEpubCover(filePath, filename);
  } else if (filename.toLowerCase().endsWith('.cbz')) {
    thumbnail_url = await extractCbzCover(filePath, filename);
  }

  const [insertResult] = await pool.query(
    'INSERT INTO books (title, author, type, source, source_url, thumbnail_url, series_id, volume_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      title || file.originalname,
      author || 'Unknown',
      type || 'book',
      'local',
      filename,
      thumbnail_url,
      series_id ? parseInt(series_id) : null,
      volume_number ? parseFloat(volume_number) : null
    ]
  );

  const bookId = insertResult.insertId;
  const parsedGenres = String(genres || '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);

  for (const genreName of parsedGenres) {
    let [tagRows] = await pool.query('SELECT id FROM tags WHERE name = ? LIMIT 1', [genreName]);
    let tagId = tagRows[0]?.id;
    if (!tagId) {
      const [tagResult] = await pool.query('INSERT INTO tags (name, color) VALUES (?, ?)', [genreName, '#00f2ff']);
      tagId = tagResult.insertId;
    }
    await pool.query(
      'INSERT INTO content_tags (tag_id, content_type, content_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE tag_id=tag_id',
      [tagId, 'book', bookId]
    );
  }

  return { id: bookId, title: title || file.originalname, filename: file.originalname };
};

app.post('/api/upload/book', upload.single('book'), async (req, res) => {
  try {
    await createBookFromUpload(req.file, req.body);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/upload/book/bulk', upload.array('book_files', 100), async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'No book files provided' });
    }
    const { author, type, series_id, volume_number, genres } = req.body;
    const results = [];
    for (const file of files) {
      try {
        const created = await createBookFromUpload(file, {
          author,
          type,
          series_id,
          volume_number,
          genres
        });
        results.push({ status: 'success', file: file.originalname, id: created.id, title: created.title });
      } catch (err) {
        results.push({ status: 'failed', file: file.originalname, error: err.message });
      }
    }
    const successCount = results.filter((r) => r.status === 'success').length;
    const failedCount = results.length - successCount;
    res.status(failedCount > 0 ? 207 : 200).json({
      success: failedCount === 0,
      successCount,
      failedCount,
      results
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/books/search', async (req, res) => {
  const { q, type, provider = 'all' } = req.query;
  try {
    if (type === 'manga') {
      const providers = [];
      if (provider === 'all' || provider === 'mangadex') providers.push(searchMangaDex(q || 'popular'));
      if (provider === 'all' || provider === 'myanimelist') providers.push(searchJikan(q || 'popular', 'manga'));
      const results = await Promise.all(providers);
      return res.json(results.flat());
    }
    const providers = [];
    if (provider === 'all' || provider === 'gutenberg') providers.push(searchFreeNovels(q));
    if (provider === 'all' || provider === 'openlibrary') providers.push(searchOpenLibrary(q));
    const results = await Promise.all(providers);
    const flattened = results.flat();
    res.json(flattened);
  } catch (err) { res.status(500).json({ error: 'Search failed' }); }
});

app.delete('/api/books/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM books WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Book not found' });
    
    const book = rows[0];
    if (book.source === 'local') {
      if (book.type === 'manga') {
        const dirPath = path.join(mangaUploadDir, book.source_url);
        if (fs.existsSync(dirPath)) fs.rmSync(dirPath, { recursive: true, force: true });
      } else {
        const filePath = path.join(booksUploadDir, book.source_url);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }
    
    if (book.thumbnail_url && book.thumbnail_url.startsWith('/uploads/thumbnails/')) {
      const thumbPath = path.join(UPLOADS_DIR, 'thumbnails', path.basename(book.thumbnail_url));
      if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    }
    
    await pool.query('DELETE FROM books WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/books/:id/progress', async (req, res) => {
  const { id } = req.params;
  const { progress, last_page, total_pages, last_cfi, last_chapter_title } = req.body;
  
  try {
    const updates = [];
    const values = [];
    if (progress !== undefined) {
      const normalizedProgress = Math.max(0, Math.min(100, Number(progress) || 0));
      updates.push('progress = ?');
      values.push(normalizedProgress);
    }
    if (last_page !== undefined) { updates.push('last_page = ?'); values.push(last_page); }
    if (total_pages !== undefined) { updates.push('total_pages = ?'); values.push(total_pages); }
    if (last_cfi !== undefined) { updates.push('last_cfi = ?'); values.push(last_cfi); }
    if (last_chapter_title !== undefined) { updates.push('last_chapter_title = ?'); values.push(last_chapter_title); }
    
    updates.push('last_read_at = CURRENT_TIMESTAMP');
    
    if (updates.length > 0) {
      values.push(id);
      await pool.query(`UPDATE books SET ${updates.join(', ')} WHERE id = ?`, values);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Progress update error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/books/:id/metadata', async (req, res) => {
  const { id } = req.params;
  const { title, author, volume_number, genres } = req.body;
  try {
    const updates = [];
    const values = [];
    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (author !== undefined) { updates.push('author = ?'); values.push(author); }
    if (volume_number !== undefined) { updates.push('volume_number = ?'); values.push(volume_number || null); }
    if (updates.length > 0) {
      values.push(id);
      await pool.query(`UPDATE books SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    if (genres !== undefined) {
      await pool.query(
        "DELETE ct FROM content_tags ct JOIN tags t ON t.id = ct.tag_id WHERE ct.content_type = 'book' AND ct.content_id = ? AND t.color = '#00f2ff'",
        [id]
      );
      const parsedGenres = String(genres || '')
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean);
      for (const genreName of parsedGenres) {
        let [tagRows] = await pool.query('SELECT id FROM tags WHERE name = ? LIMIT 1', [genreName]);
        let tagId = tagRows[0]?.id;
        if (!tagId) {
          const [tagResult] = await pool.query('INSERT INTO tags (name, color) VALUES (?, ?)', [genreName, '#00f2ff']);
          tagId = tagResult.insertId;
        }
        await pool.query(
          'INSERT INTO content_tags (tag_id, content_type, content_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE tag_id=tag_id',
          [tagId, 'book', id]
        );
      }
    }

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/books/:id/highlights', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT id, book_id, format, locator, text_excerpt, color, note, created_at FROM book_highlights WHERE book_id = ? ORDER BY created_at DESC',
      [id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/books/:id/highlights', async (req, res) => {
  const { id } = req.params;
  const { format, locator, text_excerpt, color, note } = req.body;

  if (!['epub', 'pdf'].includes(format)) {
    return res.status(400).json({ error: 'Invalid format' });
  }
  if (!locator || !String(locator).trim()) {
    return res.status(400).json({ error: 'Locator is required' });
  }
  if (!text_excerpt || !String(text_excerpt).trim()) {
    return res.status(400).json({ error: 'Text excerpt is required' });
  }

  try {
    const normalizedText = String(text_excerpt).trim();
    const normalizedLocator = String(locator).trim();
    const normalizedColor = typeof color === 'string' && color.trim() ? color.trim() : '#fde047';
    const normalizedNote = note ? String(note).trim() : null;

    const [duplicate] = await pool.query(
      `SELECT id FROM book_highlights
       WHERE book_id = ?
         AND format = ?
         AND (
           locator = ?
           OR LOWER(text_excerpt) = LOWER(?)
         )
       LIMIT 1`,
      [id, format, normalizedLocator, normalizedText]
    );
    if (duplicate.length > 0) {
      return res.status(409).json({ error: 'Highlight already exists' });
    }

    const [result] = await pool.query(
      'INSERT INTO book_highlights (book_id, format, locator, text_excerpt, color, note) VALUES (?, ?, ?, ?, ?, ?)',
      [id, format, normalizedLocator, normalizedText, normalizedColor, normalizedNote]
    );
    const [createdRows] = await pool.query(
      'SELECT id, book_id, format, locator, text_excerpt, color, note, created_at FROM book_highlights WHERE id = ? LIMIT 1',
      [result.insertId]
    );
    res.status(201).json(createdRows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Highlight already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/books/:id/highlights/:highlightId', async (req, res) => {
  const { id, highlightId } = req.params;
  try {
    const [result] = await pool.query(
      'DELETE FROM book_highlights WHERE id = ? AND book_id = ?',
      [highlightId, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Highlight not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ROUTES: MANGA ---

app.get('/api/manga/:id/chapters', async (req, res) => {
  let mangaId = req.params.id;
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mangaId);
    if (!isUuid) {
      const results = await searchMangaDex(mangaId);
      if (results.length > 0) mangaId = results[0].source_url;
      else return res.status(404).json({ error: 'Manga not found' });
    }
    const response = await axios.get(`https://api.mangadex.org/manga/${mangaId}/feed?translatedLanguage[]=en&limit=100&order[chapter]=asc&includes[]=scanlation_group`);
    res.json(response.data.data.map(c => {
      const scanlationGroup = c.relationships.find(r => r.type === 'scanlation_group');
      const scanlator = scanlationGroup ? scanlationGroup.attributes?.name : null;
      return { 
        id: c.id, 
        chapter: c.attributes.chapter, 
        title: c.attributes.title || `Chapter ${c.attributes.chapter}`,
        scanlator: scanlator || 'Unknown Scan'
      };
    }));
  } catch (err) { res.status(500).json({ error: 'MangaDex Error' }); }
});

app.get('/api/manga/chapter/:chapterId/pages', async (req, res) => {
  try {
    const resHash = await axiosInstance.get(`https://api.mangadex.org/at-home/server/${req.params.chapterId}`);
    const { baseUrl, chapter } = resHash.data;
    res.json(chapter.data.map(file => `${baseUrl}/data/${chapter.hash}/${file}`));
  } catch (err) { res.status(500).json({ error: 'MangaDex Page Error', details: err.message }); }
});

app.post('/api/manga/chapter/:chapterId/download', async (req, res) => {
  const { chapterId } = req.params;
  const { mangaId, mangaTitle, chapterTitle, chapterNum, thumbnailUrl } = req.body;
  try {
    const safeChapterNum = chapterNum ? String(chapterNum).replace(/[^0-9.]/g, '') : '0';
    const mangaDir = path.join(mangaUploadDir, mangaId);
    
    // Check if chapter already exists locally
    if (fs.existsSync(mangaDir)) {
      const existingFiles = fs.readdirSync(mangaDir).filter(f => f.endsWith('.cbz'));
      const exists = existingFiles.some(f => {
        const numMatches = f.match(/chapter_([\d.]+)/);
        const existingNum = numMatches ? parseFloat(numMatches[1]).toString() : null;
        return existingNum === parseFloat(safeChapterNum).toString();
      });
      if (exists) {
        return res.status(400).json({ error: 'Chapter is already downloaded' });
      }
    }

    const resHash = await axiosInstance.get(`https://api.mangadex.org/at-home/server/${chapterId}`);
    const { baseUrl, chapter } = resHash.data;
    const pageUrls = chapter.data.map(file => `${baseUrl}/data/${chapter.hash}/${file}`);
    
    const zip = new AdmZip();
    
    for (let i = 0; i < pageUrls.length; i++) {
      const pageRes = await axiosInstance.get(pageUrls[i], { responseType: 'arraybuffer' });
      const ext = path.extname(pageUrls[i]) || '.jpg';
      const fileName = `page_${String(i).padStart(3, '0')}${ext}`;
      zip.addFile(fileName, Buffer.from(pageRes.data));
    }
    
    if (!fs.existsSync(mangaDir)) fs.mkdirSync(mangaDir, { recursive: true });

    const filename = `chapter_${safeChapterNum.padStart(4, '0')}_${Date.now()}.cbz`;
    const dest = path.join(mangaDir, filename);
    zip.writeZip(dest);
    
    // Check if manga already exists in collection (either local or external)
    const [existing] = await pool.query('SELECT * FROM books WHERE source_url = ?', [mangaId]);

    let localThumb = null;
    if (thumbnailUrl) {
      const ext = path.extname(thumbnailUrl.split('?')[0]) || '.jpg';
      const thumbFilename = `thumb-manga-${mangaId}${ext}`;
      const thumbDest = path.join(thumbUploadDir, thumbFilename);
      try {
        if (!fs.existsSync(thumbDest)) {
          await downloadFile(thumbnailUrl, thumbDest);
        }
        localThumb = `/uploads/thumbnails/${thumbFilename}`;
      } catch (e) { console.error('Thumb dl failed', e.message); }
    }

    if (existing.length === 0) {
      await pool.query(
        'INSERT INTO books (title, author, type, source, source_url, thumbnail_url) VALUES (?, ?, ?, ?, ?, ?)',
        [mangaTitle, 'MangaDex Archive', 'manga', 'local', mangaId, localThumb]
      );
    } else {
      // Update existing entry to local if it was external, and refresh thumb/type
      await pool.query(
        'UPDATE books SET source = "local", type = "manga", thumbnail_url = COALESCE(?, thumbnail_url) WHERE source_url = ?',
        [localThumb, mangaId]
      );
    }
    
    res.json({ success: true, message: 'Chapter integrated into your archive.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Download failed', details: err.message });
  }
});

app.get('/api/manga/local/:mangaId/chapters', (req, res) => {
  const { mangaId } = req.params;
  const mangaDir = path.join(mangaUploadDir, mangaId);
  if (!fs.existsSync(mangaDir)) return res.json([]);

  const files = fs.readdirSync(mangaDir).filter(f => f.endsWith('.cbz'));
  const chapters = files.map(f => {
    const numMatches = f.match(/chapter_([\d.]+)/);
    const chapterNum = numMatches ? parseFloat(numMatches[1]).toString() : 'Unknown';
    return {
      id: f,
      chapter: chapterNum,
      title: `Chapter ${chapterNum} (Local Archive)`,
      isLocal: true,
      mangaId: mangaId
    };
  });
  chapters.sort((a, b) => {
    const numA = parseFloat(a.chapter);
    const numB = parseFloat(b.chapter);
    if (isNaN(numA) || isNaN(numB)) return a.id.localeCompare(b.id);
    return numA - numB;
  });
  res.json(chapters);
});

app.get('/api/manga/local/:mangaId/chapter/:chapterFile/pages', (req, res) => {
  const { mangaId, chapterFile } = req.params;
  const chapterPath = path.join(mangaUploadDir, mangaId, chapterFile);
  if (!fs.existsSync(chapterPath) || !chapterPath.toLowerCase().endsWith('.cbz')) {
    return res.status(404).json({ error: 'Chapter file not found' });
  }
  try {
    const pages = extractCbzPagesAsDataUrls(chapterPath);
    res.json(pages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to decode chapter pages', details: err.message });
  }
});

// --- ROUTES: SERIES ---

app.get('/api/series', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.*, 
      (SELECT thumbnail_url FROM books b WHERE b.series_id = s.id ORDER BY b.created_at DESC LIMIT 1) as latest_book_thumbnail
      FROM series s 
      ORDER BY s.title ASC
    `);
    const results = rows.map(s => ({
      ...s,
      thumbnail_url: s.thumbnail_url || s.latest_book_thumbnail
    }));
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/series', async (req, res) => {
  const { title, author, description, thumbnail_url } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO series (title, author, description, thumbnail_url) VALUES (?, ?, ?, ?)',
      [title, author || '', description || '', thumbnail_url || null]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/series/:id', async (req, res) => {
  const { id } = req.params;
  const { title, author, description, thumbnail_url } = req.body;
  try {
    await pool.query(
      'UPDATE series SET title = ?, author = ?, description = ?, thumbnail_url = ? WHERE id = ?',
      [title, author, description, thumbnail_url, id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/series/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE books SET series_id = NULL, volume_number = NULL WHERE series_id = ?', [id]);
    await pool.query('DELETE FROM series WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/books/:id/series', async (req, res) => {
  const { id } = req.params;
  const { series_id, volume_number } = req.body;
  try {
    await pool.query(
      'UPDATE books SET series_id = ?, volume_number = ? WHERE id = ?',
      [series_id, volume_number, id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ROUTES: PLAYLISTS ---

app.get('/api/playlists', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM playlists ORDER BY created_at DESC');
    for (const p of rows) {
      const [songs] = await pool.query(`
        SELECT s.thumbnail_url FROM songs s
        JOIN playlist_songs ps ON s.id = ps.song_id
        WHERE ps.playlist_id = ? AND s.thumbnail_url IS NOT NULL
        ORDER BY ps.song_id ASC
        LIMIT 4
      `, [p.id]);
      p.thumbnails = songs.map(s => s.thumbnail_url).filter(Boolean);
    }
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/playlists', async (req, res) => {
  const { name, description, thumbnail_url } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO playlists (name, description, thumbnail_url) VALUES (?, ?, ?)',
      [name, description || '', thumbnail_url || null]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/playlists/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM playlist_songs WHERE playlist_id = ?', [id]);
    await pool.query('DELETE FROM playlists WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/playlists/:id/songs', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(`
      SELECT s.* FROM songs s
      JOIN playlist_songs ps ON s.id = ps.song_id
      WHERE ps.playlist_id = ?
      ORDER BY s.created_at DESC
    `, [id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/playlists/:id/songs', async (req, res) => {
  const { id } = req.params;
  const { song_id } = req.body;
  try {
    await pool.query(
      'INSERT INTO playlist_songs (playlist_id, song_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE playlist_id=playlist_id',
      [id, song_id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/playlists/:id/songs/:songId', async (req, res) => {
  const { id, songId } = req.params;
  try {
    await pool.query('DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?', [id, songId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ROUTES: STREAMING ---
const { spawn } = require('child_process');
const ytStreamUrlCache = new Map();
const YT_STREAM_TTL_MS = 10 * 60 * 1000;

const resolveYouTubeStreamUrl = (videoId, retryWithEdge = false) => new Promise((resolve, reject) => {
  const now = Date.now();
  const cached = ytStreamUrlCache.get(videoId);
  if (cached && cached.expiresAt > now) {
    return resolve({ url: cached.url, cached: true });
  }

  const args = [
    `https://www.youtube.com/watch?v=${videoId}`,
    '--get-url',
    '--format', 'bestaudio/best',
    '--no-warnings',
    '--quiet',
  ];

  const browser = retryWithEdge ? 'chrome' : process.env.COOKIES_FROM_BROWSER;
  if (browser) {
    args.push('--cookies-from-browser', browser);
  } else if (process.env.YT_COOKIES) {
    args.push('--cookies', process.env.YT_COOKIES);
  }

  const proc = spawn('yt-dlp', args);
  let stdout = '';
  let stderr = '';

  proc.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  proc.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  proc.on('error', (error) => reject(error));
  proc.on('close', (code) => {
    if (code !== 0) {
      const cookieLocked = stderr.includes('Could not copy') && stderr.includes('cookie');
      if (!retryWithEdge && cookieLocked) {
        return resolve(resolveYouTubeStreamUrl(videoId, true));
      }
      return reject(new Error(stderr || `yt-dlp exited with code ${code}`));
    }
    const url = stdout.split('\n').map((line) => line.trim()).find(Boolean);
    if (!url) {
      return reject(new Error('No stream URL returned by yt-dlp'));
    }
    ytStreamUrlCache.set(videoId, { url, expiresAt: now + YT_STREAM_TTL_MS });
    resolve({ url, cached: false });
  });
});

app.get('/api/stream/resolve/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await resolveYouTubeStreamUrl(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve stream URL', details: err.message });
  }
});

app.get('/api/resolve-stream/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await resolveYouTubeStreamUrl(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve stream URL', details: err.message });
  }
});

app.get('/api/stream/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await resolveYouTubeStreamUrl(id);
    const upstream = await axios.get(result.url, {
      responseType: 'stream',
      headers: req.headers.range ? { Range: req.headers.range } : {},
      timeout: 30000,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    if (upstream.headers['content-type']) {
      res.setHeader('Content-Type', upstream.headers['content-type']);
    } else {
      res.setHeader('Content-Type', 'audio/webm');
    }
    res.setHeader('Cache-Control', 'private, max-age=120');
    if (upstream.headers['accept-ranges']) res.setHeader('Accept-Ranges', upstream.headers['accept-ranges']);
    if (upstream.headers['content-length']) res.setHeader('Content-Length', upstream.headers['content-length']);
    if (upstream.headers['content-range']) res.setHeader('Content-Range', upstream.headers['content-range']);
    res.status(upstream.status);

    upstream.data.pipe(res);
    req.on('close', () => {
      if (upstream?.data?.destroy) upstream.data.destroy();
    });
  } catch (err) {
    console.error('Stream resolve error:', err.message);
    res.status(500).json({ error: 'Failed to resolve stream URL' });
  }
});

// ============================================
// BATCH 1 FEATURES - NEW API ENDPOINTS
// ============================================

// --- ROUTES: TAGS SYSTEM ---

app.get('/api/tags', async (req, res) => {

  try {
    const [rows] = await pool.query('SELECT * FROM tags ORDER BY name ASC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/tags', async (req, res) => {
  const { name, color } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Tag name is required' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO tags (name, color) VALUES (?, ?)',
      [name.trim(), color || '#00f2ff']
    );
    res.status(201).json({ id: result.insertId, name: name.trim(), color: color || '#00f2ff' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Tag already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tags/:id', async (req, res) => {
  const { id } = req.params;
  const { name, color } = req.body;
  try {
    await pool.query('UPDATE tags SET name = ?, color = ? WHERE id = ?', [name, color, id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/tags/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM tags WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Content Tags
app.get('/api/tags/content/:contentType/:contentId', async (req, res) => {
  const { contentType, contentId } = req.params;
  try {
    const [rows] = await pool.query(`
      SELECT t.* FROM tags t
      JOIN content_tags ct ON t.id = ct.tag_id
      WHERE ct.content_type = ? AND ct.content_id = ?
    `, [contentType, contentId]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/tags/content', async (req, res) => {
  const { tag_id, content_type, content_id } = req.body;
  try {
    await pool.query(
      'INSERT INTO content_tags (tag_id, content_type, content_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE tag_id=tag_id',
      [tag_id, content_type, content_id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/tags/content/:contentType/:contentId/:tagId', async (req, res) => {
  const { contentType, contentId, tagId } = req.params;
  try {
    await pool.query(
      'DELETE FROM content_tags WHERE tag_id = ? AND content_type = ? AND content_id = ?',
      [tagId, contentType, contentId]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Filter content by tags
app.get('/api/tags/:tagId/content', async (req, res) => {
  const { tagId } = req.params;
  const { type } = req.query; // optional filter by content type
  try {
    let query = `
      SELECT ct.content_type, ct.content_id, ct.created_at,
        CASE 
          WHEN ct.content_type = 'song' THEN (SELECT title FROM songs WHERE id = ct.content_id)
          WHEN ct.content_type = 'book' THEN (SELECT title FROM books WHERE id = ct.content_id)
          WHEN ct.content_type = 'video' THEN (SELECT title FROM videos WHERE id = ct.content_id)
        END as title,
        CASE 
          WHEN ct.content_type = 'song' THEN (SELECT thumbnail_url FROM songs WHERE id = ct.content_id)
          WHEN ct.content_type = 'book' THEN (SELECT thumbnail_url FROM books WHERE id = ct.content_id)
          WHEN ct.content_type = 'video' THEN (SELECT thumbnail_url FROM videos WHERE id = ct.content_id)
        END as thumbnail_url
      FROM content_tags ct
      WHERE ct.tag_id = ?
    `;
    const params = [tagId];
    if (type) {
      query += ' AND ct.content_type = ?';
      params.push(type);
    }
    query += ' ORDER BY ct.created_at DESC';
    
    const [rows] = await pool.query(query, params);
    res.json(rows.filter(r => r.title !== null)); // Filter out deleted content
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ROUTES: ACTIVITY LOG / WATCH HISTORY ---

app.get('/api/activity', async (req, res) => {
  const { limit = 50, offset = 0, type, content_type } = req.query;
  try {
    let query = 'SELECT * FROM activity_log WHERE 1=1';
    const params = [];
    
    if (type) {
      query += ' AND action_type = ?';
      params.push(type);
    }
    if (content_type) {
      query += ' AND content_type = ?';
      params.push(content_type);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [rows] = await pool.query(query, params);
    const [countResult] = await pool.query('SELECT COUNT(*) as total FROM activity_log');
    
    res.json({ 
      activities: rows, 
      total: countResult[0].total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/activity', async (req, res) => {
  const { action_type, content_type, content_id, content_title, content_thumbnail, metadata } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO activity_log (action_type, content_type, content_id, content_title, content_thumbnail, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      [action_type, content_type, content_id, content_title, content_thumbnail, metadata ? JSON.stringify(metadata) : null]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/activity/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM activity_log WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/activity', async (req, res) => {
  // Clear all activity (with optional filters)
  const { content_type, before_date } = req.query;
  try {
    let query = 'DELETE FROM activity_log WHERE 1=1';
    const params = [];
    if (content_type) {
      query += ' AND content_type = ?';
      params.push(content_type);
    }
    if (before_date) {
      query += ' AND created_at < ?';
      params.push(before_date);
    }
    await pool.query(query, params);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Activity Statistics
app.get('/api/activity/stats', async (req, res) => {
  const { days = 30 } = req.query;
  try {
    // Get activity by day
    const [dailyActivity] = await pool.query(`
      SELECT DATE(created_at) as date, content_type, COUNT(*) as count
      FROM activity_log
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(created_at), content_type
      ORDER BY date DESC
    `, [parseInt(days)]);

    // Get most played/read content
    const [topSongs] = await pool.query(`
      SELECT content_id, content_title, content_thumbnail, COUNT(*) as play_count
      FROM activity_log
      WHERE content_type = 'song' AND action_type = 'play'
      GROUP BY content_id, content_title, content_thumbnail
      ORDER BY play_count DESC
      LIMIT 10
    `);

    const [topBooks] = await pool.query(`
      SELECT content_id, content_title, content_thumbnail, COUNT(*) as read_count
      FROM activity_log
      WHERE content_type = 'book' AND action_type = 'read'
      GROUP BY content_id, content_title, content_thumbnail
      ORDER BY read_count DESC
      LIMIT 10
    `);

    res.json({ dailyActivity, topSongs, topBooks });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ROUTES: VIDEOS / MOVIES / ANIME ---

app.get('/api/videos', async (req, res) => {
  const { type, sort = 'created_at', order = 'DESC' } = req.query;
  try {
    let query = 'SELECT * FROM videos';
    const params = [];
    if (type) {
      query += ' WHERE type = ?';
      params.push(type);
    }
    const validSorts = ['created_at', 'title', 'rating', 'release_year', 'last_watched_at'];
    const sortField = validSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortField} ${sortOrder}`;
    
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/videos', async (req, res) => {
  const { 
    title, original_title, type, source, source_id, source_provider,
    thumbnail_url, backdrop_url, description, release_year, duration,
    rating, genres, total_episodes 
  } = req.body;
  try {
    const [result] = await pool.query(
      `INSERT INTO videos (title, original_title, type, source, source_id, source_provider,
        thumbnail_url, backdrop_url, description, release_year, duration, rating, genres, total_episodes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title=VALUES(title), thumbnail_url=VALUES(thumbnail_url)`,
      [title, original_title, type || 'movie', source || 'external', source_id, source_provider,
       thumbnail_url, backdrop_url, description, release_year, duration, rating, genres, total_episodes || 1]
    );
    res.status(201).json({ id: result.insertId || result.affectedRows, success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/videos/:id/progress', async (req, res) => {
  const { progress, last_position } = req.body;
  try {
    await pool.query(
      'UPDATE videos SET progress = ?, last_position = ?, last_watched_at = NOW() WHERE id = ?',
      [progress, last_position, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/videos/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM videos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Video Episodes
app.post('/api/videos/:id/episodes', async (req, res) => {
  const { episodes } = req.body; // Array of episode objects
  try {
    for (const ep of episodes) {
      await pool.query(
        `INSERT INTO video_episodes (video_id, episode_number, season_number, title, source_id, source_url, thumbnail_url, duration)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE title=VALUES(title), source_url=VALUES(source_url)`,
        [req.params.id, ep.episode_number, ep.season_number || 1, ep.title, ep.source_id, ep.source_url, ep.thumbnail_url, ep.duration]
      );
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/videos/:videoId/episodes/:episodeId/progress', async (req, res) => {
  const { progress, last_position, watched } = req.body;
  try {
    await pool.query(
      'UPDATE video_episodes SET progress = ?, last_position = ?, watched = ? WHERE id = ?',
      [progress, last_position, watched || false, req.params.episodeId]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update watch progress for a video (last episode watched)
app.put('/api/videos/:id/watch-progress', async (req, res) => {
  const { id } = req.params;
  const { last_episode_number, last_episode_id, last_episode_title, last_position } = req.body;
  try {
    const updates = [];
    const values = [];
    if (last_episode_number !== undefined) {
      updates.push('progress = ?');
      values.push(last_episode_number);
    }
    if (last_position !== undefined) {
      updates.push('last_position = ?');
      values.push(last_position);
    }
    updates.push('last_watched_at = CURRENT_TIMESTAMP');
    
    if (updates.length > 0) {
      values.push(id);
      await pool.query(`UPDATE videos SET ${updates.join(', ')} WHERE id = ?`, values);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get video progress (per-episode tracking)
app.get('/api/videos/:id/progress', async (req, res) => {
  const { id } = req.params;
  try {
    // Handle case where video might not be in library yet
    if (!id || id === 'undefined' || id === 'null') {
      return res.json({});
    }
    const [rows] = await pool.query(
      'SELECT episode_number, progress, last_position, watched FROM video_episodes WHERE video_id = ?',
      [id]
    );
    const progressMap = {};
    rows.forEach(r => {
      progressMap[r.episode_number] = {
        progress: r.progress || 0,
        position: r.last_position || 0,
        watched: r.watched || false
      };
    });
    res.json(progressMap);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Video Search - Multiple Providers
app.get('/api/videos/search', async (req, res) => {
  const { q, type = 'movie', provider = 'all' } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });
  
  try {
    const results = [];
    
    if (type === 'anime') {
      // Primary anime provider: Gogoanime/Anitaku
      if (provider === 'all' || provider === 'gogoanime') {
        try {
          const gogoResults = await searchAnitaku(q, 'Gogoanime');
          results.push(...gogoResults);
        } catch (e) { console.error('Gogoanime search error:', e.message); }
      }

      // Alternate anime provider mapped to same upstream (Aniwatch-style selection)
      if (provider === 'all' || provider === 'aniwatch') {
        try {
          const aniwatchResults = await searchAnitaku(q, 'Aniwatch');
          results.push(...aniwatchResults);
        } catch (e) { console.error('Aniwatch search error:', e.message); }
      }

      // Optional metadata-only source
      if (provider === 'all' || provider === 'myanimelist') {
        try {
          const jikanRes = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=20`);
          const animeResults = (jikanRes.data.data || []).map(a => ({
            id: `jikan-${a.mal_id}`,
            title: a.title,
            original_title: a.title_japanese,
            type: 'anime',
            source: 'external',
            source_id: a.mal_id.toString(),
            source_provider: 'MyAnimeList',
            thumbnail_url: a.images.jpg.large_image_url || a.images.jpg.image_url,
            description: a.synopsis,
            release_year: a.year || (a.aired?.from ? new Date(a.aired.from).getFullYear() : null),
            rating: a.score,
            genres: a.genres?.map(g => g.name).join(', '),
            total_episodes: a.episodes || 1,
            duration: a.duration
          }));
          results.push(...animeResults);
        } catch (e) { console.error('Jikan anime search error:', e.message); }
      }
    } else {
      // Movies - Archive.org + embed-capable stream hints
      if (provider === 'all' || provider === 'archive') {
        try {
          const archiveRes = await axios.get(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}+mediatype:movies&output=json&rows=20`);
          const archiveResults = (archiveRes.data.response?.docs || []).map(m => ({
            id: `archive-${m.identifier}`,
            title: m.title,
            type: 'movie',
            source: 'external',
            source_id: m.identifier,
            source_provider: 'Archive.org',
            thumbnail_url: `https://archive.org/services/img/${m.identifier}`,
            description: m.description,
            release_year: m.year ? parseInt(m.year) : null
          }));
          results.push(...archiveResults);
        } catch (e) { console.error('Archive.org search error:', e.message); }
      }

      // Add generic movie embed source suggestions (query-based)
      const qEnc = encodeURIComponent(q);
      if (provider === 'all' || provider === 'embed2') {
        results.push({
          id: `embed2-${qEnc}`,
          title: `${q} (Embed Source)`,
          type: 'movie',
          source: 'external',
          source_id: qEnc,
          source_provider: 'Embed.su',
          thumbnail_url: null,
          embed_url: `https://www.2embed.to/embed/imdb/movie?q=${qEnc}`
        });
      }
      if (provider === 'all' || provider === 'vidsrc') {
        const vidsrcResults = await searchVidSrcMovies(q);
        results.push(...vidsrcResults);
      }
    }
    
    const providerMap = {
      gogoanime: 'Gogoanime',
      aniwatch: 'Aniwatch',
      myanimelist: 'MyAnimeList',
      archive: 'Archive.org',
      embed2: 'Embed.su',
      vidsrc: 'VidSrc',
    };
    const strictResults = provider === 'all'
      ? results
      : results.filter((item) => item.source_provider === providerMap[provider]);
    res.json(strictResults);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/videos/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM videos WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Video not found' });
    
    // Get episodes if it's a series/anime
    const [episodes] = await pool.query(
      'SELECT * FROM video_episodes WHERE video_id = ? ORDER BY season_number, episode_number',
      [req.params.id]
    );
    
    res.json({ ...rows[0], episodes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get streaming sources for anime episodes
app.get('/api/videos/anime/:id/episodes', async (req, res) => {
  const { id } = req.params;
  try {
    const episodes = await getGogoEpisodeList(id);
    res.json({ episodes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/videos/anime/watch/:episodeId', async (req, res) => {
  const { episodeId } = req.params;
  try {
    const sources = await getGogoWatchSources(episodeId);
    res.json({ sources });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/videos/movie/watch', async (req, res) => {
  const { source, id, q } = req.query;
  const query = encodeURIComponent(q || '');
  if (source === 'Archive.org' && id) {
    return res.json({ url: `https://archive.org/details/${id}` });
  }
  if (source === 'Embed.su') {
    return res.json({ url: `https://www.2embed.to/embed/imdb/movie?q=${query}` });
  }
  if (source === 'VidSrc') {
    const { imdb, tmdb } = parseVidSrcSourceId(id);
    if (imdb) return res.json({ url: `https://vidsrc-embed.su/embed/movie?imdb=${encodeURIComponent(imdb)}` });
    if (tmdb) return res.json({ url: `https://vidsrc-embed.su/embed/movie?tmdb=${encodeURIComponent(tmdb)}` });
    return res.json({ url: `https://vidsrc-embed.su/embed/movie?imdb=${query}` });
  }
  return res.status(400).json({ error: 'Unsupported movie source' });
});

// Local video upload
const videoUploadDir = path.join(UPLOADS_DIR, 'videos');
if (!fs.existsSync(videoUploadDir)) fs.mkdirSync(videoUploadDir, { recursive: true });

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, videoUploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
});
const videoUpload = multer({ storage: videoStorage });

app.post('/api/upload/video', videoUpload.single('video'), async (req, res) => {
  try {
    const { title, type } = req.body;
    const filename = req.file.filename;
    
    const [result] = await pool.query(
      'INSERT INTO videos (title, type, source, source_id) VALUES (?, ?, ?, ?)',
      [title || req.file.originalname, type || 'movie', 'local', filename]
    );
    
    res.json({ success: true, id: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Stream local video
app.get('/api/videos/stream/:filename', (req, res) => {
  const { filename } = req.params;
  const videoPath = path.join(videoUploadDir, filename);
  
  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: 'Video not found' });
  }
  
  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;
  
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(videoPath).pipe(res);
  }
});

// --- ROUTES: FAVORITES ---

app.get('/api/favorites', async (req, res) => {
  const { type } = req.query;
  try {
    let query = `
      SELECT f.*, 
        CASE 
          WHEN f.content_type = 'song' THEN (SELECT JSON_OBJECT('id', id, 'title', title, 'artist', artist, 'thumbnail_url', thumbnail_url, 'duration', duration) FROM songs WHERE id = f.content_id)
          WHEN f.content_type = 'book' THEN (SELECT JSON_OBJECT('id', id, 'title', title, 'author', author, 'thumbnail_url', thumbnail_url, 'progress', progress, 'type', type) FROM books WHERE id = f.content_id)
          WHEN f.content_type = 'video' THEN (SELECT JSON_OBJECT('id', id, 'title', title, 'thumbnail_url', thumbnail_url, 'type', type, 'progress', progress) FROM videos WHERE id = f.content_id)
        END as content_data
      FROM favorites f
    `;
    const params = [];
    if (type) {
      query += ' WHERE f.content_type = ?';
      params.push(type);
    }
    query += ' ORDER BY f.created_at DESC';
    
    const [rows] = await pool.query(query, params);
    // Parse JSON content_data
    const results = rows.map(r => ({
      ...r,
      content_data: r.content_data ? JSON.parse(r.content_data) : null
    })).filter(r => r.content_data !== null);
    
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/favorites', async (req, res) => {
  const { content_type, content_id } = req.body;
  try {
    await pool.query(
      'INSERT INTO favorites (content_type, content_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE created_at=NOW()',
      [content_type, content_id]
    );
    res.status(201).json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/favorites/:contentType/:contentId', async (req, res) => {
  const { contentType, contentId } = req.params;
  try {
    await pool.query('DELETE FROM favorites WHERE content_type = ? AND content_id = ?', [contentType, contentId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/favorites/check/:contentType/:contentId', async (req, res) => {
  const { contentType, contentId } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT id FROM favorites WHERE content_type = ? AND content_id = ?',
      [contentType, contentId]
    );
    res.json({ isFavorite: rows.length > 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Continue where you left off (song/book/video)
app.get('/api/continue', async (req, res) => {
  try {
    const [songs] = await pool.query(`
      SELECT id, title, artist, thumbnail_url, duration, last_position, last_played_at
      FROM songs
      WHERE last_played_at IS NOT NULL
      ORDER BY last_played_at DESC
      LIMIT 1
    `);

    const [books] = await pool.query(`
      SELECT id, title, author, type, thumbnail_url, progress, last_page, last_chapter_title, last_read_at
      FROM books
      WHERE (type = 'manga' AND last_page IS NOT NULL)
         OR (type <> 'manga' AND progress > 0 AND progress < 100)
      ORDER BY last_read_at DESC
      LIMIT 1
    `);

    const [videos] = await pool.query(`
      SELECT id, title, type, thumbnail_url, progress, last_position, last_watched_at
      FROM videos
      WHERE last_watched_at IS NOT NULL
      ORDER BY last_watched_at DESC
      LIMIT 1
    `);

    res.json({
      song: songs[0] || null,
      book: books[0] || null,
      video: videos[0] || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Duplicate detection helper
app.get('/api/duplicates/check', async (req, res) => {
  const { content_type, source_id, source_url, title } = req.query;
  try {
    if (!content_type) return res.status(400).json({ error: 'content_type is required' });

    let rows = [];
    if (content_type === 'song') {
      const [bySourceId] = source_id
        ? await pool.query('SELECT id, title, artist, source_id FROM songs WHERE source_id = ? LIMIT 5', [source_id])
        : [[]];
      if (bySourceId.length > 0) rows = bySourceId;
      else if (title) {
        const [byTitle] = await pool.query('SELECT id, title, artist, source_id FROM songs WHERE LOWER(title) = LOWER(?) LIMIT 5', [title]);
        rows = byTitle;
      }
    } else if (content_type === 'book') {
      const [bySourceUrl] = source_url
        ? await pool.query('SELECT id, title, author, source_url, type FROM books WHERE source_url = ? LIMIT 5', [source_url])
        : [[]];
      if (bySourceUrl.length > 0) rows = bySourceUrl;
      else if (title) {
        const [byTitle] = await pool.query('SELECT id, title, author, source_url, type FROM books WHERE LOWER(title) = LOWER(?) LIMIT 5', [title]);
        rows = byTitle;
      }
    } else if (content_type === 'video') {
      const [bySourceId] = source_id
        ? await pool.query('SELECT id, title, type, source_id FROM videos WHERE source_id = ? LIMIT 5', [source_id])
        : [[]];
      if (bySourceId.length > 0) rows = bySourceId;
      else if (title) {
        const [byTitle] = await pool.query('SELECT id, title, type, source_id FROM videos WHERE LOWER(title) = LOWER(?) LIMIT 5', [title]);
        rows = byTitle;
      }
    } else {
      return res.status(400).json({ error: 'Unsupported content_type' });
    }

    res.json({ isDuplicate: rows.length > 0, matches: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lyrics lookup
app.get('/api/lyrics', async (req, res) => {
  const { artist, title } = req.query;
  if (!title) return res.status(400).json({ error: 'title is required' });
  try {
    const normalize = (value = '') => String(value)
      .toLowerCase()
      .replace(/\(.*?\)|\[.*?\]|feat\.?.*$/gi, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const overlapScore = (a = '', b = '') => {
      const toTokens = (value = '') => {
        const trimmed = String(value).trim();
        if (!trimmed) return [];
        if (/\s/.test(trimmed)) {
          return trimmed.split(' ').filter(Boolean);
        }
        const chars = Array.from(trimmed);
        if (chars.length <= 2) return chars;
        const grams = [];
        for (let i = 0; i < chars.length - 1; i += 1) {
          grams.push(`${chars[i]}${chars[i + 1]}`);
        }
        return grams;
      };
      const setA = new Set(toTokens(a));
      const setB = new Set(toTokens(b));
      if (!setA.size || !setB.size) return 0;
      let common = 0;
      setA.forEach((token) => {
        if (setB.has(token)) common += 1;
      });
      return common / Math.max(setA.size, setB.size);
    };
    const parseSyncedLyrics = (raw = '') => {
      const out = [];
      const regex = /\[(\d{2}):(\d{2})(?:\.(\d{1,2}))?\](.*)/g;
      let match;
      while ((match = regex.exec(raw)) !== null) {
        const min = Number(match[1]) || 0;
        const sec = Number(match[2]) || 0;
        const frac = match[3] ? Number(`0.${match[3].padEnd(2, '0')}`) : 0;
        const text = (match[4] || '').trim();
        if (!text) continue;
        out.push({
          time: Math.max(0, min * 60 + sec + frac),
          text,
        });
      }
      return out.sort((a, b) => a.time - b.time);
    };
    const parseTitleMeta = (raw = '') => {
      const stripped = String(raw)
        .split('|')[0]
        .replace(/\((official|lyrics?|audio|video|hd)\)/gi, '')
        .replace(/\[(official|lyrics?|audio|video|hd)\]/gi, '')
        .trim();
      const splitIdx = stripped.indexOf(' - ');
      if (splitIdx === -1) return { parsedArtist: '', parsedTitle: stripped };
      const left = stripped.slice(0, splitIdx).trim();
      const right = stripped.slice(splitIdx + 3).trim();
      return { parsedArtist: left, parsedTitle: right || stripped };
    };
    const isGenericArtistLabel = (value = '') => /(music|records|official|topic|ncs|vevo|channel|lyrics)/i.test(String(value));

    const { parsedArtist, parsedTitle } = parseTitleMeta(title);
    const wantedArtists = Array.from(new Set([
      normalize(artist || ''),
      normalize(parsedArtist || ''),
    ].filter(Boolean)));
    const preferredArtist = wantedArtists[0] || '';
    const preferredParsedArtist = normalize(parsedArtist || '');
    const providedArtistGeneric = isGenericArtistLabel(artist || '');
    const wantedTitle = normalize(parsedTitle || title);
    const rawTitle = String(title || '');
    const titleVariants = Array.from(new Set([
      rawTitle,
      parsedTitle,
      rawTitle.split(' - ').pop(),
      rawTitle.split(' | ').shift(),
      rawTitle.replace(/\(.*?\)|\[.*?\]/g, '').trim(),
    ].map((t) => t && t.trim()).filter(Boolean)));

    const reqs = [];
    for (const variant of titleVariants) {
      if (artist) {
        reqs.push(
          axios.get('https://lrclib.net/api/search', { params: { track_name: variant, artist_name: artist }, timeout: 10000 }),
        );
      }
      if (parsedArtist && normalize(parsedArtist) !== normalize(artist || '')) {
        reqs.push(
          axios.get('https://lrclib.net/api/search', { params: { track_name: variant, artist_name: parsedArtist }, timeout: 10000 }),
        );
      }
      reqs.push(
        axios.get('https://lrclib.net/api/search', { params: { track_name: variant }, timeout: 10000 }),
      );
    }
    reqs.push(axios.get('https://lrclib.net/api/search', { params: { q: artist ? `${artist} ${title}` : `${title}` }, timeout: 10000 }));
    const responses = await Promise.allSettled(reqs);
    const candidates = responses
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => (Array.isArray(r.value.data) ? r.value.data : []));
    const unique = [];
    const seen = new Set();
    for (const c of candidates) {
      const key = `${normalize(c.artistName || c.artist || '')}::${normalize(c.trackName || c.name || '')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(c);
    }

    const scored = unique
      .map((c) => {
        const cArtist = normalize(c.artistName || c.artist || '');
        const cTitle = normalize(c.trackName || c.name || '');
        const titleOverlap = overlapScore(cTitle, wantedTitle);
        let score = 0;
        for (const candidateArtist of wantedArtists) {
          if (cArtist === candidateArtist) score += 4;
          else if (candidateArtist && (cArtist.includes(candidateArtist) || candidateArtist.includes(cArtist))) score += 2;
        }
        if (cTitle === wantedTitle) score += 6;
        else if (cTitle.includes(wantedTitle) || wantedTitle.includes(cTitle)) score += 3;
        score += titleOverlap * 3;
        if (titleOverlap < 0.2) score -= 1.8;
        if (preferredParsedArtist && cArtist && overlapScore(cArtist, preferredParsedArtist) < 0.2) score -= 2;
        if (providedArtistGeneric && preferredArtist && cArtist && overlapScore(cArtist, preferredArtist) < 0.2) score -= 1;
        if (c.syncedLyrics) score += 1;
        if (c.duration && c.duration > 30) score += 0.25;
        return { c, score, titleOverlap };
      })
      .sort((a, b) => b.score - a.score);

    if (!scored.length || scored[0].score < 2.8) {
      return res.status(404).json({ error: 'Lyrics not found' });
    }
    const best = scored[0]?.c;
    let rawLyrics = best?.syncedLyrics || best?.plainLyrics || '';
    if (!rawLyrics && artist) {
      // Fallback for cases where LRCLIB has metadata hit but empty lyric fields
      const fallback = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`, { timeout: 10000 });
      rawLyrics = fallback.data?.lyrics || '';
    }
    if (!rawLyrics) return res.status(404).json({ error: 'Lyrics not found' });

    const lines = rawLyrics
      .replace(/\[\d{2}:\d{2}(?:\.\d{1,2})?\]/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const synced = parseSyncedLyrics(rawLyrics);
    res.json({
      artist,
      title,
      lines,
      lyrics: rawLyrics,
      provider: best ? 'lrclib' : 'lyrics.ovh',
      synced: synced.length > 0,
      syncedLines: synced,
      matchedArtist: best?.artistName || best?.artist || null,
      matchedTitle: best?.trackName || best?.name || null,
    });
  } catch (err) {
    res.status(404).json({ error: 'Lyrics not found' });
  }
});

// --- ROUTES: READING SESSIONS & STATISTICS ---

app.post('/api/reading-sessions/start', async (req, res) => {
  const { book_id, start_page } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO reading_sessions (book_id, start_page) VALUES (?, ?)',
      [book_id, start_page || 0]
    );
    res.status(201).json({ session_id: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/reading-sessions/:id/end', async (req, res) => {
  const { id } = req.params;
  const { end_page, pages_read } = req.body;
  try {
    // Calculate duration
    const [session] = await pool.query('SELECT start_time FROM reading_sessions WHERE id = ?', [id]);
    if (session.length === 0) return res.status(404).json({ error: 'Session not found' });
    
    const startTime = new Date(session[0].start_time);
    const endTime = new Date();
    const durationSeconds = Math.floor((endTime - startTime) / 1000);
    
    await pool.query(
      'UPDATE reading_sessions SET end_time = NOW(), end_page = ?, pages_read = ?, duration_seconds = ? WHERE id = ?',
      [end_page, pages_read || 0, durationSeconds, id]
    );
    res.json({ success: true, duration_seconds: durationSeconds });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reading-sessions/book/:bookId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM reading_sessions WHERE book_id = ? ORDER BY start_time DESC',
      [req.params.bookId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Reading Statistics
app.get('/api/stats/reading', async (req, res) => {
  const { days = 30 } = req.query;
  try {
    // Total reading time
    const [totalTime] = await pool.query(`
      SELECT SUM(duration_seconds) as total_seconds, SUM(pages_read) as total_pages
      FROM reading_sessions
      WHERE start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [parseInt(days)]);
    
    // Reading by day
    const [dailyReading] = await pool.query(`
      SELECT DATE(start_time) as date, 
             SUM(duration_seconds) as seconds,
             SUM(pages_read) as pages,
             COUNT(DISTINCT book_id) as books_read
      FROM reading_sessions
      WHERE start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(start_time)
      ORDER BY date DESC
    `, [parseInt(days)]);
    
    // Books completed
    const [booksCompleted] = await pool.query(`
      SELECT COUNT(*) as count FROM books WHERE progress >= 100
    `);
    
    // Current streak
    const [streakData] = await pool.query(`
      SELECT DISTINCT DATE(start_time) as date
      FROM reading_sessions
      WHERE start_time >= DATE_SUB(NOW(), INTERVAL 90 DAY)
      ORDER BY date DESC
    `);
    
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < streakData.length; i++) {
      const sessionDate = new Date(streakData[i].date);
      sessionDate.setHours(0, 0, 0, 0);
      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);
      
      if (sessionDate.getTime() === expectedDate.getTime()) {
        currentStreak++;
      } else if (i === 0 && sessionDate.getTime() === expectedDate.getTime() - 86400000) {
        // Allow for "yesterday" to still count
        currentStreak++;
      } else {
        break;
      }
    }
    
    // Average session length
    const [avgSession] = await pool.query(`
      SELECT AVG(duration_seconds) as avg_seconds, AVG(pages_read) as avg_pages
      FROM reading_sessions
      WHERE duration_seconds > 0
    `);
    
    // Most read books
    const [topBooks] = await pool.query(`
      SELECT b.id, b.title, b.author, b.thumbnail_url, 
             SUM(rs.duration_seconds) as total_time,
             SUM(rs.pages_read) as total_pages
      FROM reading_sessions rs
      JOIN books b ON rs.book_id = b.id
      GROUP BY b.id
      ORDER BY total_time DESC
      LIMIT 10
    `);
    
    res.json({
      totalSeconds: totalTime[0]?.total_seconds || 0,
      totalPages: totalTime[0]?.total_pages || 0,
      dailyReading,
      booksCompleted: booksCompleted[0]?.count || 0,
      currentStreak,
      avgSessionSeconds: Math.round(avgSession[0]?.avg_seconds || 0),
      avgPagesPerSession: Math.round(avgSession[0]?.avg_pages || 0),
      topBooks
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/stats/play-counts', async (req, res) => {
  try {
    const [summary] = await pool.query(`
      SELECT
        COALESCE(SUM(play_count), 0) AS totalPlays,
        COUNT(*) AS totalSongsPlayed
      FROM songs
      WHERE play_count > 0
    `);
    const [topSongs] = await pool.query(`
      SELECT id, title, artist, thumbnail_url, play_count, last_played_at
      FROM songs
      WHERE play_count > 0
      ORDER BY play_count DESC, last_played_at DESC
      LIMIT 20
    `);
    res.json({
      totalPlays: Number(summary[0]?.totalPlays || 0),
      totalSongsPlayed: Number(summary[0]?.totalSongsPlayed || 0),
      topSongs
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/stats/reading-estimates', async (req, res) => {
  try {
    const [avgRows] = await pool.query(`
      SELECT
        COALESCE(SUM(duration_seconds) / NULLIF(SUM(pages_read), 0), 45) AS avg_seconds_per_page
      FROM reading_sessions
      WHERE duration_seconds > 0 AND pages_read > 0
    `);
    const avgSecondsPerPage = Number(avgRows[0]?.avg_seconds_per_page || 45);

    const [rows] = await pool.query(`
      SELECT
        b.id,
        b.title,
        b.author,
        b.thumbnail_url,
        b.progress,
        b.total_pages,
        GREATEST(ROUND((b.total_pages * (100 - COALESCE(b.progress, 0))) / 100), 0) AS remaining_pages
      FROM books b
      WHERE b.type = 'book'
        AND b.total_pages IS NOT NULL
        AND b.total_pages > 0
        AND COALESCE(b.progress, 0) < 100
      ORDER BY b.last_read_at DESC, b.created_at DESC
    `);

    const estimates = rows.map((book) => {
      const remainingPages = Number(book.remaining_pages || 0);
      const remainingSeconds = Math.round(remainingPages * avgSecondsPerPage);
      return {
        ...book,
        remaining_pages: remainingPages,
        remaining_seconds: remainingSeconds,
        remaining_minutes: Math.max(1, Math.round(remainingSeconds / 60))
      };
    });

    res.json({ avgSecondsPerPage: Math.round(avgSecondsPerPage), estimates });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/books/:bookId/reading-estimate', async (req, res) => {
  const { bookId } = req.params;
  try {
    const [[book]] = await pool.query(`
      SELECT id, title, type, progress, total_pages
      FROM books
      WHERE id = ?
      LIMIT 1
    `, [bookId]);

    if (!book) return res.status(404).json({ error: 'Book not found' });
    if (book.type !== 'book' || !book.total_pages || Number(book.total_pages) <= 0) {
      return res.json({ available: false });
    }

    const [avgRows] = await pool.query(`
      SELECT
        COALESCE(SUM(duration_seconds) / NULLIF(SUM(pages_read), 0), 45) AS avg_seconds_per_page
      FROM reading_sessions
      WHERE duration_seconds > 0 AND pages_read > 0
    `);
    const avgSecondsPerPage = Number(avgRows[0]?.avg_seconds_per_page || 45);
    const remainingPages = Math.max(
      0,
      Math.round((Number(book.total_pages) * (100 - Number(book.progress || 0))) / 100)
    );
    const remainingSeconds = Math.round(remainingPages * avgSecondsPerPage);

    res.json({
      available: true,
      avgSecondsPerPage: Math.round(avgSecondsPerPage),
      remaining_pages: remainingPages,
      remaining_seconds: remainingSeconds,
      remaining_minutes: Math.max(1, Math.round(remainingSeconds / 60))
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/books/:bookId/bookmarks', async (req, res) => {
  const { bookId } = req.params;
  const { type } = req.query;
  try {
    let query = `
      SELECT id, book_id, bookmark_type, chapter_id, chapter_title, locator, note, created_at
      FROM chapter_bookmarks
      WHERE book_id = ?
    `;
    const params = [bookId];
    if (type) {
      query += ' AND bookmark_type = ?';
      params.push(type);
    }
    query += ' ORDER BY created_at DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/books/:bookId/bookmarks', async (req, res) => {
  const { bookId } = req.params;
  const { bookmark_type = 'manga', chapter_id = null, chapter_title = null, locator = null, note = null } = req.body || {};
  try {
    if (!chapter_id && !locator) {
      return res.status(400).json({ error: 'chapter_id or locator is required' });
    }
    const [result] = await pool.query(`
      INSERT INTO chapter_bookmarks (book_id, bookmark_type, chapter_id, chapter_title, locator, note)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        chapter_title = VALUES(chapter_title),
        note = VALUES(note),
        created_at = CURRENT_TIMESTAMP
    `, [bookId, bookmark_type, chapter_id, chapter_title, locator, note]);
    res.status(201).json({ success: true, id: result.insertId || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/books/:bookId/bookmarks/:bookmarkId', async (req, res) => {
  const { bookId, bookmarkId } = req.params;
  try {
    await pool.query(
      'DELETE FROM chapter_bookmarks WHERE id = ? AND book_id = ?',
      [bookmarkId, bookId]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ROUTES: ENHANCED HIGHLIGHTS (with notes) ---

// Update the existing highlights endpoint to include notes
app.put('/api/books/:bookId/highlights/:highlightId', async (req, res) => {
  const { bookId, highlightId } = req.params;
  const { color, note } = req.body;
  try {
    const updates = [];
    const params = [];
    
    if (color !== undefined) {
      updates.push('color = ?');
      params.push(color);
    }
    if (note !== undefined) {
      updates.push('note = ?');
      params.push(note);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    params.push(highlightId, bookId);
    await pool.query(
      `UPDATE book_highlights SET ${updates.join(', ')} WHERE id = ? AND book_id = ?`,
      params
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get all highlights with notes (annotations view)
app.get('/api/annotations', async (req, res) => {
  const { book_id } = req.query;
  try {
    let query = `
      SELECT h.*, b.title as book_title, b.author as book_author, b.thumbnail_url as book_thumbnail
      FROM book_highlights h
      JOIN books b ON h.book_id = b.id
    `;
    const params = [];
    if (book_id) {
      query += ' WHERE h.book_id = ?';
      params.push(book_id);
    }
    query += ' ORDER BY h.created_at DESC';
    
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============== DOWNLOAD QUEUE ENDPOINTS ==============

// In-memory download progress tracking (for real-time updates)
const activeDownloads = new Map();

// Get all downloads
app.get('/api/downloads', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT * FROM downloads 
      ORDER BY 
        CASE status 
          WHEN 'downloading' THEN 1 
          WHEN 'pending' THEN 2 
          WHEN 'failed' THEN 3
          WHEN 'completed' THEN 4
          WHEN 'cancelled' THEN 5
        END,
        created_at DESC
    `);
    // Merge with in-memory progress for active downloads
    const enriched = rows.map(row => {
      const active = activeDownloads.get(row.id);
      if (active) {
        return { ...row, ...active };
      }
      return row;
    });
    res.json(enriched);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get download progress (for polling)
app.get('/api/downloads/:id/progress', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM downloads WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Download not found' });
    
    const active = activeDownloads.get(parseInt(id));
    if (active) {
      return res.json({ ...rows[0], ...active });
    }
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Queue a new download
app.post('/api/downloads/queue', async (req, res) => {
  const { content_type, content_id, title, parent_title, parent_id, thumbnail_url, metadata } = req.body;
  try {
    // Check if already exists
    const [existing] = await pool.query(
      'SELECT * FROM downloads WHERE content_type = ? AND content_id = ?',
      [content_type, content_id]
    );
    
    if (existing.length > 0) {
      const dl = existing[0];
      if (dl.status === 'completed') {
        return res.status(400).json({ error: 'Already downloaded' });
      }
      if (dl.status === 'downloading' || dl.status === 'pending') {
        return res.status(400).json({ error: 'Already in queue', download: dl });
      }
      // If failed or cancelled, allow re-queue by updating status
      await pool.query(
        'UPDATE downloads SET status = "pending", error_message = NULL, progress = 0, downloaded_bytes = 0 WHERE id = ?',
        [dl.id]
      );
      return res.json({ id: dl.id, message: 'Re-queued for download' });
    }
    
    const [result] = await pool.query(
      `INSERT INTO downloads (content_type, content_id, title, parent_title, parent_id, thumbnail_url, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [content_type, content_id, title, parent_title, parent_id, thumbnail_url, JSON.stringify(metadata || {})]
    );
    
    res.json({ id: result.insertId, message: 'Added to download queue' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Cancel a download
app.post('/api/downloads/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      'UPDATE downloads SET status = "cancelled" WHERE id = ? AND status IN ("pending", "downloading")',
      [id]
    );
    activeDownloads.delete(parseInt(id));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Retry a failed download
app.post('/api/downloads/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      'UPDATE downloads SET status = "pending", error_message = NULL, progress = 0, downloaded_bytes = 0 WHERE id = ? AND status IN ("failed", "cancelled")',
      [id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Clear completed/failed downloads
app.delete('/api/downloads/clear', async (req, res) => {
  try {
    const { status } = req.query; // 'completed', 'failed', 'all'
    if (status === 'all') {
      await pool.query('DELETE FROM downloads WHERE status IN ("completed", "failed", "cancelled")');
    } else if (status) {
      await pool.query('DELETE FROM downloads WHERE status = ?', [status]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete individual download
app.delete('/api/downloads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM downloads WHERE id = ? AND status IN ("completed", "failed", "cancelled")', [id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Process downloads (called by frontend or can be automated)
app.post('/api/downloads/process', async (req, res) => {
  try {
    // Get next pending download
    const [pending] = await pool.query(
      'SELECT * FROM downloads WHERE status = "pending" ORDER BY created_at ASC LIMIT 1'
    );
    
    if (pending.length === 0) {
      return res.json({ message: 'No pending downloads' });
    }
    
    const download = pending[0];
    const downloadId = download.id;
    
    // Mark as downloading
    await pool.query(
      'UPDATE downloads SET status = "downloading", started_at = NOW() WHERE id = ?',
      [downloadId]
    );
    
    // Start download based on content type
    if (download.content_type === 'manga_chapter') {
      // Process manga chapter download
      processMangaChapterDownload(download).catch(err => {
        console.error('Download failed:', err);
      });
    }
    
    res.json({ message: 'Download started', download });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Helper function to process manga chapter download with progress tracking
async function processMangaChapterDownload(download) {
  const downloadId = download.id;
  const metadata = typeof download.metadata === 'string' ? JSON.parse(download.metadata) : download.metadata;
  const { mangaId, chapterNum, thumbnailUrl } = metadata;
  const chapterId = download.content_id;
  
  try {
    const safeChapterNum = chapterNum ? String(chapterNum).replace(/[^0-9.]/g, '') : '0';
    const mangaDir = path.join(mangaUploadDir, mangaId);
    
    // Check if already exists
    if (fs.existsSync(mangaDir)) {
      const existingFiles = fs.readdirSync(mangaDir).filter(f => f.endsWith('.cbz'));
      const exists = existingFiles.some(f => {
        const numMatches = f.match(/chapter_([\d.]+)/);
        const existingNum = numMatches ? parseFloat(numMatches[1]).toString() : null;
        return existingNum === parseFloat(safeChapterNum).toString();
      });
      if (exists) {
        await pool.query(
          'UPDATE downloads SET status = "completed", progress = 100, completed_at = NOW() WHERE id = ?',
          [downloadId]
        );
        activeDownloads.delete(downloadId);
        return;
      }
    }
    
    // Get chapter pages from MangaDex
    const resHash = await axiosInstance.get(`https://api.mangadex.org/at-home/server/${chapterId}`);
    const { baseUrl, chapter } = resHash.data;
    const pageUrls = chapter.data.map(file => `${baseUrl}/data/${chapter.hash}/${file}`);
    
    const totalPages = pageUrls.length;
    let downloadedBytes = 0;
    let totalBytes = 0;
    
    // Estimate total size (rough estimate based on typical manga page sizes)
    totalBytes = totalPages * 500000; // ~500KB per page estimate
    
    await pool.query('UPDATE downloads SET total_bytes = ? WHERE id = ?', [totalBytes, downloadId]);
    
    const zip = new AdmZip();
    
    for (let i = 0; i < pageUrls.length; i++) {
      // Check if cancelled
      const [current] = await pool.query('SELECT status FROM downloads WHERE id = ?', [downloadId]);
      if (current.length === 0 || current[0].status === 'cancelled') {
        activeDownloads.delete(downloadId);
        return;
      }
      
      const pageRes = await axiosInstance.get(pageUrls[i], { responseType: 'arraybuffer' });
      const pageData = Buffer.from(pageRes.data);
      downloadedBytes += pageData.length;
      
      const ext = path.extname(pageUrls[i]) || '.jpg';
      const fileName = `page_${String(i).padStart(3, '0')}${ext}`;
      zip.addFile(fileName, pageData);
      
      // Update progress
      const progress = Math.round(((i + 1) / totalPages) * 100);
      activeDownloads.set(downloadId, {
        progress,
        downloaded_bytes: downloadedBytes,
        total_bytes: Math.max(totalBytes, downloadedBytes),
        current_page: i + 1,
        total_pages: totalPages
      });
      
      // Update DB periodically (every 5 pages or last page)
      if (i % 5 === 0 || i === totalPages - 1) {
        await pool.query(
          'UPDATE downloads SET progress = ?, downloaded_bytes = ?, total_bytes = ? WHERE id = ?',
          [progress, downloadedBytes, Math.max(totalBytes, downloadedBytes), downloadId]
        );
      }
    }
    
    // Save the CBZ file
    if (!fs.existsSync(mangaDir)) fs.mkdirSync(mangaDir, { recursive: true });
    
    const filename = `chapter_${safeChapterNum.padStart(4, '0')}_${Date.now()}.cbz`;
    const dest = path.join(mangaDir, filename);
    zip.writeZip(dest);
    
    // Update/create manga entry in books table
    const [existing] = await pool.query('SELECT * FROM books WHERE source_url = ?', [mangaId]);
    
    let localThumb = null;
    if (thumbnailUrl) {
      const ext = path.extname(thumbnailUrl.split('?')[0]) || '.jpg';
      const thumbFilename = `thumb-manga-${mangaId}${ext}`;
      const thumbDest = path.join(thumbUploadDir, thumbFilename);
      try {
        if (!fs.existsSync(thumbDest)) {
          await downloadFile(thumbnailUrl, thumbDest);
        }
        localThumb = `/uploads/thumbnails/${thumbFilename}`;
      } catch (e) { console.error('Thumb dl failed', e.message); }
    }
    
    if (existing.length === 0) {
      await pool.query(
        'INSERT INTO books (title, author, type, source, source_url, thumbnail_url) VALUES (?, ?, ?, ?, ?, ?)',
        [download.parent_title, 'MangaDex Archive', 'manga', 'local', mangaId, localThumb]
      );
    } else {
      await pool.query(
        'UPDATE books SET source = "local", type = "manga", thumbnail_url = COALESCE(?, thumbnail_url) WHERE source_url = ?',
        [localThumb, mangaId]
      );
    }
    
    // Mark as completed
    await pool.query(
      'UPDATE downloads SET status = "completed", progress = 100, downloaded_bytes = ?, total_bytes = ?, completed_at = NOW() WHERE id = ?',
      [downloadedBytes, downloadedBytes, downloadId]
    );
    activeDownloads.delete(downloadId);
    
  } catch (err) {
    console.error('Download error:', err);
    await pool.query(
      'UPDATE downloads SET status = "failed", error_message = ? WHERE id = ?',
      [err.message, downloadId]
    );
    activeDownloads.delete(downloadId);
  }
}

app.listen(PORT, '0.0.0.0', () => console.log(`Archive Pulse running on http://127.0.0.1:${PORT}`));
