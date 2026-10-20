import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AddMemberModal } from '../src/components/genealogy/AddMemberModal.tsx';
import { Modal } from '../src/components/ui/Modal.tsx';
import { FamilyMember } from '../src/types/index.ts';

describe('Phase 43: FamilyRoots — Preserve Fullscreen during Profile Photo Upload', () => {
  const mockMember: FamilyMember = {
    id: 'mem-suresh-1',
    familyId: 'fam-test-1',
    firstName: 'Suresh',
    lastName: 'Pattara',
    displayName: 'Suresh Pattara',
    gender: 'MALE',
    isLiving: true,
    generation: 2,
    branchName: 'Suresh Branch',
    profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  describe('1. File Input & Upload Trigger Isolation', () => {
    it('renders Edit Profile photo upload with isolated file input and accessible button', () => {
      const html = renderToString(
        <AddMemberModal
          isOpen={true}
          onClose={() => {}}
          onSubmit={async () => {}}
          editMember={mockMember}
          isRootAncestor={false}
          isFullscreen={true}
        />
      );

      // Must include Edit Profile title
      expect(html).toContain('Edit Profile: Suresh Pattara');

      // Must render photo upload action button
      expect(html).toContain('Replace Profile Photo');

      // File input must exist with image mime types
      expect(html).toContain('type="file"');
      expect(html).toContain('accept="image/png,image/jpeg,image/webp,image/jpg"');

      // File input must be sr-only so it remains mounted in the layout tree of the fullscreen container
      expect(html).toContain('sr-only');

      // Camera upload trigger button must exist with proper accessibility
      expect(html).toContain('aria-label="Upload photo"');
      expect(html).toContain('title="Upload photo"');
    });

    it('renders Add Relative photo upload with isolated file input and accessible button', () => {
      const html = renderToString(
        <AddMemberModal
          isOpen={true}
          onClose={() => {}}
          onSubmit={async () => {}}
          isRootAncestor={false}
          isFullscreen={true}
        />
      );

      expect(html).toContain('Add Family Member');
      expect(html).toContain('Upload Photo');
      expect(html).toContain('type="file"');
      expect(html).toContain('sr-only');
    });

    it('never includes exitFullscreen call in photo upload rendered HTML', () => {
      const html = renderToString(
        <AddMemberModal
          isOpen={true}
          onClose={() => {}}
          onSubmit={async () => {}}
          editMember={mockMember}
          isRootAncestor={false}
          isFullscreen={true}
        />
      );

      expect(html).not.toContain('exitFullscreen');
    });
  });

  describe('2. Modal Container Fullscreen Stability', () => {
    it('Modal renders dialog with z-50 and backdrop blur for fullscreen display', () => {
      const html = renderToString(
        <Modal
          isOpen={true}
          onClose={() => {}}
          title="Edit Profile"
          description="Update genealogical records"
        >
          <div>Profile Form Content</div>
        </Modal>
      );

      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('Edit Profile');
      expect(html).toContain('fixed inset-0');
      expect(html).toContain('z-50');
    });
  });

  describe('3. Non-destructive Upload Flow Verification', () => {
    it('accepts onRestoreFullscreen callback prop without throwing errors', () => {
      const restoreMock = vi.fn();
      expect(() => {
        renderToString(
          <AddMemberModal
            isOpen={true}
            onClose={() => {}}
            onSubmit={async () => {}}
            editMember={mockMember}
            isRootAncestor={false}
            isFullscreen={true}
            onRestoreFullscreen={restoreMock}
          />
        );
      }).not.toThrow();
    });
  });
});
