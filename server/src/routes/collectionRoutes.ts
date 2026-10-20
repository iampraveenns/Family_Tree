import { Router } from 'express';
import { collectionController } from '../controllers/collectionController.ts';
import { requireAuthentication } from '../middleware/auth.ts';

const router = Router({ mergeParams: true });

router.get('/', requireAuthentication, (req, res, next) => {
  collectionController.getCollections(req, res, next);
});

router.post('/', requireAuthentication, (req, res, next) => {
  collectionController.createCollection(req, res, next);
});

router.get('/:collectionId', requireAuthentication, (req, res, next) => {
  collectionController.getCollectionById(req, res, next);
});

router.patch('/:collectionId', requireAuthentication, (req, res, next) => {
  collectionController.updateCollection(req, res, next);
});

router.delete('/:collectionId', requireAuthentication, (req, res, next) => {
  collectionController.deleteCollection(req, res, next);
});

router.post('/:collectionId/memories', requireAuthentication, (req, res, next) => {
  collectionController.addMemory(req, res, next);
});

router.delete('/:collectionId/memories/:memoryId', requireAuthentication, (req, res, next) => {
  collectionController.removeMemory(req, res, next);
});

export default router;
