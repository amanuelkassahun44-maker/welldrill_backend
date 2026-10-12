import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for video/images
});

// In-memory cache for fast broadcast & resilient fallback
let cachedReels: any[] = [];
let cachedListings: any[] = [];
let cachedJobs: any[] = [];

// Base URL helper
function getBaseUrl(req: Request): string {
  const host = req.get('host') || 'welldrill-backend.onrender.com';
  const proto = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  return `${proto}://${host}`;
}

// Upload file directly
router.post('/upload', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }
  const fileUrl = `${getBaseUrl(req)}/uploads/${req.file.filename}`;
  return res.json({ success: true, url: fileUrl, filename: req.file.filename });
});

// GET /api/ecosystem/all
router.get('/all', (_req: Request, res: Response) => {
  res.json({
    reels: cachedReels,
    listings: cachedListings,
    jobs: cachedJobs,
  });
});

// GET /api/ecosystem/reels
router.get('/reels', (_req: Request, res: Response) => {
  res.json(cachedReels);
});

// POST /api/ecosystem/reels
router.post('/reels', (req: Request, res: Response) => {
  try {
    const reel = req.body;
    if (!reel || !reel.id) {
      return res.status(400).json({ error: 'Invalid reel data' });
    }

    // If videoBase64 is passed, save to disk
    if (reel.videoBase64 && typeof reel.videoBase64 === 'string' && reel.videoBase64.length > 50) {
      try {
        const ext = reel.videoExtension || '.mp4';
        const filename = `reel_${Date.now()}_${uuidv4().substring(0, 8)}${ext}`;
        const filePath = path.join(uploadsDir, filename);
        const cleanBase64 = reel.videoBase64.replace(/^data:video\/\w+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        fs.writeFileSync(filePath, buffer);
        reel.videoPath = `${getBaseUrl(req)}/uploads/${filename}`;
        delete reel.videoBase64;
      } catch (e) {
        console.error('Failed to save base64 video:', e);
      }
    }

    // Remove existing if duplicate
    cachedReels = cachedReels.filter((r) => r.id !== reel.id);
    cachedReels.unshift(reel);
    if (cachedReels.length > 200) cachedReels = cachedReels.slice(0, 200);

    return res.status(201).json({ success: true, reel });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/ecosystem/listings
router.get('/listings', (_req: Request, res: Response) => {
  res.json(cachedListings);
});

// POST /api/ecosystem/listings
router.post('/listings', (req: Request, res: Response) => {
  try {
    const listing = req.body;
    if (!listing || !listing.id) {
      return res.status(400).json({ error: 'Invalid listing data' });
    }

    // If imageBase64 is passed, save to disk
    if (listing.imageBase64 && typeof listing.imageBase64 === 'string' && listing.imageBase64.length > 50) {
      try {
        const ext = listing.imageExtension || '.jpg';
        const filename = `item_${Date.now()}_${uuidv4().substring(0, 8)}${ext}`;
        const filePath = path.join(uploadsDir, filename);
        const cleanBase64 = listing.imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        fs.writeFileSync(filePath, buffer);
        listing.imagePath = `${getBaseUrl(req)}/uploads/${filename}`;
        delete listing.imageBase64;
      } catch (e) {
        console.error('Failed to save base64 image:', e);
      }
    }

    // Remove existing if duplicate
    cachedListings = cachedListings.filter((l) => l.id !== listing.id);
    cachedListings.unshift(listing);
    if (cachedListings.length > 200) cachedListings = cachedListings.slice(0, 200);

    return res.status(201).json({ success: true, listing });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/ecosystem/jobs
router.get('/jobs', (_req: Request, res: Response) => {
  res.json(cachedJobs);
});

// POST /api/ecosystem/jobs
router.post('/jobs', (req: Request, res: Response) => {
  try {
    const job = req.body;
    if (!job || !job.id) {
      return res.status(400).json({ error: 'Invalid job data' });
    }
    cachedJobs = cachedJobs.filter((j) => j.id !== job.id);
    cachedJobs.unshift(job);
    if (cachedJobs.length > 200) cachedJobs = cachedJobs.slice(0, 200);
    return res.status(201).json({ success: true, job });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export { router as ecosystemRouter };
