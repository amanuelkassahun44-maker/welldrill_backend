import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();
const versionFilePath = path.join(process.cwd(), 'uploads', 'app_version.json');

export interface AppVersionConfig {
  latestVersion: string;
  latestBuildNumber: number;
  minSupportedVersion: string;
  minSupportedBuildNumber: number;
  forceUpdate: boolean;
  releaseNotesAm: string;
  releaseNotesEn: string;
  downloadUrl: string;
  websiteUrl: string;
  titleAm: string;
  titleEn: string;
  updatedAt: string;
}

const defaultVersionConfig: AppVersionConfig = {
  latestVersion: '1.0.0',
  latestBuildNumber: 1,
  minSupportedVersion: '1.0.0',
  minSupportedBuildNumber: 1,
  forceUpdate: false,
  releaseNotesAm: 'አዳዲስ ማሻሻያዎች፣ ፈጣን አሰራር እና አስተማማኝ የደህንነት መጠበቂያዎች ተካተዋል!',
  releaseNotesEn: 'New performance improvements, bug fixes, and enhanced security updates!',
  downloadUrl: 'https://t.me/WaterDrilli',
  websiteUrl: 'https://water-drilling-website.vercel.app/',
  titleAm: '🚀 አዲስ የ WellDrill ስሪት ተለቋል!',
  titleEn: '🚀 New WellDrill Update Available!',
  updatedAt: new Date().toISOString(),
};

export function readVersionConfig(): AppVersionConfig {
  try {
    if (fs.existsSync(versionFilePath)) {
      const data = fs.readFileSync(versionFilePath, 'utf8');
      const parsed = JSON.parse(data);
      return { ...defaultVersionConfig, ...parsed };
    }
  } catch (err) {
    console.error('Error reading version config:', err);
  }
  return defaultVersionConfig;
}

export function writeVersionConfig(config: AppVersionConfig): void {
  try {
    const dir = path.dirname(versionFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(versionFilePath, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing version config:', err);
  }
}

// GET /api/version - Public version check for mobile apps
router.get('/', (_req: Request, res: Response) => {
  const config = readVersionConfig();
  res.json(config);
});

// POST /api/version - Admin or deploy hook to update app version config
router.post('/', (req: Request, res: Response) => {
  try {
    const current = readVersionConfig();
    const body = req.body || {};
    const updated: AppVersionConfig = {
      latestVersion: body.latestVersion || current.latestVersion,
      latestBuildNumber: body.latestBuildNumber !== undefined ? Number(body.latestBuildNumber) : current.latestBuildNumber,
      minSupportedVersion: body.minSupportedVersion || current.minSupportedVersion,
      minSupportedBuildNumber: body.minSupportedBuildNumber !== undefined ? Number(body.minSupportedBuildNumber) : current.minSupportedBuildNumber,
      forceUpdate: body.forceUpdate !== undefined ? Boolean(body.forceUpdate) : current.forceUpdate,
      releaseNotesAm: body.releaseNotesAm || current.releaseNotesAm,
      releaseNotesEn: body.releaseNotesEn || current.releaseNotesEn,
      downloadUrl: body.downloadUrl || current.downloadUrl,
      websiteUrl: body.websiteUrl || current.websiteUrl,
      titleAm: body.titleAm || current.titleAm,
      titleEn: body.titleEn || current.titleEn,
      updatedAt: new Date().toISOString(),
    };
    writeVersionConfig(updated);
    res.json({ success: true, message: 'App version configuration updated', config: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update version config' });
  }
});

export { router as versionRouter };
