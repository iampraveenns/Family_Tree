import { Router } from 'express';
import { changeProposalController } from '../controllers/changeProposalController.ts';
import { requireAuthentication, requireFamilyMembership } from '../middleware/auth.ts';

const router = Router({ mergeParams: true });

// Propose a change
router.post(
  '/',
  requireAuthentication,
  requireFamilyMembership,
  (req, res, next) => changeProposalController.createProposal(req, res, next)
);

// Get list of proposals
router.get(
  '/',
  requireAuthentication,
  requireFamilyMembership,
  (req, res, next) => changeProposalController.getProposals(req, res, next)
);

// Approve proposal
router.post(
  '/:proposalId/approve',
  requireAuthentication,
  requireFamilyMembership,
  (req, res, next) => changeProposalController.approveProposal(req, res, next)
);

// Reject proposal
router.post(
  '/:proposalId/reject',
  requireAuthentication,
  requireFamilyMembership,
  (req, res, next) => changeProposalController.rejectProposal(req, res, next)
);

export default router;
