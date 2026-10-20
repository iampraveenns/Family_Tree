import { Router } from 'express';
import multer from 'multer';
import { backupController } from '../controllers/backupController.ts';
import {
  requireAuthentication,
  requireFamilyMembership,
  requireFamilyRoles,
} from '../middleware/auth.ts';
import { Role } from '../constants/index.ts';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 150 * 1024 * 1024, // 150MB maximum for family archives
  },
});

const router = Router({ mergeParams: true });

// Enforce authentication, family membership, and Owner/Admin role
router.use(
  requireAuthentication,
  requireFamilyMembership,
  requireFamilyRoles([Role.FAMILY_OWNER, Role.FAMILY_ADMIN])
);

// Archive Export
router.get('/export', (req, res, next) => {
  backupController.exportArchive(req, res, next);
});

// Backup Management
router.get('/backups', (req, res, next) => {
  backupController.listBackups(req, res, next);
});

router.post('/backups', (req, res, next) => {
  backupController.createBackup(req, res, next);
});

router.get('/backups/:backupId/download', (req, res, next) => {
  backupController.downloadBackup(req, res, next);
});

router.delete('/backups/:backupId', (req, res, next) => {
  backupController.deleteBackup(req, res, next);
});

// Restore Workflow
router.post('/restore/validate', upload.single('archive'), (req, res, next) => {
  backupController.validateArchive(req, res, next);
});

router.post('/restore/execute', upload.single('archive'), (req, res, next) => {
  backupController.executeRestore(req, res, next);
});

export default router;
