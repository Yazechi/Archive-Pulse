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
  destination: (req, file, cb) => cb(null, file.fieldname === 'music' ? musicUploadDir : booksUploadDir),
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
    
    // Migrations
    try { await conn.query('ALTER TABLE books ADD COLUMN last_cfi VARCHAR(255)'); } catch (e) {}
    try { await conn.query('ALTER TABLE books MODIFY COLUMN last_page VARCHAR(255)'); } catch (e) {}
    try { await conn.query('ALTER TABLE books ADD COLUMN last_read_at TIMESTAMP NULL'); } catch (e) {}
    try { await conn.query('ALTER TABLE books ADD COLUMN series_id INT NULL'); } catch (e) {}
    try { await conn.query('ALTER TABLE books ADD COLUMN volume_number FLOAT NULL'); } catch (e) {}

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

app.post('/api/upload/music', upload.single('music'), async (req, res) => {
  try {
    const { title, artist } = req.body;
    const filePath = req.file.path;
    
    // Auto-extract metadata
    const meta = await extractMusicMetadata(filePath);
    
    await pool.query(
      'INSERT INTO songs (title, artist, album, duration, source, source_id, thumbnail_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        title || meta?.title || req.file.originalname, 
        artist || meta?.artist || 'Unknown', 
        meta?.album || 'Unknown',
        meta?.duration || 'N/A',
        'local', 
        req.file.filename,
        meta?.thumbnail_url || null
      ]
    );
    res.json({ success: true });
  } catch (err) { 
    console.error('Music upload error:', err.message);
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

app.post('/api/upload/book', upload.single('book'), async (req, res) => {
  try {
    const { title, author, type, series_id, volume_number } = req.body;
    const filename = req.file.filename;
    const filePath = req.file.path;
    let thumbnail_url = null;

    if (filename.toLowerCase().endsWith('.epub')) {
      thumbnail_url = await extractEpubCover(filePath, filename);
    } else if (filename.toLowerCase().endsWith('.cbz')) {
      thumbnail_url = await extractCbzCover(filePath, filename);
    }

    await pool.query(
      'INSERT INTO books (title, author, type, source, source_url, thumbnail_url, series_id, volume_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        title || req.file.originalname, 
        author || 'Unknown', 
        type || 'book', 
        'local', 
        filename, 
        thumbnail_url,
        series_id ? parseInt(series_id) : null,
        volume_number ? parseFloat(volume_number) : null
      ]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/books/search', async (req, res) => {
  const { q, type } = req.query;
  try {
    if (type === 'manga') {
      const mdResults = await searchMangaDex(q || 'popular');
      return res.json(mdResults);
    }
    const gtResults = await searchFreeNovels(q);
    const olResults = await searchOpenLibrary(q);
    
    // Merge and interleave results for better variety
    const merged = [];
    const maxLength = Math.max(gtResults.length, olResults.length);
    for (let i = 0; i < maxLength; i++) {
      if (i < gtResults.length) merged.push(gtResults[i]);
      if (i < olResults.length) merged.push(olResults[i]);
    }
    res.json(merged);
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
  const { progress, last_page, total_pages, last_cfi } = req.body;
  
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

app.get('/api/books/:id/highlights', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT id, book_id, format, locator, text_excerpt, color, created_at FROM book_highlights WHERE book_id = ? ORDER BY created_at DESC',
      [id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/books/:id/highlights', async (req, res) => {
  const { id } = req.params;
  const { format, locator, text_excerpt, color } = req.body;

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
      'INSERT INTO book_highlights (book_id, format, locator, text_excerpt, color) VALUES (?, ?, ?, ?, ?)',
      [id, format, normalizedLocator, normalizedText, normalizedColor]
    );
    const [createdRows] = await pool.query(
      'SELECT id, book_id, format, locator, text_excerpt, color, created_at FROM book_highlights WHERE id = ? LIMIT 1',
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

app.get('/api/stream/:id', (req, res) => {
  const videoId = req.params.id;
  res.header('Content-Type', 'audio/webm');
  res.header('Accept-Ranges', 'bytes');
  res.header('Cache-Control', 'no-store');

  const isExpectedTermination = (err) => {
    if (!err) return false;
    const msg = (err.message || '').toLowerCase();
    const signal = err.signalCode || err.signal;
    return (
      signal === 'SIGTERM' ||
      signal === 'SIGKILL' ||
      msg.includes('aborted') ||
      msg.includes('premature close') ||
      msg.includes('socket hang up')
    );
  };
  
  const startStream = (retryWithEdge = false) => {
    try {
      const options = {
        output: '-',
        format: 'bestaudio/best',
        quiet: true,
        noWarnings: true,
      };

      const browser = retryWithEdge ? 'chrome' : process.env.COOKIES_FROM_BROWSER;
      if (browser) {
        options.cookiesFromBrowser = browser;
      } else if (process.env.YT_COOKIES) {
        options.cookies = process.env.YT_COOKIES;
      }

      const ytdlProcess = youtubedl.exec(`https://www.youtube.com/watch?v=${videoId}`, options);
      let cleanedUp = false;
      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        if (ytdlProcess?.stdout) ytdlProcess.stdout.unpipe(res);
        if (ytdlProcess?.kill) ytdlProcess.kill('SIGTERM');
      };

      ytdlProcess.stdout.pipe(res);

      // youtube-dl-exec returns a thenable that rejects on non-zero exit;
      // consume that rejection so expected SIGTERM does not pollute logs.
      if (typeof ytdlProcess.catch === 'function') {
        ytdlProcess.catch((err) => {
          if (isExpectedTermination(err)) return;
          const errorStr = err?.message || '';
          if (!retryWithEdge && errorStr.includes('Could not copy') && errorStr.includes('cookie')) {
            console.warn('Stream cookies locked, falling back to msedge...');
            cleanup();
            return startStream(true);
          }
          console.error('YTDL Stream Promise Error:', err);
          if (!res.headersSent) res.status(500).end();
        });
      }

      ytdlProcess.on('error', (err) => {
        if (isExpectedTermination(err)) return;
        const errorStr = err?.message || '';
        if (!retryWithEdge && errorStr.includes('Could not copy') && errorStr.includes('cookie')) {
          console.warn('Stream cookies locked, falling back to msedge...');
          cleanup();
          return startStream(true);
        }
        console.error('YTDL Stream Error:', err);
        if (!res.headersSent) res.status(500).end();
      });

      req.on('close', cleanup);
      req.on('aborted', cleanup);
      res.on('close', cleanup);
    } catch (err) {
      console.error('Stream setup error:', err);
      if (!res.headersSent) res.status(500).end();
    }
  };

  startStream();
});

app.listen(PORT, '0.0.0.0', () => console.log(`Archive Pulse running on http://127.0.0.1:${PORT}`));
