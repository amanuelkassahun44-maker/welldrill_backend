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
let cachedDrillers: any[] = [
  {
    id: 'driller_abyssinia',
    companyName: 'አቢሲኒያ የጥልቅ ውሃ ቁፋሮ (Abyssinia Drilling)',
    name: 'አቢሲኒያ የጥልቅ ውሃ ቁፋሮ',
    phone: '0911223344',
    realPhone: '0911223344',
    regionName: 'አዲስ አበባ',
    location: 'አዲስ አበባ (Addis Ababa)',
    rigTypes: 'DTH Pneumatic Heavy Rig',
    maxDepthMeters: 350,
    pricePerMeterMin: 8000.0,
    pricePerMeterMax: 14000.0,
    rating: 4.9,
    reviewCount: 24,
    isVerified: true,
    photoUrl: null,
    reviews: [
      { user: 'ዳዊት ከለቡ', rating: 5, comment: 'በጣም ፈጣን እና ታማኝ ናቸው! በ 4 ቀን ውስጥ 180 ሜትር ቆፍረው ጨረሱልኝ።' },
    ],
  },
  {
    id: 'driller_rift_valley',
    companyName: 'ሪፍት ቫሊ ግራውንድ ዋተር (Rift Valley Water)',
    name: 'ሪፍት ቫሊ ግራውንድ ዋተር',
    phone: '0922334455',
    realPhone: '0922334455',
    regionName: 'ኦሮሚያ',
    location: 'ኦሮሚያ (Oromia)',
    rigTypes: 'Truck Mounted Hydraulic Rig',
    maxDepthMeters: 280,
    pricePerMeterMin: 8500.0,
    pricePerMeterMax: 13000.0,
    rating: 4.8,
    reviewCount: 18,
    isVerified: true,
    photoUrl: null,
    reviews: [
      { user: 'አቶ በቀለ', rating: 5, comment: 'አዳማ አቅራቢያ ጥሩ ውሃ አውጥተውልናል። ዋጋቸውም ተመጣጣኝ ነው።' },
    ],
  },
  {
    id: 'driller_blue_nile',
    companyName: 'ዓባይ ጥልቅ ቦርሃል ሰርቪስ (Blue Nile Deep Wells)',
    name: 'ዓባይ ጥልቅ ቦርሃል ሰርቪስ',
    phone: '0933445566',
    realPhone: '0933445566',
    regionName: 'አማራ',
    location: 'አማራ (Amhara)',
    rigTypes: 'Rotary Drilling Rig',
    maxDepthMeters: 400,
    pricePerMeterMin: 9000.0,
    pricePerMeterMax: 15000.0,
    rating: 5.0,
    reviewCount: 31,
    isVerified: true,
    photoUrl: null,
    reviews: [
      { user: 'ማርታ ከባህር ዳር', rating: 5, comment: 'ባለሙያዎቻቸው እጅግ ጎበዞች ናቸው።' },
    ],
  },
  {
    id: 'driller_awash',
    companyName: 'አዋሽ ሃይድሮ ቁፋሮ (Awash Hydro Drilling)',
    name: 'አዋሽ ሃይድሮ ቁፋሮ',
    phone: '0944556677',
    realPhone: '0944556677',
    regionName: 'ድሬ ዳዋ',
    location: 'ድሬ ዳዋ (Dire Dawa)',
    rigTypes: 'DTH & Mud Rotary Rig',
    maxDepthMeters: 300,
    pricePerMeterMin: 8000.0,
    pricePerMeterMax: 14000.0,
    rating: 4.7,
    reviewCount: 14,
    isVerified: true,
    photoUrl: null,
    reviews: [],
  },
  {
    id: 'driller_tigray',
    companyName: 'ሰላም የውሃ ቁፋሮ (Selam Water Drilling)',
    name: 'ሰላም የውሃ ቁፋሮ',
    phone: '0955667788',
    realPhone: '0955667788',
    regionName: 'ትግራይ',
    location: 'ትግራይ (Tigray)',
    rigTypes: 'Trailer Mounted Rig',
    maxDepthMeters: 250,
    pricePerMeterMin: 8500.0,
    pricePerMeterMax: 12500.0,
    rating: 4.9,
    reviewCount: 9,
    isVerified: true,
    photoUrl: null,
    reviews: [],
  },
  {
    id: 'driller_sidama',
    companyName: 'ሀዋሳ ቦርሃል ቁፋሮ (Hawassa Borehole Tech)',
    name: 'ሀዋሳ ቦርሃል ቁፋሮ',
    phone: '0966778899',
    realPhone: '0966778899',
    regionName: 'ሲዳማ',
    location: 'ሲዳማ (Sidama)',
    rigTypes: 'Hydraulic DTH Rig',
    maxDepthMeters: 220,
    pricePerMeterMin: 8000.0,
    pricePerMeterMax: 13500.0,
    rating: 4.8,
    reviewCount: 11,
    isVerified: true,
    photoUrl: null,
    reviews: [],
  },
];
let cachedSupportMessages: any[] = [];

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
    drillers: cachedDrillers,
    support_messages: cachedSupportMessages,
  });
});

// Anti-circumvention phone & social patterns for feed posts & comments
const PHONE_PATTERN = /(\+?251[-. ]?)?(0?[97]\d[-. ]?\d{3}[-. ]?\d{4})|\b0[97]\d{8}\b|\b\d[\d\s\-.]{7,14}\d\b|(ደውሉ|ቁጥሬ|ቁጥሩ|ቁጥሯ|ስልኬ|ስልክ|call\s*me|my\s*phone|contact\s*me)[\s:]*[\d\s\-+]{5,}/gi;
const SOCIAL_PATTERN = /(t\.me\/|telegram|ቴሌግራም|wa\.me\/|whatsapp|ዋትሳፕ|facebook|ፌስቡክ|fb\.me|tiktok|ቲክቶክ|instagram|ኢንስታግራም|viber|ቫይበር|imo|ኢሞ|@[a-zA-Z0-9_\.]{3,})/gi;

function sanitizeFeedText(text: string): string {
  if (!text) return '';
  return text.replace(PHONE_PATTERN, '[***]').replace(SOCIAL_PATTERN, '[***]');
}

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

    // Anti-circumvention text check & sanitization
    if (reel.caption) {
      reel.caption = sanitizeFeedText(reel.caption);
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

    // If imageBase64 is passed (Photo Post), save to disk
    if (reel.imageBase64 && typeof reel.imageBase64 === 'string' && reel.imageBase64.length > 50) {
      try {
        const ext = reel.imageExtension || '.jpg';
        const filename = `feed_img_${Date.now()}_${uuidv4().substring(0, 8)}${ext}`;
        const filePath = path.join(uploadsDir, filename);
        const cleanBase64 = reel.imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        fs.writeFileSync(filePath, buffer);
        reel.imagePath = `${getBaseUrl(req)}/uploads/${filename}`;
        delete reel.imageBase64;
      } catch (e) {
        console.error('Failed to save base64 feed image:', e);
      }
    }

    // Check if reel already exists (e.g. for likes/comments update)
    const existingIndex = cachedReels.findIndex((r) => r.id === reel.id);
    if (existingIndex >= 0) {
      cachedReels[existingIndex] = { ...cachedReels[existingIndex], ...reel };
    } else {
      cachedReels.unshift(reel);
    }
    if (cachedReels.length > 200) cachedReels = cachedReels.slice(0, 200);

    return res.status(201).json({ success: true, reel });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/ecosystem/reels/:id/like
router.post('/reels/:id/like', (req: Request, res: Response) => {
  const { id } = req.params;
  const target = cachedReels.find((r) => r.id === id);
  if (!target) return res.status(404).json({ error: 'Reel not found' });
  const delta = req.body.delta ?? 1;
  target.likesCount = Math.max(0, (target.likesCount || 0) + delta);
  return res.json({ success: true, likesCount: target.likesCount });
});

// POST /api/ecosystem/reels/:id/comment
router.post('/reels/:id/comment', (req: Request, res: Response) => {
  const { id } = req.params;
  const { author, text } = req.body;
  const target = cachedReels.find((r) => r.id === id);
  if (!target) return res.status(404).json({ error: 'Reel not found' });
  if (!text || !text.trim()) return res.status(400).json({ error: 'Empty comment' });

  const cleanText = sanitizeFeedText(text.trim());
  target.comments = target.comments || [];
  const commentObj = {
    id: `c_${Date.now()}`,
    author: author || 'User',
    text: cleanText,
    createdAt: new Date().toISOString(),
  };
  target.comments.push(commentObj);
  return res.json({ success: true, comment: commentObj, totalComments: target.comments.length });
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

// GET /api/ecosystem/drillers
router.get('/drillers', (_req: Request, res: Response) => {
  res.json(cachedDrillers);
});

// POST /api/ecosystem/drillers
router.post('/drillers', (req: Request, res: Response) => {
  try {
    const driller = req.body;
    if (!driller || !driller.id) {
      return res.status(400).json({ error: 'Invalid driller data' });
    }

    // Save profile photo if imageBase64 is passed
    if (driller.imageBase64 && typeof driller.imageBase64 === 'string' && driller.imageBase64.length > 50) {
      try {
        const ext = driller.imageExtension || '.jpg';
        const filename = `driller_${Date.now()}_${uuidv4().substring(0, 8)}${ext}`;
        const filePath = path.join(uploadsDir, filename);
        const cleanBase64 = driller.imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        fs.writeFileSync(filePath, buffer);
        driller.photoUrl = `${getBaseUrl(req)}/uploads/${filename}`;
        delete driller.imageBase64;
      } catch (e) {
        console.error('Failed to save driller base64 image:', e);
      }
    }

    cachedDrillers = cachedDrillers.filter((d) => d.id !== driller.id && d.phone !== driller.phone);
    cachedDrillers.unshift(driller);
    if (cachedDrillers.length > 300) cachedDrillers = cachedDrillers.slice(0, 300);
    return res.status(201).json({ success: true, driller });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/ecosystem/support
router.get('/support', (_req: Request, res: Response) => {
  res.json(cachedSupportMessages);
});

// POST /api/ecosystem/support
router.post('/support', (req: Request, res: Response) => {
  try {
    const msg = req.body;
    if (!msg || !msg.id) {
      return res.status(400).json({ error: 'Invalid support message data' });
    }

    // Handle attached screenshot/photo
    if (msg.imageBase64 && typeof msg.imageBase64 === 'string' && msg.imageBase64.length > 50) {
      try {
        const ext = msg.imageExtension || '.jpg';
        const filename = `support_${Date.now()}_${uuidv4().substring(0, 8)}${ext}`;
        const filePath = path.join(uploadsDir, filename);
        const cleanBase64 = msg.imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        fs.writeFileSync(filePath, buffer);
        msg.imagePath = `${getBaseUrl(req)}/uploads/${filename}`;
        delete msg.imageBase64;
      } catch (e) {
        console.error('Failed to save support base64 image:', e);
      }
    }

    cachedSupportMessages = cachedSupportMessages.filter((m) => m.id !== msg.id);
    cachedSupportMessages.push(msg); // Keep chronological order
    if (cachedSupportMessages.length > 500) cachedSupportMessages = cachedSupportMessages.slice(-500);
    return res.status(201).json({ success: true, message: msg });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export { router as ecosystemRouter };
